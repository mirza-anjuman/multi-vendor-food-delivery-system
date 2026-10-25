import { Router } from "express";
import {
  getCompareHandler,
  getPairingsHandler,
  getNutritionHandler,
} from "../controllers/menu-item-features.controller";

const router: Router = Router();

// Public routes for menu item extended features
router.get("/:id/compare", getCompareHandler);
router.get("/:id/pairings", getPairingsHandler);
router.get("/:id/nutrition", getNutritionHandler);

export default router;
