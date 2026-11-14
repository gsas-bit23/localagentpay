// Deploys LocalAgentPay to NEAR testnet from a faucet-funded root account.
// Usage: LAP_SECRETS_DIR=/path/outside/repo node scripts/near/deploy-testnet.mjs
// Reads  $LAP_SECRETS_DIR/root.txt and ~/.near-credentials/testnet/<root>.json
// Writes $LAP_SECRETS_DIR/keys.json + $LAP_SECRETS_DIR/.dev.vars (private, never commit)
//        lib/near/deployment.testnet.json (public account ids only)
import { Account, JsonRpcProvider, KeyPair, actions, nearToYocto } from "near-api-js";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const dir = process.env.LAP_SECRETS_DIR;
if (!dir) throw new Error("Set LAP_SECRETS_DIR to a private directory outside the repository");
const root = readFileSync(join(dir, "root.txt"), "utf8").trim();
const rootKey = JSON.parse(readFileSync(join(homedir(), ".near-credentials/testnet", `${root}.json`), "utf8")).private_key;
const provider = new JsonRpcProvider({ url: process.env.NEAR_RPC_URL || "https://test.rpc.fastnear.com" });
const rootAcc = new Account(root, provider, rootKey);
const keysPath = join(dir, "keys.json");
const keys = existsSync(keysPath) ? JSON.parse(readFileSync(keysPath, "utf8")) : {};
const save = () => writeFileSync(keysPath, JSON.stringify(keys, null, 2), { mode: 0o600 });
const id = (p) => `${p}.${root}`;
const log = (...a) => console.log(...a);
const txUrl = (r) => `https://testnet.nearblocks.io/txns/${r.transaction.hash}`;

async function exists(accountId) {
  try { await provider.viewAccount({ accountId, finality: "final" }); return true; } catch { return false; }
}
async function sub(prefix, near) {
  const accountId = id(prefix);
  if (!keys[accountId]) { keys[accountId] = KeyPair.fromRandom("ed25519").toString(); save(); }
  if (!(await exists(accountId))) {
    const kp = KeyPair.fromString(keys[accountId]);
    const r = await rootAcc.createSubAccount({ accountOrPrefix: prefix, publicKey: kp.getPublicKey().toString(), nearToTransfer: nearToYocto(near) });
    log("created", accountId, txUrl(r));
  }
  return new Account(accountId, provider, keys[accountId]);
}
async function deploy(acc, wasm, init) {
  const state = await acc.getState();
  if (state.codeHash && state.codeHash !== "11111111111111111111111111111111") { log("code already on", acc.accountId); return; }
  const code = readFileSync(join(repo, "contracts/target/near", wasm));
  const r = await acc.signAndSendTransaction({ receiverId: acc.accountId, actions: [actions.deployContract(code), actions.functionCall(init.method, init.args, 100_000_000_000_000n, 0n)] });
  log("deployed", acc.accountId, txUrl(r));
}

const usdc = await sub("usdc", "2.4");
const lap = await sub("lap", "3.2");
const agent = await sub("agent", "0.7");
await deploy(usdc, "mock_usdc/mock_usdc.wasm", { method: "new", args: {} });
await deploy(lap, "lap/lap.wasm", { method: "new", args: { owner: root, token: usdc.accountId, order_timeout_ms: 10 * 60 * 1000 } });

// Register the escrow contract on the token so it can hold balances.
await rootAcc.callFunction({ contractId: usdc.accountId, methodName: "register", args: { account_id: lap.accountId } });

// Restricted agent key: can only call lap.agent_pay, no deposits, 2 NEAR gas allowance (charged at buy price, refunded after execution).
if (!keys.agentFunctionCallKey) {
  const kp = KeyPair.fromRandom("ed25519");
  const r = await agent.addFunctionCallAccessKey({ publicKey: kp.getPublicKey().toString(), contractId: lap.accountId, methodNames: ["agent_pay"], allowance: nearToYocto("2") });
  keys.agentFunctionCallKey = kp.toString(); save();
  log("agent function-call key", kp.getPublicKey().toString(), txUrl(r));
}

// Demo merchants (real NEAR accounts, demo catalog). One shared restricted key lets the
// server act as these demo merchants for confirm/refund only.
const demoMerchants = [
  { prefix: "bakery", name: "Saddar Bakery (demo)", category: "groceries", city: "Karachi", lat: 24.8556, lon: 67.0236, items: [["Bread loaf", 1.5], ["Eggs (12)", 3.2], ["Milk 1L", 1.1], ["Weekly grocery bag", 18]] },
  { prefix: "chai", name: "Clifton Chai House (demo)", category: "food", city: "Karachi", lat: 24.8138, lon: 67.0300, items: [["Doodh patti chai", 0.8], ["Bun kebab", 1.6], ["Family dinner box", 12]] },
  { prefix: "pharmacy", name: "Gulshan Pharmacy (demo)", category: "pharmacy", city: "Karachi", lat: 24.9204, lon: 67.0932, items: [["Paracetamol strip", 0.7], ["First-aid kit", 9.5], ["Vitamin C", 4]] },
  { prefix: "mobile", name: "Tariq Road Mobile Top-up (demo)", category: "services", city: "Karachi", lat: 24.8724, lon: 67.0602, items: [["Mobile top-up 500 PKR", 1.8], ["Phone case", 5], ["Screen protector", 3]] },
];
if (!keys.demoMerchantKey) { keys.demoMerchantKey = KeyPair.fromRandom("ed25519").toString(); save(); }
const demoPk = KeyPair.fromString(keys.demoMerchantKey).getPublicKey().toString();
for (const m of demoMerchants) {
  const acc = await sub(m.prefix, "0.15");
  const list = await acc.getAccessKeyList();
  if (!list.keys.some((k) => k.public_key === demoPk)) {
    await acc.addFunctionCallAccessKey({ publicKey: demoPk, contractId: lap.accountId, methodNames: ["confirm", "refund", "set_merchant_active"], allowance: nearToYocto("1") });
  }
  await rootAcc.callFunction({ contractId: usdc.accountId, methodName: "register", args: { account_id: acc.accountId } });
  const r = await acc.callFunctionRaw({
    contractId: lap.accountId, methodName: "register_merchant",
    args: { name: m.name, category: m.category, city: m.city, lat_e6: Math.round(m.lat * 1e6), lon_e6: Math.round(m.lon * 1e6), items: m.items.map(([name, usd]) => ({ name, price: String(Math.round(usd * 1e6)) })) },
  });
  log("merchant", acc.accountId, txUrl(r));
}

const deployment = {
  network: "testnet",
  rpcUrl: "https://test.rpc.fastnear.com",
  explorer: "https://testnet.nearblocks.io",
  root,
  lapContract: lap.accountId,
  tokenContract: usdc.accountId,
  tokenSymbol: "tUSDC",
  tokenDecimals: 6,
  agentAccount: agent.accountId,
  relayerAccount: root,
  demoMerchants: demoMerchants.map((m) => id(m.prefix)),
};
writeFileSync(join(repo, "lib/near/deployment.testnet.json"), JSON.stringify(deployment, null, 2) + "\n");
writeFileSync(join(dir, ".dev.vars"), [
  `NEAR_NETWORK=testnet`,
  `RELAYER_ACCOUNT_ID=${root}`,
  `RELAYER_PRIVATE_KEY=${rootKey}`,
  `AGENT_ACCOUNT_ID=${agent.accountId}`,
  `AGENT_PRIVATE_KEY=${keys.agentFunctionCallKey}`,
  `DEMO_MERCHANT_PRIVATE_KEY=${keys.demoMerchantKey}`,
  "",
].join("\n"), { mode: 0o600 });
log("done", JSON.stringify(deployment));
