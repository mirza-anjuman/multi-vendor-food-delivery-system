import React, { useState } from "react";
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
import { Crosshair, MapPin, Check } from "lucide-react";
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
    const ok = await requestBrowserLocation();
    setIsGpsLoading(false);
    if (ok) {
      closePicker();
    }
  };

  return (
    <Dialog open={isPickerOpen} onOpenChange={(open) => !open && closePicker()}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto p-5">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <MapPin className="h-5 w-5 text-brand-500" />
            Set Delivery Location
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Pin your location to see accurate road distance, delivery charges, and available restaurants.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 my-2">
          {/* Quick Action: Device GPS */}
          <Button
            type="button"
            variant="outline"
            onClick={handleUseGps}
            loading={isGpsLoading}
            className="w-full justify-center text-xs h-9 border-brand-200 bg-brand-50/50 hover:bg-brand-50 text-brand-700"
          >
            <Crosshair className="mr-1.5 h-4 w-4" />
            Use my current GPS location
          </Button>

          {/* Saved Addresses (if any) */}
          {savedAddresses.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-700 mb-2">Saved Addresses</p>
              <div className="grid gap-2">
                {savedAddresses.map((addr: UserAddress) => {
                  const hasCoords =
                    addr.coordinates?.latitude !== undefined &&
                    addr.coordinates?.longitude !== undefined;
                  const isSelected =
                    location?.latitude === addr.coordinates?.latitude &&
                    location?.longitude === addr.coordinates?.longitude;

                  return (
                    <button
                      key={addr._id}
                      type="button"
                      disabled={!hasCoords}
                      onClick={() => {
                        if (hasCoords) {
                          setLocation({
                            latitude: addr.coordinates.latitude,
                            longitude: addr.coordinates.longitude,
                            addressText: [addr.street, addr.area, addr.district].filter(Boolean).join(", "),
                            source: "saved_address",
                          });
                          closePicker();
                        }
                      }}
                      className={`flex items-center justify-between p-2.5 rounded-xl border text-left text-xs transition-colors ${
                        isSelected
                          ? "border-brand-500 bg-brand-50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 font-semibold text-gray-900">
                          <span className="capitalize">{addr.type}</span>
                          {addr.isDefault && (
                            <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-normal">
                              Default
                            </span>
                          )}
                        </div>
                        <p className="text-gray-500 truncate mt-0.5">
                          {[addr.street, addr.area, addr.district].filter(Boolean).join(", ")}
                        </p>
                      </div>
                      {isSelected && <Check className="h-4 w-4 text-brand-600 ml-2 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Interactive Map Picker */}
          <div>
            <p className="text-xs font-semibold text-gray-700 mb-2">Pin on Map or Search Address</p>
            <div className="rounded-xl overflow-hidden border border-gray-200">
              <LocationPicker
                value={picked || undefined}
                onChange={(val) => setPicked(val)}
                className="w-full"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
          <Button variant="ghost" size="sm" onClick={closePicker} className="text-xs">
            Cancel
          </Button>
          <Button
            variant="brand"
            size="sm"
            onClick={handleConfirm}
            disabled={!picked}
            className="text-xs px-4"
          >
            Apply Location
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
