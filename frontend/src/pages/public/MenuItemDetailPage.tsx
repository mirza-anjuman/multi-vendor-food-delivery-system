import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FoodImage } from "@/components/ui/FoodImage";
import { useCart, CartItem } from "@/contexts/CartContext";
import { useCustomerLocation } from "@/contexts/LocationContext";
import { useDeliveryQuote } from "@/hooks/useDeliveryQuote";
import apiService from "@/services/apiService";
import menuService from "@/services/menuService";
import reviewService, { Review as ApiReview } from "@/services/reviewService";
import type { MenuItem, MenuItemAddon, MenuItemVariant } from "@/types/menu";
import { PriceComparisonSection } from "@/components/menu/PriceComparisonSection";
import { ComplementaryPairingsSection } from "@/components/menu/ComplementaryPairingsSection";
import { NutritionEstimateBlock } from "@/components/menu/NutritionEstimateBlock";
import { cn } from "@/utils/cn";
import { toast } from "@/lib/toast";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Clock,
  Flame,
  MapPin,
  Minus,
  Plus,
  ShoppingBag,
  Star,
  Store,
  Trash2,
  Truck,
  UtensilsCrossed,
} from "lucide-react";

const DIETARY_COLORS: Record<string, string> = {
  halal: "bg-emerald-50 text-emerald-700 border-emerald-200",
  vegetarian: "bg-green-50 text-green-700 border-green-200",
  vegan: "bg-lime-50 text-lime-700 border-lime-200",
  gluten_free: "bg-blue-50 text-blue-700 border-blue-200",
  "gluten-free": "bg-blue-50 text-blue-700 border-blue-200",
  spicy: "bg-red-50 text-red-700 border-red-200",
};

const SPICE_LABEL: Record<string, { label: string; flames: number }> = {
  mild: { label: "Mild", flames: 1 },
  medium: { label: "Medium", flames: 2 },
  hot: { label: "Hot", flames: 3 },
  "extra-hot": { label: "Extra hot", flames: 3 },
};

const formatTaka = (amount: number): string => `৳${Math.round(amount)}`;

interface ApiRestaurant {
  _id: string;
  name: string;
  slug?: string;
  description?: string;
  address?: { street?: string; area?: string; city?: string };
  cuisineType?: string[];
  images?: { logo?: string; coverPhoto?: string };
  rating?: { average?: number; count?: number };
  deliveryTime?: string | { min: number; max: number };
  isOpen?: boolean;
  isTemporarilyClosed?: boolean;
  isActive?: boolean;
}

const MenuItemDetailPage: React.FC = () => {
  const { restaurantId, itemId } = useParams<{
    restaurantId: string;
    itemId: string;
  }>();
  const navigate = useNavigate();

  const { items, addItem, updateQuantity, removeItem } = useCart();
  const { openPicker } = useCustomerLocation();

  const [item, setItem] = useState<MenuItem | null>(null);
  const [restaurant, setRestaurant] = useState<ApiRestaurant | null>(null);
  const [reviews, setReviews] = useState<ApiReview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Configuration state for new adds
  const [quantity, setQuantity] = useState(1);
  const [isAdding, setIsAdding] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<MenuItemVariant | null>(null);
  const [selectedAddons, setSelectedAddons] = useState<MenuItemAddon[]>([]);

  // Delivery quote integration
  const deliveryQuote = useDeliveryQuote(restaurantId, item?.price || 0);

  // Fetch Item, Restaurant, and Reviews
  useEffect(() => {
    if (!restaurantId || !itemId) {
      setError("Invalid menu item");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    setQuantity(1);
    setSelectedVariant(null);
    setSelectedAddons([]);

    menuService
      .getMenuItem(restaurantId, itemId)
      .then((res) => {
        if (res.success && res.data?.item) {
          setItem(res.data.item);
          if (res.data.item.variants && res.data.item.variants.length > 0) {
            setSelectedVariant(res.data.item.variants[0]);
          }
        } else {
          setError(res.message || "Failed to load menu item.");
        }
      })
      .catch(() => setError("Something went wrong. Please try again."))
      .finally(() => setIsLoading(false));

    apiService
      .getRestaurantById(restaurantId)
      .then((res) => {
        const payload = res.data as { data?: ApiRestaurant };
        if (payload?.data) setRestaurant(payload.data);
      })
      .catch(() => {});

    reviewService
      .getRestaurantReviews(restaurantId, 1, 4)
      .then((res) => {
        if (res.success && res.data?.reviews) {
          setReviews(res.data.reviews);
        }
      })
      .catch(() => {});
  }, [restaurantId, itemId]);

  const toggleAddon = useCallback((addon: MenuItemAddon) => {
    setSelectedAddons((prev) =>
      prev.some((a) => a._id === addon._id)
        ? prev.filter((a) => a._id !== addon._id)
        : [...prev, addon]
    );
  }, []);

  const unitPrice = useMemo(() => {
    if (!item) return 0;
    const variantDelta = selectedVariant ? selectedVariant.price : 0;
    const addonTotal = selectedAddons.reduce((s, a) => s + a.price, 0);
    return item.price + variantDelta + addonTotal;
  }, [item, selectedVariant, selectedAddons]);

  const effectivePrice = unitPrice * quantity;

  // Matching items in Cart
  const matchingCartItems = useMemo(() => {
    if (!item) return [];
    return items.filter((ci: CartItem) => ci.menuItemId === item._id);
  }, [items, item]);

  const totalInCart = useMemo(() => {
    return matchingCartItems.reduce((sum: number, ci: CartItem) => sum + ci.quantity, 0);
  }, [matchingCartItems]);

  const restaurantName = restaurant?.name || "Kitchen";
  const isRestaurantClosed =
    restaurant?.isTemporarilyClosed ||
    restaurant?.isOpen === false ||
    restaurant?.isActive === false;

  const canAddToCart = Boolean(item?.isAvailable && !isRestaurantClosed);

  const handleAddToCart = useCallback(async () => {
    if (!item || !restaurantId || !canAddToCart) return;
    setIsAdding(true);

    const cartItem = {
      menuItemId: item._id,
      name: item.name,
      price: item.price,
      image: item.image,
      quantity,
      variants: selectedVariant
        ? [
            {
              optionId: selectedVariant._id,
              name: selectedVariant.name,
              price: selectedVariant.price,
            },
          ]
        : [],
      addons: selectedAddons.map((a) => ({
        optionId: a._id,
        name: a.name,
        price: a.price,
      })),
    };

    try {
      await addItem(restaurantId, restaurantName, cartItem);
      toast.success("Added to cart", {
        description: `${item.name} (${quantity}x) added to your order.`,
      });
      setQuantity(1);
    } catch {
      // Error handled by cart context
    } finally {
      setIsAdding(false);
    }
  }, [
    item,
    restaurantId,
    restaurantName,
    quantity,
    selectedVariant,
    selectedAddons,
    canAddToCart,
    addItem,
  ]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl px-4 pt-24 pb-16">
        <Skeleton className="mb-6 h-6 w-32" />
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="grid gap-8 md:grid-cols-2">
            <Skeleton className="aspect-square rounded-3xl" />
            <div className="space-y-4">
              <Skeleton className="h-9 w-3/4" />
              <Skeleton className="h-6 w-28" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          </div>
          <div className="space-y-4">
            <Skeleton className="h-40 w-full rounded-3xl" />
            <Skeleton className="h-40 w-full rounded-3xl" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="mx-auto max-w-4xl px-4 pt-28 pb-16 text-center">
        <div className="mx-auto mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-500">
          <UtensilsCrossed className="h-8 w-8" />
        </div>
        <h2 className="mb-2 text-xl font-bold text-gray-900">Item not found</h2>
        <p className="mb-6 text-sm text-gray-500">
          {error || "This menu item is unavailable or may have been removed."}
        </p>
        <Button variant="outline" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Go back
        </Button>
      </div>
    );
  }

  const hasDiscount = !!item.originalPrice && item.originalPrice > item.price;
  const discountPct = hasDiscount
    ? Math.round(((item.originalPrice! - item.price) / item.originalPrice!) * 100)
    : 0;
  const spice = item.spiceLevel ? SPICE_LABEL[item.spiceLevel] : undefined;

  return (
    <div className="min-h-screen bg-gray-50/50 pb-36 md:pb-16">
      {/* ── Breadcrumb bar ── */}
      <nav
        aria-label="Breadcrumb"
        className="border-b border-gray-100 bg-white/90 backdrop-blur-md sticky top-20 z-20"
      >
        <div className="mx-auto flex h-12 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-500 truncate">
            <button
              onClick={() => navigate(-1)}
              className="p-1 -ml-1 text-gray-600 hover:text-gray-900 transition-colors rounded-md"
              aria-label="Back"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <Link
              to="/menu"
              className="hover:text-brand-600 transition-colors truncate"
            >
              Menu
            </Link>
            <ChevronRight className="h-3 w-3 shrink-0 text-gray-400" />
            <Link
              to={`/restaurants/${restaurantId}`}
              className="hover:text-brand-600 transition-colors truncate max-w-[140px] sm:max-w-none"
            >
              {restaurantName}
            </Link>
            <ChevronRight className="h-3 w-3 shrink-0 text-gray-400" />
            <span className="font-semibold text-gray-900 truncate">
              {item.name}
            </span>
          </div>

          {matchingCartItems.length > 0 && (
            <Button
              asChild
              size="sm"
              variant="outline"
              className="h-8 text-xs border-brand-200 text-brand-600 hover:bg-brand-50"
            >
              <Link to="/cart">
                <ShoppingBag className="mr-1.5 h-3.5 w-3.5" />
                View Cart ({totalInCart})
              </Link>
            </Button>
          )}
        </div>
      </nav>

      {/* ── Main content grid ── */}
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
          {/* Left Column: Image & Details */}
          <div>
            <div className="grid gap-8 md:grid-cols-2">
              {/* Product Hero Image */}
              <div className="relative aspect-square overflow-hidden rounded-3xl bg-gray-100 shadow-xs border border-gray-100">
                <FoodImage
                  name={item.name}
                  src={item.image}
                  aspectRatio="1/1"
                  className="h-full w-full"
                  imgClassName="h-full w-full object-cover"
                />

                {/* Badges */}
                <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
                  {item.isPopular && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-brand-500 px-3 py-1 text-xs font-bold text-white shadow-xs">
                      <Flame className="h-3.5 w-3.5" /> Popular
                    </span>
                  )}
                  {item.isFeatured && (
                    <span className="rounded-full bg-purple-600 px-3 py-1 text-xs font-bold text-white shadow-xs">
                      Featured
                    </span>
                  )}
                </div>

                {hasDiscount && (
                  <div className="absolute right-3 top-3 rounded-full bg-red-500 px-2.5 py-1 text-xs font-bold text-white shadow-xs">
                    -{discountPct}%
                  </div>
                )}

                {(!item.isAvailable || isRestaurantClosed) && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-xs">
                    <span className="rounded-full bg-white px-4 py-2 text-xs sm:text-sm font-bold text-gray-900 shadow-md">
                      {isRestaurantClosed ? "Kitchen currently closed" : "Currently unavailable"}
                    </span>
                  </div>
                )}
              </div>

              {/* Product Info & Options */}
              <div className="flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 text-xs font-medium text-gray-500 mb-1">
                    <Link
                      to={`/restaurants/${restaurantId}`}
                      className="text-brand-600 hover:underline flex items-center gap-1"
                    >
                      <Store className="h-3.5 w-3.5" />
                      {restaurantName}
                    </Link>
                    {restaurant?.rating?.average ? (
                      <span className="flex items-center gap-0.5 text-gray-700">
                        · <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                        {restaurant.rating.average.toFixed(1)}
                      </span>
                    ) : null}
                  </div>

                  <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
                    {item.name}
                  </h1>

                  {/* Price display */}
                  <div className="mt-2.5 flex items-baseline gap-2.5">
                    <span className="text-2xl font-black text-brand-600 tracking-tight">
                      {formatTaka(unitPrice)}
                    </span>
                    {hasDiscount && (
                      <span className="text-base text-gray-400 line-through">
                        {formatTaka(item.originalPrice!)}
                      </span>
                    )}
                  </div>

                  {/* Dietary & Spice tags */}
                  {(item.dietaryTags.length > 0 || spice) && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {item.dietaryTags.map((tag) => (
                        <span
                          key={tag}
                          className={cn(
                            "rounded-full border px-2.5 py-0.5 text-[11px] font-medium capitalize",
                            DIETARY_COLORS[tag.toLowerCase()] ||
                              "border-gray-200 bg-gray-100 text-gray-700"
                          )}
                        >
                          {tag.replace(/[_-]/g, " ")}
                        </span>
                      ))}
                      {spice && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-[11px] font-medium text-red-700">
                          {Array.from({ length: spice.flames }).map((_, i) => (
                            <Flame key={i} className="h-3 w-3" />
                          ))}
                          {spice.label}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Description */}
                  {item.description && (
                    <p className="mt-4 text-sm leading-relaxed text-gray-600">
                      {item.description}
                    </p>
                  )}

                  {/* ── Variants selector ── */}
                  {item.variants && item.variants.length > 0 && (
                    <div className="mt-5 pt-4 border-t border-gray-100">
                      <h2 className="text-xs font-bold uppercase tracking-wider text-gray-900 mb-2">
                        Select Option
                      </h2>
                      <div className="grid gap-2">
                        {item.variants.map((v) => {
                          const isSelected = selectedVariant?._id === v._id;
                          return (
                            <button
                              key={v._id}
                              type="button"
                              onClick={() => setSelectedVariant(v)}
                              className={cn(
                                "flex items-center justify-between p-3 rounded-xl border-2 text-left text-sm transition-all",
                                isSelected
                                  ? "border-brand-500 bg-brand-50/40 text-brand-900 font-semibold shadow-xs"
                                  : "border-gray-200 hover:border-gray-300 text-gray-700"
                              )}
                              aria-pressed={isSelected}
                            >
                              <div className="flex items-center gap-2.5">
                                <span
                                  className={cn(
                                    "h-4 w-4 rounded-full border-2 flex items-center justify-center transition-colors",
                                    isSelected
                                      ? "border-brand-500 bg-brand-500"
                                      : "border-gray-300"
                                  )}
                                >
                                  {isSelected && (
                                    <span className="h-1.5 w-1.5 rounded-full bg-white" />
                                  )}
                                </span>
                                <span>{v.name}</span>
                              </div>
                              <span className="text-xs text-brand-600 font-bold">
                                +{formatTaka(v.price)}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* ── Add-ons selector ── */}
                  {item.addons && item.addons.length > 0 && (
                    <div className="mt-5 pt-4 border-t border-gray-100">
                      <h2 className="text-xs font-bold uppercase tracking-wider text-gray-900 mb-2">
                        Extras & Add-ons
                      </h2>
                      <div className="grid gap-2">
                        {item.addons.map((a) => {
                          const isSelected = selectedAddons.some(
                            (s) => s._id === a._id
                          );
                          return (
                            <button
                              key={a._id}
                              type="button"
                              onClick={() => toggleAddon(a)}
                              className={cn(
                                "flex items-center justify-between p-3 rounded-xl border-2 text-left text-sm transition-all",
                                isSelected
                                  ? "border-brand-500 bg-brand-50/40 text-brand-900 font-semibold shadow-xs"
                                  : "border-gray-200 hover:border-gray-300 text-gray-700"
                              )}
                              aria-pressed={isSelected}
                            >
                              <div className="flex items-center gap-2.5">
                                <span
                                  className={cn(
                                    "h-4 w-4 rounded border-2 flex items-center justify-center transition-colors",
                                    isSelected
                                      ? "border-brand-500 bg-brand-500"
                                      : "border-gray-300"
                                  )}
                                >
                                  {isSelected && (
                                    <Check className="h-3 w-3 text-white" />
                                  )}
                                </span>
                                <span>{a.name}</span>
                              </div>
                              <span className="text-xs text-gray-600 font-medium">
                                +{formatTaka(a.price)}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Desktop Primary Action Box ── */}
                <div className="mt-6 pt-5 border-t border-gray-100 hidden md:block">
                  {/* Cart sync notification */}
                  {matchingCartItems.length > 0 && (
                    <div className="mb-4 rounded-xl bg-brand-50/70 p-3 border border-brand-200/70 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-brand-600 shrink-0" />
                        <div>
                          <p className="text-xs font-bold text-brand-900">
                            Already in your cart ({totalInCart} item{totalInCart > 1 ? "s" : ""})
                          </p>
                          <p className="text-[11px] text-brand-700">
                            Update quantity below or choose options to add another item.
                          </p>
                        </div>
                      </div>
                      <Button
                        asChild
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs bg-white border-brand-300 text-brand-700"
                      >
                        <Link to="/cart">View Cart</Link>
                      </Button>
                    </div>
                  )}

                  {/* Existing Cart Lines Steppers (if already added) */}
                  {matchingCartItems.length > 0 && (
                    <div className="space-y-2 mb-4">
                      {matchingCartItems.map((cartLine: CartItem) => {
                        const variantDesc = [
                          cartLine.variants.map((v) => v.name).join(", "),
                          cartLine.addons.map((a) => `+${a.name}`).join(", "),
                        ]
                          .filter(Boolean)
                          .join(" · ");

                        return (
                          <div
                            key={cartLine.itemKey || cartLine.menuItemId}
                            className="flex items-center justify-between p-2.5 rounded-xl border border-gray-200 bg-white"
                          >
                            <div className="min-w-0 flex-1 mr-3">
                              <p className="text-xs font-semibold text-gray-900 truncate">
                                {item.name}
                              </p>
                              {variantDesc ? (
                                <p className="text-[11px] text-gray-500 truncate">
                                  {variantDesc}
                                </p>
                              ) : (
                                <p className="text-[11px] text-gray-400">Standard</p>
                              )}
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <div className="flex items-center gap-1.5 bg-gray-50 rounded-lg p-1 border border-gray-200">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (cartLine.quantity === 1) {
                                      removeItem(cartLine.itemKey || cartLine.menuItemId);
                                    } else {
                                      updateQuantity(
                                        cartLine.itemKey || cartLine.menuItemId,
                                        cartLine.quantity - 1
                                      );
                                    }
                                  }}
                                  className="h-7 w-7 flex items-center justify-center rounded-md bg-white text-gray-700 shadow-xs hover:bg-gray-100 transition-colors"
                                  aria-label="Decrease quantity"
                                >
                                  {cartLine.quantity === 1 ? (
                                    <Trash2 className="h-3.5 w-3.5 text-red-500" />
                                  ) : (
                                    <Minus className="h-3.5 w-3.5" />
                                  )}
                                </button>
                                <span className="w-6 text-center text-xs font-bold text-gray-900">
                                  {cartLine.quantity}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateQuantity(
                                      cartLine.itemKey || cartLine.menuItemId,
                                      cartLine.quantity + 1
                                    )
                                  }
                                  className="h-7 w-7 flex items-center justify-center rounded-md bg-brand-500 text-white shadow-xs hover:bg-brand-600 transition-colors"
                                  aria-label="Increase quantity"
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                </button>
                              </div>

                              <button
                                type="button"
                                onClick={() =>
                                  removeItem(cartLine.itemKey || cartLine.menuItemId)
                                }
                                className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                                aria-label="Remove item from cart"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Action Button Area */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 border border-gray-200 rounded-xl p-1 bg-white">
                      <button
                        type="button"
                        onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                        disabled={quantity <= 1}
                        className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-gray-100 disabled:opacity-30 text-gray-700"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="w-8 text-center text-sm font-bold text-gray-900">
                        {quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => setQuantity((q) => q + 1)}
                        className="h-9 w-9 flex items-center justify-center rounded-lg bg-brand-50 text-brand-600 hover:bg-brand-100"
                        aria-label="Increase quantity"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>

                    <Button
                      onClick={handleAddToCart}
                      disabled={!canAddToCart}
                      loading={isAdding}
                      variant="brand"
                      size="lg"
                      className="flex-1 justify-between h-12 text-sm font-bold"
                    >
                      <span>
                        {matchingCartItems.length > 0
                          ? (item.variants?.length ? "Add with selected options" : "Add more to cart")
                          : "Add to cart"}
                      </span>
                      <span>{formatTaka(effectivePrice)}</span>
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Nutrition Block (§5) */}
            <div className="mt-8">
              <NutritionEstimateBlock itemId={item._id} />
            </div>

            {/* Price Comparison Section (§3) */}
            <PriceComparisonSection
              itemId={item._id}
              restaurantId={restaurantId}
            />

            {/* Complementary Food Recommendations (§4) */}
            <ComplementaryPairingsSection
              itemId={item._id}
              restaurantId={restaurantId}
            />
          </div>

          {/* Right Column: Restaurant Context & Delivery Info */}
          <aside className="space-y-5">
            {/* Restaurant Card */}
            <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-2xl bg-brand-50 flex items-center justify-center">
                  {restaurant?.images?.logo ? (
                    <img
                      src={restaurant.images.logo}
                      alt={restaurantName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Store className="h-6 w-6 text-brand-500" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="font-bold text-gray-900 truncate text-sm">
                    {restaurantName}
                  </h2>
                  <p className="text-xs text-gray-500 truncate">
                    {restaurant?.cuisineType?.slice(0, 2).join(" · ") ||
                      "Multi-cuisine"}
                  </p>
                </div>
              </div>

              {/* Verified Delivery Info */}
              <div className="mt-4 pt-3 border-t border-gray-100 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-gray-500">
                    <Clock className="h-3.5 w-3.5 text-gray-400" />
                    Prep & Delivery
                  </span>
                  <span className="font-semibold text-gray-900">
                    {typeof restaurant?.deliveryTime === "object"
                      ? `${restaurant.deliveryTime.min}–${restaurant.deliveryTime.max} min`
                      : restaurant?.deliveryTime || "30–45 min"}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-gray-500">
                    <Truck className="h-3.5 w-3.5 text-gray-400" />
                    Delivery Charge
                  </span>
                  <div>
                    {deliveryQuote.hasLocation ? (
                      deliveryQuote.isLoading ? (
                        <Skeleton className="h-4 w-12" />
                      ) : deliveryQuote.isDeliverable ? (
                        <div className="text-right">
                          <span className="font-bold text-gray-900">
                            {formatTaka(deliveryQuote.deliveryFee ?? 0)}
                          </span>
                          {deliveryQuote.distanceKm !== undefined && (
                            <span className="text-[10px] text-gray-400 block">
                              {deliveryQuote.isEstimate ? "~" : ""}
                              {deliveryQuote.distanceKm} km
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-red-500 font-medium">Out of delivery range</span>
                      )
                    ) : (
                      <span className="text-gray-400">Location needed</span>
                    )}
                  </div>
                </div>

                {deliveryQuote.freeDeliveryCampaign && (
                  <div className="rounded-lg bg-emerald-50 p-2 text-emerald-800 text-[11px] font-semibold border border-emerald-100 flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    <span>{deliveryQuote.freeDeliveryCampaign}</span>
                  </div>
                )}
              </div>

              {/* Set Location Action if missing */}
              {!deliveryQuote.hasLocation && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={openPicker}
                  className="mt-3 w-full text-xs border-brand-200 text-brand-600 hover:bg-brand-50"
                >
                  <MapPin className="mr-1.5 h-3.5 w-3.5" />
                  Set your location for delivery fee
                </Button>
              )}

              <Button asChild variant="outline" className="mt-3 w-full text-xs">
                <Link to={`/restaurants/${restaurantId}`}>
                  View Kitchen Full Menu
                  <ChevronRight className="ml-1 h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>

            {/* Customer Reviews for this kitchen */}
            {reviews.length > 0 && (
              <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-xs">
                <div className="flex items-center justify-between mb-3 border-b border-gray-100 pb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-900">
                    Kitchen Reviews
                  </h3>
                  {typeof restaurant?.rating?.average === "number" &&
                    typeof restaurant?.rating?.count === "number" &&
                    restaurant.rating.count > 0 && (
                      <span className="flex items-center gap-1 text-xs font-bold text-gray-800">
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                        {restaurant.rating.average.toFixed(1)} ({restaurant.rating.count}{" "}
                        {restaurant.rating.count === 1 ? "rating" : "ratings"})
                      </span>
                    )}
                </div>

                <div className="space-y-3">
                  {reviews.map((rev) => (
                    <div key={rev._id} className="text-xs">
                      <div className="flex items-center justify-between text-gray-700">
                        <span className="font-semibold text-gray-900 truncate">
                          {typeof rev.customerId === "object" && rev.customerId
                            ? `${rev.customerId.firstName} ${rev.customerId.lastName}`.trim()
                            : "Verified Customer"}
                        </span>
                        <div className="flex items-center gap-0.5">
                          {Array.from({ length: rev.rating }).map((_, i) => (
                            <Star
                              key={i}
                              className="h-2.5 w-2.5 fill-amber-400 text-amber-400"
                            />
                          ))}
                        </div>
                      </div>
                      {rev.comment && (
                        <p className="mt-1 text-gray-600 line-clamp-2 italic">
                          "{rev.comment}"
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>

      {/* ── Mobile Sticky Bottom Action Bar (<768px) ── */}
      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 backdrop-blur-md p-3 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] md:hidden"
        style={{
          paddingBottom: "max(12px, env(safe-area-inset-bottom))",
        }}
      >
        <div className="flex items-center gap-2.5">
          {/* If already in cart, show quick stepper + add variation */}
          {matchingCartItems.length > 0 ? (
            <>
              <div className="flex items-center gap-1 bg-brand-50 rounded-xl p-1 border border-brand-200 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    const first = matchingCartItems[0];
                    if (totalInCart === 1) {
                      removeItem(first.itemKey || first.menuItemId);
                    } else {
                      updateQuantity(
                        first.itemKey || first.menuItemId,
                        totalInCart - 1
                      );
                    }
                  }}
                  className="h-10 w-10 flex items-center justify-center rounded-lg bg-white text-gray-700 shadow-xs"
                  aria-label="Decrease quantity"
                >
                  {totalInCart === 1 ? (
                    <Trash2 className="h-4 w-4 text-red-500" />
                  ) : (
                    <Minus className="h-4 w-4" />
                  )}
                </button>
                <span className="w-7 text-center text-sm font-bold text-brand-800">
                  {totalInCart}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const first = matchingCartItems[0];
                    updateQuantity(
                      first.itemKey || first.menuItemId,
                      totalInCart + 1
                    );
                  }}
                  className="h-10 w-10 flex items-center justify-center rounded-lg bg-brand-500 text-white shadow-xs"
                  aria-label="Increase quantity"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              <Button
                asChild
                variant="brand"
                size="lg"
                className="flex-1 h-12 text-sm font-bold justify-between"
              >
                <Link to="/cart">
                  <span>View in Cart</span>
                  <ShoppingBag className="h-4 w-4" />
                </Link>
              </Button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-1 border border-gray-200 rounded-xl p-1 bg-white shrink-0">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={quantity <= 1}
                  className="h-10 w-10 flex items-center justify-center rounded-lg hover:bg-gray-100 disabled:opacity-30 text-gray-700"
                  aria-label="Decrease quantity"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-6 text-center text-sm font-bold text-gray-900">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => q + 1)}
                  className="h-10 w-10 flex items-center justify-center rounded-lg bg-brand-50 text-brand-600"
                  aria-label="Increase quantity"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              <Button
                onClick={handleAddToCart}
                disabled={!canAddToCart}
                loading={isAdding}
                variant="brand"
                size="lg"
                className="flex-1 h-12 text-sm font-bold justify-between"
              >
                <span>{canAddToCart ? "Add to cart" : "Unavailable"}</span>
                {canAddToCart && <span>{formatTaka(effectivePrice)}</span>}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default MenuItemDetailPage;
