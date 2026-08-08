import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Formats a vehicle as "Make Model", used across the booking flow, PDF, and email. */
export function formatVehicleLabel(vehicle: {
  make: string;
  model: string;
}): string {
  return `${vehicle.make} ${vehicle.model}`;
}

/**
 * Formats a vehicle as "Make Model — Color (PLATE)" for contexts where two
 * same-named vehicles (e.g. the fleet's two Corollas) could be confused.
 * Kept separate from formatVehicleLabel: the rental agreement PDF already
 * shows colour/plate as their own rows, so this would just repeat them there.
 */
export function formatVehicleWithDetails(vehicle: {
  make: string;
  model: string;
  color: string;
  registrationNumber?: string | null;
}): string {
  const base = `${vehicle.make} ${vehicle.model} — ${vehicle.color}`;
  return vehicle.registrationNumber ? `${base} (${vehicle.registrationNumber})` : base;
}
