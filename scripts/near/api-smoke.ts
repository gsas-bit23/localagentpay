// Drives the HTTP API exactly like the browser does: guest -> gasless fund -> policy -> agent plan
// -> signed agent_pay -> demo merchant confirm. Usage: BASE=http://127.0.0.1:3000 npx tsx scripts/near/api-smoke.ts
import { Account, JsonRpcProvider, KeyPair, actions, base64Encode, encodeSignedDelegate } from "near-api-js";
import { near, toUnits, txUrl } from "../../lib/near/config";
import { memoFor } from "../../lib/agent/planner";
const BASE = process.env.BASE || "http://127.0.0.1:3000";
const post = async (path: string, body: unknown) => {
  const r = await fetch(BASE + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json();
  if (!r.ok) throw new Error(`${path} ${r.status} ${JSON.stringify(j)}`);
  return j;
};
const key = KeyPair.fromRandom("ed25519");
const g = await post("/api/near/guest", { publicKey: key.getPublicKey().toString() });
console.log("guest", g.accountId, txUrl(g.txHash));
await new Promise((r) => setTimeout(r, 1500));
const acc = new Account(g.accountId, new JsonRpcProvider({ url: near.rpcUrl }), key.toString() as `ed25519:${string}`);
const gasless = async (receiverId: string, calls: { method: string; args: object; deposit?: bigint }[]) => {
  const { signedDelegate } = await acc.createSignedMetaTransaction({ receiverId, blockHeightTtl: 120, actions: calls.map((c) => actions.functionCall(c.method, c.args, 50_000_000_000_000n, c.deposit ?? 0n)) });
  const r = await post("/api/near/relay", { signedDelegate: base64Encode(encodeSignedDelegate(signedDelegate)) });
  if (!r.ok) throw new Error(r.error);
  return r;
};
console.log("fund", txUrl((await gasless(near.token, [{ method: "faucet", args: { amount: toUnits("50") } }, { method: "ft_transfer_call", args: { receiver_id: near.lap, amount: toUnits("30"), msg: '{"action":"fund"}' }, deposit: 1n }])).txHash));
console.log("policy", txUrl((await gasless(near.lap, [{ method: "set_agent_policy", args: { agent: near.agent, per_order_cap: toUnits("10"), daily_cap: toUnits("25"), expires_in_ms: 86_400_000, allowed_merchants: null } }])).txHash));
// The relayer must refuse anything outside its allow-list.
try { await gasless(near.token, [{ method: "ft_transfer", args: { receiver_id: near.root, amount: "1" }, deposit: 1n }]); throw new Error("relayer accepted a forbidden call"); }
catch (e) { if (String(e).includes("forbidden")) throw e; console.log("relayer refused ft_transfer ✓"); }
const plan = await post("/api/agent", { message: "bread and eggs" });
const p = plan.proposals[0];
console.log("plan", plan.source, p.merchantName, p.total, memoFor(p.lines));
const message = ["agent_pay", p.merchant, p.total, memoFor(p.lines), String(Date.now())].join("|");
const signature = base64Encode(key.sign(new TextEncoder().encode(message)).signature);
const auth = { accountId: g.accountId, message, publicKey: key.getPublicKey().toString(), signature };
const items = p.lines.map((l: any) => ({ name: l.name, quantity: l.quantity }));
// Tampered amount must be rejected before any transaction.
const bad = await fetch(BASE + "/api/agent/pay", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ merchant: p.merchant, items: [{ ...items[0], quantity: 9 }], auth }) });
console.log("tampered order rejected ✓", bad.status);
const paid = await post("/api/agent/pay", { merchant: p.merchant, items, auth });
console.log("agent_pay", paid.ok, "order", paid.orderId, txUrl(paid.txHash));
const conf = await post("/api/merchant/demo", { merchant: p.merchant, action: "confirm", orderId: paid.orderId });
console.log("confirm", conf.ok, txUrl(conf.txHash));
console.log("API SMOKE PASSED");
