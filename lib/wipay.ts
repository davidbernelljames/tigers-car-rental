import crypto from "crypto";

// ============================================================================
// WiPay Plugins Payment Request API integration
// Implemented against the official WiPay Payments API Documentation v1.0.8
// (23/12/2024), retrieved from wipaycaribbean.com.
//
// IMPORTANT — CORRECTIONS TO EARLIER PROJECT ASSUMPTIONS:
//
// 1. The `developer_id` parameter referenced in some third-party guides
//    belongs to WiPay's DEPRECATED "Old API". The current API replaced it
//    with `account_number`. This file uses the current API.
//
// 2. Callback verification uses MD5, not HMAC. The official docs specify
//    the hash is md5(transaction_id + total + apiKey), concatenated with
//    NO separators. The Pseudocode document (Algorithm A-02, Normal Flow
//    step 2) describes this as an "HMAC hash" — that wording should be
//    corrected to "MD5 hash" during the Phase 7 pseudocode revision so the
//    document matches the real implementation.
//
// 3. The hash response parameter is returned for `status = success`
//    transactions ONLY. Failed/error callbacks legitimately arrive with no
//    hash, so verification must not be a blanket requirement — see
//    verifyCallbackHash() below.
//
// 4. The callback is delivered as a GET web-redirect with a querystring,
//    not a POST body.
//
// SANDBOX CREDENTIALS (no WiPay account required):
//   account_number : 1234567890  (documented WiPay SANDBOX Account Number)
//   API key        : 123         (documented API Key of the TEST Account)
// The docs state plainly that there are no special requirements for using
// the API for SANDBOX transactions; a Verified Business Account and a real
// API Key are prerequisites for LIVE transactions only.
// ============================================================================

const WIPAY_SANDBOX_ACCOUNT_NUMBER = "1234567890";
const WIPAY_SANDBOX_API_KEY = "123";

export type WiPayEnvironment = "sandbox" | "live";

export function getWiPayEnv(): WiPayEnvironment {
  return process.env.WIPAY_ENV === "live" ? "live" : "sandbox";
}

/**
 * Resolves the account number and API key for the active environment.
 *
 * In sandbox we deliberately fall back to WiPay's documented public test
 * credentials so the full payment cycle can be demonstrated without anyone
 * registering a WiPay Business Account under their own or the client's name.
 * In live mode the real values are required and absence is a hard error —
 * we never silently fall back to test credentials for real money.
 */
export function getWiPayCredentials(): { accountNumber: string; apiKey: string } {
  const env = getWiPayEnv();

  if (env === "live") {
    const accountNumber = process.env.WIPAY_ACCOUNT_NUMBER;
    const apiKey = process.env.WIPAY_API_KEY;
    if (!accountNumber || !apiKey) {
      throw new Error(
        "WIPAY_ACCOUNT_NUMBER and WIPAY_API_KEY must be set when WIPAY_ENV=live"
      );
    }
    return { accountNumber, apiKey };
  }

  return {
    accountNumber: process.env.WIPAY_ACCOUNT_NUMBER || WIPAY_SANDBOX_ACCOUNT_NUMBER,
    apiKey: process.env.WIPAY_API_KEY || WIPAY_SANDBOX_API_KEY,
  };
}

// TT platform endpoint — matches country_code "TT" and TTD currency.
const WIPAY_REQUEST_URL = "https://tt.wipayfinancial.com/plugins/payments/request";

export interface CreatePaymentRequestInput {
  /** Booking reference, used as WiPay's order_id (must be unique). */
  orderId: string;
  /** Amount in TTD, will be formatted to 2 decimal places. */
  total: number;
  /** Absolute URL WiPay redirects the customer back to after checkout. */
  responseUrl: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
}

export interface CreatePaymentRequestResult {
  url: string;
  message: string;
  transactionId?: string;
}

/**
 * Requests a WiPay hosted payment page URL for a booking.
 *
 * Note on order_id: WiPay requires it to begin and end with an alphanumeric
 * character and be unique. Our booking refs (TCR-0001) satisfy both.
 */
export async function createWiPayPaymentRequest(
  input: CreatePaymentRequestInput
): Promise<CreatePaymentRequestResult> {
  const { accountNumber } = getWiPayCredentials();

  const params = new URLSearchParams();
  params.append("account_number", accountNumber);
  params.append("avs", "0");
  params.append("country_code", "TT");
  params.append("currency", "TTD");
  params.append("environment", getWiPayEnv());
  // merchant_absorb keeps the customer-facing total identical to the amount
  // quoted in the booking summary. Under customer_pay the gateway would add
  // WiPay's transaction fee on top, so the figure the customer is charged
  // would no longer match the total shown on S4/S5.
  params.append("fee_structure", "merchant_absorb");
  params.append("method", "credit_card");
  params.append("order_id", input.orderId);
  params.append("origin", "TigersCarRental");
  params.append("response_url", input.responseUrl);
  params.append("total", input.total.toFixed(2));

  if (input.customerName) params.append("name", input.customerName);
  if (input.customerEmail) params.append("email", input.customerEmail);
  if (input.customerPhone) params.append("phone", input.customerPhone);

  const response = await fetch(WIPAY_REQUEST_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });

  // Read as text first. WiPay does not always return JSON — an error page, a
  // WAF block, or a maintenance notice arrives as HTML, and calling
  // response.json() on that throws a parse error that hides the real cause.
  const raw = await response.text();

  let result: { url?: string; message?: string; transaction_id?: string };
  try {
    result = JSON.parse(raw);
  } catch {
    throw new Error(
      `WiPay returned a non-JSON response (HTTP ${response.status}): ${raw
        .slice(0, 300)
        .replace(/\s+/g, " ")
        .trim()}`
    );
  }

  if (!response.ok || !result.url) {
    throw new Error(
      `WiPay payment request failed (HTTP ${response.status}): ${
        result.message ?? response.statusText ?? "no message returned"
      }`
    );
  }

  return {
    url: result.url,
    message: result.message ?? "",
    transactionId: result.transaction_id,
  };
}

/**
 * The response parameters WiPay appends to the response_url querystring.
 * Several are documented as "conditionally absent", hence the optionals.
 */
export interface WiPayCallbackParams {
  status?: string;
  order_id?: string;
  transaction_id?: string;
  total?: string;
  hash?: string;
  message?: string;
  card?: string;
  currency?: string;
  date?: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
}

/**
 * Verifies a WiPay callback's MD5 hash.
 *
 * Per the official docs the hash is:
 *   md5(transaction_id + total + apiKey)
 * with no separators between the concatenated parts.
 *
 * The hash is only returned for `status = success`. For failed/error
 * callbacks WiPay legitimately omits it, so we return "skipped" rather than
 * "invalid" in that case — treating an absent hash on a declined payment as
 * tampering would break every legitimate decline. We still refuse to accept
 * a SUCCESS callback that has no hash, since that is the case where a forged
 * request would actually be worth something to an attacker.
 */
export function verifyCallbackHash(
  params: WiPayCallbackParams
): { valid: boolean; reason: string } {
  const { apiKey } = getWiPayCredentials();
  const isSuccess = params.status?.toLowerCase() === "success";

  if (!params.hash) {
    if (isSuccess) {
      return {
        valid: false,
        reason: "Success callback arrived without a hash — rejected",
      };
    }
    return {
      valid: true,
      reason: "No hash present (expected for non-success callbacks)",
    };
  }

  if (!params.transaction_id || !params.total) {
    return {
      valid: false,
      reason: "Hash present but transaction_id or total missing — cannot verify",
    };
  }

  // WiPay computes the hash over the total AS SUBMITTED in the payment
  // request (e.g. "120.00") but returns the total in the callback in a
  // NORMALISED form (e.g. "120"). Hashing the returned value alone therefore
  // fails for any amount with trailing zeros. Confirmed against a real
  // sandbox callback: md5(txId + "120" + key) mismatched, while
  // md5(txId + "120.00" + key) matched exactly.
  //
  // Trying both formats is not a weakening of the check — each candidate is
  // still a full MD5 over the API key, which an attacker does not hold. It
  // only accounts for an ambiguity in WiPay's own formatting.
  const rawTotal = params.total;
  const parsedTotal = Number(rawTotal);
  const candidates = new Set<string>([rawTotal]);
  if (Number.isFinite(parsedTotal)) {
    candidates.add(parsedTotal.toFixed(2));
    candidates.add(String(parsedTotal));
  }

  const provided = params.hash.toLowerCase();
  const providedBuf = Buffer.from(provided, "utf8");

  let valid = false;
  let matchedTotal: string | null = null;

  for (const candidate of candidates) {
    const expected = crypto
      .createHash("md5")
      .update(`${params.transaction_id}${candidate}${apiKey}`)
      .digest("hex");
    const expectedBuf = Buffer.from(expected, "utf8");

    if (
      expectedBuf.length === providedBuf.length &&
      // Constant-time comparison to avoid leaking hash contents via timing.
      crypto.timingSafeEqual(expectedBuf, providedBuf)
    ) {
      valid = true;
      matchedTotal = candidate;
      break;
    }
  }

  return {
    valid,
    reason: valid
      ? `Hash verified (total format: "${matchedTotal}")`
      : "Hash mismatch",
  };
}
