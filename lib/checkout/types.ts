import { z } from "zod";
import type { MapLocation } from "../maps/geo";
export const SOLANA_MAINNET = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";
export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
export const solanaAddress = z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
export const positiveAtomic = z
  .union([
    z.string().regex(/^\d+$/),
    z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  ])
  .transform(String)
  .refine(
    (value) => BigInt(value) > 0n && BigInt(value) <= 100000000000n,
    "Amount is outside the supported checkout range.",
  );
export type TravelKind = "flight" | "hotel";
export type TravelOffer = {
  id: string;
  kind: TravelKind;
  title: string;
  subtitle: string;
  price: string;
  currency: string;
  expiresAt?: string;
  departure?: string;
  arrival?: string;
  timeZone?: string;
  duration?: string;
  stops?: number;
  baggage?: string;
  fare?: string;
  refundable?: boolean;
  changeable?: boolean;
  location?: MapLocation;
  dueAtHotel?: string;
  photo?: string;
  rating?: number;
  alternatives?: {
    id: string;
    name: string;
    price: string;
    refundable?: boolean;
    changeable?: boolean;
  }[];
};
export type HotelRate = {
  id: string;
  room: string;
  board: string;
  price: string;
  dueAtHotel: string;
  currency: string;
  refundable?: boolean;
  refundability: string;
  conditions: { title: string; description: string }[];
  cancellations: unknown[];
  expiresAt?: string;
};
export type BookingSummary = {
  kind: TravelKind;
  intentId: string;
  amount: string;
  amountAtomic: string;
  serviceFee: string;
  ticketAmount: string;
  wallet: string;
  refundWallet: string;
  escrow: string;
  expiresAt: string;
  title: string;
  travellers: number;
  dueAtHotel?: string;
};
export type PreparedCheckout = {
  token: string;
  summary: BookingSummary;
  requirements: Record<string, unknown>;
  paymentId: string;
  policy: string[];
  review: {
    travellers: { given_name: string; family_name: string }[];
    email: string;
    phone: string;
  };
};
export type FundingQuote = {
  token: string;
  depositAddress: string;
  amountIn: string;
  nearAmount: string;
  expiresAt: string;
  destinationAmount: string;
  status?: string;
};
export function usdcAmount(value: string | number) {
  const amount = BigInt(value);
  return `${amount / 1000000n}.${(amount % 1000000n).toString().padStart(6, "0")}`;
}
export function displayMoney(value: string, currency = "USD") {
  const n = Number(value);
  return Number.isFinite(n)
    ? new Intl.NumberFormat("en", {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
      }).format(n)
    : "Quote required";
}
export function isPayableStatus(value: string) {
  return value === "active" || value === "awaiting_payment";
}
