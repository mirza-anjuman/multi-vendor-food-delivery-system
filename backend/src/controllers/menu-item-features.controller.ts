import { Request, Response } from "express";
import { getDishComparison } from "../services/menu/dish-comparison.service";
import { getDishPairings } from "../services/menu/dish-pairings.service";
import { getNutritionForItem } from "../services/nutrition/nutrition.service";

/**
 * GET /api/menu-items/:id/compare
 */
export async function getCompareHandler(req: Request, res: Response): Promise<void> {
  try {
    const id = String(req.params.id);
    let userLocation: { lat: number; lng: number } | undefined;

    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);
    if (!isNaN(lat) && !isNaN(lng)) {
      userLocation = { lat, lng };
    }

    const comparison = await getDishComparison(id, userLocation);
    if (!comparison) {
      res.status(404).json({ success: false, message: "Menu item not found" });
      return;
    }

    res.json({
      success: true,
      data: comparison,
    });
  } catch (error: unknown) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to load price comparison",
    });
  }
}

/**
 * GET /api/menu-items/:id/pairings
 */
export async function getPairingsHandler(req: Request, res: Response): Promise<void> {
  try {
    const id = String(req.params.id);
    const rawExclude = req.query.excludeIds as string;
    const excludeItemIds = rawExclude ? rawExclude.split(",").map((s) => s.trim()).filter(Boolean) : [];

    let userLocation: { lat: number; lng: number } | undefined;
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);
    if (!isNaN(lat) && !isNaN(lng)) {
      userLocation = { lat, lng };
    }

    const pairings = await getDishPairings(id, { excludeItemIds, userLocation });

    res.json({
      success: true,
      data: {
        pairings,
      },
    });
  } catch (error: unknown) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to load complementary pairings",
    });
  }
}

/**
 * GET /api/menu-items/:id/nutrition
 */
export async function getNutritionHandler(req: Request, res: Response): Promise<void> {
  try {
    const id = String(req.params.id);
    const nutrition = await getNutritionForItem(id);

    res.json({
      success: true,
      data: nutrition,
    });
  } catch (error: unknown) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to load nutrition information",
    });
  }
}
