import { test } from "node:test";
import assert from "node:assert/strict";
import {
  inferCategory,
  inferCountry,
  planCommerce,
  routingSchema,
} from "../lib/commerce/planner";
import { commerceProviders } from "../lib/commerce/providers";

test("country routing never substitutes a US grocery provider for Pakistan", () => {
  const result = planCommerce({
    query: "groceries in Karachi under PKR 5,000",
  });
  assert.equal(result.country, "PK");
  assert.deepEqual(result.budget, { amount: 5000, currency: "PKR" });
  assert.ok(result.routes.some((p) => p.id === "foodpanda-pk"));
  assert.ok(
    !result.routes.some((p) => p.id === "instacart" || p.id === "walmart-us"),
  );
});
test("regional storefronts differ by country and named merchants are prioritized", () => {
  assert.equal(
    planCommerce({ query: "groceries", country: "GB" }).routes[0].name,
    "Deliveroo UK",
  );
  assert.ok(
    planCommerce({ query: "Tesco groceries", country: "GB" }).routes[0].id ===
      "tesco-gb",
  );
  assert.equal(
    planCommerce({ query: "groceries", country: "SG" }).routes[0].id,
    "fairprice-sg",
  );
  assert.equal(
    planCommerce({ query: "groceries", country: "DE" }).routes[0].id,
    "rewe-de",
  );
});
test("direct NEAR checkout avoids fabricating a bridge quote or merchant invoice", () => {
  const result = planCommerce({
    query: "Book a hotel in Dubai and pay in NEAR",
  });
  assert.equal(result.country, "AE");
  assert.equal(result.routes[0].id, "travala");
  assert.equal(result.routes[0].payment, "near");
  assert.equal(result.routes[0].quoteStatus, "invoice-required");
  assert.equal("price" in result.routes[0], false);
  assert.equal("recipient" in result.routes[0], false);
  assert.ok(!result.routes[0].steps.some((step) => /Intents quote/.test(step)));
});
test("fiat merchants never appear as crypto compatible", () => {
  const result = planCommerce({
    query: "groceries in Pakistan",
    cryptoOnly: true,
  });
  assert.equal(result.routes.length, 0);
  const shopping = planCommerce({
    query: "buy headphones in Pakistan",
    cryptoOnly: true,
  });
  assert.ok(shopping.routes.length > 0);
  assert.ok(
    shopping.routes.every(
      (p) => p.payment === "crypto" || p.payment === "near",
    ),
  );
  assert.ok(!shopping.routes.some((p) => p.id === "daraz-pk"));
});
test("missing, ambiguous, and unsupported country inputs need clarification", () => {
  assert.throws(() => inferCountry("groceries please"), /Choose a country/);
  assert.throws(
    () => inferCountry("grocery delivery in Pakistan and India"),
    /several countries/,
  );
  assert.throws(
    () => inferCountry("groceries in Mexico", "US"),
    /not in the current/,
  );
  assert.equal(inferCountry("help us buy groceries", "PK"), "PK");
  assert.equal(inferCountry("groceries in London, Canada"), "CA");
  assert.throws(
    () => inferCountry("groceries in Pakistan", "US"),
    /country selector/,
  );
  assert.equal(
    routingSchema.safeParse({ query: "groceries", country: "ZZ" }).success,
    false,
  );
});
test("specific categories take precedence over generic shopping words", () => {
  assert.equal(inferCategory("buy weekly groceries"), "groceries");
  assert.equal(inferCategory("book a hotel"), "travel");
  assert.equal(inferCategory("recharge my mobile"), "mobile");
  assert.equal(inferCategory("find a car service"), "services");
  assert.equal(inferCategory("order pizza for dinner"), "food");
  assert.equal(inferCategory("buy a food processor", "shopping"), "shopping");
  assert.equal(inferCategory("Tesco"), "groceries");
  assert.throws(
    () => inferCategory("what is the weather"),
    /Choose a category/,
  );
});
test("unknown price is not represented as a quote, rating, or budget match", () => {
  const result = planCommerce({ query: "groceries under $1", country: "US" });
  assert.ok(result.routes.length > 0);
  assert.match(result.warning, /not a lowest-price comparison/);
  assert.ok(
    result.routes.every(
      (p) => !("trust" in p) && !("price" in p) && !("distance" in p),
    ),
  );
  assert.deepEqual(result.budget, { amount: 1, currency: "USD" });
});
test("merchant URLs and payment evidence come from the server-owned directory", () => {
  assert.equal(
    new Set(commerceProviders.map((p) => p.id)).size,
    commerceProviders.length,
  );
  for (const provider of commerceProviders) {
    assert.equal(new URL(provider.url).protocol, "https:");
    if (provider.payment === "near" || provider.payment === "crypto")
      assert.ok(provider.paymentSource);
  }
  const parsed = routingSchema.parse({
    query: "groceries",
    country: "PK",
    price: 1,
    payment: "near",
    recipient: "attacker",
  });
  assert.ok(!("recipient" in parsed) && !("payment" in parsed));
});
test("local services use actual discovery links without claiming payment support", () => {
  const route = planCommerce({
    query: "find a car service",
    country: "PK",
    city: "Karachi",
  }).routes[0];
  assert.equal(route.handoff, "directory");
  assert.equal(route.actionable, false);
  assert.equal(route.quoteStatus, "discovery-only");
  assert.match(
    new URL(route.url).searchParams.get("query")!,
    /Karachi Pakistan/,
  );
});

test("Newegg crypto routes respect regional and product restrictions", () => {
  assert.equal(
    planCommerce({ query: "buy headphones", country: "US", cryptoOnly: true })
      .routes[0].id,
    "newegg-us",
  );
  assert.equal(
    planCommerce({ query: "buy headphones", country: "CA", cryptoOnly: true })
      .routes[0].id,
    "newegg-ca",
  );
  assert.ok(
    !planCommerce({ query: "buy headphones", country: "PK" }).routes.some((p) =>
      p.id.startsWith("newegg"),
    ),
  );
  assert.ok(
    !planCommerce({
      query: "buy marketplace headphones",
      country: "US",
      cryptoOnly: true,
    }).routes.some((p) => p.id.startsWith("newegg")),
  );
});
test("travel product matches and account funding flows are explicit", () => {
  assert.ok(
    !planCommerce({ query: "book a hotel in Dubai" }).routes.some(
      (p) => p.id === "alternative-airlines",
    ),
  );
  assert.ok(
    planCommerce({ query: "book flights", country: "GB" }).routes.some(
      (p) => p.id === "alternative-airlines",
    ),
  );
  const domain = planCommerce({ query: "buy a domain", country: "GB" })
    .routes[0];
  assert.equal(domain.id, "namecheap");
  assert.match(domain.steps.join(" "), /account credit/);
  assert.throws(
    () => planCommerce({ query: "buy a gift card", country: "US" }),
    /excluded/,
  );
  assert.ok(
    planCommerce({ query: "buy headphones without vouchers", country: "US" })
      .routes.length > 0,
  );
  assert.equal(
    planCommerce({ query: "groceries", city: "Karachi" }).country,
    "PK",
  );
});
