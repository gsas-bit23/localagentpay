"use client";
import { useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  Check,
  CheckCheck,
  Clock3,
  Info,
  LockKeyhole,
  RefreshCw,
  Route,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import type { Merchant, PayAsset, PaymentQuote } from "@/lib/types";

export default function PaymentCard({
  merchant,
  asset,
  setAsset,
  mode,
  setMode,
  quote,
  loading,
  confirmed,
  onQuote,
  onConfirm,
}: {
  merchant?: Merchant;
  asset: PayAsset;
  setAsset: (asset: PayAsset) => void;
  mode: "demo" | "live";
  setMode: (mode: "demo" | "live") => void;
  quote?: PaymentQuote;
  loading: boolean;
  confirmed: boolean;
  onQuote: () => void;
  onConfirm: () => void;
}) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const seconds = quote
    ? Math.max(
        0,
        Math.ceil((Date.parse(quote.expiresAt) - (now || Date.now())) / 1000),
      )
    : 0;
  const expired = !!quote && seconds === 0;
  return (
    <aside className="payment-column" aria-label="Payment preview">
      <div className="payment-card">
        <div className="payment-title">
          <span className="icon-box">
            <Wallet size={18} />
          </span>
          <h2>Your payment route</h2>
          <span className="tiny-dot" />
        </div>
        <p className="payment-intro">
          Your assets. Their preferred currency.
          <br />
          NEAR Intents connects the dots.
        </p>
        <div className="mode-toggle" aria-label="Quote mode">
          {(["demo", "live"] as const).map((m) => (
            <button
              key={m}
              aria-pressed={mode === m}
              disabled={loading}
              className={mode === m ? "active" : ""}
              onClick={() => setMode(m)}
            >
              {m === "demo" ? "Demo quote" : "Live API preview"}
            </button>
          ))}
        </div>
        <label className="field-label" htmlFor="pay-asset">
          YOU PAY WITH
        </label>
        <div className="asset-select">
          <span className={`coin ${asset.toLowerCase()}`}>
            {asset === "ETH" ? "Ξ" : asset === "USDC" ? "$" : "N"}
          </span>
          <div>
            <select
              id="pay-asset"
              value={asset}
              onChange={(e) => setAsset(e.target.value as PayAsset)}
              disabled={loading}
            >
              <option value="ETH">ETH</option>
              <option value="USDC">USDC</option>
              <option value="wNEAR">wNEAR</option>
            </select>
            <small>{asset === "wNEAR" ? "NEAR" : "Ethereum"} network</small>
          </div>
          <strong>{quote ? quote.origin.amount : "—"}</strong>
        </div>
        <div className="route-connector">
          <span />
          <i>
            <ArrowDown size={15} />
          </i>
          <span />
        </div>
        <div className="route-provider">
          <Route size={15} />
          <strong>NEAR Intents</strong>
          <span>1Click</span>
        </div>
        <div className="route-connector">
          <span />
          <i>
            <ArrowDown size={15} />
          </i>
          <span />
        </div>
        <span className="field-label">MERCHANT RECEIVES</span>
        <div className="destination">
          <span className="coin usdc">$</span>
          <div>
            <strong>USDC</strong>
            <small>Base network</small>
          </div>
          <strong>
            {merchant
              ? `$${quote?.destination.amount ?? merchant.price.toFixed(2)}`
              : "—"}
          </strong>
        </div>
        <div className="payment-breakdown">
          <div>
            <span>Merchant</span>
            <b>{merchant?.name ?? "Choose an option"}</b>
          </div>
          <div>
            <span>{quote?.feeLabel ?? "Route fee"}</span>
            <b>{quote?.fee ?? "Quoted on selection"}</b>
          </div>
          <div>
            <span>Estimated route time</span>
            <b>{quote ? `~${quote.estimatedSeconds} seconds` : "—"}</b>
          </div>
          {quote && !confirmed ? (
            <div>
              <span>Preview expires in</span>
              <b className={expired ? "expired" : ""}>
                <Clock3 size={11} /> {seconds}s
              </b>
            </div>
          ) : null}
        </div>
        {quote?.destination.recipient ? (
          <p className="address">Recipient: {quote.destination.recipient}</p>
        ) : null}
        {confirmed ? (
          <div className="confirmation" role="status">
            <CheckCheck size={22} />
            <div>
              <strong>Demo payment confirmed</strong>
              <p>No funds moved. No order was placed.</p>
              <small>Reference: {quote?.id.slice(0, 22)}</small>
            </div>
          </div>
        ) : (
          <button
            className="primary payment-action"
            disabled={!merchant || loading}
            onClick={quote && !expired ? onConfirm : onQuote}
          >
            {loading ? (
              <>
                <RefreshCw size={16} className="spin" /> Getting quote…
              </>
            ) : quote && !expired ? (
              <>
                <LockKeyhole size={16} /> Simulate confirmation{" "}
                <ArrowRight size={16} />
              </>
            ) : (
              <>
                {expired ? "Refresh quote" : "Preview payment"}
                <ArrowRight size={16} />
              </>
            )}
          </button>
        )}
        <p className="payment-disclaimer">
          <Info size={13} />
          {mode === "demo"
            ? "Illustrative rates. Confirmation is simulated."
            : "Real API quote. Dry run only; cannot be funded."}
        </p>
      </div>
      <div className="why-card">
        <ShieldCheck size={23} />
        <h3>A little more peace of mind.</h3>
        <p>You review every route before confirming. Your keys stay yours.</p>
        <div>
          <Check size={13} /> No custody of your funds
        </div>
        <div>
          <Check size={13} /> Explicit payment approval
        </div>
        <div>
          <Check size={13} /> Transparent merchant amount
        </div>
      </div>
      <div className="built-on">
        <span className="near-logo">N</span> Built on <strong>NEAR</strong>
        <span>·</span> Made for everyday life
      </div>
    </aside>
  );
}
