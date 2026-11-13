import { z } from "zod";

export const locationSchema = z.object({
  city: z.string().trim().min(2).max(80),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});
export const chatSchema = z.object({
  message: z.string().trim().min(2).max(1000),
  location: locationSchema,
  category: z.enum(["groceries", "car", "shops"]).optional(),
});
export const quoteSchema = z.object({
  merchantId: z.string().max(40),
  asset: z.enum(["ETH", "USDC", "wNEAR"]),
  mode: z.enum(["demo", "live"]),
});

// Decimal strings avoid floating-point rounding of on-chain atomic amounts.
export function toAtomic(value: string, decimals: number): string {
  if (
    !/^\d+(\.\d+)?$/.test(value) ||
    !Number.isInteger(decimals) ||
    decimals < 0 ||
    decimals > 30
  ) {
    throw new Error("Invalid token amount");
  }
  const [whole, fraction = ""] = value.split(".");
  if (fraction.length > decimals) throw new Error("Token precision exceeded");
  return BigInt(whole + fraction.padEnd(decimals, "0")).toString();
}
export function fromAtomic(value: string, decimals: number): string {
  if (
    !/^\d+$/.test(value) ||
    !Number.isInteger(decimals) ||
    decimals < 0 ||
    decimals > 30
  )
    throw new Error("Invalid atomic amount");
  if (!decimals) return BigInt(value).toString();
  const padded = value.padStart(decimals + 1, "0");
  return `${padded.slice(0, -decimals)}.${padded.slice(-decimals)}`.replace(
    /\.?0+$/,
    "",
  );
}
