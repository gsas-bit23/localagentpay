import { z } from "zod";
import type { BookingSummary, TravelKind } from "./types";
import { CheckoutError } from "./brij";
const tokenSchema = z.object({
  v: z.literal(1),
  type: z.enum(["booking", "funding"]),
  expires: z.number(),
  data: z.record(z.string(), z.unknown()),
});
export type BookingSession = {
  kind: TravelKind;
  intentId: string;
  supportCode: string;
  wallet: string;
  payBy: number;
  args: Record<string, unknown>;
  requirements: Record<string, unknown>;
  summary: BookingSummary;
  paymentId: string;
  policy: string[];
};
function keySecret() {
  const value = process.env.CHECKOUT_SESSION_SECRET;
  if (!value || value.length < 40)
    throw new CheckoutError(
      "Checkout is coming soon while secure order storage is configured.",
      503,
      "CHECKOUT_NOT_CONFIGURED",
    );
  return value;
}
async function key() {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(keySecret()),
  );
  return crypto.subtle.importKey("raw", hash, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}
const encode = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64url");
export async function seal(
  type: "booking" | "funding",
  data: object,
  expires = Date.now() + 365 * 86400000,
) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData: new TextEncoder().encode("LocalAgentPay checkout v1"),
    },
    await key(),
    new TextEncoder().encode(JSON.stringify({ v: 1, type, data, expires })),
  );
  return `${encode(iv)}.${encode(new Uint8Array(cipher))}`;
}
export async function unseal<T>(
  token: string,
  type: "booking" | "funding",
): Promise<T> {
  keySecret();
  try {
    if (token.length > 30000) throw Error();
    const parts = token.split(".");
    if (parts.length !== 2) throw Error();
    const plain = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: Buffer.from(parts[0], "base64url"),
        additionalData: new TextEncoder().encode("LocalAgentPay checkout v1"),
      },
      await key(),
      Buffer.from(parts[1], "base64url"),
    );
    const payload = tokenSchema.parse(
      JSON.parse(new TextDecoder().decode(plain)),
    );
    if (payload.type !== type || payload.expires < Date.now()) throw Error();
    return payload.data as T;
  } catch {
    throw new CheckoutError(
      "This order recovery code is invalid or expired.",
      400,
      "INVALID_SESSION",
    );
  }
}
export function requirePayable(session: BookingSession) {
  if (session.payBy <= Date.now())
    throw new CheckoutError(
      "This payment quote expired. Check the order status, then request a fresh booking quote if it is still unpaid.",
      409,
      "QUOTE_EXPIRED",
    );
}
export function checkoutConfigured() {
  return (
    !!process.env.CHECKOUT_SESSION_SECRET &&
    process.env.CHECKOUT_SESSION_SECRET.length >= 40
  );
}
