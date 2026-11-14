import { NextResponse } from "next/server";
import { agentPay, verifyAccountSignature, NearError, isGuestAccount } from "@/lib/near/server";
import { getMerchants } from "@/lib/near/views";
import { memoFor, priceLines } from "@/lib/agent/planner";
import { body, fail, limit } from "@/lib/near/api";

type Input = {
  merchant: string; items: { name: string; quantity: number }[];
  auth: { accountId: string; message: string; publicKey: string; signature: string };
};

/** The user asks the agent to pay. The server checks the user's signature, recomputes the price from
 * the on-chain catalog, then the agent signs agent_pay with its restricted key. The contract enforces
 * the user's per-order cap, daily cap, expiry and allow-list. */
export async function POST(request: Request) {
  try {
    limit(request, "agent-pay", 10);
    const input = await body<Input>(request);
    const { auth } = input;
    if (!auth || !isGuestAccount(auth.accountId)) throw new NearError("Sign in with a LocalAgentPay testnet account");
    const merchant = (await getMerchants()).find((m) => m.account_id === input.merchant && m.active);
    if (!merchant) throw new NearError("Unknown merchant");
    const { lines, total } = priceLines(merchant, input.items || []);
    const memo = memoFor(lines);
    const expected = ["agent_pay", merchant.account_id, total.toString(), memo].join("|");
    if (!auth.message.startsWith(expected + "|")) throw new NearError("Signed request does not match this order", 401);
    await verifyAccountSignature(auth.accountId, auth.message, auth.publicKey, auth.signature);
    const result = await agentPay(auth.accountId, merchant.account_id, total.toString(), memo);
    return NextResponse.json({ ...result, amount: total.toString(), memo }, { status: result.ok ? 200 : 409 });
  } catch (error) { return fail(error); }
}
