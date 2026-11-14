"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { near, toUnits } from "@/lib/near/config";
import { createGuest, gasless, loadGuest, type Guest } from "@/lib/near/client";
import { getMerchants, getOrders, getTokenBalance, type Merchant, type Order } from "@/lib/near/views";
import { Acct, Btn, Card, Status, Tx, usd } from "./ui";

export default function MerchantDashboard() {
  const [guest, setGuest] = useState<Guest | null>(null);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [selected, setSelected] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [balance, setBalance] = useState("0");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; hash?: string } | null>(null);
  const [form, setForm] = useState({ name: "", category: "groceries", city: "Karachi", lat: "24.8607", lon: "67.0011", items: "Bread loaf=1.50\nMilk 1L=1.10" });

  const load = useCallback(async () => {
    const list = await getMerchants();
    setMerchants(list);
    const id = selected || list[0]?.account_id || "";
    if (!selected && id) setSelected(id);
    if (id) { setOrders(await getOrders(id)); setBalance(await getTokenBalance(id).catch(() => "0")); }
  }, [selected]);
  useEffect(() => { setGuest(loadGuest()); }, []);
  useEffect(() => { void load(); const t = setInterval(() => void load(), 6000); return () => clearInterval(t); }, [load]);

  const isDemo = near.demoMerchants.includes(selected);
  const isMine = guest?.accountId === selected;

  async function act(action: "confirm" | "refund", id: number) {
    setBusy(true); setNote(null);
    try {
      const r = isMine
        ? await gasless(guest!, near.lap, [{ method: action, args: { order_id: id } }])
        : await fetch("/api/merchant/demo", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ merchant: selected, action, orderId: id }) }).then((x) => x.json());
      setNote({ text: r.ok ? `${action === "confirm" ? "Released escrow for" : "Refunded"} order #${id}` : `Rejected: ${r.error}`, hash: r.txHash });
      await load();
    } catch (e) { setNote({ text: e instanceof Error ? e.message : String(e) }); } finally { setBusy(false); }
  }

  async function register() {
    setBusy(true); setNote(null);
    try {
      const g = guest || (await createGuest());
      setGuest(g);
      const items = form.items.split("\n").map((l) => l.split("=")).filter((p) => p.length === 2 && p[0].trim()).map(([name, price]) => ({ name: name.trim(), price: toUnits(price.trim()) }));
      const r = await gasless(g, near.lap, [{ method: "register_merchant", args: { name: form.name, category: form.category, city: form.city, lat_e6: Math.round(Number(form.lat) * 1e6), lon_e6: Math.round(Number(form.lon) * 1e6), items } }]);
      setNote({ text: r.ok ? `Registered ${g.accountId} as a merchant` : `Rejected: ${r.error}`, hash: r.txHash });
      if (r.ok) setSelected(g.accountId);
      await load();
    } catch (e) { setNote({ text: e instanceof Error ? e.message : String(e) }); } finally { setBusy(false); }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <header className="mb-4 flex items-end justify-between">
        <div><h1 className="text-2xl font-bold">Merchant dashboard</h1><p className="text-[var(--muted)]">Get paid in USDC on NEAR. Funds sit in escrow until you confirm.</p></div>
        <Link className="text-sm underline" href="/">← Shopper app</Link>
      </header>
      {note && <p className="mb-3 rounded-lg bg-[var(--soft)] px-3 py-2 text-sm">{note.text} <Tx hash={note.hash} /></p>}
      <div className="grid gap-4 md:grid-cols-[1.3fr_1fr]">
        <Card title="Orders">
          <select className="mb-3 w-full rounded border px-2 py-1" value={selected} onChange={(e) => setSelected(e.target.value)}>
            {merchants.map((m) => <option key={m.account_id} value={m.account_id}>{m.name} — {m.account_id}</option>)}
          </select>
          <p className="mb-2 text-sm">Received: <b>{usd(balance)}</b> tUSDC · <Acct id={selected || near.lap} /> {isDemo && <span className="text-xs text-[var(--muted)]">(demo merchant: the server signs with a key limited to confirm/refund)</span>}</p>
          {!orders.length && <p className="text-sm text-[var(--muted)]">No orders yet.</p>}
          <div className="grid gap-2">
            {orders.map((o) => (
              <div key={o.id} className="flex items-center justify-between gap-2 rounded-lg border border-[var(--line)] px-3 py-2 text-sm">
                <div><b>#{o.id}</b> {usd(o.amount)} from <Acct id={o.payer} /> <Status s={o.status} /><div className="text-xs text-[var(--muted)]">{o.memo}{o.via_agent ? ` · via agent ${o.via_agent}` : ""}</div></div>
                {o.status === "Escrowed" && (isDemo || isMine) && <div className="flex gap-1"><Btn disabled={busy} onClick={() => act("confirm", o.id)}>Confirm</Btn><Btn kind="ghost" disabled={busy} onClick={() => act("refund", o.id)}>Refund</Btn></div>}
              </div>
            ))}
          </div>
        </Card>
        <Card title="Register your shop (gasless, testnet)">
          <div className="grid gap-2 text-sm">
            <input className="rounded border px-2 py-1" placeholder="Shop name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <select className="rounded border px-2 py-1" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}><option>groceries</option><option>food</option><option>pharmacy</option><option>services</option></select>
            <div className="grid grid-cols-3 gap-2"><input className="rounded border px-2 py-1" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /><input className="rounded border px-2 py-1" value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} /><input className="rounded border px-2 py-1" value={form.lon} onChange={(e) => setForm({ ...form, lon: e.target.value })} /></div>
            <textarea className="h-24 rounded border px-2 py-1 font-mono text-xs" value={form.items} onChange={(e) => setForm({ ...form, items: e.target.value })} />
            <p className="text-xs text-[var(--muted)]">One item per line: <code>name=price in USD</code>. Uses this browser&apos;s guest account{guest ? ` (${guest.accountId})` : " (created on submit)"}.</p>
            <Btn disabled={busy || form.name.trim().length < 2} onClick={register}>Register on NEAR</Btn>
          </div>
        </Card>
      </div>
    </main>
  );
}
