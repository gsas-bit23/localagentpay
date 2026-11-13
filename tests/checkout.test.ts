import { test } from "node:test";
import assert from "node:assert/strict";
import { Keypair } from "@solana/web3.js";
import { ExactSvmScheme } from "@x402/svm/exact/client";
import { brijCall, validateChallenge } from "../lib/checkout/brij";
import {
  seal,
  unseal,
  requirePayable,
  type BookingSession,
} from "../lib/checkout/session";
import { SOLANA_MAINNET, USDC_MINT, usdcAmount } from "../lib/checkout/types";
import { validateSignedPayment } from "../lib/checkout/payment";
import { checkoutRequest } from "../lib/checkout/validation";
import { hotelRates, hotelOffer } from "../lib/checkout/normalize";
process.env.CHECKOUT_SESSION_SECRET = "test-only-".repeat(8);
const wallet = "GePYLuofQFE2CL6Wxh5unmXhuKYNU8Ccu6EDUAyyDJLV";
const escrow = "3Bj9W5brUmRDEiseemfQoGusa7rPSxTR6zm9CQt9bruY";
const feePayer = "6Rkm9H4v4NqKB6v8SQrt8PE9bfd4PBhWpAQ2bi8P8AM";
const requirement = {
  scheme: "exact",
  network: SOLANA_MAINNET,
  asset: USDC_MINT,
  amount: "191131600",
  payTo: escrow,
  maxTimeoutSeconds: 300,
  extra: { feePayer },
};
const challenge = {
  x402Version: 2,
  resource: { url: "https://travel.brij.fi/air/book" },
  accepts: [requirement],
  extensions: {
    "payment-identifier": { info: { required: true } },
    bazaar: { large: "omitted" },
  },
};
const intent = {
  expected_escrow_amount: 191131600,
  expected_escrow_mint: USDC_MINT,
  escrow_address: escrow,
};
test("merchant challenge binds exact atomic amount, network, token, endpoint and escrow", () => {
  const pinned = validateChallenge(challenge, intent, "flight");
  assert.equal(pinned.accepts[0].amount, "191131600");
  assert.equal("bazaar" in pinned.extensions, false);
  assert.equal(usdcAmount("191131600"), "191.131600");
  for (const change of [
    { amount: "1" },
    { payTo: wallet },
    { asset: wallet },
    { network: "solana:devnet" },
    { scheme: "upto" },
  ])
    assert.throws(() =>
      validateChallenge(
        { ...challenge, accepts: [{ ...requirement, ...change }] },
        intent,
        "flight",
      ),
    );
  assert.throws(() =>
    validateChallenge(
      { ...challenge, resource: { url: "https://evil.example/book" } },
      intent,
      "flight",
    ),
  );
  assert.throws(() => validateChallenge(challenge, intent, "hotel"));
});
test("encrypted recovery protects passenger data, integrity, token purpose and expiry", async () => {
  const details = {
    supportCode: "private-support-code",
    email: "traveller@example.com",
  };
  const token = await seal("booking", details);
  assert.ok(!token.includes("traveller"));
  assert.ok(!token.includes("private-support"));
  assert.deepEqual(await unseal(token, "booking"), details);
  await assert.rejects(unseal(token, "funding"));
  const [iv, body] = token.split(".");
  const changed = Buffer.from(body, "base64url");
  changed[0] ^= 1;
  await assert.rejects(
    unseal(`${iv}.${changed.toString("base64url")}`, "booking"),
  );
  await assert.rejects(
    unseal(await seal("booking", details, Date.now() - 1), "booking"),
  );
});
test("expired quotes cannot fund or authorize a new payment", () => {
  assert.throws(
    () => requirePayable({ payBy: Date.now() - 1 } as BookingSession),
    /expired/,
  );
});
test("request validation requires consent and excludes client price or recipient overrides", () => {
  const input = {
    action: "prepare",
    kind: "flight",
    offerId: "fastbooking:offer",
    wallet,
    travellers: [
      {
        given_name: "Test",
        family_name: "Traveller",
        born_on: "1990-01-01",
        title: "mr",
        gender: "m",
      },
    ],
    email: "traveller@example.com",
    phone: "+12025550123",
    termsAccepted: true,
    amount: "1",
    recipient: "attacker",
  };
  const parsed = checkoutRequest.parse(input);
  assert.equal("amount" in parsed, false);
  assert.equal("recipient" in parsed, false);
  assert.equal(
    checkoutRequest.safeParse({ ...input, termsAccepted: false }).success,
    false,
  );
  assert.equal(
    checkoutRequest.safeParse({ ...input, phone: "123" }).success,
    false,
  );
  assert.equal(
    checkoutRequest.safeParse({
      ...input,
      travellers: [{ ...input.travellers[0], born_on: "2000-02-31" }],
    }).success,
    false,
  );
  assert.equal(
    checkoutRequest.safeParse({ action: "brij_sandbox_exec", cmd: "anything" })
      .success,
    false,
  );
});
test("free MCP adapter does not call paid HTTP search routes and preserves payment challenges", async () => {
  let outgoing: any;
  const mock: typeof fetch = async (url, options) => {
    assert.equal(url, "https://travel.brij.fi/mcp");
    outgoing = JSON.parse(String(options?.body));
    return Response.json({
      result: { isError: true, structuredContent: challenge },
    });
  };
  const result = await brijCall(
    "brij_book_flight",
    { intent_id: "intent_test" },
    undefined,
    mock,
  );
  assert.equal(outgoing.params.arguments.x402_payment, undefined);
  assert.equal(result.paymentRequired?.x402Version, 2);
  await assert.rejects(brijCall("brij_sandbox_exec", {}, undefined, mock));
});
test("hotel normalization preserves extra charges and restrictive property policies", () => {
  const rates = hotelRates({
    room_types: [
      {
        name: "Studio",
        rates: [
          {
            rate_id: "rate_test",
            board: "Room only",
            price: {
              total_amount: "75.08",
              due_at_hotel_amount: "4.08",
              currency: "USD",
            },
            refundable: true,
            refundability: "Before the deadline only",
            conditions: [
              {
                title: "Photo Policy",
                description: "Credit card and ID required at check-in",
              },
            ],
            cancellation_timeline: [],
          },
        ],
      },
    ],
  });
  assert.equal(rates[0].dueAtHotel, "4.08");
  assert.match(rates[0].conditions[0].description, /Credit card/);
  const hotel = hotelOffer(
    {
      hotel_id: "hotel_test",
      name: "Actual hotel",
      longitude: 55.22,
      latitude: 25.04,
      address: "Dubai",
      total_from: "75.08",
      due_at_hotel_from: "4.08",
    },
    "AE",
  );
  assert.equal(hotel.location?.source, "provider");
  assert.deepEqual(hotel.location?.coordinates, [55.22, 25.04]);
});
test("signed transaction validation rejects altered transfer bytes even when metadata claims the correct payment", async () => {
  const signer = await Keypair.generate();
  const sender = signer.publicKey.toBase58();
  const realFetch = globalThis.fetch;
  const mint = new Uint8Array(82);
  mint[44] = 6;
  mint[45] = 1;
  globalThis.fetch = async (_url, options) => {
    const request = JSON.parse(String(options?.body));
    const result =
      request.method === "getAccountInfo"
        ? {
            context: { slot: 100 },
            value: {
              data: [Buffer.from(mint).toString("base64"), "base64"],
              executable: false,
              lamports: 1461600,
              owner: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
              rentEpoch: 0,
              space: 82,
            },
          }
        : {
            context: { slot: 100 },
            value: {
              blockhash: "11111111111111111111111111111111",
              lastValidBlockHeight: 200,
            },
          };
    return Response.json({ jsonrpc: "2.0", id: request.id, result });
  };
  try {
    const pinned = validateChallenge(challenge, intent, "flight");
    const session = {
      requirements: pinned,
      wallet: sender,
      paymentId: "test_payment_identifier_123456",
    } as unknown as BookingSession;
    const scheme = new ExactSvmScheme(signer, {
      rpcUrl: "https://rpc.example.test",
      transactionVersions: [0],
    });
    async function payment(amount: string) {
      const signed = await scheme.createPaymentPayload(2, {
        ...requirement,
        amount,
      } as any);
      return Buffer.from(
        JSON.stringify({
          x402Version: 2,
          resource: challenge.resource,
          accepted: requirement,
          payload: signed.payload,
          extensions: {
            "payment-identifier": { info: { id: session.paymentId } },
          },
        }),
      ).toString("base64");
    }
    const { x402Client } = await import("@x402/core/client");
    const capped = new x402Client()
      .register(SOLANA_MAINNET, scheme)
      .setSpendControls({
        allowedAssets: [
          {
            network: SOLANA_MAINNET,
            asset: USDC_MINT,
            maxAmountPerPayment: requirement.amount,
          },
        ],
      });
    const clientPayload = await capped.createPaymentPayload(challenge as any);
    assert.equal(clientPayload.accepted.amount, requirement.amount);
    await assert.rejects(
      capped.createPaymentPayload({
        ...challenge,
        accepts: [{ ...requirement, amount: "191131601" }],
      } as any),
      /spendControls/,
    );
    const valid = await payment(requirement.amount);
    await validateSignedPayment(valid, session);
    await assert.rejects(
      validateSignedPayment(await payment("191131601"), session),
      /does not match/,
    );
    const tampered = JSON.parse(Buffer.from(valid, "base64").toString());
    tampered.accepted.payTo = wallet;
    await assert.rejects(
      validateSignedPayment(
        Buffer.from(JSON.stringify(tampered)).toString("base64"),
        session,
      ),
    );
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("NEAR funding quotes bind the merchant amount to the buyer's Solana wallet and NEAR refund account", async () => {
  const { OneClickService } =
    await import("@defuse-protocol/one-click-sdk-typescript");
  const { fundWithNear } = await import("../lib/checkout/funding");
  const oldTokens = OneClickService.getTokens,
    oldQuote = OneClickService.getQuote,
    oldFetch = globalThis.fetch;
  let sent: any;
  const cancellable = (value: any) =>
    Object.assign(Promise.resolve(value), { cancel() {} });
  OneClickService.getTokens = (() =>
    cancellable([
      { blockchain: "near", assetId: "nep141:wrap.near", decimals: 24 },
      {
        blockchain: "sol",
        symbol: "USDC",
        decimals: 6,
        assetId: "sol-usdc-from-catalog",
      },
    ])) as typeof oldTokens;
  OneClickService.getQuote = ((request: any) => {
    sent = request;
    return cancellable({
      quote: {
        depositAddress: "f".repeat(64),
        amountIn: "56000000000000000000000000",
        amountOut: request.amount,
        deadline: new Date(Date.now() + 300000).toISOString(),
      },
    });
  }) as typeof oldQuote;
  globalThis.fetch = async (_url, options) => {
    const rpc = JSON.parse(String(options?.body));
    assert.equal(rpc.method, "getAccountInfo");
    return Response.json({
      jsonrpc: "2.0",
      id: rpc.id,
      result: { context: { slot: 1 }, value: null },
    });
  };
  try {
    const result = await fundWithNear(
      {
        payBy: Date.now() + 600000,
        wallet,
        intentId: "intent_test",
        summary: { amountAtomic: "191131600" },
      } as BookingSession,
      "buyer.near",
    );
    assert.equal(sent.dry, false);
    assert.equal(sent.amount, "191131600");
    assert.equal(sent.recipient, wallet);
    assert.equal(sent.refundTo, "buyer.near");
    assert.equal(sent.refundType, "ORIGIN_CHAIN");
    assert.equal(sent.originAsset, "nep141:wrap.near");
    assert.equal(sent.destinationAsset, "sol-usdc-from-catalog");
    assert.equal(result.destinationAmount, "191.131600");
    assert.equal(result.nearAmount, "56.000000000000000000000000");
    assert.ok(result.token);
  } finally {
    OneClickService.getTokens = oldTokens;
    OneClickService.getQuote = oldQuote;
    globalThis.fetch = oldFetch;
  }
});
