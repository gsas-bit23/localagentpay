import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { KeyPair } from "near-api-js";
import { near, toUnits, fromUnits, isGuestAccount, txUrl } from "../lib/near/config";
import { rejectReason, allowedMethods, type RelayAction } from "../lib/near/relay-policy";
import { parseRequest, priceLines, memoFor, rulesPlan, distanceKm } from "../lib/agent/planner";
import { planWithNearAI } from "../lib/agent/near-ai";
import { buildDryQuote, NEAR_USDC } from "../lib/near/intents";
import { verifyAccountSignature, NearError } from "../lib/near/server";
import type { Merchant } from "../lib/near/views";

const guest = `g-abcd12.${near.root}`;
const fc = (methodName: string, args: object = {}, deposit = 0n, gas = 30_000_000_000_000n): RelayAction =>
  ({ methodName, args: new TextEncoder().encode(JSON.stringify(args)), gas, deposit });

const merchants: Merchant[] = [
  { account_id: "bakery.x.testnet", name: "Bakery", category: "groceries", city: "Karachi", lat_e6: 24_860_700, lon_e6: 67_001_100, active: true,
    items: [{ name: "Bread loaf", price: "1500000" }, { name: "Eggs (12)", price: "3200000" }, { name: "Weekly grocery bag", price: "18000000" }] },
  { account_id: "pharmacy.x.testnet", name: "Pharmacy", category: "pharmacy", city: "Karachi", lat_e6: 24_900_000, lon_e6: 67_100_000, active: true,
    items: [{ name: "Paracetamol 500mg", price: "1200000" }, { name: "First-aid kit", price: "9000000" }] },
  { account_id: "closed.x.testnet", name: "Closed", category: "groceries", city: "Karachi", lat_e6: 0, lon_e6: 0, active: false,
    items: [{ name: "Bread loaf", price: "100" }] },
];

test("token units round-trip without float drift", () => {
  assert.equal(toUnits("25.3"), "25300000");
  assert.equal(toUnits(0.1 + 0.2), "300000");
  assert.equal(fromUnits("25300000"), "25.3");
  assert.equal(fromUnits(1_000_000n), "1");
  assert.equal(fromUnits("1"), "0.000001");
  assert.throws(() => toUnits("-1"));
  assert.throws(() => toUnits("1.1234567"));
  assert.match(txUrl("abc"), /^https:\/\/testnet\.nearblocks\.io\/txns\/abc$/);
});

test("deployment points at testnet contracts", () => {
  assert.equal(near.network, "testnet");
  assert.ok(near.lap.endsWith(".testnet") && near.token.endsWith(".testnet"));
  assert.equal(near.tokenSymbol, "tUSDC");
});

test("only relayer-created guest accounts are sponsored", () => {
  assert.ok(isGuestAccount(guest));
  assert.ok(!isGuestAccount(`g-abcd12.evil.testnet`));
  assert.ok(!isGuestAccount(`alice.${near.root}`));
  assert.ok(!isGuestAccount(`g-AB.${near.root}`));
});

test("relay policy allows the app's own calls", () => {
  assert.equal(rejectReason({ senderId: guest, receiverId: near.token, actions: [fc("faucet", { amount: "1" }), fc("ft_transfer_call", { receiver_id: near.lap, amount: "1", msg: "" }, 1n)] }), null);
  assert.equal(rejectReason({ senderId: guest, receiverId: near.lap, actions: [fc("set_agent_policy")] }), null);
  assert.ok(allowedMethods(near.lap)!.includes("refund"));
  assert.equal(allowedMethods("someone.testnet"), undefined);
});

test("relay policy refuses abuse of the sponsored gas", () => {
  const r = (senderId: string, receiverId: string, actions: RelayAction[]) => rejectReason({ senderId, receiverId, actions });
  assert.match(r("alice.testnet", near.lap, [fc("refund")])!, /guest/);
  assert.match(r(guest, "wrap.testnet", [fc("near_deposit")])!, /not a LocalAgentPay contract/);
  assert.match(r(guest, near.token, [fc("ft_transfer", { receiver_id: "x.testnet" }, 1n)])!, /not sponsored/);
  assert.match(r(guest, near.token, [fc("ft_transfer_call", { receiver_id: "x.testnet", amount: "1", msg: "" }, 1n)])!, /escrow contract/);
  assert.match(r(guest, near.lap, [fc("refund", {}, 10n ** 24n)])!, /Deposits/);
  assert.match(r(guest, near.lap, [fc("refund", {}, 0n, 300_000_000_000_000n)])!, /gas/);
  assert.match(r(guest, near.lap, [null])!, /function calls/);
  assert.match(r(guest, near.lap, [])!, /1-3/);
  assert.match(r(guest, near.lap, [fc("refund"), fc("refund"), fc("refund"), fc("refund")])!, /1-3/);
});

test("request parsing finds category and budget", () => {
  assert.deepEqual(parseRequest("Weekly groceries under $20"), { category: "groceries", budgetUnits: 20_000_000n });
  assert.equal(parseRequest("something for a headache below 2.50").category, "pharmacy");
  assert.equal(parseRequest("something for a headache below 2.50").budgetUnits, 2_500_000n);
  assert.equal(parseRequest("mobile top-up").category, "services");
  assert.equal(parseRequest("hello").category, undefined);
});

test("prices always come from the on-chain catalog", () => {
  const { lines, total } = priceLines(merchants[0], [{ name: "bread LOAF", quantity: 2 }, { name: "Eggs (12)", quantity: 1 }]);
  assert.equal(total, 6_200_000n);
  assert.equal(lines[0].name, "Bread loaf");
  assert.equal(memoFor(lines), "2x Bread loaf, 1x Eggs (12)");
  assert.throws(() => priceLines(merchants[0], [{ name: "Caviar", quantity: 1 }]), /does not sell/);
  assert.throws(() => priceLines(merchants[0], [{ name: "Bread loaf", quantity: 50 }]), /1-20/);
  assert.throws(() => priceLines(merchants[0], []), /at least one/);
  assert.ok(memoFor(Array.from({ length: 30 }, () => ({ name: "Weekly grocery bag", quantity: 1, price: "1" }))).length <= 120);
});

test("rules planner respects budget, category and inactive merchants", () => {
  const p = rulesPlan("bread and eggs", merchants);
  assert.equal(p.source, "rules");
  assert.equal(p.proposals.length, 1);
  assert.equal(p.proposals[0].merchant, "bakery.x.testnet");
  assert.equal(p.proposals[0].total, "4700000");
  const capped = rulesPlan("weekly groceries under $10", merchants);
  assert.ok(capped.proposals.every((x) => BigInt(x.total) <= 10_000_000n));
  assert.equal(rulesPlan("headache under $1", merchants).proposals.length, 0);
  const near1 = rulesPlan("medicine", merchants, { lat: 24.9, lon: 67.1 });
  assert.equal(near1.proposals[0].distanceKm, 0);
  assert.ok(Math.abs(distanceKm(24.8607, 67.0011, 24.8607, 67.0011)) < 1e-9);
});

async function fakeNearAI(toolArgs: object | null, fn: () => Promise<void>) {
  const server = createServer((req, res) => {
    let body = ""; req.on("data", (c) => (body += c)); req.on("end", () => {
      const sent = JSON.parse(body);
      assert.equal(sent.tool_choice.function.name, "propose_orders");
      res.setHeader("content-type", "application/json");
      if (!toolArgs) { res.statusCode = 500; res.end("{}"); return; }
      res.end(JSON.stringify({ id: "x", object: "chat.completion", created: 0, model: sent.model, choices: [{ index: 0, finish_reason: "tool_calls",
        message: { role: "assistant", content: null, tool_calls: [{ id: "c1", type: "function", function: { name: "propose_orders", arguments: JSON.stringify(toolArgs) } }] } }] }));
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const env = { ...process.env };
  process.env.NEAR_AI_API_KEY = "test"; process.env.NEAR_AI_MODEL = "test-model";
  process.env.NEAR_AI_BASE_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`;
  try { await fn(); } finally { process.env = env; server.close(); }
}

test("NEAR AI plans are validated against chain data", async () => {
  await fakeNearAI({ reply: "Here you go", orders: [
    { merchant: "bakery.x.testnet", reason: "fresh", items: [{ name: "Bread loaf", quantity: 3 }] },
    { merchant: "invented.testnet", reason: "hallucinated", items: [{ name: "Bread loaf", quantity: 1 }] },
    { merchant: "pharmacy.x.testnet", reason: "bad item", items: [{ name: "Free iPhone", quantity: 1 }] },
    { merchant: "closed.x.testnet", reason: "inactive", items: [{ name: "Bread loaf", quantity: 1 }] },
  ] }, async () => {
    const plan = await planWithNearAI("bread", merchants);
    assert.equal(plan.source, "near-ai");
    assert.equal(plan.model, "test-model");
    assert.equal(plan.proposals.length, 1);
    assert.equal(plan.proposals[0].total, "4500000");
  });
});

test("NEAR AI failures fall back to the rules planner", async () => {
  await fakeNearAI(null, async () => {
    const plan = await planWithNearAI("bread and eggs", merchants);
    assert.equal(plan.source, "rules");
    assert.equal(plan.proposals[0].total, "4700000");
  });
  delete process.env.NEAR_AI_API_KEY;
  assert.equal((await planWithNearAI("bread", merchants)).source, "rules");
});

test("1Click funding quotes are dry previews to NEAR USDC", () => {
  const q = buildDryQuote("base-usdc", "25000000", "alice.near", 0);
  assert.equal(q.dry, true);
  assert.equal(q.swapType, "EXACT_OUTPUT");
  assert.equal(q.destinationAsset, NEAR_USDC);
  assert.equal(q.recipient, "alice.near");
  assert.match(q.refundTo, /^0x[0-9a-fA-F]{40}$/);
  assert.equal(q.deadline, new Date(600_000).toISOString());
  assert.equal(buildDryQuote("near-wnear", "1", "alice.near").refundTo, "alice.near");
});

test("signed agent requests reject tampering and replays before any RPC call", async () => {
  const kp = KeyPair.fromRandom("ed25519");
  const msg = `agent_pay|bakery.x.testnet|4700000|1x Bread|${Date.now()}`;
  const sig = Buffer.from(kp.sign(new TextEncoder().encode(msg)).signature).toString("base64");
  const tampered = msg.replace("4700000", "9700000");
  await assert.rejects(verifyAccountSignature(guest, tampered, kp.getPublicKey().toString(), sig), (e: NearError) => e.status === 401 && /Bad signature/.test(e.message));
  const old = `agent_pay|bakery.x.testnet|1|m|${Date.now() - 10 * 60_000}`;
  const oldSig = Buffer.from(kp.sign(new TextEncoder().encode(old)).signature).toString("base64");
  await assert.rejects(verifyAccountSignature(guest, old, kp.getPublicKey().toString(), oldSig), /expired/);
});
