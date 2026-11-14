"use client";
import { Account, JsonRpcProvider, KeyPair, actions, base64Encode, encodeSignedDelegate } from "near-api-js";
import { near } from "./config";

const STORE = "localagentpay:guest:v1";
export type Guest = { accountId: string; privateKey: string; createdTx?: string };

export function loadGuest(): Guest | null {
  try { return JSON.parse(localStorage.getItem(STORE) || "null"); } catch { return null; }
}
export function forgetGuest() { localStorage.removeItem(STORE); }

async function post<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json.error || `Request failed (${response.status})`);
  return json as T;
}

/** Generates a key in the browser and asks the relayer to create a named testnet account for it. */
export async function createGuest(): Promise<Guest> {
  const key = KeyPair.fromRandom("ed25519");
  const { accountId, txHash } = await post<{ accountId: string; txHash: string }>("/api/near/guest", { publicKey: key.getPublicKey().toString() });
  const guest = { accountId, privateKey: key.toString(), createdTx: txHash };
  localStorage.setItem(STORE, JSON.stringify(guest));
  return guest;
}

export type Call = { method: string; args: object; deposit?: bigint; gas?: bigint };
export type RelayResult = { txHash: string; ok: boolean; error: string | null; value?: unknown };

/** Signs a NEP-366 delegate action locally and sends it to the gasless relayer. */
export async function gasless(guest: Guest, receiverId: string, calls: Call[]): Promise<RelayResult> {
  const account = new Account(guest.accountId, new JsonRpcProvider({ url: near.rpcUrl }), guest.privateKey as `ed25519:${string}`);
  const { signedDelegate } = await account.createSignedMetaTransaction({
    receiverId,
    actions: calls.map((c) => actions.functionCall(c.method, c.args, c.gas ?? 50_000_000_000_000n, c.deposit ?? 0n)),
    blockHeightTtl: 120,
  });
  return post<RelayResult>("/api/near/relay", { signedDelegate: base64Encode(encodeSignedDelegate(signedDelegate)) });
}

/** Signs `parts|timestamp` so the server can verify the request came from this account's key. */
export function signRequest(guest: Guest, parts: string[]) {
  const key = KeyPair.fromString(guest.privateKey as `ed25519:${string}`);
  const message = [...parts, String(Date.now())].join("|");
  const { signature } = key.sign(new TextEncoder().encode(message));
  return { accountId: guest.accountId, message, publicKey: key.getPublicKey().toString(), signature: base64Encode(signature) };
}
