import { z } from "zod";
import {
  countries,
  commerceCategories,
  type CountryCode,
  type CommerceCategory,
} from "./config";
import { commerceProviders } from "./providers";
import type { CommerceResult, CommerceRoute, CommerceProvider } from "./types";

export const routingSchema = z.object({
  query: z.string().trim().min(3).max(1000),
  country: z
    .enum([
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
    ])
    .optional(),
  city: z.string().trim().max(80).optional(),
  category: z
    .enum([
      "groceries",
      "food",
      "shopping",
      "travel",
      "mobile",
      "services",
      "digital",
    ])
    .optional(),
  cryptoOnly: z.boolean().default(false),
});

function contains(text: string, phrase: string) {
  return new RegExp(
    `\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
    "i",
  ).test(text);
}
function namesProvider(query: string, provider: CommerceProvider) {
  const brand =
    provider.id === "alternative-airlines"
      ? "alternative airlines"
      : provider.name.split(/[\s/]/)[0];
  return contains(query, brand);
}
export function inferCategory(
  query: string,
  hint?: CommerceCategory,
): CommerceCategory {
  if (hint) return hint;
  // Specific requests beat broad words such as "buy" and "shop".
  for (const id of [
    "services",
    "mobile",
    "digital",
    "travel",
    "groceries",
    "food",
  ] as const) {
    const item = commerceCategories.find((c) => c.id === id)!;
    if (item.keywords.some((word) => contains(query, word))) return id;
  }
  const named = commerceProviders.find((provider) =>
    namesProvider(query, provider),
  );
  if (named && named.categories.length === 1) return named.categories[0];
  if (
    commerceCategories
      .find((c) => c.id === "shopping")!
      .keywords.some((word) => contains(query, word))
  )
    return "shopping";
  throw new Error(
    "Choose a category, or describe a purchase such as groceries, food delivery, shopping, travel, mobile top-ups, domains/hosting, or a local service.",
  );
}

export function inferCountry(
  query: string,
  selected?: CountryCode,
): CountryCode {
  const matches = countries.filter((c) =>
    c.aliases.some((alias) => contains(query, alias)),
  );
  // Explicit country names override inferred city names (e.g. "London, Canada").
  const explicit = countries.filter((c) =>
    [
      c.name.toLowerCase(),
      ...c.aliases.filter((a) =>
        ["usa", "us", "uk", "britain", "uae"].includes(a),
      ),
    ].some((a) => contains(query, a)),
  );
  // "us" as a pronoun is not enough to override the selected country.
  const strong = explicit.filter(
    (c) =>
      c.code !== "US" ||
      /\b(?:USA|United States|in the US|in US|US\s+(?:stores|shopping|delivery))\b/i.test(
        query,
      ),
  );
  const unsupported =
    /\b(mexico|brazil|bangladesh|saudi arabia|south africa|egypt|indonesia|philippines|kenya|turkey|netherlands|spain|italy)\b/i.exec(
      query,
    );
  if (unsupported)
    throw new Error(
      `${unsupported[1]} is not in the current country directory — Coming soon. Choose one of the listed countries; availability is not inferred from a neighboring market.`,
    );
  if (selected) {
    if (strong.length === 1 && strong[0].code !== selected)
      throw new Error(
        `Your request names ${strong[0].name}, but the country selector is set to ${countries.find((c) => c.code === selected)!.name}. Update one so the purchase destination is clear.`,
      );
    return selected;
  }
  const found = strong.length
    ? strong
    : matches.filter(
        (c) =>
          c.code !== "US" ||
          /\b(?:USA|United States|in the US|in US|san francisco|new york|los angeles)\b/i.test(
            query,
          ),
      );
  if (found.length > 1 && !selected)
    throw new Error(
      "Your request mentions several countries. Select the country where the purchase will be used, then try again.",
    );
  if (found.length === 1) return found[0].code;
  if (selected) return selected;
  throw new Error(
    "Choose a country, or include one in your request, such as ‘groceries in Pakistan’. Country coverage is checked before recommending merchants.",
  );
}

function paymentRoute(
  provider: CommerceProvider,
): Pick<
  CommerceRoute,
  "steps" | "paymentLabel" | "actionable" | "quoteStatus" | "destinationAsset"
> {
  if (provider.payment === "near")
    return {
      paymentLabel: "NEAR listed at provider checkout",
      actionable: true,
      quoteStatus: "invoice-required",
      destinationAsset: "NEAR · confirm invoice network",
      steps: [
        "Choose the booking on Travala",
        "Confirm NEAR and its network on that booking's invoice",
        "Review invoice amount, expiry, and refund terms",
        "Approve payment in your own wallet",
        "Wait for Travala's booking confirmation",
      ],
    };
  if (provider.payment === "crypto")
    return {
      paymentLabel: "Crypto checkout · invoice required",
      actionable: true,
      quoteStatus: "invoice-required",
      destinationAsset: "Provider's invoiced token and chain",
      steps: [
        `Select an eligible purchase and destination on ${provider.name}`,
        "Obtain the actual token, chain, amount, and recipient from checkout",
        "If needed, convert NEAR through NEAR Intents into a compatible destination wallet",
        "Pay the invoice using the provider's required wallet flow before expiry",
        `Confirm payment and fulfillment with ${provider.name}`,
      ],
    };
  if (provider.handoff === "directory")
    return {
      paymentLabel: "Contact provider for payment methods",
      actionable: false,
      quoteStatus: "discovery-only",
      steps: [
        "Find providers serving your city",
        "Confirm service details and obtain an actual estimate",
        "Ask which payment methods the provider accepts",
        "Use NEAR only after verifying a supported recipient or checkout integration",
      ],
    };
  return {
    paymentLabel: "Provider checkout · NEAR not connected",
    actionable: false,
    quoteStatus: "not-supported",
    steps: [
      "Open the merchant's regional storefront",
      "Set your delivery address and build the real cart",
      "Check the final price, stock, fees, and delivery window",
      "Use a payment method supported by that checkout",
      "NEAR-funded checkout needs an additional verified payment integration",
    ],
  };
}

export function planCommerce(
  input: z.input<typeof routingSchema>,
): CommerceResult {
  const request = routingSchema.parse(input);
  if (
    /\bgift[\s-]?cards?\b|\bvouchers?\b/i.test(request.query) &&
    !/\b(?:without|avoid|skip|no|not using|don't use|do not use)\s+(?:any\s+)?(?:gift[\s-]?cards?|vouchers?)\b/i.test(
      request.query,
    )
  )
    throw new Error(
      "This finder focuses on direct purchases. Gift cards and voucher suggestions are excluded; describe the goods or service you want instead.",
    );
  const country = inferCountry(
    `${request.query} ${request.city || ""}`,
    request.country,
  );
  const region = countries.find((c) => c.code === country)!;
  const category = inferCategory(request.query, request.category);
  const name = commerceCategories
    .find((c) => c.id === category)!
    .name.toLowerCase();
  const budgetMatch = request.query.match(
    /(?:under|below|budget(?:\s+of)?|less than|up to|max(?:imum)?)\s*(USD|PKR|INR|GBP|AED|EUR|SGD|NGN|CAD|AUD|JPY|[$£€])?\s*(\d+(?:,\d{3})*(?:\.\d{1,2})?)/i,
  );
  const budgetCurrency = budgetMatch?.[1]?.toUpperCase();
  const budget = budgetMatch
    ? {
        amount: Number(budgetMatch[2].replaceAll(",", "")),
        currency: budgetCurrency
          ? ({ $: "USD", "£": "GBP", "€": "EUR" }[budgetCurrency] ??
            budgetCurrency)
          : region.currency,
      }
    : undefined;
  const travelService = /\b(?:hotels?|stays?|accommodation)\b/i.test(
    request.query,
  )
    ? "stays"
    : /\b(?:flights?|airlines?)\b/i.test(request.query)
      ? "flights"
      : /\bcar rental\b/i.test(request.query)
        ? "cars"
        : undefined;
  const pool: CommerceProvider[] = commerceProviders.filter(
    (p) =>
      p.categories.includes(category) &&
      (p.countries === "conditional" || p.countries.includes(country)) &&
      !p.excludedKeywords?.some((word) => contains(request.query, word)) &&
      !(
        category === "travel" &&
        travelService &&
        p.travelServices &&
        !p.travelServices.includes(travelService)
      ),
  );
  if (category === "services")
    pool.push({
      id: "local-directory",
      name: "Local service providers",
      categories: ["services"],
      countries: [country],
      url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${request.query} ${request.city || ""} ${region.name}`)}`,
      sourceUrl: "https://www.google.com/maps",
      description:
        "Find actual workshops and service providers, then request an estimate directly.",
      payment: "unknown",
      handoff: "directory",
      caveat:
        "Directory results are not vetted by LocalAgentPay. Availability, price, reputation, and payment acceptance must be checked with the provider.",
    });
  const routes = pool
    .filter(
      (p) =>
        !request.cryptoOnly || p.payment === "near" || p.payment === "crypto",
    )
    .map((provider) => {
      const matchedName = namesProvider(request.query, provider);
      const regional = provider.countries !== "conditional";
      const reasons = [
        regional
          ? `Regional storefront for ${region.name}`
          : `International catalog; verify this product is available in ${region.name}`,
        `Matches ${name}`,
      ];
      if (matchedName) reasons.push("Matches the merchant you named");
      if (provider.payment === "near")
        reasons.push(
          "Provider explicitly lists NEAR; no conversion is needed if that invoice accepts it",
        );
      if (provider.payment === "crypto")
        reasons.push(
          "Crypto checkout offers a possible NEAR Intents settlement path after invoice checks",
        );
      if (provider.payment === "fiat")
        reasons.push(
          "Real merchant handoff available; NEAR-funded checkout is not connected",
        );
      return {
        ...provider,
        ...paymentRoute(provider),
        actionable: provider.embeddedCheckout === "brij",
        availability:
          provider.embeddedCheckout === "brij"
            ? ("live" as const)
            : ("coming-soon" as const),
        paymentLabel:
          provider.embeddedCheckout === "brij"
            ? "In-app wallet checkout · USDC / NEAR funding"
            : "Coming soon · in-app checkout unavailable",
        ...(provider.checkoutSteps ? { steps: provider.checkoutSteps } : {}),
        score:
          50 +
          (provider.embeddedCheckout === "brij" ? 120 : 0) +
          (matchedName ? 60 : 0) +
          (regional ? 15 : 0) +
          (provider.payment === "near"
            ? 35
            : provider.payment === "crypto"
              ? 25
              : 0),
        reasons,
      };
    })
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, 5);
  return {
    query: request.query,
    country,
    countryName: region.name,
    category,
    routes,
    budget,
    message: routes.length
      ? `Found ${routes.length} ${routes.length === 1 ? "merchant" : "merchants"} for ${name} in ${region.name}. ${routes.some((route) => route.availability === "live") ? "Live travel checkout is available inside this app; exact inventory and prices are checked next." : "In-app checkout for these merchants is coming soon."}`
      : `No ${request.cryptoOnly ? "crypto-compatible " : "listed "}${name} merchants are connected for ${region.name}. Coming soon — try live flights and hotel stays.`,
    warning:
      "Live travel routes open in-app checkout. Other merchants are Coming soon. This directory does not compare live prices; travel inventory, totals, fees and eligibility are retrieved during checkout.",
    source: "curated-provider-directory",
    reviewedAt: "2026-11-14",
  };
}
