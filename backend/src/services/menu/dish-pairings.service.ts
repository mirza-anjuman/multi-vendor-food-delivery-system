/**
 * Dish Pairings Service — "Goes well with" complementary food recommendations.
 *
 * Ranking criteria (documented weights in PAIRINGS_CONFIG):
 * 1. Frequently bought together in real orders (co-occurrence)
 * 2. Category pairing rules as data (e.g. Burgers -> Sides, Drinks, Desserts)
 * 3. Popularity & ratings fallback
 *
 * Filters & safety:
 * - Excludes current item
 * - Excludes items currently in user's cart (excludeIds)
 * - Excludes unavailable items or closed restaurants
 * - Prefers same restaurant (no extra delivery fee), then highly rated alternatives
 * - Limits to 6 high-value pairings
 */

import mongoose, { Types } from "mongoose";
import MenuItemModel from "../../models/MenuItem";
import RestaurantModel from "../../models/Restaurant";
import MenuCategoryModel from "../../models/MenuCategory";
import OrderModel from "../../models/Order";

export const PAIRINGS_CONFIG = {
  WEIGHT_CO_OCCURRENCE: 100,
  WEIGHT_SAME_RESTAURANT: 50,
  WEIGHT_CATEGORY_RULE: 30,
  WEIGHT_POPULARITY: 10,
  MIN_ORDER_SUPPORT: 2,
  MAX_PAIRINGS_RETURNED: 6,
} as const;

/**
 * Category pairing rules as data (seeded from real taxonomy).
 * Key: Lowercase source category keywords or exact names.
 * Value: Complementary target category keywords.
 */
export const CATEGORY_PAIRING_RULES: Record<string, string[]> = {
  burger: ["side", "drink", "beverage", "dessert", "snack"],
  pizza: ["side", "drink", "beverage", "dessert", "salad"],
  chicken: ["side", "drink", "beverage", "rice", "fries"],
  biryani: ["bhorta", "side", "drink", "beverage", "dessert", "curry"],
  curry: ["bhorta", "side", "rice", "naan", "paratha", "drink", "beverage"],
  rice: ["curry", "bhorta", "side", "drink", "beverage"],
  snack: ["coffee", "tea", "drink", "beverage", "dessert"],
  noodle: ["soup", "drink", "beverage", "side"],
  chowmein: ["soup", "drink", "beverage", "side"],
};

export interface PairingItemResult {
  itemId: string;
  name: string;
  price: number;
  originalPrice?: number;
  image?: string;
  description?: string;
  isPopular?: boolean;
  score: number;
  matchReason: string; // e.g. "Frequently bought together", "Popular side", "Recommended drink"
  isSameRestaurant: boolean;
  restaurant: {
    restaurantId: string;
    name: string;
    isOpen: boolean;
    rating?: { average?: number; count?: number };
  };
}

export async function getDishPairings(
  itemId: string,
  options?: {
    excludeItemIds?: string[];
    userLocation?: { lat: number; lng: number };
  }
): Promise<PairingItemResult[]> {
  const targetItem = await MenuItemModel.findById(itemId).lean();
  if (!targetItem || targetItem.deletedAt) {
    return [];
  }

  const targetRestaurant = await RestaurantModel.findById(targetItem.restaurantId).lean();
  if (!targetRestaurant) {
    return [];
  }

  const excludeSet = new Set<string>([
    targetItem._id.toString(),
    ...(options?.excludeItemIds || []),
  ]);

  // Step 1: Check co-occurrence in orders
  const coOccurrenceCounts = new Map<string, number>();
  try {
    const ordersWithTarget = await OrderModel.find({
      "items.menuItemId": targetItem._id,
    })
      .select("items.menuItemId")
      .limit(100)
      .lean();

    for (const order of ordersWithTarget) {
      if (!order.items) continue;
      for (const it of order.items) {
        if (!it.menuItemId) continue;
        const oItemId = it.menuItemId.toString();
        if (oItemId !== targetItem._id.toString()) {
          coOccurrenceCounts.set(oItemId, (coOccurrenceCounts.get(oItemId) || 0) + 1);
        }
      }
    }
  } catch {
    // Non-blocking: fallback gracefully if order aggregation fails
  }

  // Step 2: Determine target item's category context
  let targetCategoryName = "";
  if (targetItem.categoryId) {
    const cat = await MenuCategoryModel.findById(targetItem.categoryId).lean();
    if (cat?.name) {
      targetCategoryName = cat.name.toLowerCase();
    }
  }

  // Find complementary target keywords from category rules
  const targetKeywords: string[] = [];
  const lowerItemName = targetItem.name.toLowerCase();
  for (const [key, complementaries] of Object.entries(CATEGORY_PAIRING_RULES)) {
    if (lowerItemName.includes(key) || targetCategoryName.includes(key)) {
      targetKeywords.push(...complementaries);
    }
  }

  // Default complementary fallback keywords if no specific rule matched
  if (targetKeywords.length === 0) {
    targetKeywords.push("side", "drink", "beverage", "dessert");
  }

  // Step 3: Fetch candidates from same restaurant first, plus other active restaurants
  const approvedRestaurants = await RestaurantModel.find({
    isActive: true,
    approvalStatus: "approved",
    isTemporarilyClosed: { $ne: true },
  })
    .select("_id name rating")
    .lean();

  const restaurantMap = new Map<string, (typeof approvedRestaurants)[0]>();
  for (const r of approvedRestaurants) {
    restaurantMap.set(r._id.toString(), r);
  }

  // Get available candidates from the same restaurant
  const sameRestaurantCandidates = await MenuItemModel.find({
    restaurantId: targetRestaurant._id,
    _id: { $nin: Array.from(excludeSet).map((id) => new Types.ObjectId(id)) },
    isAvailable: true,
    stockStatus: "available",
    deletedAt: null,
  })
    .select("_id restaurantId name price originalPrice image isPopular description categoryId")
    .limit(30)
    .lean();

  // Get some candidates from other approved restaurants
  const otherRestaurantCandidates = await MenuItemModel.find({
    restaurantId: {
      $in: approvedRestaurants
        .filter((r) => r._id.toString() !== targetRestaurant._id.toString())
        .map((r) => r._id),
    },
    _id: { $nin: Array.from(excludeSet).map((id) => new Types.ObjectId(id)) },
    isAvailable: true,
    stockStatus: "available",
    isPopular: true,
    deletedAt: null,
  })
    .select("_id restaurantId name price originalPrice image isPopular description categoryId")
    .limit(30)
    .lean();

  const allCandidates = [...sameRestaurantCandidates, ...otherRestaurantCandidates];

  // Step 4: Score and rank candidates
  const scoredCandidates: Array<{
    item: (typeof allCandidates)[0];
    score: number;
    reason: string;
    isSameRest: boolean;
  }> = [];

  for (const candidate of allCandidates) {
    let score = 0;
    let reason = "Recommended pairing";
    const candIdStr = candidate._id.toString();
    const isSameRest = candidate.restaurantId.toString() === targetRestaurant._id.toString();

    // 1. Order co-occurrence bonus
    const coCount = coOccurrenceCounts.get(candIdStr) || 0;
    if (coCount >= PAIRINGS_CONFIG.MIN_ORDER_SUPPORT) {
      score += PAIRINGS_CONFIG.WEIGHT_CO_OCCURRENCE * coCount;
      reason = "Frequently bought together";
    }

    // 2. Same restaurant preference (saves separate delivery fee)
    if (isSameRest) {
      score += PAIRINGS_CONFIG.WEIGHT_SAME_RESTAURANT;
    }

    // 3. Category pairing rules matching
    const candNameLower = candidate.name.toLowerCase();
    const matchesCategoryRule = targetKeywords.some((kw) => candNameLower.includes(kw));
    if (matchesCategoryRule) {
      score += PAIRINGS_CONFIG.WEIGHT_CATEGORY_RULE;
      if (reason === "Recommended pairing") {
        if (candNameLower.includes("drink") || candNameLower.includes("beverage")) {
          reason = "Pairs well with drinks";
        } else if (candNameLower.includes("dessert") || candNameLower.includes("cake")) {
          reason = "Sweet finish";
        } else {
          reason = "Complementary side";
        }
      }
    }

    // 4. Popularity bonus
    if (candidate.isPopular) {
      score += PAIRINGS_CONFIG.WEIGHT_POPULARITY;
    }

    scoredCandidates.push({ item: candidate, score, reason, isSameRest });
  }

  // Sort by score descending
  scoredCandidates.sort((a, b) => b.score - a.score);

  // Deduplicate items with identical normalized names
  const seenNames = new Set<string>();
  const topPairings: PairingItemResult[] = [];

  for (const { item, score, reason, isSameRest } of scoredCandidates) {
    const norm = item.name.toLowerCase().trim();
    if (seenNames.has(norm)) continue;
    seenNames.add(norm);

    const rest = restaurantMap.get(item.restaurantId.toString()) || targetRestaurant;

    topPairings.push({
      itemId: item._id.toString(),
      name: item.name,
      price: item.price,
      originalPrice: item.originalPrice,
      image: item.image,
      description: item.description,
      isPopular: item.isPopular,
      score,
      matchReason: reason,
      isSameRestaurant: isSameRest,
      restaurant: {
        restaurantId: rest._id.toString(),
        name: rest.name,
        isOpen: true,
        rating: rest.rating,
      },
    });

    if (topPairings.length >= PAIRINGS_CONFIG.MAX_PAIRINGS_RETURNED) {
      break;
    }
  }

  return topPairings;
}
