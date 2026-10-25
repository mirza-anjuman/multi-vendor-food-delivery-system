import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAuth } from "@/contexts/AuthContext";
import userService, { UserAddress } from "@/services/userService";
import { toast } from "@/lib/toast";
import { LocationModal } from "@/components/location/LocationModal";

export interface UserCoordinates {
  latitude: number;
  longitude: number;
  addressText?: string;
  source?: "saved_address" | "browser_gps" | "picker";
}

export interface LocationContextValue {
  location: UserCoordinates | null;
  setLocation: (loc: UserCoordinates | null) => void;
  isPickerOpen: boolean;
  openPicker: () => void;
  closePicker: () => void;
  savedAddresses: UserAddress[];
  isLoadingAddresses: boolean;
  requestBrowserLocation: () => Promise<boolean>;
}

const STORAGE_KEY = "foodrush_customer_location";

const LocationContext = createContext<LocationContextValue | null>(null);

export const LocationProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { isAuthenticated } = useAuth();
  const [location, setLocationState] = useState<UserCoordinates | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (
          typeof parsed.latitude === "number" &&
          typeof parsed.longitude === "number"
        ) {
          return parsed;
        }
      }
    } catch {
      // Ignore JSON error
    }
    return null;
  });

  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState<UserAddress[]>([]);
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(false);

  // Sync to localStorage
  const setLocation = useCallback((loc: UserCoordinates | null) => {
    setLocationState(loc);
    try {
      if (loc) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(loc));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // Ignore localStorage error
    }
  }, []);

  // Fetch saved addresses if authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      setSavedAddresses([]);
      return;
    }

    let isMounted = true;
    setIsLoadingAddresses(true);

    userService
      .getProfile()
      .then((res) => {
        if (isMounted && res.success && res.data?.user?.addresses) {
          const addrs = res.data.user.addresses;
          setSavedAddresses(addrs);

          // If no location set yet, adopt user's default saved address
          setLocationState((current) => {
            if (current) return current;
            const def = addrs.find((a: UserAddress) => a.isDefault) || addrs[0];
            if (
              def?.coordinates?.latitude !== undefined &&
              def?.coordinates?.longitude !== undefined
            ) {
              const newLoc: UserCoordinates = {
                latitude: def.coordinates.latitude,
                longitude: def.coordinates.longitude,
                addressText: [def.street, def.area, def.district]
                  .filter(Boolean)
                  .join(", "),
                source: "saved_address",
              };
              try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(newLoc));
              } catch {
                // Ignore storage errors
              }
              return newLoc;
            }
            return current;
          });
        }
      })
      .catch(() => {
        // Non-blocking
      })
      .finally(() => {
        if (isMounted) setIsLoadingAddresses(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated]);

  // Request browser geolocation (ONLY on user tap)
  const requestBrowserLocation = useCallback(async (): Promise<boolean> => {
    if (!navigator.geolocation) {
      toast.error("Geolocation not supported by your browser");
      return false;
    }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const newLoc: UserCoordinates = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            addressText: "Current location",
            source: "browser_gps",
          };
          setLocation(newLoc);
          toast.success("Location updated from your device GPS");
          resolve(true);
        },
        (err) => {
          toast.error(
            err.code === 1
              ? "Location permission denied"
              : "Unable to retrieve your location"
          );
          resolve(false);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    });
  }, [setLocation]);

  const openPicker = useCallback(() => setIsPickerOpen(true), []);
  const closePicker = useCallback(() => setIsPickerOpen(false), []);

  const value = useMemo<LocationContextValue>(
    () => ({
      location,
      setLocation,
      isPickerOpen,
      openPicker,
      closePicker,
      savedAddresses,
      isLoadingAddresses,
      requestBrowserLocation,
    }),
    [
      location,
      setLocation,
      isPickerOpen,
      openPicker,
      closePicker,
      savedAddresses,
      isLoadingAddresses,
      requestBrowserLocation,
    ]
  );

  return (
    <LocationContext.Provider value={value}>
      {children}
      <LocationModal />
    </LocationContext.Provider>
  );
};

export const useCustomerLocation = (): LocationContextValue => {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error(
      "useCustomerLocation must be used within a LocationProvider"
    );
  }
  return context;
};
