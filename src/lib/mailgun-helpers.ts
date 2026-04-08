import crypto from "crypto";
import { NextRequest } from "next/server";

/**
 * Verify Mailgun webhook signature.
 * Mailgun signs with HMAC-SHA256: hex(HMAC(signing_key, timestamp + token)) === signature
 */
export function verifyMailgunSignature(
  timestamp: string,
  token: string,
  signature: string
): boolean {
  const signingKey = process.env.MAILGUN_WEBHOOK_SIGNING_KEY;
  if (!signingKey) {
    console.error("MAILGUN_WEBHOOK_SIGNING_KEY is not configured");
    return false;
  }

  const hmac = crypto
    .createHmac("sha256", signingKey)
    .update(timestamp + token)
    .digest("hex");

  if (hmac !== signature) {
    console.warn("Signature mismatch debug:", {
      timestamp,
      token: token.substring(0, 8) + "...",
      expected: hmac,
      received: signature,
      keyPrefix: signingKey.substring(0, 4) + "...",
    });
  }

  return hmac === signature;
}

/**
 * Try to extract form fields from the request.
 * Attempts formData() first, then falls back to text-based URL-encoded parsing.
 * Returns null if both fail.
 *
 * When formData() succeeds, the raw FormData is preserved so callers can
 * access File objects (e.g., ICS attachments) that aren't in the string map.
 */
export async function extractFormFields(
  request: NextRequest
): Promise<{ fields: Map<string, string>; method: string; rawFormData: FormData | null } | null> {
  // Attempt 1: request.formData() — works for multipart/form-data and
  // application/x-www-form-urlencoded in Node.js runtime
  try {
    const cloned = request.clone();
    const formData = await cloned.formData();
    const fields = new Map<string, string>();
    formData.forEach((value, key) => {
      if (typeof value === "string") {
        fields.set(key, value);
      }
    });
    if (fields.size > 0) {
      return { fields, method: "formData", rawFormData: formData };
    }
    // formData() succeeded but returned no string fields — fall through
    console.warn("formData() returned 0 string fields, trying text fallback");
  } catch (e) {
    console.warn("formData() threw:", e instanceof Error ? e.message : e);
  }

  // Attempt 2: Read raw body and parse as URL-encoded
  try {
    const text = await request.text();
    if (text.length > 0) {
      const params = new URLSearchParams(text);
      const fields = new Map<string, string>();
      params.forEach((value, key) => {
        fields.set(key, value);
      });
      if (fields.size > 0) {
        return { fields, method: "urlencoded-fallback", rawFormData: null };
      }
    }
    console.warn("Text body fallback also produced 0 fields, length:", text.length);
  } catch (e) {
    console.warn("Text body fallback threw:", e instanceof Error ? e.message : e);
  }

  return null;
}
