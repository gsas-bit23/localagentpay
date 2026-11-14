import type { Merchant } from "../near/views";

export type Category = "groceries" | "food" | "pharmacy" | "services";
export type Line = { name: string; quantity: number; price: string };
export type Proposal = {
  merchant: string; merchantName: string; city: string; category: string;
  lines: Line[]; total: string; distanceKm?: number; reason: string;
};
export type Plan = {
  reply: string; category?: Category; budget?: string; proposals: Proposal[];
  source: "near-ai" | "rules"; model?: string;
};

const CATEGORY_WORDS: Record<Category, string[]> = {
  groceries: ["grocer", "bread", "milk", "egg", "food shop", "supermarket", "bakery", "weekly"],
  food: ["chai", "tea", "dinner", "lunch", "kebab", "restaurant", "eat", "hungry", "meal", "breakfast"],
  pharmacy: ["pharmacy", "medicine", "paracetamol", "vitamin", "first-aid", "first aid", "headache", "chemist"],
  services: ["top-up", "topup", "top up", "recharge", "mobile", "phone", "screen", "case", "balance"],
};

export function parseRequest(message: string): { category?: Category; budgetUnits?: bigint } {
  const text = message.toLowerCase();
  let category: Category | undefined;
  let best = 0;
  for (const [cat, words] of Object.entries(CATEGORY_WORDS) as [Category, string[]][]) {
    const hits = words.filter((w) => text.includes(w)).length;
    if (hits > best) { best = hits; category = cat; }
  }
  const m = text.match(/(?:under|below|max(?:imum)?|budget|up to|less than|<)\s*\$?\s*(\d+(?:\.\d{1,2})?)/) || text.match(/\$\s*(\d+(?:\.\d{1,2})?)/) || text.match(/(\d+(?:\.\d{1,2})?)\s*(?:usd|usdc|dollars?)/);
  const budgetUnits = m ? BigInt(Math.round(Number(m[1]) * 1e6)) : undefined;
  return { category, budgetUnits };
}

export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const r = (d: number) => (d * Math.PI) / 180;
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lon2 - lon1) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

const fmt = (units: bigint) => (Number(units) / 1e6).toFixed(2);

/** Builds an order from a merchant's on-chain catalog. Prices always come from chain data. */
export function priceLines(merchant: Merchant, wanted: { name: string; quantity: number }[]) {
  const lines: Line[] = [];
  let total = 0n;
  for (const w of wanted) {
    const item = merchant.items.find((i) => i.name.toLowerCase() === w.name.toLowerCase());
    if (!item) throw new Error(`${merchant.name} does not sell "${w.name}"`);
    const q = Math.floor(w.quantity);
    if (q < 1 || q > 20) throw new Error("Quantity must be 1-20");
    lines.push({ name: item.name, quantity: q, price: item.price });
    total += BigInt(item.price) * BigInt(q);
  }
  if (!lines.length) throw new Error("Choose at least one item");
  return { lines, total };
}

export function memoFor(lines: Line[]) {
  return lines.map((l) => `${l.quantity}x ${l.name}`).join(", ").slice(0, 120);
}

/** Deterministic planner used when NEAR AI is not configured or returns an invalid plan. */
export function rulesPlan(message: string, merchants: Merchant[], location?: { lat: number; lon: number }): Plan {
  const { category, budgetUnits } = parseRequest(message);
  const text = message.toLowerCase();
  const pool = merchants.filter((m) => m.active && (!category || m.category === category));
  const proposals: Proposal[] = [];
  for (const m of pool) {
    const named = m.items.filter((i) => i.name.toLowerCase().split(/[^a-z0-9]+/).some((w) => w.length > 2 && text.includes(w)));
    let chosen = named.length ? named : [...m.items].sort((a, b) => Number(BigInt(a.price) - BigInt(b.price)));
    if (!named.length && budgetUnits) {
      const fitting = m.items.filter((i) => BigInt(i.price) <= budgetUnits).sort((a, b) => Number(BigInt(b.price) - BigInt(a.price)));
      chosen = fitting.slice(0, 1);
    } else if (!named.length) chosen = chosen.slice(0, 1);
    if (!chosen.length) continue;
    const { lines, total } = priceLines(m, chosen.map((i) => ({ name: i.name, quantity: 1 })));
    if (budgetUnits && total > budgetUnits) continue;
    const d = location ? distanceKm(location.lat, location.lon, m.lat_e6 / 1e6, m.lon_e6 / 1e6) : undefined;
    proposals.push({
      merchant: m.account_id, merchantName: m.name, city: m.city, category: m.category, lines,
      total: total.toString(), distanceKm: d === undefined ? undefined : Math.round(d * 10) / 10,
      reason: named.length ? "Matches the items you named" : budgetUnits ? `Best item within $${fmt(budgetUnits)}` : "Cheapest matching item",
    });
  }
  proposals.sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0) || Number(BigInt(a.total) - BigInt(b.total)));
  const top = proposals.slice(0, 3);
  const reply = top.length
    ? `I found ${top.length} NEAR-payable option${top.length > 1 ? "s" : ""}${category ? ` for ${category}` : ""}${budgetUnits ? ` under $${fmt(budgetUnits)}` : ""}. Pick one and I can pay from your on-chain budget, inside the limits you set.`
    : `No registered NEAR merchant matches that${budgetUnits ? ` under $${fmt(budgetUnits)}` : ""}. Try groceries, food, pharmacy or mobile top-up.`;
  return { reply, category, budget: budgetUnits?.toString(), proposals: top, source: "rules" };
}
