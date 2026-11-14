import OpenAI from "openai";
import type { Merchant } from "../near/views";
import { distanceKm, memoFor, priceLines, rulesPlan, type Plan, type Proposal } from "./planner";

const SYSTEM = `You are LocalAgentPay, a shopping agent that pays local merchants on NEAR.
You receive the user's request and the on-chain merchant catalog (prices in USD, token units of 6 decimals).
Choose up to 3 orders that best satisfy the request and any budget. Only use merchant account ids and exact
item names from the catalog. Never invent merchants, items or prices. Never claim a payment happened:
the user must approve, and the contract enforces their spending limits. Reply briefly.`;

/** NEAR AI Cloud (OpenAI-compatible, TEE inference) with a forced tool call; validated against chain data. */
export async function planWithNearAI(message: string, merchants: Merchant[], location?: { lat: number; lon: number }): Promise<Plan> {
  const fallback = rulesPlan(message, merchants, location);
  const key = process.env.NEAR_AI_API_KEY;
  const model = process.env.NEAR_AI_MODEL;
  if (!key || !model) return fallback;
  try {
    const client = new OpenAI({ apiKey: key, baseURL: process.env.NEAR_AI_BASE_URL || "https://cloud-api.near.ai/v1", timeout: 15000, maxRetries: 0 });
    const catalog = merchants.filter((m) => m.active).map((m) => ({
      merchant: m.account_id, name: m.name, category: m.category, city: m.city,
      items: m.items.map((i) => ({ name: i.name, usd: Number(i.price) / 1e6 })),
    }));
    const completion = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: JSON.stringify({ request: message, catalog }) },
      ],
      tools: [{
        type: "function",
        function: {
          name: "propose_orders",
          description: "Propose orders for the user to approve.",
          parameters: {
            type: "object",
            properties: {
              reply: { type: "string" },
              orders: {
                type: "array", maxItems: 3,
                items: {
                  type: "object",
                  properties: {
                    merchant: { type: "string" },
                    reason: { type: "string" },
                    items: { type: "array", items: { type: "object", properties: { name: { type: "string" }, quantity: { type: "integer", minimum: 1, maximum: 20 } }, required: ["name", "quantity"] } },
                  },
                  required: ["merchant", "items", "reason"],
                },
              },
            },
            required: ["reply", "orders"],
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "propose_orders" } },
    });
    const call = completion.choices[0]?.message.tool_calls?.[0];
    if (!call || call.type !== "function") throw new Error("no tool call");
    const parsed = JSON.parse(call.function.arguments) as { reply: string; orders: { merchant: string; reason: string; items: { name: string; quantity: number }[] }[] };
    const proposals: Proposal[] = [];
    for (const o of parsed.orders || []) {
      const m = merchants.find((x) => x.account_id === o.merchant && x.active);
      if (!m) continue;
      try {
        const { lines, total } = priceLines(m, o.items);
        const d = location ? distanceKm(location.lat, location.lon, m.lat_e6 / 1e6, m.lon_e6 / 1e6) : undefined;
        proposals.push({ merchant: m.account_id, merchantName: m.name, city: m.city, category: m.category, lines, total: total.toString(),
          distanceKm: d === undefined ? undefined : Math.round(d * 10) / 10, reason: String(o.reason || "").slice(0, 160) || memoFor(lines) });
      } catch { /* drop invalid lines */ }
    }
    if (!proposals.length) return { ...fallback, reply: `${String(parsed.reply || "").slice(0, 300)} ${fallback.reply}`.trim() };
    return { reply: String(parsed.reply || "").slice(0, 400), proposals, source: "near-ai", model, category: fallback.category, budget: fallback.budget };
  } catch {
    return fallback;
  }
}
