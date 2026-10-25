import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useCustomerLocation } from "@/contexts/LocationContext";
import LocationPicker, { LocationPickerValue } from "@/components/location/LocationPicker";
import {
  Crosshair,
  MapPin,
  Check,
  Home,
  Briefcase,
  Map,
  Bookmark,
} from "lucide-react";
import { UserAddress } from "@/services/userService";

export const LocationModal: React.FC = () => {
  const {
    location,
    setLocation,
    isPickerOpen,
    closePicker,
    savedAddresses,
    requestBrowserLocation,
  } = useCustomerLocation();

  const [activeTab, setActiveTab] = useState<"map" | "saved">("map");
  const [picked, setPicked] = useState<LocationPickerValue | null>(() => {
    if (location) {
      return {
        latitude: location.latitude,
        longitude: location.longitude,
        address: location.addressText,
      };
    }
    return null;
  });

  const [isGpsLoading, setIsGpsLoading] = useState(false);

  // Sync internal picked state when modal opens
  useEffect(() => {
    if (isPickerOpen) {
      if (location) {
        setPicked({
          latitude: location.latitude,
          longitude: location.longitude,
          address: location.addressText,
        });
      }
      // If user has saved addresses and no location set yet, default to saved addresses
      if (savedAddresses.length > 0 && !location) {
        setActiveTab("saved");
      } else {
        setActiveTab("map");
      }
    }
  }, [isPickerOpen, location, savedAddresses.length]);

  const handleConfirm = () => {
    if (picked) {
      setLocation({
        latitude: picked.latitude,
        longitude: picked.longitude,
        addressText: picked.address || "Selected location",
        source: "picker",
      });
    }
    closePicker();
  };

  const handleUseGps = async () => {
    setIsGpsLoading(true);
    try {
      const ok = await requestBrowserLocation();
      if (ok) {
        closePicker();
      }
    } finally {
      setIsGpsLoading(false);
    }
  };

  const getAddressIcon = (type?: string) => {
    switch (type?.toLowerCase()) {
      case "home":
        return <Home className="h-4 w-4 text-brand-600" />;
      case "work":
      case "office":
        return <Briefcase className="h-4 w-4 text-blue-600" />;
      default:
        return <MapPin className="h-4 w-4 text-emerald-600" />;
    }
  };

  return (
    <Dialog open={isPickerOpen} onOpenChange={(open) => !open && closePicker()}>
      <DialogContent className="sm:max-w-xl max-h-[92vh] overflow-y-auto p-4 sm:p-6 rounded-3xl border border-gray-100 shadow-2xl">
        <DialogHeader className="space-y-1.5 pb-2 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-orange-100 text-brand-600">
              <MapPin className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold text-gray-900 tracking-tight">
                Set Delivery Location
              </DialogTitle>
              <DialogDescription className="text-xs text-gray-500">
                Pin your address to see accurate road distance and real-time delivery fees.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Tab switcher if user has saved addresses */}
        {savedAddresses.length > 0 && (
          <div className="flex rounded-xl bg-gray-100 p-1 text-xs font-semibold text-gray-600">
            <button
              type="button"
              onClick={() => setActiveTab("map")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg transition-all ${
                activeTab === "map"
                  ? "bg-white text-gray-900 shadow-xs font-bold"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              <Map className="h-3.5 w-3.5 text-brand-500" />
              Pin on Map & Search
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("saved")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg transition-all ${
                activeTab === "saved"
                  ? "bg-white text-gray-900 shadow-xs font-bold"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              <Bookmark className="h-3.5 w-3.5 text-blue-500" />
              Saved Addresses ({savedAddresses.length})
            </button>
          </div>
        )}

        {/* Tab 1: Map & Search */}
        {activeTab === "map" && (
          <div className="space-y-3">
            {/* Quick GPS Action Banner */}
            <div className="flex items-center justify-between gap-2 p-2.5 rounded-2xl bg-orange-50/60 border border-orange-100">
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-brand-500 text-white">
                  <Crosshair className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-gray-900 truncate">
                    Use GPS Location
                  </p>
                  <p className="text-[11px] text-gray-500 truncate">
                    Detect exact device coordinates
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="brand"
                size="sm"
                onClick={handleUseGps}
                loading={isGpsLoading}
                className="text-xs h-8 px-3 shrink-0 shadow-xs"
              >
                Locate Me
              </Button>
            </div>

            {/* Interactive Leaflet Map Picker */}
            <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-xs">
              <LocationPicker
                value={picked || undefined}
                onChange={(val) => setPicked(val)}
                mapHeight="290px"
                className="w-full"
              />
            </div>
          </div>
        )}

        {/* Tab 2: Saved Addresses */}
        {activeTab === "saved" && savedAddresses.length > 0 && (
          <div className="space-y-2 py-1">
            <p className="text-xs font-semibold text-gray-600 px-1">
              Select one of your saved delivery addresses:
            </p>
            <div className="grid gap-2 max-h-[320px] overflow-y-auto pr-1">
              {savedAddresses.map((addr: UserAddress) => {
                const hasCoords =
                  addr.coordinates?.latitude !== undefined &&
                  addr.coordinates?.longitude !== undefined;
                const isSelected =
                  picked?.latitude === addr.coordinates?.latitude &&
                  picked?.longitude === addr.coordinates?.longitude;

                return (
                  <button
                    key={addr._id}
                    type="button"
                    disabled={!hasCoords}
                    onClick={() => {
                      if (hasCoords) {
                        setPicked({
                          latitude: addr.coordinates.latitude,
                          longitude: addr.coordinates.longitude,
                          address: [addr.street, addr.area, addr.district]
                            .filter(Boolean)
                            .join(", "),
                        });
                      }
                    }}
                    className={`flex items-start justify-between p-3.5 rounded-2xl border text-left text-xs transition-all ${
                      isSelected
                        ? "border-brand-500 bg-orange-50/50 shadow-xs ring-1 ring-brand-500"
                        : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/50"
                    } ${!hasCoords ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                  >
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="p-2 rounded-xl bg-gray-50 border border-gray-100 shrink-0 mt-0.5">
                        {getAddressIcon(addr.type)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-900 capitalize">
                            {addr.type}
                          </span>
                          {addr.isDefault && (
                            <span className="text-[10px] bg-brand-100 text-brand-700 px-1.5 py-0.5 rounded-full font-semibold">
                              Default
                            </span>
                          )}
                        </div>
                        <p className="text-gray-600 text-xs mt-1 line-clamp-2 leading-relaxed">
                          {[addr.street, addr.area, addr.district]
                            .filter(Boolean)
                            .join(", ")}
                        </p>
                      </div>
                    </div>
                    {isSelected && (
                      <div className="ml-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white">
                        <Check className="h-3 w-3 stroke-[3]" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Selected Location Summary Card */}
        {picked && (
          <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-gray-50 border border-gray-200 text-xs">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <Check className="h-4 w-4 stroke-[2.5]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                Selected Delivery Location
              </p>
              <p className="font-semibold text-gray-900 truncate mt-0.5">
                {picked.address || `${picked.latitude.toFixed(4)}, ${picked.longitude.toFixed(4)}`}
              </p>
            </div>
          </div>
        )}

        {/* Modal Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={closePicker}
            className="text-xs h-9 px-4 text-gray-600 hover:text-gray-900"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="brand"
            size="sm"
            onClick={handleConfirm}
            disabled={!picked}
            className="text-xs h-9 px-5 shadow-xs font-semibold"
          >
            Confirm Location
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
export default LocationModal;
