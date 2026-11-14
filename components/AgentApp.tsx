"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { near, toUnits } from "@/lib/near/config";
import { createGuest, forgetGuest, gasless, loadGuest, signRequest, type Guest } from "@/lib/near/client";
import { getBudget, getOrders, getTokenBalance, type Budget, type Order } from "@/lib/near/views";
import { memoFor, type Plan, type Proposal } from "@/lib/agent/planner";
import { Acct, Btn, Card, Status, Tx, usd } from "./ui";

type Log = { label: string; hash?: string; ok: boolean; error?: string | null; at: number };
const EXAMPLES = ["Weekly groceries under $20", "Bread and eggs", "Something for a headache under $2", "Mobile top-up", "Chai and bun kebab for two"];

export default function AgentApp() {
  const [guest, setGuest] = useState<Guest | null>(null);
  const [wallet, setWallet] = useState("0");
  const [budget, setBudget] = useState<Budget | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [log, setLog] = useState<Log[]>([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState(EXAMPLES[0]);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [caps, setCaps] = useState({ perOrder: "20", daily: "40", hours: "24" });
  const [location, setLocation] = useState<{ lat: number; lon: number } | undefined>();
  const [fund, setFund] = useState({ origin: "base-usdc", amount: "25", recipient: "" });
  const [quote, setQuote] = useState<any>(null);

  const refresh = useCallback(async (g = guest) => {
    if (!g) return;
    const [w, b, o] = await Promise.all([getTokenBalance(g.accountId).catch(() => "0"), getBudget(g.accountId), getOrders(g.accountId)]);
    setWallet(w); setBudget(b); setOrders(o);
  }, [guest]);

  useEffect(() => { const g = loadGuest(); setGuest(g); if (g) void refresh(g); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!guest) return; const t = setInterval(() => void refresh(), 6000); return () => clearInterval(t); }, [guest, refresh]);

  async function run(label: string, fn: () => Promise<{ txHash?: string; ok: boolean; error?: string | null } | void>) {
    setBusy(label); setError("");
    try {
      const r = await fn();
      if (r) {
        setLog((l) => [{ label, hash: r.txHash, ok: r.ok, error: r.error, at: Date.now() }, ...l].slice(0, 30));
        if (!r.ok) setError(`${label} was rejected on-chain: ${r.error}`);
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setBusy(""); }
  }

  const policy = budget?.policy;
  const policyActive = !!policy?.agent && policy.expires_at_ms > Date.now();

  async function ask() {
    setBusy("agent"); setError(""); setPlan(null);
    try {
      const r = await fetch("/api/agent", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message, location }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setPlan(j);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(""); }
  }

  async function agentPay(p: Proposal) {
    if (!guest) return;
    await run(`Agent paid ${p.merchantName} ${usd(p.total)}`, async () => {
      const auth = signRequest(guest, ["agent_pay", p.merchant, p.total, memoFor(p.lines)]);
      const r = await fetch("/api/agent/pay", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ merchant: p.merchant, items: p.lines.map((l) => ({ name: l.name, quantity: l.quantity })), auth }) });
      const j = await r.json();
      if (!j.txHash && j.error) throw new Error(`Agent payment rejected: ${j.error}`);
      return j;
    });
  }

  async function previewFunding() {
    setBusy("quote"); setQuote(null); setError("");
    try {
      const r = await fetch("/api/funding-quote", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(fund) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setQuote(j);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(""); }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">LocalAgentPay</h1>
          <p className="text-[var(--muted)]">An AI shopping agent that pays local merchants on NEAR, only inside the limits you set on-chain.</p>
        </div>
        <nav className="flex gap-3 text-sm">
          <Link className="underline" href="/merchant">Merchant dashboard</Link>
          <Link className="underline" href="/explore">Map explorer</Link>
          <a className="underline" href="https://github.com/gsas-bit23/localagentpay" target="_blank" rel="noreferrer">Source</a>
        </nav>
      </header>
      <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">NEAR <b>testnet</b> prototype. Tokens are test USDC (tUSDC) with no value; merchants marked (demo) are demo accounts. Contract <Acct id={near.lap} />.</p>
      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}

      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <div className="grid content-start gap-4">
          <Card step="1" title="Account (gasless)">
            {!guest ? (
              <div className="grid gap-2">
                <p className="text-sm text-[var(--muted)]">Creates a named NEAR testnet account. Your key stays in this browser; a relayer pays all gas (NEP-366 meta transactions).</p>
                <Btn disabled={!!busy} onClick={() => run("Created guest account", async () => { const g = await createGuest(); setGuest(g); await refresh(g); return { txHash: g.createdTx, ok: true }; })}>{busy ? "Working…" : "Try as guest"}</Btn>
              </div>
            ) : (
              <div className="grid gap-2 text-sm">
                <div>Account: <Acct id={guest.accountId} /></div>
                <div>Wallet: <b>{usd(wallet)}</b> tUSDC · Budget: <b>{usd(budget?.balance || "0")}</b> · In escrow: {usd(budget?.escrowed || "0")}</div>
                <div className="flex flex-wrap gap-2">
                  <Btn disabled={!!busy} onClick={() => run("Faucet 50 + deposit 30 to budget", () => gasless(guest, near.token, [
                    { method: "faucet", args: { amount: toUnits("50") } },
                    { method: "ft_transfer_call", args: { receiver_id: near.lap, amount: toUnits("30"), msg: JSON.stringify({ action: "fund" }) }, deposit: 1n },
                  ]))}>Get 50 tUSDC + fund budget 30</Btn>
                  <Btn kind="ghost" disabled={!!busy || BigInt(budget?.balance || "0") === 0n} onClick={() => run("Withdrew budget", () => gasless(guest, near.lap, [{ method: "withdraw_budget", args: { amount: budget!.balance } }]))}>Withdraw budget</Btn>
                  <Btn kind="ghost" onClick={() => { if (confirm("Forget this guest key? The testnet account stays on-chain but you lose access.")) { forgetGuest(); setGuest(null); setBudget(null); setOrders([]); } }}>Sign out</Btn>
                </div>
              </div>
            )}
          </Card>

          <Card step="2" title="Agent spending limits (enforced by the contract)">
            <div className="grid grid-cols-3 gap-2 text-sm">
              <label>Per order $<input className="w-full rounded border px-2 py-1" value={caps.perOrder} onChange={(e) => setCaps({ ...caps, perOrder: e.target.value })} /></label>
              <label>Daily $<input className="w-full rounded border px-2 py-1" value={caps.daily} onChange={(e) => setCaps({ ...caps, daily: e.target.value })} /></label>
              <label>Hours<input className="w-full rounded border px-2 py-1" value={caps.hours} onChange={(e) => setCaps({ ...caps, hours: e.target.value })} /></label>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Btn disabled={!guest || !!busy} onClick={() => run("Authorized agent", () => gasless(guest!, near.lap, [{ method: "set_agent_policy", args: { agent: near.agent, per_order_cap: toUnits(caps.perOrder), daily_cap: toUnits(caps.daily), expires_in_ms: Math.round(Number(caps.hours) * 3_600_000), allowed_merchants: null } }]))}>Authorize agent</Btn>
              <Btn kind="danger" disabled={!guest || !policyActive || !!busy} onClick={() => run("Revoked agent", () => gasless(guest!, near.lap, [{ method: "revoke_agent", args: {} }]))}>Revoke</Btn>
            </div>
            <p className="mt-2 text-xs text-[var(--muted)]">
              {policyActive ? <>Agent <Acct id={policy!.agent!} /> may spend up to {usd(policy!.per_order_cap)} per order and {usd(policy!.daily_cap)} per day (spent today {usd(policy!.spent_today)}) until {new Date(policy!.expires_at_ms).toLocaleString()}.</> : "No active agent authorization."}
              {" "}The agent signs with a function-call key limited to <code>agent_pay</code>; such keys cannot attach deposits, so it can only spend through these on-chain checks.
            </p>
          </Card>

          <Card title="Fund from any chain (NEAR Intents preview)">
            <p className="mb-2 text-xs text-[var(--muted)]">Live 1Click <b>dry</b> quote on mainnet for exact USDC on NEAR. No deposit address is issued and nothing is sent (NEAR Intents has no testnet).</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <select className="rounded border px-2 py-1" value={fund.origin} onChange={(e) => setFund({ ...fund, origin: e.target.value })}>
                <option value="base-usdc">USDC on Base</option><option value="arb-usdc">USDC on Arbitrum</option><option value="eth-eth">ETH on Ethereum</option><option value="sol-usdc">USDC on Solana</option><option value="near-wnear">NEAR</option>
              </select>
              <input className="rounded border px-2 py-1" value={fund.amount} onChange={(e) => setFund({ ...fund, amount: e.target.value })} placeholder="USDC to receive" />
              <input className="col-span-2 rounded border px-2 py-1" value={fund.recipient} onChange={(e) => setFund({ ...fund, recipient: e.target.value })} placeholder="Mainnet NEAR recipient (optional, e.g. you.near)" />
            </div>
            <div className="mt-2"><Btn kind="ghost" disabled={!!busy} onClick={previewFunding}>{busy === "quote" ? "Quoting…" : "Get dry quote"}</Btn></div>
            {quote && <p className="mt-2 text-sm">Pay <b>{quote.pay}</b> (≈${Number(quote.payUsd).toFixed(2)}) → receive <b>{quote.receive}</b> at <span className="font-mono text-xs">{quote.recipient}</span> in ~{quote.timeEstimateSec}s. <span className="text-xs text-[var(--muted)]">dry quote · 1Click correlation {String(quote.correlationId).slice(0, 8)}</span></p>}
          </Card>
        </div>

        <div className="grid content-start gap-4">
          <Card step="3" title="Ask the agent">
            <div className="flex gap-2">
              <input className="flex-1 rounded-lg border px-3 py-2" value={message} onChange={(e) => setMessage(e.target.value)} onKeyDown={(e) => e.key === "Enter" && ask()} />
              <Btn disabled={!!busy} onClick={ask}>{busy === "agent" ? "Thinking…" : "Ask"}</Btn>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {EXAMPLES.map((x) => <button key={x} className="rounded-full bg-[var(--soft)] px-2 py-1 text-xs" onClick={() => setMessage(x)}>{x}</button>)}
              <button className="rounded-full bg-[var(--soft)] px-2 py-1 text-xs" onClick={() => navigator.geolocation?.getCurrentPosition((p) => setLocation({ lat: p.coords.latitude, lon: p.coords.longitude }))}>{location ? "📍 location on" : "📍 sort by my location"}</button>
            </div>
            {plan && (
              <div className="mt-3 grid gap-2">
                <p className="text-sm">{plan.reply} <span className="text-xs text-[var(--muted)]">({plan.source === "near-ai" ? `NEAR AI Cloud · ${plan.model}` : "rules fallback: NEAR AI key not configured"})</span></p>
                {plan.proposals.map((p) => (
                  <div key={p.merchant} className="rounded-xl border border-[var(--line)] p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-medium">{p.merchantName}</div>
                        <div className="text-xs text-[var(--muted)]">{p.city} · {p.category}{p.distanceKm !== undefined ? ` · ${p.distanceKm} km` : ""} · <Acct id={p.merchant} /></div>
                        <div className="mt-1 text-sm">{p.lines.map((l) => `${l.quantity}× ${l.name} (${usd(l.price)})`).join(", ")}</div>
                        <div className="text-xs text-[var(--muted)]">{p.reason}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-semibold">{usd(p.total)}</div>
                        <Btn disabled={!guest || !policyActive || !!busy} onClick={() => agentPay(p)}>Let agent pay</Btn>
                        {policyActive && BigInt(p.total) > BigInt(policy!.per_order_cap) && <div className="mt-1 max-w-40 text-xs text-red-700">Above your per-order cap: the contract will reject it.</div>}
                      </div>
                    </div>
                  </div>
                ))}
                {!guest || !policyActive ? <p className="text-xs text-[var(--muted)]">Create an account, fund the budget and authorize the agent first (steps 1–2).</p> : null}
              </div>
            )}
          </Card>

          <Card step="4" title="Orders & on-chain receipts">
            {!orders.length && <p className="text-sm text-[var(--muted)]">No orders yet.</p>}
            <div className="grid gap-2">
              {orders.map((o) => (
                <div key={o.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--line)] px-3 py-2 text-sm">
                  <div>
                    <b>#{o.id}</b> {usd(o.amount)} → <Acct id={o.merchant} /> <Status s={o.status} />
                    <div className="text-xs text-[var(--muted)]">{o.memo} · {o.via_agent ? "paid by agent" : "paid directly"} · {new Date(o.created_at_ms).toLocaleTimeString()}</div>
                  </div>
                  <div className="flex gap-1">
                    {o.status === "Escrowed" && near.demoMerchants.includes(o.merchant) && <>
                      <Btn kind="ghost" disabled={!!busy} onClick={() => run(`Demo merchant confirmed #${o.id}`, () => fetch("/api/merchant/demo", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ merchant: o.merchant, action: "confirm", orderId: o.id }) }).then((r) => r.json()))}>Merchant: confirm</Btn>
                      <Btn kind="ghost" disabled={!!busy} onClick={() => run(`Demo merchant refunded #${o.id}`, () => fetch("/api/merchant/demo", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ merchant: o.merchant, action: "refund", orderId: o.id }) }).then((r) => r.json()))}>Merchant: refund</Btn>
                    </>}
                    {o.status === "Escrowed" && Date.now() >= o.deadline_ms && <Btn kind="danger" disabled={!!busy} onClick={() => run(`Reclaimed #${o.id}`, () => gasless(guest!, near.lap, [{ method: "refund", args: { order_id: o.id } }]))}>Reclaim</Btn>}
                  </div>
                </div>
              ))}
            </div>
            {log.length > 0 && (
              <div className="mt-3 border-t pt-2">
                <div className="mb-1 text-xs font-semibold uppercase text-[var(--muted)]">Transactions this session</div>
                {log.map((l) => <div key={l.at} className="flex justify-between gap-2 text-xs"><span>{l.ok ? "✅" : "⛔"} {l.label}{l.error ? ` — ${l.error}` : ""}</span><Tx hash={l.hash} /></div>)}
              </div>
            )}
            {guest && <p className="mt-2 text-xs"><a className="underline" href={`${near.explorer}/address/${guest.accountId}`} target="_blank" rel="noreferrer">All activity for this account on NearBlocks ↗</a></p>}
          </Card>
        </div>
      </div>
    </main>
  );
}
