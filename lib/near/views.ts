import { near } from "./config";

export type Item = { name: string; price: string };
export type Merchant = {
  account_id: string; name: string; category: string; city: string;
  lat_e6: number; lon_e6: number; items: Item[]; active: boolean;
};
export type Policy = {
  agent: string | null; per_order_cap: string; daily_cap: string; expires_at_ms: number;
  allowed_merchants: string[]; spent_today: string; day_index: number;
};
export type Budget = { balance: string; escrowed: string; policy: Policy };
export type Order = {
  id: number; payer: string; merchant: string; amount: string; memo: string;
  via_agent: string | null; status: "Escrowed" | "Releasing" | "Confirmed" | "Refunded";
  created_at_ms: number; deadline_ms: number;
};

/** Read-only RPC view call; works in the browser, Node and Cloudflare Workers. */
export async function view<T>(contractId: string, method: string, args: object = {}): Promise<T> {
  const response = await fetch(near.rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0", id: "lap", method: "query",
      params: { request_type: "call_function", finality: "optimistic", account_id: contractId, method_name: method, args_base64: btoa(JSON.stringify(args)) },
    }),
  });
  const json = await response.json();
  if (json.error || json.result?.error) throw new Error(JSON.stringify(json.error || json.result.error).slice(0, 300));
  return JSON.parse(new TextDecoder().decode(new Uint8Array(json.result.result))) as T;
}

export async function accountExists(accountId: string) {
  const response = await fetch(near.rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: "lap", method: "query", params: { request_type: "view_account", finality: "optimistic", account_id: accountId } }),
  });
  const json = await response.json();
  return !json.error && !json.result?.error;
}

export const getMerchants = () => view<Merchant[]>(near.lap, "get_merchants", { limit: 100 });
export const getBudget = (account_id: string) => view<Budget>(near.lap, "get_budget", { account_id });
export const getOrders = (account_id: string) => view<Order[]>(near.lap, "get_orders_for", { account_id, limit: 50 });
export const getOrder = (order_id: number) => view<Order | null>(near.lap, "get_order", { order_id });
export const getTokenBalance = (account_id: string) => view<string>(near.token, "ft_balance_of", { account_id });
