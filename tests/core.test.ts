import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fromAtomic,
  toAtomic,
  chatSchema,
  quoteSchema,
} from "../lib/validation";
import {
  getNearbyOptions,
  interpretRequest,
  merchants,
} from "../lib/merchants";
import { createDemoQuote, createPaymentIntent } from "../lib/near-intents";
import { runAgent } from "../lib/agent";
import {
  OneClickService,
  CancelablePromise,
  type QuoteRequest,
} from "@defuse-protocol/one-click-sdk-typescript";

test("atomic conversion preserves 18-decimal precision without floating-point loss", () => {
  assert.equal(toAtomic("0.123456789012345678", 18), "123456789012345678");
  assert.equal(fromAtomic("123456789012345678", 18), "0.123456789012345678");
  assert.equal(toAtomic("48.00", 6), "48000000");
  assert.equal(fromAtomic("48000000", 6), "48");
  assert.equal(fromAtomic("0", 6), "0");
  assert.equal(fromAtomic("1000000", 0), "1000000");
  assert.throws(() => toAtomic("1.001", 2));
  assert.throws(() => toAtomic("-1", 6));
  assert.throws(() => toAtomic("1e18", 18));
});
test("requests honor USD budgets and category intent", () => {
  assert.deepEqual(interpretRequest("car service nearby under $200"), {
    category: "car",
    budget: 200,
  });
  assert.equal(getNearbyOptions("car", 100).length, 2);
  assert.equal(getNearbyOptions("groceries", 10).length, 0);
  assert.ok(getNearbyOptions("groceries", 50).every((m) => m.price <= 50));
  assert.equal(interpretRequest("local gifts below $30").category, "shops");
});
test("untrusted API inputs are rejected", () => {
  assert.equal(
    chatSchema.safeParse({ message: "", location: { city: "X" } }).success,
    false,
  );
  assert.equal(
    chatSchema.safeParse({
      message: "groceries",
      location: { city: "Paris", latitude: 95 },
    }).success,
    false,
  );
  assert.equal(
    quoteSchema.safeParse({
      merchantId: "green-basket",
      asset: "BTC",
      mode: "demo",
    }).success,
    false,
  );
  const parsed = quoteSchema.parse({
    merchantId: "green-basket",
    asset: "ETH",
    mode: "demo",
    price: 1,
    recipient: "attacker",
  });
  assert.ok(!("price" in parsed) && !("recipient" in parsed));
});
test("demo quotes preserve merchant output, distinguish chains, expire, and cannot be funded", () => {
  for (const asset of ["ETH", "USDC", "wNEAR"] as const) {
    const quote = createDemoQuote(merchants[0], asset);
    assert.equal(quote.destination.amount, "48.00");
    assert.equal(quote.destination.chain, "Base");
    assert.equal(quote.dryRun, true);
    assert.equal(quote.mode, "demo");
    assert.ok(Date.parse(quote.expiresAt) > Date.now());
    assert.equal("depositAddress" in quote, false);
  }
});
test("missing live configuration errors instead of silently returning mock results", async () => {
  const saved = process.env.MERCHANT_BASE_ADDRESS;
  delete process.env.MERCHANT_BASE_ADDRESS;
  try {
    await assert.rejects(
      createPaymentIntent(merchants[0], "ETH", "live"),
      /MERCHANT_BASE_ADDRESS/,
    );
  } finally {
    if (saved) process.env.MERCHANT_BASE_ADDRESS = saved;
  }
});
test("no-key assistant completes the request and explains empty results", async () => {
  const key = process.env.NEAR_AI_API_KEY;
  delete process.env.NEAR_AI_API_KEY;
  try {
    const result = await runAgent("groceries under $50", { city: "Karachi" });
    assert.equal(result.options.length, 2);
    assert.equal(result.source, "rules");
    assert.match(result.message, /Karachi/);
    const empty = await runAgent("groceries under $10", { city: "Karachi" });
    assert.equal(empty.options.length, 0);
    assert.match(empty.message, /higher limit/);
  } finally {
    if (key) process.env.NEAR_AI_API_KEY = key;
  }
});
test("live wrapper discovers tokens and sends an exact-output dry-run using server price", async () => {
  const savedAddress = process.env.MERCHANT_BASE_ADDRESS;
  const getTokens = OneClickService.getTokens,
    getQuote = OneClickService.getQuote;
  let sent: QuoteRequest | undefined;
  process.env.MERCHANT_BASE_ADDRESS = `0x${"1".repeat(40)}`;
  OneClickService.getTokens = () =>
    new CancelablePromise((resolve) =>
      resolve([
        {
          assetId: "test-eth",
          symbol: "ETH",
          blockchain: "eth",
          decimals: 18,
          price: 2000,
        },
        {
          assetId: "test-base-usdc",
          symbol: "USDC",
          blockchain: "base",
          decimals: 6,
          price: 1,
        },
      ] as Awaited<ReturnType<typeof getTokens>>),
    );
  OneClickService.getQuote = (request) => {
    sent = request;
    return new CancelablePromise((resolve) =>
      resolve({
        quote: {
          amountIn: "24000000000000000",
          amountOut: "48000000",
          timeEstimate: 25,
        },
      } as Awaited<ReturnType<typeof getQuote>>),
    );
  };
  try {
    const quote = await createPaymentIntent(merchants[0], "ETH", "live");
    assert.equal(sent?.dry, true);
    assert.equal(sent?.swapType, "EXACT_OUTPUT");
    assert.equal(sent?.amount, "48000000");
    assert.equal(sent?.destinationAsset, "test-base-usdc");
    assert.equal(sent?.slippageTolerance, 100);
    assert.equal(quote.origin.amount, "0.024");
    assert.equal(quote.destination.amount, "48");
    assert.equal(quote.mode, "live");
    assert.equal("depositAddress" in quote, false);
  } finally {
    OneClickService.getTokens = getTokens;
    OneClickService.getQuote = getQuote;
    if (savedAddress) process.env.MERCHANT_BASE_ADDRESS = savedAddress;
    else delete process.env.MERCHANT_BASE_ADDRESS;
  }
});
