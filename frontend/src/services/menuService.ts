/**
 * Menu service – wraps /api/restaurants/:id/menu endpoints.
 */
import httpClient from "@/lib/httpClient";
import type { ApiResponse } from "@/services/authService";
import type { MenuItem, MenuCategory } from "@/types/menu";

export interface ComparisonItem {
  itemId: string;
  name: string;
  price: number;
  originalPrice?: number;
  priceDiff: number;
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
  estimatedTotal?: number;
  isEstimateDistance?: boolean;
  highlights: string[];
  isCurrentRestaurant: boolean;
}

export interface ComparisonData {
  targetItem: ComparisonItem;
  alternatives: ComparisonItem[];
  hasLocation: boolean;
}

export interface PairingItem {
  itemId: string;
  name: string;
  price: number;
  originalPrice?: number;
  image?: string;
  description?: string;
  isPopular?: boolean;
  score: number;
  matchReason: string;
  isSameRestaurant: boolean;
  restaurant: {
    restaurantId: string;
    name: string;
    isOpen: boolean;
    rating?: { average?: number; count?: number };
  };
}

export interface NutritionData {
  enabled: boolean;
  source: "vendor" | "ai" | "none";
  label?: string;
  servingSize?: string;
  calories?: number;
  caloriesMin?: number;
  caloriesMax?: number;
  proteinGrams?: number;
  carbsGrams?: number;
  fatGrams?: number;
  status?: "ready" | "pending" | "failed";
}

const extractError = (error: unknown): ApiResponse => {
  if (typeof error === "object" && error !== null && "response" in error) {
    const axiosErr = error as { response?: { data?: ApiResponse } };
    if (axiosErr.response?.data) return axiosErr.response.data;
  }
  if (typeof error === "object" && error !== null && "request" in error) {
    return {
      success: false,
      message: "Network error. Please check your connection.",
    };
  }
  return { success: false, message: "An unexpected error occurred." };
};

const menuService = {
  /** GET /api/restaurants/:restaurantId/menu */
  async getMenu(
    restaurantId: string,
  ): Promise<ApiResponse<{ categories: MenuCategory[]; items: MenuItem[] }>> {
    try {
      const response = await httpClient.get<
        ApiResponse<{ categories: MenuCategory[]; items: MenuItem[] }>
      >(`/api/restaurants/${restaurantId}/menu`);
      return response.data;
    } catch (error: unknown) {
      return extractError(error) as ApiResponse<{
        categories: MenuCategory[];
        items: MenuItem[];
      }>;
    }
  },

  /** GET /api/restaurants/:restaurantId/menu/:itemId */
  async getMenuItem(
    restaurantId: string,
    itemId: string,
  ): Promise<ApiResponse<{ item: MenuItem }>> {
    try {
      const response = await httpClient.get<ApiResponse<{ item: MenuItem }>>(
        `/api/restaurants/${restaurantId}/menu/${itemId}`,
      );
      return response.data;
    } catch (error: unknown) {
      return extractError(error) as ApiResponse<{ item: MenuItem }>;
    }
  },

  /** GET /api/menu-items/:itemId/compare */
  async getDishComparison(
    itemId: string,
    lat?: number,
    lng?: number,
  ): Promise<ApiResponse<ComparisonData>> {
    try {
      const params = lat !== undefined && lng !== undefined ? { lat, lng } : undefined;
      const response = await httpClient.get<ApiResponse<ComparisonData>>(
        `/api/menu-items/${itemId}/compare`,
        { params },
      );
      return response.data;
    } catch (error: unknown) {
      return extractError(error) as ApiResponse<ComparisonData>;
    }
  },

  /** GET /api/menu-items/:itemId/pairings */
  async getDishPairings(
    itemId: string,
    excludeIds?: string[],
    lat?: number,
    lng?: number,
  ): Promise<ApiResponse<{ pairings: PairingItem[] }>> {
    try {
      const params: Record<string, string | number> = {};
      if (excludeIds && excludeIds.length) {
        params.excludeIds = excludeIds.join(",");
      }
      if (lat !== undefined && lng !== undefined) {
        params.lat = lat;
        params.lng = lng;
      }
      const response = await httpClient.get<ApiResponse<{ pairings: PairingItem[] }>>(
        `/api/menu-items/${itemId}/pairings`,
        { params },
      );
      return response.data;
    } catch (error: unknown) {
      return extractError(error) as ApiResponse<{ pairings: PairingItem[] }>;
    }
  },

  /** GET /api/menu-items/:itemId/nutrition */
  async getDishNutrition(
    itemId: string,
  ): Promise<ApiResponse<NutritionData>> {
    try {
      const response = await httpClient.get<ApiResponse<NutritionData>>(
        `/api/menu-items/${itemId}/nutrition`,
      );
      return response.data;
    } catch (error: unknown) {
      return extractError(error) as ApiResponse<NutritionData>;
    }
  },
};

export default menuService;
