import { useEffect, useState, useCallback, useRef } from "react";
import { useCustomerLocation } from "@/contexts/LocationContext";
import deliveryService, { SubOrderQuoteResult } from "@/services/deliveryService";

export interface RestaurantDeliveryQuoteState {
  hasLocation: boolean;
  isLoading: boolean;
  quote: SubOrderQuoteResult | null;
  distanceKm?: number;
  deliveryFee?: number;
  isEstimate?: boolean;
  isDeliverable: boolean;
  reason?: string;
  freeDeliveryCampaign?: string | null;
  error: string | null;
  refetch: () => void;
}

export function useDeliveryQuote(
  restaurantId?: string,
  itemsSubtotal: number = 0
): RestaurantDeliveryQuoteState {
  const { location } = useCustomerLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [quote, setQuote] = useState<SubOrderQuoteResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchIdRef = useRef(0);

  const fetchQuote = useCallback(async () => {
    if (!restaurantId || !location) {
      setQuote(null);
      setIsLoading(false);
      return;
    }

    const currentFetchId = ++fetchIdRef.current;
    setIsLoading(true);
    setError(null);

    try {
      const res = await deliveryService.quoteDelivery(
        { latitude: location.latitude, longitude: location.longitude },
        [{ restaurantId, itemsSubtotal }]
      );

      if (currentFetchId !== fetchIdRef.current) return;

      if (res.success && res.data?.quotes?.length) {
        const found = res.data.quotes.find((q) => q.restaurantId === restaurantId);
        if (found) {
          setQuote(found);
        } else {
          setQuote(null);
          setError("Restaurant not found in delivery quote");
        }
      } else {
        setQuote(null);
        setError(res.message || "Failed to calculate delivery fee");
      }
    } catch (err: unknown) {
      if (currentFetchId === fetchIdRef.current) {
        setQuote(null);
        setError(err instanceof Error ? err.message : "Delivery fee unavailable");
      }
    } finally {
      if (currentFetchId === fetchIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [restaurantId, location, itemsSubtotal]);

  useEffect(() => {
    void fetchQuote();
  }, [fetchQuote]);

  if (!location) {
    return {
      hasLocation: false,
      isLoading: false,
      quote: null,
      isDeliverable: false,
      error: null,
      refetch: fetchQuote,
    };
  }

  const freeDeliveryCampaign = quote?.campaign?.name || quote?.campaign?.label || null;

  return {
    hasLocation: true,
    isLoading,
    quote,
    distanceKm: quote?.distanceKm,
    deliveryFee: quote?.feeCharged,
    isEstimate: quote?.isEstimate,
    isDeliverable: quote?.deliverable ?? false,
    reason: quote?.reason,
    freeDeliveryCampaign,
    error,
    refetch: fetchQuote,
  };
}
