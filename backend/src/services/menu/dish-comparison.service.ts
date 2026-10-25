/**
 * Dish Comparison Service — Finds the same dish at alternative active restaurants.
 */
import mongoose, { Types } from "mongoose";
import MenuItemModel from "../../models/MenuItem";
import RestaurantModel from "../../models/Restaurant";
import { isSameDish, normalizeDishName } from "./dish-matcher.service";
import { calculateDeliveryFee } from "../delivery/fee-calculator";
import { calculateHaversineDistanceMeters } from "../delivery/routing/haversine-fallback.provider";
import DeliverySettingsModel from "../../models/DeliverySettings";

export interface ComparisonItemResult {
  itemId: string;
  name: string;
  price: number;
  originalPrice?: number;
  priceDiff: number; // relative to target item price (negative = cheaper)
  portionLabel?: string;
  isAvailable: boolean;
  image?: string;
  restaurant: {
    restaurantId: string;
    name: string;
    slug?: string;
    rating?: { average?: number; count?: number };
    isOpen: boolean;
    deliveryTime?: string | { min: number; max: number };
    address?: { street?: string; city?: string };
  };
  distanceKm?: number;
  deliveryFee?: number;
  estimatedTotal?: number; // price + deliveryFee
  isEstimateDistance?: boolean;
  highlights: string[]; // e.g. ["Lowest price", "Lowest total", "Top rated", "Nearest"]
  isCurrentRestaurant: boolean;
}

export interface ComparisonResponse {
  targetItem: ComparisonItemResult;
  alternatives: ComparisonItemResult[];
  hasLocation: boolean;
}

export async function getDishComparison(
  itemId: string,
  userLocation?: { lat: number; lng: number }
): Promise<ComparisonResponse | null> {
  const targetItem = await MenuItemModel.findById(itemId).lean();
  if (!targetItem || targetItem.deletedAt) {
    return null;
  }

  const targetRestaurant = await RestaurantModel.findById(targetItem.restaurantId).lean();
  if (!targetRestaurant) {
    return null;
  }

  // Get active delivery settings for fee calculations if location provided
  let deliverySettings: any = null;
  if (userLocation) {
    deliverySettings = await DeliverySettingsModel.getSettings();
  }

  // Find other approved and active restaurants
  const activeRestaurants = await RestaurantModel.find({
    isActive: true,
    approvalStatus: "approved",
    isTemporarilyClosed: { $ne: true },
  })
    .select("_id name slug rating operatingHours deliveryTime address location")
    .lean();

  const restaurantMap = new Map<string, (typeof activeRestaurants)[0]>();
  for (const r of activeRestaurants) {
    restaurantMap.set(r._id.toString(), r);
  }

  // Find candidate items across approved restaurants
  const candidateItems = await MenuItemModel.find({
    _id: { $ne: targetItem._id },
    isAvailable: true,
    stockStatus: "available",
    deletedAt: null,
  })
    .select("_id restaurantId name price originalPrice image variants description")
    .lean();

  const matchingAlternatives: Array<{
    item: (typeof candidateItems)[0];
    restaurant: (typeof activeRestaurants)[0];
  }> = [];

  for (const candidate of candidateItems) {
    const candidateRest = restaurantMap.get(candidate.restaurantId.toString());
    if (!candidateRest) continue;

    // High precision matching
    if (isSameDish(targetItem.name, candidate.name)) {
      // Exclude multiple items from the same restaurant (keep the cheapest)
      const existing = matchingAlternatives.find(
        (m) => m.restaurant._id.toString() === candidateRest._id.toString()
      );
      if (!existing) {
        matchingAlternatives.push({ item: candidate, restaurant: candidateRest });
      } else if (candidate.price < existing.item.price) {
        existing.item = candidate;
      }
    }
  }

  // Helper to compute distance and delivery fee
  const computeDelivery = (rest: any) => {
    if (!userLocation || !deliverySettings) {
      return { distanceKm: undefined, deliveryFee: undefined, estimatedTotal: undefined };
    }

    let restLat: number | undefined;
    let restLng: number | undefined;

    if (rest?.location?.coordinates && rest.location.coordinates.length >= 2) {
      restLng = rest.location.coordinates[0];
      restLat = rest.location.coordinates[1];
    } else if (rest?.address?.coordinates?.lat && rest?.address?.coordinates?.lng) {
      restLat = rest.address.coordinates.lat;
      restLng = rest.address.coordinates.lng;
    }

    if (restLat === undefined || restLng === undefined) {
      return { distanceKm: undefined, deliveryFee: undefined, estimatedTotal: undefined };
    }

    const distanceMeters = calculateHaversineDistanceMeters(
      { latitude: restLat, longitude: restLng },
      { latitude: userLocation.lat, longitude: userLocation.lng }
    );
    const distanceKm = Math.round((distanceMeters / 1000) * 10) / 10;

    try {
      const feeResult = calculateDeliveryFee({
        distanceKm,
        minFee: deliverySettings.minFee,
        includedKm: deliverySettings.includedKm,
        includedDistanceFee: deliverySettings.includedDistanceFee,
        perKmRate: deliverySettings.perKmRate,
        maxFee: deliverySettings.maxFee,
        maxDeliveryDistanceKm: deliverySettings.maxDeliveryDistanceKm,
      });

      return {
        distanceKm,
        deliveryFee: feeResult.fee,
        isEstimateDistance: true,
      };
    } catch {
      return { distanceKm, deliveryFee: undefined, isEstimateDistance: true };
    }
  };

  // Build target item result
  const targetDelivery = computeDelivery(targetRestaurant);
  const targetEstimatedTotal =
    targetDelivery.deliveryFee !== undefined
      ? targetItem.price + targetDelivery.deliveryFee
      : undefined;

  const targetResult: ComparisonItemResult = {
    itemId: targetItem._id.toString(),
    name: targetItem.name,
    price: targetItem.price,
    originalPrice: targetItem.originalPrice,
    priceDiff: 0,
    portionLabel: targetItem.variants?.[0]?.name,
    isAvailable: targetItem.isAvailable,
    image: targetItem.image,
    restaurant: {
      restaurantId: targetRestaurant._id.toString(),
      name: targetRestaurant.name,
      slug: targetRestaurant.slug,
      rating: targetRestaurant.rating,
      isOpen: true,
      deliveryTime: targetRestaurant.deliveryTime,
      address: targetRestaurant.address,
    },
    distanceKm: targetDelivery.distanceKm,
    deliveryFee: targetDelivery.deliveryFee,
    estimatedTotal: targetEstimatedTotal,
    isEstimateDistance: targetDelivery.isEstimateDistance,
    highlights: [],
    isCurrentRestaurant: true,
  };

  // Build alternative items results
  const altResults: ComparisonItemResult[] = matchingAlternatives.map(({ item, restaurant }) => {
    const delivery = computeDelivery(restaurant);
    const estimatedTotal =
      delivery.deliveryFee !== undefined ? item.price + delivery.deliveryFee : undefined;
    const priceDiff = item.price - targetItem.price;

    return {
      itemId: item._id.toString(),
      name: item.name,
      price: item.price,
      originalPrice: item.originalPrice,
      priceDiff,
      portionLabel: item.variants?.[0]?.name,
      isAvailable: item.isAvailable,
      image: item.image,
      restaurant: {
        restaurantId: restaurant._id.toString(),
        name: restaurant.name,
        slug: restaurant.slug,
        rating: restaurant.rating,
        isOpen: true,
        deliveryTime: restaurant.deliveryTime,
        address: restaurant.address,
      },
      distanceKm: delivery.distanceKm,
      deliveryFee: delivery.deliveryFee,
      estimatedTotal,
      isEstimateDistance: delivery.isEstimateDistance,
      highlights: [],
      isCurrentRestaurant: false,
    };
  });

  // Calculate real highlights across all entries (target + alternatives)
  const allEntries = [targetResult, ...altResults];

  // Lowest price
  const minPrice = Math.min(...allEntries.map((e) => e.price));
  for (const e of allEntries) {
    if (e.price === minPrice) {
      e.highlights.push("Lowest price");
    }
  }

  // Lowest total (if locations known)
  const entriesWithTotal = allEntries.filter((e) => e.estimatedTotal !== undefined);
  if (entriesWithTotal.length > 0) {
    const minTotal = Math.min(...entriesWithTotal.map((e) => e.estimatedTotal!));
    for (const e of entriesWithTotal) {
      if (e.estimatedTotal === minTotal && !e.highlights.includes("Lowest price")) {
        e.highlights.push("Lowest total");
      }
    }
  }

  // Top rated (must have at least 1 review; highest average rating wins; tie-broken by review count)
  const entriesWithRating = allEntries.filter(
    (e) => (e.restaurant.rating?.average || 0) >= 4.0 && (e.restaurant.rating?.count || 0) >= 1
  );
  if (entriesWithRating.length > 0) {
    const sortedByRating = [...entriesWithRating].sort((a, b) => {
      const avgDiff = (b.restaurant.rating?.average || 0) - (a.restaurant.rating?.average || 0);
      if (Math.abs(avgDiff) > 0.01) return avgDiff;
      return (b.restaurant.rating?.count || 0) - (a.restaurant.rating?.count || 0);
    });

    const topOne = sortedByRating[0];
    if (topOne && !topOne.highlights.includes("Top rated")) {
      topOne.highlights.push("Top rated");
    }
  }

  // Most rated (popular by review count, distinct from Top rated)
  const entriesByReviewCount = allEntries.filter(
    (e) => (e.restaurant.rating?.count || 0) >= 10
  );
  if (entriesByReviewCount.length > 0) {
    const sortedByCount = [...entriesByReviewCount].sort(
      (a, b) => (b.restaurant.rating?.count || 0) - (a.restaurant.rating?.count || 0)
    );
    const mostReviewed = sortedByCount[0];
    if (mostReviewed && !mostReviewed.highlights.includes("Top rated") && !mostReviewed.highlights.includes("Most rated")) {
      mostReviewed.highlights.push("Most rated");
    }
  }

  // Nearest (if locations known)
  const entriesWithDistance = allEntries.filter((e) => e.distanceKm !== undefined);
  if (entriesWithDistance.length > 0) {
    const minDistance = Math.min(...entriesWithDistance.map((e) => e.distanceKm!));
    for (const e of entriesWithDistance) {
      if (e.distanceKm === minDistance) {
        e.highlights.push("Nearest");
        break;
      }
    }
  }

  // Cap alternatives to at most 7 items (sensible cap 6-8)
  const cappedAlternatives = altResults.slice(0, 7);

  return {
    targetItem: targetResult,
    alternatives: cappedAlternatives,
    hasLocation: Boolean(userLocation),
  };
}
