"use client";
import { txUrl, accountUrl } from "@/lib/near/config";

export function Card({ title, step, children }: { title: string; step?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[var(--line)] bg-white p-5 shadow-sm">
      <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
        {step && <span className="grid h-6 w-6 place-items-center rounded-full bg-[var(--green)] text-xs text-white">{step}</span>}
        {title}
      </h2>
      {children}
    </section>
  );
}
export function Btn({ children, onClick, disabled, kind = "primary", type = "button" }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; kind?: "primary" | "ghost" | "danger"; type?: "button" | "submit" }) {
  const styles = { primary: "bg-[var(--green)] text-white hover:opacity-90", ghost: "border border-[var(--line)] bg-white hover:bg-[var(--soft)]", danger: "border border-red-200 bg-white text-red-700 hover:bg-red-50" }[kind];
  return <button type={type} onClick={onClick} disabled={disabled} className={`rounded-lg px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40 ${styles}`}>{children}</button>;
}
export function Tx({ hash, label }: { hash?: string; label?: string }) {
  if (!hash) return null;
  return <a className="text-xs text-[var(--green)] underline" href={txUrl(hash)} target="_blank" rel="noreferrer">{label || `tx ${hash.slice(0, 8)}…`} ↗</a>;
}
export function Acct({ id }: { id: string }) {
  return <a className="font-mono text-xs underline" href={accountUrl(id)} target="_blank" rel="noreferrer">{id}</a>;
}
export function Status({ s }: { s: string }) {
  const c = { Escrowed: "bg-amber-100 text-amber-800", Releasing: "bg-blue-100 text-blue-800", Confirmed: "bg-green-100 text-green-800", Refunded: "bg-gray-100 text-gray-700" }[s] || "bg-gray-100";
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${c}`}>{s}</span>;
}
export const usd = (units: string | bigint) => `$${(Number(units) / 1e6).toFixed(2)}`;
