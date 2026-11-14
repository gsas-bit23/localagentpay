// End-to-end check on NEAR testnet: guest account -> gasless faucet + budget deposit ->
// agent policy -> agent pays (restricted key) -> demo merchant confirms -> second order
// refunded by merchant -> over-limit agent payment rejected by the contract.
// Usage: LAP_ENV=/path/to/.dev.vars npx tsx scripts/near/e2e-testnet.ts
import { readFileSync, writeFileSync } from "node:fs";
for (const line of readFileSync(process.env.LAP_ENV || "", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2];
}
const { Account, JsonRpcProvider, KeyPair, actions, base64Encode, encodeSignedDelegate } = await import("near-api-js");
const { near, txUrl, toUnits, fromUnits } = await import("../../lib/near/config");
const server = await import("../../lib/near/server");
const views = await import("../../lib/near/views");

const out: Record<string, string> = {};
const step = (name: string, r: { txHash: string; ok: boolean; error?: string | null }) => {
  out[name] = txUrl(r.txHash);
  console.log(r.ok ? "ok  " : "FAIL", name.padEnd(28), txUrl(r.txHash), r.error || "");
  if (!r.ok && !name.startsWith("expected_reject")) throw new Error(`${name} failed`);
};
const key = KeyPair.fromRandom("ed25519");
const guest = await server.createGuest(key.getPublicKey().toString());
step("guest_created", { ...guest, ok: true });
const account = new Account(guest.accountId, new JsonRpcProvider({ url: near.rpcUrl }), key.toString() as `ed25519:${string}`);
async function gasless(receiverId: string, calls: { method: string; args: object; deposit?: bigint }[]) {
  const { signedDelegate } = await account.createSignedMetaTransaction({
    receiverId, blockHeightTtl: 120,
    actions: calls.map((c) => actions.functionCall(c.method, c.args, 50_000_000_000_000n, c.deposit ?? 0n)),
  });
  return server.relay(base64Encode(encodeSignedDelegate(signedDelegate)));
}
await new Promise((r) => setTimeout(r, 1500));
step("faucet_and_fund_budget", await gasless(near.token, [
  { method: "faucet", args: { amount: toUnits("40") } },
  { method: "ft_transfer_call", args: { receiver_id: near.lap, amount: toUnits("30"), msg: JSON.stringify({ action: "fund" }) }, deposit: 1n },
]));
step("set_agent_policy", await gasless(near.lap, [{ method: "set_agent_policy", args: {
  agent: near.agent, per_order_cap: toUnits("10"), daily_cap: toUnits("15"), expires_in_ms: 3_600_000, allowed_merchants: null } }]));
const [bakery, chai] = near.demoMerchants;
const pay = await server.agentPay(guest.accountId, bakery, toUnits("4.7"), "Bread loaf + Eggs (12)");
step("agent_pay", pay);
const orderId = pay.orderId!;
step("merchant_confirm", await server.demoMerchantAct(bakery, "confirm", orderId));
const pay2 = await server.agentPay(guest.accountId, chai, toUnits("1.6"), "Bun kebab");
step("agent_pay_2", pay2);
step("merchant_refund", await server.demoMerchantAct(chai, "refund", pay2.orderId!));
step("expected_reject_over_cap", await server.agentPay(guest.accountId, bakery, toUnits("11"), "too expensive"));
step("expected_reject_daily_cap", await server.agentPay(guest.accountId, bakery, toUnits("9"), "over daily cap"));
step("revoke_agent", await gasless(near.lap, [{ method: "revoke_agent", args: {} }]));
step("expected_reject_revoked", await server.agentPay(guest.accountId, bakery, toUnits("1"), "after revoke"));

const budget = await views.getBudget(guest.accountId);
const orders = await views.getOrders(guest.accountId);
const bakeryBal = await views.getTokenBalance(bakery);
console.log("budget", fromUnits(budget.balance), "escrowed", fromUnits(budget.escrowed), "spent_today", fromUnits(budget.policy.spent_today));
console.log("orders", orders.map((o) => `${o.id}:${o.status}:${fromUnits(o.amount)}`).join(" "));
console.log("bakery tUSDC", fromUnits(bakeryBal));
if (fromUnits(budget.balance) !== "25.3" || budget.escrowed !== "0") throw new Error("Unexpected budget state");
if (orders.find((o) => o.id === orderId)?.status !== "Confirmed") throw new Error("Order not confirmed");
if (orders.find((o) => o.id === pay2.orderId)?.status !== "Refunded") throw new Error("Order not refunded");
writeFileSync(process.env.LAP_E2E_OUT || "/tmp/lap-e2e.json", JSON.stringify({ guest: guest.accountId, orderId, refundedOrderId: pay2.orderId, ...out }, null, 2));
console.log("E2E PASSED for", guest.accountId);
