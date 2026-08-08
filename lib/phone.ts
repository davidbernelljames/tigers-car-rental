// Phone number handling.
//
// WiPay validates phone numbers by rules it doesn't publish, and rejects
// what it dislikes after the customer has already committed to paying. Since
// we can't replicate rules we can't see, this module does two things that
// are correct regardless: normalises every number to E.164 (the shape that
// succeeded in sandbox testing, +18684900175), and validates digit count per
// country to catch genuine typos without inventing policy.
//
// The country selector also serves overseas visitors arriving at Piarco
// directly, who shouldn't be pushed into a Trinidad number format.
// ============================================================================

export interface CountryDialCode {
  /** ISO 3166-1 alpha-2, used as the stable option value. */
  code: string;
  name: string;
  /** Dial prefix including the leading plus. */
  dial: string;
  /**
   * Expected number of subscriber digits AFTER the dial prefix.
   * For +1 countries this is 10 (area code + 7), since the country code and
   * area code are distinct — e.g. Trinidad numbers are 868 + 7 digits.
   */
  digits: number;
  /** Shown as the input placeholder, so the expected shape is obvious. */
  example: string;
}

/**
 * Countries offered in the selector.
 *
 * Trinidad and Tobago first as the default. The rest are the main origin
 * markets for arrivals at Piarco — North America, the UK, and the nearest
 * Caribbean neighbours — rather than an exhaustive world list, which would
 * bury the common cases. "Other" at the end keeps the form usable for anyone
 * not listed instead of blocking them.
 */
export const COUNTRY_DIAL_CODES: CountryDialCode[] = [
  // Home market first, as the default.
  { code: "TT", name: "Trinidad & Tobago", dial: "+1", digits: 10, example: "868 123 4567" },

  // Largest visitor sources for Piarco arrivals.
  { code: "US", name: "United States", dial: "+1", digits: 10, example: "555 123 4567" },
  { code: "CA", name: "Canada", dial: "+1", digits: 10, example: "416 123 4567" },
  { code: "GB", name: "United Kingdom", dial: "+44", digits: 10, example: "7400 123456" },

  // Caribbean neighbours and regional partners.
  { code: "BB", name: "Barbados", dial: "+1", digits: 10, example: "246 123 4567" },
  { code: "JM", name: "Jamaica", dial: "+1", digits: 10, example: "876 123 4567" },
  { code: "GD", name: "Grenada", dial: "+1", digits: 10, example: "473 123 4567" },
  { code: "LC", name: "St Lucia", dial: "+1", digits: 10, example: "758 123 4567" },
  { code: "VC", name: "St Vincent & Grenadines", dial: "+1", digits: 10, example: "784 123 4567" },
  { code: "AG", name: "Antigua & Barbuda", dial: "+1", digits: 10, example: "268 123 4567" },
  { code: "KN", name: "St Kitts & Nevis", dial: "+1", digits: 10, example: "869 123 4567" },
  { code: "DM", name: "Dominica", dial: "+1", digits: 10, example: "767 123 4567" },
  { code: "BS", name: "Bahamas", dial: "+1", digits: 10, example: "242 123 4567" },
  { code: "GY", name: "Guyana", dial: "+592", digits: 7, example: "123 4567" },
  { code: "SR", name: "Suriname", dial: "+597", digits: 7, example: "123 4567" },
  { code: "VE", name: "Venezuela", dial: "+58", digits: 10, example: "412 123 4567" },

  // Other common origins.
  { code: "DE", name: "Germany", dial: "+49", digits: 11, example: "1512 3456789" },
  { code: "FR", name: "France", dial: "+33", digits: 9, example: "6 12 34 56 78" },
  { code: "NL", name: "Netherlands", dial: "+31", digits: 9, example: "6 12345678" },
  { code: "IN", name: "India", dial: "+91", digits: 10, example: "98765 43210" },
  { code: "NG", name: "Nigeria", dial: "+234", digits: 10, example: "802 123 4567" },
  { code: "ZA", name: "South Africa", dial: "+27", digits: 9, example: "82 123 4567" },
  { code: "AU", name: "Australia", dial: "+61", digits: 9, example: "412 345 678" },
  { code: "BR", name: "Brazil", dial: "+55", digits: 11, example: "11 91234 5678" },

  // Escape hatch for anywhere unlisted. Requires the country code to be typed
  // in full, and is validated against the E.164 length bounds rather than a
  // per-country digit count — see validatePhone().
  { code: "OTHER", name: "Other — enter full number", dial: "+", digits: 0, example: "+countrycode number" },
];

export const DEFAULT_COUNTRY_CODE = "TT";

export function getCountry(code: string): CountryDialCode {
  return (
    COUNTRY_DIAL_CODES.find((c) => c.code === code) ?? COUNTRY_DIAL_CODES[0]
  );
}

/** Strips everything that is not a digit. */
export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * Builds an E.164 number from a country selection and the digits the customer
 * typed.
 *
 * Tolerates a customer pasting a number that already includes their country
 * code (a very common habit) rather than silently producing a doubled prefix
 * like +1868868...: if the digits already start with the dial code, it is not
 * added twice.
 */
export function toE164(countryCode: string, localNumber: string): string {
  const country = getCountry(countryCode);
  const digits = digitsOnly(localNumber);

  if (!digits) return "";

  // "Other" — the customer supplies the whole thing including country code.
  if (country.code === "OTHER") {
    return `+${digits}`;
  }

  const dialDigits = digitsOnly(country.dial);

  // Already prefixed with the country code — do not double it up.
  if (digits.startsWith(dialDigits) && digits.length > country.digits) {
    return `+${digits}`;
  }

  return `+${dialDigits}${digits}`;
}

export interface PhoneValidation {
  valid: boolean;
  message?: string;
}

/**
 * Validates the subscriber digits for the selected country.
 *
 * Deliberately checks length only, not carrier prefixes: prefix allocations
 * change as networks add ranges, and a stale prefix list would reject
 * legitimate new numbers. Length is stable and catches the realistic error —
 * a mistyped or truncated number.
 */
export function validatePhone(
  countryCode: string,
  localNumber: string
): PhoneValidation {
  const country = getCountry(countryCode);
  const digits = digitsOnly(localNumber);

  if (!digits) {
    return { valid: false, message: "Phone number is required" };
  }

  if (country.code === "OTHER") {
    // Without a per-country digit count to check against, this relies on the
    // E.164 bounds (8-15 digits including the country code) plus an explicit
    // "+" prefix. Requiring the "+" matters: it forces the customer to state
    // the country code rather than entering a local number that would be
    // unreachable from Trinidad.
    if (!localNumber.trim().startsWith("+")) {
      return {
        valid: false,
        message: "Start with + and your country code, e.g. +44 7400 123456",
      };
    }
    if (digits.length < 8 || digits.length > 15) {
      return {
        valid: false,
        message: "Enter your full international number, including country code",
      };
    }
    return { valid: true };
  }

  const dialDigits = digitsOnly(country.dial);
  // Accept a number that already carries its country code.
  const subscriber =
    digits.startsWith(dialDigits) && digits.length > country.digits
      ? digits.slice(dialDigits.length)
      : digits;

  if (subscriber.length !== country.digits) {
    return {
      valid: false,
      message: `${country.name} numbers are ${country.digits} digits — e.g. ${country.example}`,
    };
  }

  return { valid: true };
}

/**
 * Formats a stored E.164 number for display.
 *
 * Falls back to returning the input unchanged rather than throwing, so a
 * legacy row stored in an older format still renders something sensible.
 */
export function formatPhoneForDisplay(e164: string): string {
  if (!e164) return "";
  const digits = digitsOnly(e164);

  // +1 numbers (North America and much of the Caribbean): +1 XXX XXX XXXX
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+1 ${digits.slice(1, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }

  return e164;
}

/**
 * Strips the dial code from a stored E.164 number, returning just the
 * national significant number — the digits a country's own dialling
 * selector expects underneath it.
 *
 * WHY THIS EXISTS: WiPay's hosted checkout shows its own country selector
 * (defaulting to Trinidad, our merchant account's country) alongside the
 * phone number we submit. Sending the full E.164 value — dial code included
 * — produces a visible double prefix: WiPay's own "+1" selector sitting next
 * to a phone field that itself starts with "+1868...". Stripping the dial
 * code before sending leaves WiPay's selector to supply it, and the field
 * holds only the number underneath.
 *
 * The dial code is not stored separately (only the final E.164 string is
 * persisted), so this re-derives it by matching known prefixes, longest
 * first so "+1" cannot be matched inside a longer code that also starts
 * with 1.
 *
 * HONEST LIMITATION: this is built from what the sandbox checkout visibly
 * displayed, not from WiPay's own documentation of the `phone` field, which
 * does not specify its expected format. It resolves the case actually
 * observed (a Trinidad number). For a non-+1 customer, WiPay's selector may
 * still default to Trinidad regardless of what is sent — that appears to be
 * a property of the checkout page tied to the merchant account, not
 * something this value controls, and is worth re-checking against a live
 * international test rather than assumed fixed here.
 */
export function toNationalNumber(e164: string): string {
  const digits = digitsOnly(e164);
  if (!digits) return "";

  const dialCodesLongestFirst = [...COUNTRY_DIAL_CODES]
    .filter((c) => c.code !== "OTHER")
    .map((c) => digitsOnly(c.dial))
    .sort((a, b) => b.length - a.length);

  for (const code of dialCodesLongestFirst) {
    if (digits.startsWith(code) && digits.length > code.length) {
      return digits.slice(code.length);
    }
  }

  return digits;
}
