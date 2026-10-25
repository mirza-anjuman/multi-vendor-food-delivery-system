import React, { useEffect, useState } from "react";
import menuService, { NutritionData } from "@/services/menuService";
import { Flame } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface NutritionEstimateBlockProps {
  itemId: string;
}

export const NutritionEstimateBlock: React.FC<NutritionEstimateBlockProps> = ({
  itemId,
}) => {
  const [nutrition, setNutrition] = useState<NutritionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    menuService
      .getDishNutrition(itemId)
      .then((res) => {
        if (isMounted && res.success && res.data) {
          setNutrition(res.data);
        }
      })
      .catch(() => {
        // Silently degrade
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [itemId]);

  // If loading, render minimal skeleton
  if (isLoading) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-xs">
        <Skeleton className="h-4 w-32 mb-2" />
        <Skeleton className="h-6 w-48" />
      </div>
    );
  }

  // If feature is disabled, or no nutrition data available, hide block completely
  if (!nutrition || !nutrition.enabled || nutrition.source === "none") {
    return null;
  }

  // Display values
  const isVendor = nutrition.source === "vendor";
  const calDisplay = isVendor
    ? `${nutrition.calories} kcal`
    : nutrition.caloriesMin && nutrition.caloriesMax
    ? `${nutrition.caloriesMin} – ${nutrition.caloriesMax} kcal`
    : null;

  if (!calDisplay) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flame className="h-4 w-4 text-orange-500" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-900">
            Nutrition (Estimate)
          </h3>
        </div>
        <span className="rounded-md bg-gray-50 px-2 py-0.5 text-[10px] font-medium text-gray-500">
          {nutrition.label || (isVendor ? "Provided by restaurant" : "AI estimate")}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-baseline gap-2">
        <span className="text-xl font-extrabold text-gray-900 tracking-tight">
          {calDisplay}
        </span>
        <span className="text-xs text-muted-foreground">
          per serving ({nutrition.servingSize || "1 portion"})
        </span>
      </div>

      {/* Macros row */}
      {(nutrition.proteinGrams !== undefined ||
        nutrition.carbsGrams !== undefined ||
        nutrition.fatGrams !== undefined) && (
        <div className="mt-3 grid grid-cols-3 gap-2 text-center border-t border-gray-100 pt-2.5">
          {nutrition.proteinGrams !== undefined && (
            <div className="rounded-lg bg-gray-50 py-1 px-2">
              <span className="text-[10px] uppercase font-semibold text-gray-400 block">
                Protein
              </span>
              <span className="text-xs font-bold text-gray-800">
                ~{nutrition.proteinGrams}g
              </span>
            </div>
          )}
          {nutrition.carbsGrams !== undefined && (
            <div className="rounded-lg bg-gray-50 py-1 px-2">
              <span className="text-[10px] uppercase font-semibold text-gray-400 block">
                Carbs
              </span>
              <span className="text-xs font-bold text-gray-800">
                ~{nutrition.carbsGrams}g
              </span>
            </div>
          )}
          {nutrition.fatGrams !== undefined && (
            <div className="rounded-lg bg-gray-50 py-1 px-2">
              <span className="text-[10px] uppercase font-semibold text-gray-400 block">
                Fat
              </span>
              <span className="text-xs font-bold text-gray-800">
                ~{nutrition.fatGrams}g
              </span>
            </div>
          )}
        </div>
      )}

      <p className="mt-2 text-[10px] text-gray-400 italic">
        {isVendor
          ? "Provided directly by the kitchen. Actual values may vary by portion."
          : "AI estimate based on standard dish preparation. Not intended as medical or allergen advice."}
      </p>
    </div>
  );
};
