import React, { useEffect, useState } from "react";
import {
  InteractiveCard,
  InteractiveCardLink,
  InteractiveCardAction,
} from "@/components/ui/InteractiveCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FoodImage } from "@/components/ui/FoodImage";
import { useCart, CartItem } from "@/contexts/CartContext";
import menuService, { PairingItem } from "@/services/menuService";
import { Plus, Minus, Sparkles } from "lucide-react";
import { toast } from "@/lib/toast";

interface ComplementaryPairingsSectionProps {
  itemId: string;
  restaurantId?: string;
}

export const ComplementaryPairingsSection: React.FC<ComplementaryPairingsSectionProps> = ({
  itemId,
}) => {
  const { items, addItem, updateQuantity, removeItem } = useCart();
  const [pairings, setPairings] = useState<PairingItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Collect cart menu item IDs to exclude already added items from pairings
  const cartItemIds = items.map((i: CartItem) => i.menuItemId);

  const cartKey = cartItemIds.join(",");

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    menuService
      .getDishPairings(itemId, cartItemIds)
      .then((res) => {
        if (isMounted && res.success && res.data?.pairings) {
          setPairings(res.data.pairings);
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
  }, [itemId, cartKey]);

  if (isLoading) {
    return (
      <div className="mt-12 rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
        <Skeleton className="h-6 w-40 mb-4" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-44 w-full rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!pairings || pairings.length === 0) {
    return null;
  }

  return (
    <section className="mt-12 rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
        <Sparkles className="h-4 w-4 text-brand-500" />
        <h2 className="text-lg font-bold text-gray-900 tracking-tight">
          Goes Well With This Dish
        </h2>
      </div>

      {/* Responsive layout: horizontally scrollable on mobile, grid on desktop */}
      <div className="mt-4 flex gap-3 overflow-x-auto pb-2 scrollbar-none sm:grid sm:grid-cols-3 sm:overflow-visible lg:grid-cols-6">
        {pairings.map((p) => {
          const cartLines = items.filter((i: CartItem) => i.menuItemId === p.itemId);
          const totalQtyInCart = cartLines.reduce((sum: number, line: CartItem) => sum + line.quantity, 0);
          const firstLine = cartLines[0];

          return (
            <InteractiveCard
              key={p.itemId}
              className="w-40 sm:w-auto shrink-0 flex flex-col justify-between p-3 transition-all hover:border-brand-200"
            >
              <div>
                <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-gray-100 mb-2.5">
                  <FoodImage
                    name={p.name}
                    src={p.image}
                    aspectRatio="1/1"
                    className="h-full w-full"
                    imgClassName="h-full w-full object-cover"
                  />
                  {p.matchReason && (
                    <span className="absolute top-1.5 left-1.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[9px] font-semibold text-white backdrop-blur-xs">
                      {p.matchReason}
                    </span>
                  )}
                </div>

                <InteractiveCardLink
                  to={`/menu/${p.restaurant.restaurantId}/${p.itemId}`}
                  className="font-medium text-xs text-gray-900 line-clamp-1 hover:text-brand-600 transition-colors"
                >
                  {p.name}
                </InteractiveCardLink>

                {!p.isSameRestaurant && (
                  <p className="text-[10px] text-gray-400 truncate mt-0.5">
                    by {p.restaurant.name}
                  </p>
                )}
              </div>

              <div className="mt-3 flex items-center justify-between pt-2 border-t border-gray-100">
                <span className="text-xs font-bold text-gray-900">
                  ৳{p.price}
                </span>

                <InteractiveCardAction className="relative z-10">
                  {totalQtyInCart > 0 ? (
                    <div className="flex items-center gap-1 bg-brand-50 rounded-md p-0.5 border border-brand-200">
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
                        className="h-6 w-6 flex items-center justify-center rounded bg-white text-gray-700 shadow-xs hover:bg-gray-100"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-4 text-center text-[11px] font-bold text-brand-700">
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
                        className="h-6 w-6 flex items-center justify-center rounded bg-brand-500 text-white shadow-xs hover:bg-brand-600"
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
                            p.restaurant.restaurantId,
                            p.restaurant.name,
                            {
                              menuItemId: p.itemId,
                              name: p.name,
                              price: p.price,
                              image: p.image,
                              quantity: 1,
                              variants: [],
                              addons: [],
                            }
                          );
                          toast.success("Added to cart", {
                            description: `${p.name} from ${p.restaurant.name}`,
                          });
                        } catch {
                          // Handled by cart
                        }
                      }}
                      className="h-7 px-2 text-[11px] font-medium border-gray-200 hover:border-brand-500 hover:bg-brand-50 hover:text-brand-600"
                    >
                      <Plus className="mr-1 h-3 w-3" />
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
