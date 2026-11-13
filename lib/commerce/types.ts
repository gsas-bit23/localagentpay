import type { CommerceCategory, CountryCode } from "./config";

export type CommerceProvider = {
  id: string;
  name: string;
  categories: CommerceCategory[];
  countries: CountryCode[] | "conditional";
  url: string;
  sourceUrl: string;
  description: string;
  payment: "near" | "crypto" | "fiat" | "unknown";
  paymentSource?: string;
  caveat: string;
  // This registry offers real provider handoffs, never fabricated API orders.
  handoff: "storefront" | "directory";
  travelServices?: ("flights" | "stays" | "cars" | "activities")[];
  checkoutSteps?: string[];
  excludedKeywords?: string[];
};
export type CommerceRoute = CommerceProvider & {
  score: number;
  reasons: string[];
  steps: string[];
  paymentLabel: string;
  actionable: boolean;
  // A suggested settlement path is not a live swap quote or funded invoice.
  quoteStatus: "invoice-required" | "not-supported" | "discovery-only";
  destinationAsset?: string;
};
export type CommerceResult = {
  message: string;
  query: string;
  country: CountryCode;
  countryName: string;
  category: CommerceCategory;
  routes: CommerceRoute[];
  budget?: { amount: number; currency: string };
  warning: string;
  source: "curated-provider-directory";
  reviewedAt: string;
};
