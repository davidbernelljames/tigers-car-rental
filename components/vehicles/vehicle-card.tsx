import Link from "next/link";
import Image from "next/image";
import { Fuel, Users2 } from "lucide-react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type VehicleCardData = {
  vehicleId: number;
  make: string;
  model: string;
  color: string;
  seats: number;
  dailyRate: number;
  category: string;
  status: "AVAILABLE" | "ON_RENTAL" | "IN_MAINTENANCE";
  photoUrl?: string | null;
  promoDiscountPercent?: number | null;
};

const STATUS_CONFIG = {
  AVAILABLE: { label: "Available", variant: "available" as const },
  ON_RENTAL: { label: "On Rental", variant: "onRental" as const },
  IN_MAINTENANCE: { label: "In Maintenance", variant: "maintenance" as const },
};

interface AvailabilityOverride {
  bookable: boolean;
  label: string;
  reason?: string;
}

export function VehicleCard({
  vehicle,
  bookHref,
  availabilityOverride,
}: {
  vehicle: VehicleCardData;
  bookHref?: string;
  availabilityOverride?: AvailabilityOverride;
}) {
  // When dates have been entered, the real date-range check takes over
  // (see VehicleFilterGrid) — otherwise fall back to the vehicle's static
  // current status.
  const status = STATUS_CONFIG[vehicle.status];
  const isAvailable = availabilityOverride
    ? availabilityOverride.bookable
    : vehicle.status === "AVAILABLE";
  const badgeLabel = availabilityOverride ? availabilityOverride.label : status.label;
  const badgeVariant = availabilityOverride
    ? availabilityOverride.bookable
      ? "available"
      : "maintenance"
    : status.variant;

  return (
    <Card className="overflow-hidden flex flex-col">
      <div className="relative h-40 w-full bg-gradient-to-br from-customer to-customer-light">
        {vehicle.photoUrl ? (
          <Image
            src={vehicle.photoUrl}
            alt={`${vehicle.make} ${vehicle.model}`}
            fill
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-white/40 text-sm">
            {vehicle.make} {vehicle.model} — photo pending
          </div>
        )}
        <div className="absolute top-3 right-3">
          <Badge variant={badgeVariant}>{badgeLabel}</Badge>
        </div>
        {vehicle.promoDiscountPercent && (
          <div className="absolute top-3 left-3">
            <Badge variant="available" dot={false}>
              {vehicle.promoDiscountPercent}% Off
            </Badge>
          </div>
        )}
      </div>

      <CardContent className="flex-1">
        <h3 className="font-semibold text-neutral-900">
          {vehicle.make} {vehicle.model}
        </h3>
        <p className="text-xs uppercase tracking-wide text-neutral-400 mt-0.5">
          {vehicle.category} &middot; {vehicle.color}
        </p>

        <div className="flex items-center gap-4 mt-3 text-sm text-neutral-500">
          <span className="flex items-center gap-1">
            <Users2 className="h-3.5 w-3.5" /> {vehicle.seats} seats
          </span>
          <span className="flex items-center gap-1">
            <Fuel className="h-3.5 w-3.5" /> Petrol
          </span>
        </div>

        {vehicle.promoDiscountPercent ? (
          <p className="mt-3">
            <span className="text-xl font-bold text-customer">
              TT${(vehicle.dailyRate * (1 - vehicle.promoDiscountPercent / 100)).toFixed(0)}
            </span>
            <span className="text-sm font-normal text-neutral-400 line-through ml-2">
              TT${vehicle.dailyRate.toFixed(0)}
            </span>
            <span className="text-sm font-normal text-neutral-400">/day</span>
          </p>
        ) : (
          <p className="mt-3 text-xl font-bold text-customer">
            TT${vehicle.dailyRate.toFixed(0)}
            <span className="text-sm font-normal text-neutral-400">/day</span>
          </p>
        )}

        {availabilityOverride?.reason && (
          <p className="mt-2 text-xs text-status-maintenance">
            {availabilityOverride.reason}
          </p>
        )}
      </CardContent>

      <CardFooter>
        {isAvailable ? (
          <Link
            href={bookHref ?? `/booking/details?vehicleId=${vehicle.vehicleId}`}
            className="w-full"
          >
            <Button className="w-full">Book</Button>
          </Link>
        ) : (
          <Button className="w-full" variant="outline" disabled>
            Unavailable
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
