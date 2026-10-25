import apiService from "@/services/apiService";
import { restaurantFallbackSVG } from "@/utils/fallbackImages";
import { useCustomerLocation } from "@/contexts/LocationContext";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { ArrowRight, Clock, MapPin, Navigation, Star } from "lucide-react";
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

type ApiRestaurant = {
  _id: string;
  name: string;
  cuisineType?: string[];
  rating?: {
    average?: number;
  };
  deliveryTime?: string | { min: number; max: number };
  address?: {
    street?: string;
    area?: string;
    city?: string;
    state?: string;
    district?: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
  };
  location?: {
    coordinates?: [number, number];
  };
  images?: {
    coverPhoto?: string;
    logo?: string;
  };
};

type NearbyRestaurant = {
  id: string;
  name: string;
  cuisine: string;
  rating: number;
  deliveryTime: string;
  location: string;
  image: string;
  distanceKm?: number;
};

const haversineKm = (
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
) => {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(from.lat)) *
      Math.cos(toRad(to.lat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

interface NearbyRestaurantsProps {
  onLoadedIds?: (ids: string[]) => void;
}

const NearbyRestaurants: React.FC<NearbyRestaurantsProps> = ({ onLoadedIds }) => {
  const { location, openPicker } = useCustomerLocation();
  const [restaurants, setRestaurants] = useState<NearbyRestaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    const loadRestaurants = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await apiService.getAllRestaurants();
        const payload = response.data as { data?: ApiRestaurant[] };
        const all = Array.isArray(payload.data) ? payload.data : [];

        const mapped: NearbyRestaurant[] = all.map((restaurant) => {
          let coords: { lat: number; lng: number } | undefined;
          if (
            typeof restaurant.address?.coordinates?.lat === "number" &&
            typeof restaurant.address?.coordinates?.lng === "number"
          ) {
            coords = {
              lat: restaurant.address.coordinates.lat,
              lng: restaurant.address.coordinates.lng,
            };
          } else if (
            Array.isArray(restaurant.location?.coordinates) &&
            restaurant.location.coordinates.length === 2
          ) {
            coords = {
              lat: restaurant.location.coordinates[1],
              lng: restaurant.location.coordinates[0],
            };
          }

          let distanceKm: number | undefined;
          if (coords && location?.latitude && location?.longitude) {
            distanceKm = haversineKm(
              { lat: location.latitude, lng: location.longitude },
              coords,
            );
          }

          return {
            id: restaurant._id,
            name: restaurant.name,
            cuisine: restaurant.cuisineType?.[0] || "Local favorite",
            rating: restaurant.rating?.average ?? 0,
            deliveryTime:
              typeof restaurant.deliveryTime === "object" &&
              restaurant.deliveryTime !== null
                ? `${restaurant.deliveryTime.min}-${restaurant.deliveryTime.max} min`
                : (restaurant.deliveryTime as string) || "30-45 min",
            location:
              [restaurant.address?.area, restaurant.address?.district]
                .filter(Boolean)
                .join(", ") || "Nearby area",
            image:
              restaurant.images?.coverPhoto ||
              restaurant.images?.logo ||
              restaurantFallbackSVG,
            distanceKm,
          };
        });

        if (isActive) {
          // If customer location is known, sort strictly by distance
          if (location) {
            mapped.sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));
          }
          const topNearby = mapped.slice(0, 6);
          setRestaurants(topNearby);
          if (onLoadedIds) {
            onLoadedIds(topNearby.map((r) => r.id));
          }
        }
      } catch {
        if (isActive) {
          setError("Failed to load nearby restaurants.");
          setRestaurants([]);
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    void loadRestaurants();

    return () => {
      isActive = false;
    };
  }, [location, onLoadedIds]);

  if (loading) {
    return (
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-gray-800 mb-12">
            Nearby Restaurants
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[...Array(6)].map((_, index) => (
              <div
                key={index}
                className="bg-white rounded-2xl shadow-md overflow-hidden animate-pulse"
              >
                <div className="h-48 bg-gray-200"></div>
                <div className="p-6">
                  <div className="h-6 bg-gray-200 rounded w-3/4 mb-4"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 gap-3">
          <div>
            <p className="text-xs font-semibold tracking-widest text-brand-500 uppercase mb-1">Nearby</p>
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900">Restaurants Near You</h2>
          </div>
          <Link
            to="/restaurants"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:text-brand-700 transition-colors"
          >
            View all <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Error notification if any */}
        {error && (
          <p className="mb-4 text-center text-xs text-red-500">{error}</p>
        )}

        {/* If location is unknown, prompt user to set location */}
        {!location && (
          <div className="mb-6 rounded-2xl bg-brand-50/70 border border-brand-200/80 p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3 text-center sm:text-left">
              <Navigation className="w-5 h-5 text-brand-600 shrink-0 hidden sm:block" />
              <div>
                <p className="text-sm font-semibold text-brand-900">
                  Showing restaurants near Sylhet city center
                </p>
                <p className="text-xs text-brand-700">
                  Set your exact address to see precise distance and live delivery fees.
                </p>
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={openPicker}
              className="bg-brand-500 hover:bg-brand-600 text-white shrink-0 text-xs font-semibold h-8"
            >
              Set My Location
            </Button>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {restaurants.length > 0 ? (
            restaurants.map((restaurant, index) => (
              <motion.div
                key={restaurant.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.07 }}
                whileHover={{ y: -4 }}
              >
                <Link to={`/restaurants/${restaurant.id}`} className="block bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300">
                  <div className="relative">
                    <img
                      src={restaurant.image}
                      alt={restaurant.name}
                      className="w-full h-44 object-cover"
                    />
                    <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm rounded-full px-2.5 py-1 flex items-center shadow-sm">
                      <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                      <span className="ml-1 text-xs font-semibold text-gray-800">{restaurant.rating}</span>
                    </div>
                  </div>

                  <div className="p-4">
                    <h3 className="text-sm font-bold text-gray-900 mb-0.5">{restaurant.name}</h3>
                    <p className="text-xs text-brand-500 font-medium mb-3">{restaurant.cuisine}</p>

                    <div className="flex justify-between items-center text-xs text-gray-400">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{restaurant.deliveryTime}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />
                        <span className="truncate max-w-[120px]">
                          {restaurant.distanceKm !== undefined
                            ? `${restaurant.distanceKm.toFixed(1)} km · ${restaurant.location}`
                            : restaurant.location}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))
          ) : (
            <div className="col-span-full rounded-2xl border border-dashed border-gray-200 bg-white/60 px-6 py-12 text-center text-gray-500 text-sm">
              No nearby restaurants are available right now.
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default NearbyRestaurants;
