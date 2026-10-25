import React, { useEffect, useState, useMemo } from "react";
import {
  InteractiveCard,
  InteractiveCardLink,
  InteractiveCardAction,
} from "@/components/ui/InteractiveCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FoodImage } from "@/components/ui/FoodImage";
import { useCart, CartItem } from "@/contexts/CartContext";
import { useCustomerLocation } from "@/contexts/LocationContext";
import menuService, { ComparisonData } from "@/services/menuService";
import {
  MapPin,
  Star,
  Plus,
  Minus,
  ArrowUpDown,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { toast } from "@/lib/toast";

interface PriceComparisonSectionProps {
  itemId: string;
  restaurantId?: string;
}

export const PriceComparisonSection: React.FC<PriceComparisonSectionProps> = ({
  itemId,
}) => {
  const { location, openPicker } = useCustomerLocation();
  const { items, addItem, updateQuantity, removeItem } = useCart();

  const [data, setData] = useState<ComparisonData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sortBy, setSortBy] = useState<"value" | "price" | "rating" | "distance">("value");

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    const lat = location?.latitude;
    const lng = location?.longitude;

    menuService
      .getDishComparison(itemId, lat, lng)
      .then((res) => {
        if (isMounted && res.success && res.data) {
          setData(res.data);
        }
      })
      .catch(() => {
        // Silently degrade on error per specification
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [itemId, location?.latitude, location?.longitude]);

  // Combined list: target item pinned first, then sorted alternatives
  const sortedAlternatives = useMemo(() => {
    if (!data?.alternatives?.length) return [];
    const alts = [...data.alternatives];

    switch (sortBy) {
      case "price":
        return alts.sort((a, b) => a.price - b.price);
      case "rating":
        return alts.sort(
          (a, b) => (b.restaurant.rating?.average || 0) - (a.restaurant.rating?.average || 0)
        );
      case "distance":
        return alts.sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));
      case "value":
      default:
        // Best value: prioritize lowest total if location known, otherwise lowest price
        return alts.sort((a, b) => {
          if (a.estimatedTotal !== undefined && b.estimatedTotal !== undefined) {
            return a.estimatedTotal - b.estimatedTotal;
          }
          return a.price - b.price;
        });
    }
  }, [data?.alternatives, sortBy]);

  if (isLoading) {
    return (
      <div className="mt-12 rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between pb-4">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-8 w-28" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-36 w-full rounded-2xl" />
          <Skeleton className="h-36 w-full rounded-2xl" />
          <Skeleton className="h-36 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  // Hide section completely when no confident alternatives exist
  if (!data || !data.alternatives || data.alternatives.length === 0) {
    return null;
  }

  const allItemsToDisplay = [data.targetItem, ...sortedAlternatives];

  return (
    <section className="mt-12 rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-gray-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-gray-900 tracking-tight">
              Compare Prices Across Restaurants
            </h2>
            <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-600">
              {data.alternatives.length} options
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Same dish from other active kitchens. Real prices and verified delivery fees.
          </p>
        </div>

        {/* Sorting controls */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <ArrowUpDown className="h-3.5 w-3.5 text-gray-400" />
          <span className="text-xs font-medium text-gray-500">Sort:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 focus:border-brand-500 focus:outline-none"
            aria-label="Sort comparison"
          >
            <option value="value">Best Value</option>
            <option value="price">Lowest Price</option>
            <option value="rating">Highest Rated</option>
            {data.hasLocation && <option value="distance">Nearest</option>}
          </select>
        </div>
      </div>

      {/* Location awareness banner */}
      {!data.hasLocation && (
        <div className="mt-4 flex items-center justify-between rounded-xl bg-orange-50/70 px-4 py-2.5 text-xs text-orange-900 border border-orange-100">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-brand-500 shrink-0" />
            <span>Set your location to see delivery fees and estimated total order cost.</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={openPicker}
            className="h-7 text-xs border-orange-200 bg-white hover:bg-orange-100 text-orange-950 ml-2 shrink-0"
          >
            Set Location
          </Button>
        </div>
      )}

      {/* Comparison Grid */}
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {allItemsToDisplay.map((entry) => {
          // Check cart status for this specific item
          const cartLines = items.filter((i: CartItem) => i.menuItemId === entry.itemId);
          const totalQtyInCart = cartLines.reduce((sum: number, line: CartItem) => sum + line.quantity, 0);
          const firstLine = cartLines[0];

          return (
            <InteractiveCard
              key={`${entry.restaurant.restaurantId}-${entry.itemId}`}
              className={cn(
                "p-4 transition-all duration-200",
                entry.isCurrentRestaurant
                  ? "border-brand-300 bg-brand-50/30 ring-1 ring-brand-200"
                  : "hover:border-brand-200"
              )}
            >
              {/* Top Row: Current Badge & Highlight tags */}
              <div className="flex flex-wrap items-center justify-between gap-1.5 mb-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  {entry.isCurrentRestaurant && (
                    <span className="rounded-md bg-brand-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                      Current Kitchen
                    </span>
                  )}
                  {entry.highlights.map((badge) => (
                    <span
                      key={badge}
                      className={cn(
                        "rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
                        badge === "Lowest price" || badge === "Lowest total"
                          ? "bg-emerald-100 text-emerald-800"
                          : badge === "Top rated"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-blue-100 text-blue-800"
                      )}
                    >
                      {badge}
                    </span>
                  ))}
                </div>

                {/* Rating */}
                {entry.restaurant.rating?.average ? (
                  <span className="flex items-center gap-1 text-xs font-semibold text-gray-700">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    {entry.restaurant.rating.average.toFixed(1)}
                  </span>
                ) : null}
              </div>

              {/* Main Content */}
              <div className="flex gap-3">
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-gray-100">
                  <FoodImage
                    name={entry.name}
                    src={entry.image}
                    aspectRatio="1/1"
                    className="h-full w-full"
                    imgClassName="h-full w-full object-cover"
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <InteractiveCardLink
                    to={`/menu/${entry.restaurant.restaurantId}/${entry.itemId}`}
                    className="font-semibold text-sm text-gray-900 line-clamp-1 hover:text-brand-600 transition-colors"
                  >
                    {entry.restaurant.name}
                  </InteractiveCardLink>

                  <p className="text-xs text-gray-500 truncate mt-0.5">
                    {entry.name}
                    {entry.portionLabel && (
                      <span className="text-gray-400"> ({entry.portionLabel})</span>
                    )}
                  </p>

                  {/* Delivery & Distance metrics */}
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-gray-500">
                    {entry.distanceKm !== undefined && (
                      <span>
                        {entry.isEstimateDistance ? "~" : ""}
                        {entry.distanceKm} km
                      </span>
                    )}
                    {entry.deliveryFee !== undefined ? (
                      <span>+৳{entry.deliveryFee} delivery</span>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Price & Action Area */}
              <div className="mt-3.5 pt-3 border-t border-gray-100 flex items-center justify-between">
                <div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-base font-bold text-gray-900">
                      ৳{entry.price}
                    </span>
                    {entry.estimatedTotal !== undefined && (
                      <span className="text-xs font-medium text-gray-500">
                        (৳{entry.estimatedTotal} total)
                      </span>
                    )}
                  </div>

                  {/* Price diff relative to current item */}
                  {!entry.isCurrentRestaurant && entry.priceDiff !== 0 && (
                    <p
                      className={cn(
                        "text-[11px] font-medium",
                        entry.priceDiff < 0 ? "text-emerald-600" : "text-gray-500"
                      )}
                    >
                      {entry.priceDiff < 0
                        ? `৳${Math.abs(entry.priceDiff)} cheaper`
                        : `৳${entry.priceDiff} more`}
                    </p>
                  )}
                  {entry.portionLabel && (
                    <p className="text-[10px] text-gray-400">Sizes may differ</p>
                  )}
                </div>

                {/* Inline Add to Cart Control */}
                <InteractiveCardAction className="relative z-10">
                  {totalQtyInCart > 0 ? (
                    <div className="flex items-center gap-1.5 bg-brand-50 rounded-lg p-1 border border-brand-200">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (firstLine) {
                            if (totalQtyInCart === 1) {
                              removeItem(firstLine.itemKey || firstLine.menuItemId);
                            } else {
                              updateQuantity(
                                firstLine.itemKey || firstLine.menuItemId,
                                totalQtyInCart - 1
                              );
                            }
                          }
                        }}
                        className="h-7 w-7 flex items-center justify-center rounded-md bg-white text-gray-700 shadow-xs hover:bg-gray-100 transition-colors"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-5 text-center text-xs font-bold text-brand-700">
                        {totalQtyInCart}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (firstLine) {
                            updateQuantity(
                              firstLine.itemKey || firstLine.menuItemId,
                              totalQtyInCart + 1
                            );
                          }
                        }}
                        className="h-7 w-7 flex items-center justify-center rounded-md bg-brand-500 text-white shadow-xs hover:bg-brand-600 transition-colors"
                        aria-label="Increase quantity"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async (e) => {
                        e.stopPropagation();
                        try {
                          await addItem(
                            entry.restaurant.restaurantId,
                            entry.restaurant.name,
                            {
                              menuItemId: entry.itemId,
                              name: entry.name,
                              price: entry.price,
                              image: entry.image,
                              quantity: 1,
                              variants: [],
                              addons: [],
                            }
                          );
                          toast.success("Added to cart", {
                            description: `${entry.name} from ${entry.restaurant.name}`,
                          });
                        } catch {
                          // Handled by cart
                        }
                      }}
                      className="h-8 text-xs font-medium border-gray-200 hover:border-brand-500 hover:bg-brand-50 hover:text-brand-600"
                    >
                      <Plus className="mr-1 h-3.5 w-3.5" />
                      Add
                    </Button>
                  )}
                </InteractiveCardAction>
              </div>
            </InteractiveCard>
          );
        })}
      </div>
    </section>
  );
};
