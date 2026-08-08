import { z } from "zod";
import { passwordSchema } from "@/lib/validations/booking";

// ============================================================================
// Validation schemas for admin CRUD (A4-A9). Shared between each resource's
// collection route and [id] route so create and update can never validate
// differently by accident.
// ============================================================================

export const vehicleInputSchema = z.object({
  make: z.string().trim().min(1, "Make is required").max(50),
  model: z.string().trim().min(1, "Model is required").max(50),
  color: z.string().trim().min(1, "Colour is required").max(30),
  registrationNumber: z.string().trim().max(20).nullable().optional(),
  seats: z.coerce.number().int().min(1).max(15),
  dailyRate: z.coerce.number().positive("Daily rate must be greater than zero"),
  category: z.enum(["ECONOMY", "SEDAN"]),
  status: z
    .enum(["AVAILABLE", "ON_RENTAL", "IN_MAINTENANCE", "RETIRED"])
    .optional(),
});

export const maintenanceInputSchema = z.object({
  vehicleId: z.coerce.number().int().positive(),
  serviceType: z.string().trim().min(1, "Service type is required").max(100),
  serviceDate: z.string().min(1, "Service date is required"),
  providerId: z.coerce.number().int().positive(),
  status: z.enum(["SCHEDULED", "COMPLETED"]).optional(),
});

export const maintenanceProviderInputSchema = z.object({
  name: z.string().trim().min(1, "Provider name is required").max(100),
  serviceType: z.enum([
    "MECHANIC",
    "AUTO_DETAILER",
    "BODY_TECHNICIAN",
    "WINDOW_TINTING",
    "OTHER",
  ]),
  phone: z.string().trim().max(20).optional(),
});

// Base shape kept separate from the cross-field refinement below, because
// `.partial()` (needed for PATCH updates that only send changed fields) only
// exists on a plain ZodObject — calling it on a ZodEffects (what `.refine()`
// produces) is a type error, caught by the production build rather than
// tsc's looser checking in this sandbox.
const promotionBaseSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Promo code is required")
    .max(20)
    .transform((v) => v.toUpperCase()),
  vehicleCategory: z.enum(["ECONOMY", "SEDAN"]),
  discountPercent: z.coerce
    .number()
    .positive("Discount must be greater than zero")
    .max(100, "Discount cannot exceed 100%"),
  startDate: z.string().min(1, "Start date is required"),
  expiryDate: z.string().min(1, "Expiry date is required"),
  vehicleId: z.coerce.number().int().positive().nullable().optional(),
});

/** Full validation, used at creation — includes the date-order check. */
export const promotionInputSchema = promotionBaseSchema.refine(
  (data) => new Date(data.expiryDate) > new Date(data.startDate),
  { message: "Expiry date must be after the start date", path: ["expiryDate"] },
);

/** Partial validation for updates — the cross-field check happens in the
 * route itself when both dates are present in the same request, since a
 * partial update might legitimately send only one of them. */
export const promotionUpdateSchema = promotionBaseSchema.partial();

export const settingsInputSchema = z.object({
  businessName: z.string().trim().min(1, "Business name is required").max(100),
  businessPhone: z.string().trim().min(1, "Primary phone is required").max(20),
  businessPhoneSecondary: z.string().trim().max(20).nullable().optional(),
  businessEmail: z
    .string()
    .trim()
    .email("Enter a valid email address")
    .max(100),
  businessAddress: z.string().trim().min(1, "Address is required").max(255),
  fullRefundWindowHours: z.coerce.number().int().min(0).max(720),
  cancellationFeePercent: z.coerce.number().min(0).max(100),
  lateReturnGraceHours: z.coerce.number().int().min(0).max(48),
  lateFeeAmount: z.coerce.number().min(0),
  // DAR Models A9-003: notification preference toggles for T-02 (pickup
  // reminders) and T-04 (post-rental feedback request).
  reminderNotificationsEnabled: z.boolean(),
  feedbackNotificationsEnabled: z.boolean(),
});

export const pickupDetailsSchema = z.object({
  mileageAtPickup: z.coerce.number().int().min(0).max(9_999_999),
  fuelLevelAtPickup: z.enum([
    "FULL",
    "THREE_QUARTER",
    "HALF",
    "QUARTER",
    "EMPTY",
  ]),
});

export const returnDetailsSchema = z.object({
  mileageAtReturn: z.coerce.number().int().min(0).max(9_999_999),
  fuelLevelAtReturn: z.enum([
    "FULL",
    "THREE_QUARTER",
    "HALF",
    "QUARTER",
    "EMPTY",
  ]),
});

export const customerUpdateSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(50),
  lastName: z.string().trim().min(1, "Last name is required").max(50),
  phone: z.string().trim().min(1, "Phone is required").max(20),
  address: z.string().trim().min(1, "Address is required").max(255),
  drivingPermitNumber: z.string().trim().max(50),
});

export const staffInputSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  firstName: z.string().trim().min(1, "First name is required").max(50),
  lastName: z.string().trim().min(1, "Last name is required").max(50),
  role: z.enum(["OWNER_ADMIN", "STAFF_AGENT"]),
  // Only used at creation time, when Supabase Auth needs a password to
  // create the account. Never sent back, never used on update.
  password: passwordSchema.optional(),
});
