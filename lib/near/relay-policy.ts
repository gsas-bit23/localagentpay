import { near, isGuestAccount } from "./config";

/** Methods the gasless relayer will sponsor, per receiver contract. */
/** Methods the gasless relayer will sponsor, per receiver contract. */
export function allowedMethods(receiverId: string): string[] | undefined {
  if (receiverId === near.token) return ["faucet", "ft_transfer_call"];
  if (receiverId === near.lap)
    return ["set_agent_policy", "revoke_agent", "pay_from_budget", "refund", "withdraw_budget", "register_merchant", "set_merchant_active", "confirm"];
  return undefined;
}
const MAX_GAS = 150_000_000_000_000n;

export type RelayAction = { methodName: string; args: Uint8Array; gas: bigint; deposit: bigint } | null;
export type RelayCheck = { senderId: string; receiverId: string; actions: RelayAction[] };

/** Returns a reason string when the delegate must NOT be sponsored, otherwise null. */
export function rejectReason({ senderId, receiverId, actions }: RelayCheck): string | null {
  if (!isGuestAccount(senderId)) return "Only LocalAgentPay guest accounts are sponsored";
  const allowed = allowedMethods(receiverId);
  if (!allowed) return "Receiver is not a LocalAgentPay contract";
  if (!actions.length || actions.length > 3) return "Use 1-3 actions";
  for (const a of actions) {
    if (!a) return "Only function calls are sponsored";
    if (!allowed.includes(a.methodName)) return `Method ${a.methodName} is not sponsored`;
    if (a.deposit > 1n) return "Deposits above 1 yoctoNEAR are not sponsored";
    if (a.gas > MAX_GAS) return "Too much gas";
    if (a.methodName === "ft_transfer_call") {
      const args = JSON.parse(new TextDecoder().decode(a.args));
      if (args.receiver_id !== near.lap) return "Token transfers may only go to the escrow contract";
    }
  }
  return null;
}
