import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CricketSpinner } from "@/components/ui/cricket-spinner";
import { formatVehicleWithDetails } from "@/lib/utils";

interface BookingSummaryProps {
  vehicle: { make: string; model: string; color?: string; registrationNumber?: string | null } | null;
  pickupDate: string;
  returnDate: string;
  rentalDays?: number;
  totalCost?: number;

  discountApplied?: boolean;
  promoCode?: string | null;
  loading?: boolean;
  unavailableReason?: string | null;
}

export function BookingSummary({
  vehicle,
  pickupDate,
  returnDate,
  rentalDays,
  totalCost,
  discountApplied,
  promoCode,
  loading,
  unavailableReason,
}: BookingSummaryProps) {
  return (
    <Card className="sticky top-24">
      <CardHeader>
        <CardTitle>Booking Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {vehicle && (
          <p className="font-medium text-neutral-900">
            {vehicle.color ? formatVehicleWithDetails({ ...vehicle, color: vehicle.color }) : `${vehicle.make} ${vehicle.model}`}
          </p>
        )}
        <div className="text-sm text-neutral-500">
          <p>Pickup: {pickupDate || "—"}</p>
          <p>Return: {returnDate || "—"}</p>
          {rentalDays && <p className="mt-1">{rentalDays} day(s)</p>}
        </div>

        {loading && <CricketSpinner size={28} label="Calculating…" />}

        {unavailableReason && (
          <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-status-maintenance">
            {unavailableReason}
          </div>
        )}

        {!loading && !unavailableReason && totalCost !== undefined && (
          <div className="border-t border-neutral-100 pt-3 space-y-1.5">
            {discountApplied && promoCode && (
              <div className="flex justify-between text-sm">
                <span className="text-status-available">Promo applied</span>
                <Badge variant="available" dot={false}>
                  {promoCode}
                </Badge>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold text-neutral-900">
              <span>Total due now</span>
              <span>TT${totalCost.toFixed(2)}</span>
            </div>
            <p className="text-xs text-neutral-500 mt-1">
              Paid in full online — nothing further to pay at pickup.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
