"use client";

import { useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  CircleHelp,
  ExternalLink,
  Globe2,
  Info,
  Leaf,
  LoaderCircle,
  MapPin,
  Navigation,
  Plane,
  Route,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Sparkles,
  UtensilsCrossed,
  Wallet,
  Wrench,
} from "lucide-react";
import {
  countries,
  commerceCategories,
  type CountryCode,
  type CommerceCategory,
} from "@/lib/commerce/config";
import type { CommerceResult, CommerceRoute } from "@/lib/commerce/types";

const icons = {
  digital: Globe2,
  groceries: Leaf,
  food: UtensilsCrossed,
  shopping: ShoppingBag,
  travel: Plane,
  mobile: Smartphone,
  services: Wrench,
};
const examples = [
  {
    text: "Weekly groceries in Karachi under PKR 5000",
    label: "Groceries in Pakistan",
    icon: Leaf,
  },
  {
    text: "Book a hotel in Dubai and pay in NEAR",
    label: "A stay in Dubai",
    icon: Plane,
  },
  {
    text: "Buy headphones in the US using crypto",
    label: "Headphones in the US",
    icon: ShoppingBag,
  },
  {
    text: "Recharge my mobile in Nigeria",
    label: "Mobile top-up in Nigeria",
    icon: Smartphone,
  },
];

function routeStatus(route: CommerceRoute) {
  return route.payment === "near"
    ? "Direct NEAR option"
    : route.payment === "crypto"
      ? "Crypto option"
      : route.handoff === "directory"
        ? "Provider discovery"
        : "Conventional checkout";
}

export default function RouteFinder() {
  const [country, setCountry] = useState<CountryCode | "">("");
  const [city, setCity] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CommerceCategory | "">("");
  const [cryptoOnly, setCryptoOnly] = useState(false);
  const [result, setResult] = useState<CommerceResult>();
  const [selectedId, setSelectedId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [lastQuery, setLastQuery] = useState("");
  const resultsRef = useRef<HTMLElement>(null);
  const detailRef = useRef<HTMLElement>(null);
  const selected = result?.routes.find((r) => r.id === selectedId);

  function showOnMobile(target: "results" | "detail") {
    if (window.innerWidth > 820) return;
    requestAnimationFrame(() =>
      (target === "results" ? resultsRef : detailRef).current?.scrollIntoView({
        block: "start",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      }),
    );
  }

  function invalidate() {
    setResult(undefined);
    setSelectedId("");
    setError("");
  }
  async function search(text = query, example = false) {
    if (busy || text.trim().length < 3) return;
    setBusy(true);
    setError("");
    setResult(undefined);
    setSelectedId("");
    setQuery(text);
    setLastQuery(text);
    try {
      const response = await fetch("/api/routes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: text,
          country: example ? undefined : country || undefined,
          city: example ? "" : city,
          category: example ? undefined : category || undefined,
          cryptoOnly,
        }),
        signal: AbortSignal.timeout(15000),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          data.error || "Couldn't find routes. Please try again.",
        );
      const next = data as CommerceResult;
      setResult(next);
      setSelectedId(next.routes[0]?.id || "");
      showOnMobile("results");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Couldn't find routes. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="commerce-shell">
      <header className="commerce-header">
        <a href="/" className="commerce-brand">
          <span>
            <ArrowUpRight size={22} />
          </span>
          localagent<span>pay</span>
        </a>
        <nav aria-label="Main navigation">
          <a href="/" aria-current="page">
            Find a route
          </a>
          <a href="/demo">
            Payment sandbox <ArrowUpRight size={13} />
          </a>
          <a href="https://intents.near.org/" target="_blank" rel="noreferrer">
            NEAR Intents <ExternalLink size={13} />
          </a>
        </nav>
        <span className="commerce-live">
          <i /> Country-aware commerce
        </span>
      </header>
      <main className="commerce-main">
        <div className="commerce-hero">
          <div>
            <span className="commerce-eyebrow">
              <Globe2 size={14} /> EVERYDAY PURCHASES. DIFFERENT COUNTRIES.
            </span>
            <h1>
              Find the right merchant.
              <br />
              <span>Then find your way to pay.</span>
            </h1>
            <p>
              Real regional storefronts, direct purchases, and a clear payment
              path.
              <br />
              Tell us what you need and where you need it.
            </p>
          </div>
          <div className="commerce-stamp" aria-hidden="true">
            <Globe2 size={66} strokeWidth={1} />
            <span>
              LOCAL NEEDS
              <br />
              GLOBAL POSSIBILITIES
            </span>
          </div>
        </div>
        <div className="commerce-layout">
          <section className="finder-main" aria-label="Merchant route finder">
            <form
              className="finder-form"
              onSubmit={(e) => {
                e.preventDefault();
                void search();
              }}
            >
              <div className="finder-title">
                <span className="finder-avatar">
                  <Sparkles size={21} />
                </span>
                <div>
                  <h2>What are we getting done?</h2>
                  <p>
                    We match the request, country, and documented payment
                    options.
                  </p>
                </div>
                <span className="direct-tag">
                  <Check size={12} /> No voucher suggestions
                </span>
              </div>
              <label htmlFor="commerce-request" className="sr-only">
                Describe your purchase
              </label>
              <textarea
                id="commerce-request"
                placeholder="Find groceries in Karachi, book a hotel in Dubai, or buy headphones in the US…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                minLength={3}
                maxLength={1000}
                required
                disabled={busy}
              />
              <div className="finder-fields">
                <label>
                  <span>
                    <Globe2 size={13} /> Country
                  </span>
                  <select
                    aria-label="Country"
                    value={country}
                    onChange={(e) => {
                      setCountry(e.target.value as CountryCode | "");
                      invalidate();
                    }}
                    disabled={busy}
                  >
                    <option value="">Choose or mention in request</option>
                    {countries.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>
                    <MapPin size={13} /> City <small>optional</small>
                  </span>
                  <input
                    aria-label="City"
                    value={city}
                    onChange={(e) => {
                      setCity(e.target.value);
                      invalidate();
                    }}
                    maxLength={80}
                    disabled={busy}
                    placeholder="Delivery city or service area"
                  />
                </label>
                <label>
                  <span>Category</span>
                  <select
                    aria-label="Category"
                    value={category}
                    onChange={(e) => {
                      setCategory(e.target.value as CommerceCategory | "");
                      invalidate();
                    }}
                    disabled={busy}
                  >
                    <option value="">Detect from request</option>
                    {commerceCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="finder-actions">
                <label className="crypto-filter">
                  <input
                    type="checkbox"
                    checked={cryptoOnly}
                    onChange={(e) => {
                      setCryptoOnly(e.target.checked);
                      invalidate();
                    }}
                    disabled={busy}
                  />
                  <span>Only crypto-compatible checkout</span>
                </label>
                <button
                  className="find-route-button"
                  type="submit"
                  disabled={busy || query.trim().length < 3}
                >
                  {busy ? (
                    <>
                      <LoaderCircle size={16} className="spin" /> Finding
                      routes…
                    </>
                  ) : (
                    <>
                      Find my route <ArrowRight size={17} />
                    </>
                  )}
                </button>
              </div>
            </form>
            {!result && !busy ? (
              <div className="finder-examples">
                <span>TRY SOMETHING EVERYDAY</span>
                <div>
                  {examples.map((example) => (
                    <button
                      key={example.label}
                      onClick={() => void search(example.text, true)}
                    >
                      <example.icon size={16} />
                      {example.label}
                      <ArrowUpRight size={13} />
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {error ? (
              <div className="finder-error" role="alert">
                <CircleHelp size={19} />
                <div>
                  <strong>Let's refine that request.</strong>
                  <p>{error}</p>
                  <button
                    onClick={() => void search(lastQuery)}
                    disabled={busy}
                  >
                    Try again <ArrowRight size={13} />
                  </button>
                </div>
              </div>
            ) : null}
            {busy ? (
              <div className="finder-loading" role="status">
                <LoaderCircle size={25} className="spin" />
                <h3>Matching the merchant and payment path</h3>
                <p>Checking country coverage and direct purchase options.</p>
              </div>
            ) : null}
            {result ? (
              <section
                ref={resultsRef}
                className="finder-results"
                aria-live="polite"
              >
                <div className="finder-results-heading">
                  <div>
                    <span className="commerce-eyebrow">
                      YOUR AVAILABLE PATHS
                    </span>
                    <h2>
                      {
                        commerceCategories.find((c) => c.id === result.category)
                          ?.name
                      }{" "}
                      in {result.countryName}
                    </h2>
                  </div>
                  <span className="routes-count">
                    {result.routes.length}{" "}
                    {result.routes.length === 1 ? "route" : "routes"}
                  </span>
                </div>
                <p className="finder-summary">{result.message}</p>
                {result.budget ? (
                  <div className="budget-note">
                    <Wallet size={14} /> Your budget: {result.budget.currency}{" "}
                    {new Intl.NumberFormat("en-US").format(
                      result.budget.amount,
                    )}
                    <span>
                      Final totals checked on provider; not filtered by live
                      price.
                    </span>
                  </div>
                ) : null}
                {result.routes.length ? (
                  <div className="route-list">
                    {result.routes.map((route, index) => (
                      <RouteOption
                        key={route.id}
                        route={route}
                        index={index}
                        selected={selectedId === route.id}
                        onSelect={() => {
                          setSelectedId(route.id);
                          showOnMobile("detail");
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="no-routes">
                    <Navigation size={27} />
                    <h3>No matching route in this directory yet.</h3>
                    <p>
                      {cryptoOnly
                        ? "Conventional merchants may still serve this request. Turn off the crypto-only filter and search again to see those options."
                        : "Try another category or one of the other listed countries. We won't invent a payment connection."}
                    </p>
                  </div>
                )}
                <div className="route-evidence">
                  <Info size={16} />
                  <p>{result.warning}</p>
                </div>
                <p className="directory-date">
                  Curated provider directory · Reviewed {result.reviewedAt} ·
                  Checkout terms can change
                </p>
              </section>
            ) : (
              <div className="finder-explainer">
                <h2>A merchant route for the whole purchase.</h2>
                <div>
                  <article>
                    <span>01</span>
                    <h3>Start with your country</h3>
                    <p>
                      foodpanda in Pakistan. Tesco in the UK. FairPrice in
                      Singapore. Relevant storefronts first.
                    </p>
                  </article>
                  <article>
                    <span>02</span>
                    <h3>Check how you can pay</h3>
                    <p>
                      See direct NEAR options, crypto checkout candidates, or
                      merchants needing a separate payment connection.
                    </p>
                  </article>
                  <article>
                    <span>03</span>
                    <h3>Complete with the provider</h3>
                    <p>
                      Open the real store, confirm the final cart or booking,
                      and review its payment invoice.
                    </p>
                  </article>
                </div>
              </div>
            )}
          </section>
          <aside
            ref={detailRef}
            className="finder-side"
            aria-label="Selected payment route"
            aria-live="polite"
          >
            {selected ? (
              <RouteDetail route={selected} />
            ) : (
              <div className="route-detail route-detail-empty">
                <span className="detail-route-icon">
                  <Route size={23} />
                </span>
                <span className="commerce-eyebrow">YOUR PAYMENT PATH</span>
                <h2>
                  A clear route.
                  <br />
                  Every step explained.
                </h2>
                <p>
                  Pick a result to see the merchant, payment compatibility, and
                  what happens next.
                </p>
                <div className="empty-flow">
                  <span>
                    <Wallet size={17} /> Your wallet or payment method
                  </span>
                  <ChevronRight size={15} />
                  <span>
                    <Route size={17} /> A supported checkout route
                  </span>
                  <ChevronRight size={15} />
                  <span>
                    <ShoppingBag size={17} /> Merchant confirmation
                  </span>
                </div>
                <small>
                  A bridge handles asset conversion. Checkout availability and
                  fulfillment come from the merchant.
                </small>
              </div>
            )}
            <div className="finder-principles">
              <ShieldCheck size={23} />
              <h3>Evidence before execution.</h3>
              <p>
                Provider links and payment sources are visible. Prices, ratings,
                and delivery times stay unknown until confirmed.
              </p>
              <a
                href="https://intents.near.org/"
                target="_blank"
                rel="noreferrer"
              >
                Explore NEAR Intents <ArrowUpRight size={13} />
              </a>
            </div>
          </aside>
        </div>
        <details className="ranking-details">
          <summary>How does “recommended” work?</summary>
          <p>
            We filter by country and category, prioritize a merchant you name,
            then favor documented direct NEAR payment, other crypto checkout,
            and regional storefronts. This is a routing policy over a curated
            directory, not a live product search or a price-comparison engine.
            International listings require confirmation for the chosen product
            and destination. No provider checkout API is connected to this
            finder.
          </p>
          <p>
            For fiat-only stores, NEAR conversion alone cannot complete
            checkout. A compatible card, off-ramp, or commerce integration must
            be connected first. We do not mark those routes as
            crypto-compatible.
          </p>
          <p>
            Potential integrations to evaluate:{" "}
            <a
              href="https://www.crossmint.com/products/agentic-checkout"
              target="_blank"
              rel="noreferrer"
            >
              Crossmint Agent Checkout
            </a>{" "}
            and{" "}
            <a
              href="https://docs.instacart.com/developer_platform_api/"
              target="_blank"
              rel="noreferrer"
            >
              Instacart Developer Platform
            </a>
            . Access and supported markets must be confirmed.
          </p>
        </details>
        <footer className="commerce-footer">
          <span>LocalAgentPay · Built for the NEAR Hackathon</span>
          <div>
            <a href="/demo">Simulated payment sandbox</a>
            <a
              href="https://github.com/gsas-bit23/localagentpay"
              target="_blank"
              rel="noreferrer"
            >
              Source code <ArrowUpRight size={12} />
            </a>
          </div>
        </footer>
      </main>
    </div>
  );
}

function RouteOption({
  route,
  index,
  selected,
  onSelect,
}: {
  route: CommerceRoute;
  index: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const Icon = icons[route.categories[0]];
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`route-option ${selected ? "is-selected" : ""}`}
    >
      <span className={`provider-icon ${route.payment}`}>
        <Icon size={23} strokeWidth={1.5} />
      </span>
      <div className="route-option-body">
        <div className="route-option-heading">
          <h3>{route.name}</h3>
          {index === 0 ? (
            <span className="recommended-badge">
              {route.actionable ? "Recommended path" : "Top merchant match"}
            </span>
          ) : null}
        </div>
        <p>{route.description}</p>
        <div className="route-option-tags">
          <span className={`payment-status ${route.payment}`}>
            {routeStatus(route)}
          </span>
          <span>
            {route.countries === "conditional"
              ? "Check destination eligibility"
              : "Regional storefront"}
          </span>
          <span>Price at checkout</span>
        </div>
      </div>
      <ChevronRight size={18} />
    </button>
  );
}

function RouteDetail({ route }: { route: CommerceRoute }) {
  return (
    <div className="route-detail">
      <div className="detail-top">
        <span className="detail-route-icon">
          <Route size={21} />
        </span>
        <span className="commerce-eyebrow">SELECTED ROUTE</span>
      </div>
      <h2>{route.name}</h2>
      <span className={`detail-status ${route.payment}`}>
        {route.paymentLabel}
      </span>
      <div className="detail-reasons">
        <h3>Why this route</h3>
        {route.reasons.map((reason) => (
          <p key={reason}>
            <Check size={14} />
            <span>{reason}</span>
          </p>
        ))}
      </div>
      <ol className="detail-steps">
        {route.steps.map((step, index) => (
          <li key={step}>
            <span>{index + 1}</span>
            <p>{step}</p>
          </li>
        ))}
      </ol>
      <div className="detail-invoice">
        <Info size={16} />
        <p>
          {route.quoteStatus === "invoice-required"
            ? "No live invoice or exchange quote yet. Confirm the exact network and amount on the provider before payment."
            : route.quoteStatus === "discovery-only"
              ? "Contact the business for a real estimate and accepted payment methods."
              : "There is no connected NEAR-funded checkout for this merchant. Opening its store does not create a crypto payment."}
        </p>
      </div>
      <a
        className="provider-cta"
        href={route.url}
        target="_blank"
        rel="noreferrer"
      >
        {route.handoff === "directory"
          ? "Find local providers"
          : "Continue on provider"}
        <ArrowUpRight size={17} />
      </a>
      <div className="detail-sources">
        <a href={route.sourceUrl} target="_blank" rel="noreferrer">
          Provider source <ExternalLink size={11} />
        </a>
        {route.paymentSource && route.paymentSource !== route.sourceUrl ? (
          <a href={route.paymentSource} target="_blank" rel="noreferrer">
            Payment methods <ExternalLink size={11} />
          </a>
        ) : null}
      </div>
      <p className="detail-caveat">{route.caveat}</p>
    </div>
  );
}
