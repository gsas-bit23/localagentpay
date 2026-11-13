import { z } from "zod";
import { positiveAtomic, solanaAddress } from "./types";
const market = z.enum([
  "PK",
  "IN",
  "US",
  "GB",
  "AE",
  "DE",
  "SG",
  "NG",
  "CA",
  "AU",
  "FR",
  "JP",
]);
const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (value) =>
      Number.isFinite(Date.parse(`${value}T00:00:00Z`)) &&
      new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value,
    "Use a valid date.",
  );
const id = z.string().min(5).max(200);
const token = z.string().min(30).max(30000);
const traveller = z.object({
  given_name: z.string().trim().min(1).max(80),
  family_name: z.string().trim().min(1).max(80),
  born_on: day.optional(),
  title: z.enum(["mr", "mrs", "ms", "miss", "dr"]).optional(),
  gender: z.enum(["m", "f"]).optional(),
});
export const checkoutRequest = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("flights"),
    country: market,
    origin: z.string().regex(/^[A-Z]{3}$/),
    destination: z.string().regex(/^[A-Z]{3}$/),
    departure: day,
    returnDate: day.optional(),
    adults: z.number().int().min(1).max(4),
  }),
  z.object({
    action: z.literal("hotels"),
    country: market,
    location: z.string().trim().min(2).max(100),
    checkIn: day,
    checkOut: day,
    adults: z.number().int().min(1).max(4),
  }),
  z.object({ action: z.literal("rates"), hotelId: id }),
  z.object({
    action: z.literal("prepare"),
    kind: z.enum(["flight", "hotel"]),
    offerId: id,
    wallet: solanaAddress,
    travellers: z.array(traveller).min(1).max(4),
    email: z.email().max(200),
    phone: z.string().regex(/^\+[1-9]\d{6,14}$/),
    termsAccepted: z.literal(true),
  }),
  z.object({ action: z.literal("balance"), wallet: solanaAddress }),
  z.object({ action: z.literal("status"), token }),
  z.object({ action: z.literal("restore"), token }),
  z.object({ action: z.literal("flightUpdates"), searchId: id }),
  z.object({
    action: z.literal("execute"),
    token,
    payment: z.string().min(50).max(12000),
  }),
  z.object({
    action: z.literal("fund"),
    token,
    nearAccount: z
      .string()
      .min(2)
      .max(64)
      .regex(/^([a-z0-9]+[-_])*[a-z0-9]+(\.([a-z0-9]+[-_])*[a-z0-9]+)*$/),
  }),
  z.object({ action: z.literal("fundingStatus"), token }),
  z.object({
    action: z.literal("cancel"),
    token,
    familyName: z.string().trim().min(1).max(80),
    reason: z.string().trim().min(5).max(500),
    confirm: z.literal(true),
  }),
]);
export const intentSchema = z
  .object({
    id,
    customer_support_code: z.string().min(1).max(200),
    escrow_address: solanaAddress,
    expected_escrow_amount: positiveAtomic,
    expected_escrow_mint: z.string(),
    fee_amount: z.union([z.string(), z.number()]).transform(String),
    expected_ticket_amount: z.union([z.string(), z.number()]).transform(String),
    funding_wallet: solanaAddress,
    refund_wallet: solanaAddress,
    expires_at: z.string(),
    passenger_count: z.number().int().optional(),
  })
  .passthrough();
