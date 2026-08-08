"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  bookingDetailsSchema,
  availabilitySearchSchema,
  MIN_RENTAL_DAYS,
  type BookingDetailsInput,
} from "@/lib/validations/booking";
import { BookingStepper } from "@/components/booking/booking-stepper";
import { BookingSummary } from "@/components/booking/booking-summary";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { CricketSpinner } from "@/components/ui/cricket-spinner";
import { AvailabilityCalendar } from "@/components/booking/availability-calendar";
import {
  COUNTRY_DIAL_CODES,
  DEFAULT_COUNTRY_CODE,
  getCountry,
  toE164,
} from "@/lib/phone";
import {
  useFilteredInput,
  PHONE_CHARS,
  NAME_CHARS,
  PERMIT_CHARS,
} from "@/lib/input-filters";

interface CalcResult {
  available: boolean;
  reason?: string;
  rentalDays?: number;
  totalCost?: number;
  amountDueNow?: number;
  discountApplied?: boolean;
  promoCode?: string | null;
  vehicle?: { vehicleId: number; make: string; model: string };
}

function BookingDetailsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const vehicleId = Number(searchParams.get("vehicleId"));
  const [pickupDate, setPickupDate] = React.useState(searchParams.get("pickup") ?? "");
  const [returnDate, setReturnDate] = React.useState(searchParams.get("return") ?? "");
  const [dateError, setDateError] = React.useState<string | null>(null);

  const [calc, setCalc] = React.useState<CalcResult | null>(null);
  const [loadingCalc, setLoadingCalc] = React.useState(true);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const datesSet = Boolean(pickupDate && returnDate);
  // Mirrors the search widget: once a pickup date is chosen, the return
  // calendar starts from it, so an invalid range is harder to select at all.
  const [pickupDraft, setPickupDraft] = React.useState("");
  const [returnDraft, setReturnDraft] = React.useState("");

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<BookingDetailsInput>({
    resolver: zodResolver(bookingDetailsSchema),
    defaultValues: { phoneCountry: DEFAULT_COUNTRY_CODE },
  });

  // Drives the placeholder so the expected number format updates as soon as
  // the customer changes country.
  const selectedCountry = getCountry(watch("phoneCountry") ?? DEFAULT_COUNTRY_CODE);

  // Keystroke/paste filters. These complement the Zod schema rather than
  // replacing it — see lib/input-filters.ts.
  const nameFilter = useFilteredInput(NAME_CHARS);
  const phoneFilter = useFilteredInput(PHONE_CHARS);
  const permitFilter = useFilteredInput(PERMIT_CHARS);

  React.useEffect(() => {
    if (!vehicleId || !datesSet) {
      setLoadingCalc(false);
      return;
    }
    setLoadingCalc(true);
    fetch("/api/booking/calculate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vehicleId, pickupDate, returnDate }),
    })
      .then((res) => res.json())
      .then((data) => setCalc(data))
      .finally(() => setLoadingCalc(false));
  }, [vehicleId, datesSet, pickupDate, returnDate]);

  async function onSubmit(data: BookingDetailsInput) {
    setSubmitError(null);

    // Normalise to E.164 before it leaves the browser, so the number stored
    // in the database and the number handed to WiPay are the same canonical
    // form regardless of how the customer typed it.
    const customer = {
      ...data,
      phone: toE164(data.phoneCountry, data.phone),
    };

    const res = await fetch("/api/booking/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vehicleId,
        pickupDate,
        returnDate,
        customer,
      }),
    });

    const result = await res.json();

    if (!res.ok) {
      setSubmitError(result.error ?? "Something went wrong. Please try again.");
      return;
    }

    router.push(`/booking/payment?bookingRef=${result.bookingRef}`);
  }

  if (!vehicleId) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
        <p className="text-neutral-600">
          Select a vehicle first from the{" "}
          <a href="/vehicles" className="text-customer underline">
            Vehicles &amp; Book
          </a>{" "}
          page.
        </p>
      </div>
    );
  }

  if (!datesSet) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
        <BookingStepper currentStep={2} />
        <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-neutral-900 mb-1">
            When would you like this vehicle?
          </h2>
          <p className="text-sm text-neutral-500 mb-5">
            Select your pickup and return dates. Unavailable dates are shown directly on the calendar.
          </p>
          <AvailabilityCalendar
            vehicleId={vehicleId}
            pickupDate={pickupDraft}
            returnDate={returnDraft}
            onChange={(pickup, returnD) => {
              setPickupDraft(pickup);
              setReturnDraft(returnD);
              if (!returnD) return;

              // Same schema the search widget on S1/S2 already uses, so this
              // calendar enforces the identical two-day-minimum rule rather
              // than a second, potentially inconsistent copy of it.
              const parsed = availabilitySearchSchema.safeParse({
                pickupDate: pickup,
                returnDate: returnD,
              });
              if (!parsed.success) {
                setDateError(
                  parsed.error.issues[0]?.message ?? "Enter a valid date range."
                );
                return;
              }
              setDateError(null);
              setPickupDate(pickup);
              setReturnDate(returnD);

              const params = new URLSearchParams(searchParams.toString());
              params.set("pickup", pickup);
              params.set("return", returnD);
              router.replace(`/booking/details?${params.toString()}`, { scroll: false });
            }}
          />
          {dateError && (
            <p className="text-sm text-status-maintenance mt-3">{dateError}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <BookingStepper currentStep={2} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <form onSubmit={handleSubmit(onSubmit)} className="lg:col-span-2 space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900 mb-4">Contact Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName" required>First Name</Label>
                <Input
                  id="firstName"
                  autoComplete="given-name"
                  maxLength={50}
                  {...nameFilter}
                  {...register("firstName")}
                  error={!!errors.firstName}
                />
                {errors.firstName && (
                  <p className="text-xs text-status-maintenance mt-1">{errors.firstName.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="lastName" required>Last Name</Label>
                <Input
                  id="lastName"
                  autoComplete="family-name"
                  maxLength={50}
                  {...nameFilter}
                  {...register("lastName")}
                  error={!!errors.lastName}
                />
                {errors.lastName && (
                  <p className="text-xs text-status-maintenance mt-1">{errors.lastName.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="email" required>Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  maxLength={100}
                  {...register("email")}
                  error={!!errors.email}
                />
                {errors.email && (
                  <p className="text-xs text-status-maintenance mt-1">{errors.email.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="phone" required>Phone Number</Label>
                <div className="flex gap-2">
                  <Select
                    id="phoneCountry"
                    aria-label="Country dialling code"
                    className="w-[42%] shrink-0"
                    {...register("phoneCountry")}
                  >
                    {COUNTRY_DIAL_CODES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name} ({c.dial})
                      </option>
                    ))}
                  </Select>
                  <Input
                    id="phone"
                    type="tel"
                    inputMode="tel"
                    placeholder={selectedCountry.example}
                    autoComplete="tel-national"
                    maxLength={20}
                    {...phoneFilter}
                    {...register("phone")}
                    error={!!errors.phone}
                  />
                </div>
                {errors.phone && (
                  <p className="text-xs text-status-maintenance mt-1">{errors.phone.message}</p>
                )}
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="address" required>Address</Label>
                <Input
                  id="address"
                  autoComplete="street-address"
                  maxLength={255}
                  {...register("address")}
                  error={!!errors.address}
                />
                {errors.address && (
                  <p className="text-xs text-status-maintenance mt-1">{errors.address.message}</p>
                )}
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-neutral-900 mb-4">
              Driving Permit
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Label htmlFor="drivingPermitNumber" required>
                  Driving Permit Number
                </Label>
                <Input
                  id="drivingPermitNumber"
                  maxLength={50}
                  {...permitFilter}
                  autoCapitalize="characters"
                  {...register("drivingPermitNumber")}
                  error={!!errors.drivingPermitNumber}
                />
                {errors.drivingPermitNumber && (
                  <p className="text-xs text-status-maintenance mt-1">
                    {errors.drivingPermitNumber.message}
                  </p>
                )}
                <p className="text-xs text-neutral-500 mt-1.5">
                  Visiting from overseas? Enter your licence or International
                  Driving Permit number. Bring the same document to pickup.
                </p>
              </div>
            </div>
          </div>

          <label className="flex items-start gap-2 text-sm text-neutral-600">
            <input type="checkbox" className="mt-0.5" {...register("agreeToTerms")} />
            I agree to the Terms and Conditions
          </label>
          {errors.agreeToTerms && (
            <p className="text-xs text-status-maintenance -mt-4">{errors.agreeToTerms.message}</p>
          )}

          {submitError && (
            <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-status-maintenance">
              {submitError}
            </div>
          )}

          <div className="flex justify-between pt-2">
            <Button type="button" variant="outline" onClick={() => router.push("/vehicles")}>
              ← Back
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || (calc !== null && calc.available === false)}
            >
              {isSubmitting ? "Processing…" : "Proceed to Payment →"}
            </Button>
          </div>
          <p className="text-xs text-neutral-400">* Required fields</p>
        </form>

        <div>
          <BookingSummary
            vehicle={calc?.vehicle ?? null}
            pickupDate={pickupDate}
            returnDate={returnDate}
            rentalDays={calc?.rentalDays}
            totalCost={calc?.totalCost}

            discountApplied={calc?.discountApplied}
            promoCode={calc?.promoCode}
            loading={loadingCalc}
            unavailableReason={calc && !calc.available ? calc.reason : null}
          />
        </div>
      </div>
    </div>
  );
}

export default function BookingDetailsPage() {
  return (
    <React.Suspense
      fallback={
        <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
          <CricketSpinner label="Loading…" />
        </div>
      }
    >
      <BookingDetailsContent />
    </React.Suspense>
  );
}
