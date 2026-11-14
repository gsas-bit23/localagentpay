import {
  Account, JsonRpcProvider, KeyPair, PublicKey, actions, decodeSignedDelegate, base64Decode, nearToYocto,
} from "near-api-js";
import { near, isGuestAccount } from "./config";
import { rejectReason, type RelayAction } from "./relay-policy";

export class NearError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

function env(name: string) {
  const value = process.env[name];
  if (!value) throw new NearError(`Server is missing ${name}. See .env.example.`, 503);
  return value;
}
const provider = () => new JsonRpcProvider({ url: process.env.NEAR_RPC_URL || near.rpcUrl });
const relayer = () => new Account(env("RELAYER_ACCOUNT_ID"), provider(), env("RELAYER_PRIVATE_KEY") as `ed25519:${string}`);

export function hashOf(result: { transaction: { hash: string } }) {
  return result.transaction.hash;
}

function failure(result: any): string | null {
  const s = result?.status;
  if (s && typeof s === "object" && "Failure" in s) return JSON.stringify(s.Failure).slice(0, 400);
  for (const o of result?.receipts_outcome || []) {
    const st = o.outcome?.status;
    if (st && typeof st === "object" && "Failure" in st) return JSON.stringify(st.Failure).slice(0, 400);
  }
  return null;
}

/** Returns the decoded JSON return value of the transaction's last receipt, if any. */
function returnValue(result: any): unknown {
  const s = result?.status;
  if (s && typeof s === "object" && typeof s.SuccessValue === "string" && s.SuccessValue) {
    try { return JSON.parse(new TextDecoder().decode(base64Decode(s.SuccessValue))); } catch { return undefined; }
  }
  return undefined;
}

/** Creates a named guest sub-account owned by the browser's own key. Relayer pays 0.02 NEAR. */
export async function createGuest(publicKey: string) {
  const pk = PublicKey.fromString(publicKey);
  if (pk.keyType !== 0) throw new NearError("Use an ed25519 key");
  const prefix = `g-${Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => (b % 36).toString(36)).join("")}`;
  const result = await relayer().createSubAccount({ accountOrPrefix: prefix, publicKey: pk.toString(), nearToTransfer: nearToYocto("0.02") });
  const reason = failure(result);
  if (reason) throw new NearError(`Account creation failed: ${reason}`, 502);
  return { accountId: `${prefix}.${near.root}`, txHash: hashOf(result) };
}

/** NEP-366 relayer: sponsors gas only for allow-listed calls to our two contracts. */
export async function relay(signedDelegateBase64: string) {
  let signed;
  try { signed = decodeSignedDelegate(base64Decode(signedDelegateBase64)); } catch { throw new NearError("Malformed signed delegate"); }
  const d = signed.delegateAction;
  const actions: RelayAction[] = d.actions.map((a: any) => (a.functionCall ? {
    methodName: a.functionCall.methodName, args: new Uint8Array(a.functionCall.args),
    gas: BigInt(a.functionCall.gas), deposit: BigInt(a.functionCall.deposit),
  } : null));
  const reason = rejectReason({ senderId: d.senderId, receiverId: d.receiverId, actions });
  if (reason) throw new NearError(reason, 403);
  try {
    const result = await relayer().relayMetaTransaction(signed);
    const fail = failure(result);
    return { txHash: hashOf(result), ok: !fail, error: fail, value: returnValue(result) };
  } catch (error) {
    return thrown(error);
  }
}

function cleanPanic(text: string) {
  const m = text.match(/panicked: ([^"\\]+)/);
  return (m ? m[1] : text).slice(0, 300);
}

/** near-api-js throws on contract panics; keep the tx hash so the UI can still link it. */
function thrown(error: any) {
  const message = cleanPanic(String(error?.message || error));
  return { txHash: String(error?.txHash || ""), ok: false, error: message, value: undefined };
}

async function call(acc: Account, method: string, args: object, gas: bigint) {
  try {
    const result = await acc.signAndSendTransaction({
      receiverId: near.lap, actions: [actions.functionCall(method, args, gas, 0n)], throwOnFailure: false,
    } as any);
    const fail = failure(result);
    return { txHash: hashOf(result), ok: !fail, error: fail ? cleanPanic(fail) : null, value: returnValue(result) };
  } catch (error) {
    return thrown(error);
  }
}

/** Verifies that `accountId` signed `message` with one of its current access keys. */
export async function verifyAccountSignature(accountId: string, message: string, publicKey: string, signatureB64: string, maxAgeMs = 5 * 60_000) {
  const ts = Number(message.split("|").pop());
  if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > maxAgeMs) throw new NearError("Signed request expired", 401);
  const pk = PublicKey.fromString(publicKey);
  if (!pk.verify(new TextEncoder().encode(message), base64Decode(signatureB64))) throw new NearError("Bad signature", 401);
  try {
    await provider().viewAccessKey({ accountId, publicKey: pk.toString(), finality: "optimistic" } as any);
  } catch {
    throw new NearError("That key does not belong to this account", 401);
  }
}

/** The agent signs with a function-call key that can only call lap.agent_pay. */
export async function agentPay(user: string, merchant: string, amount: string, memo: string) {
  const agent = new Account(env("AGENT_ACCOUNT_ID"), provider(), env("AGENT_PRIVATE_KEY") as `ed25519:${string}`);
  const r = await call(agent, "agent_pay", { user, merchant, amount, memo }, 50_000_000_000_000n);
  return { ...r, orderId: r.value as number | undefined };
}

/** Demo merchants share one key restricted to confirm/refund/set_merchant_active on lap. */
export async function demoMerchantAct(merchant: string, action: "confirm" | "refund", orderId: number) {
  if (!near.demoMerchants.includes(merchant)) throw new NearError("Only demo merchants can be operated by the server", 403);
  const acc = new Account(merchant, provider(), env("DEMO_MERCHANT_PRIVATE_KEY") as `ed25519:${string}`);
  return call(acc, action, { order_id: orderId }, 60_000_000_000_000n);
}

export { isGuestAccount, KeyPair };
