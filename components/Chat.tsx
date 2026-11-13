"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  CircleHelp,
  Compass,
  ExternalLink,
  Globe2,
  Leaf,
  LoaderCircle,
  MapPin,
  MessageSquare,
  Navigation,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Wallet,
  Wrench,
  X,
} from "lucide-react";
import type {
  Category,
  ChatResult,
  Location,
  Merchant,
  PayAsset,
  PaymentQuote,
} from "@/lib/types";
import OptionsList from "./OptionsList";
import PaymentCard from "./PaymentCard";

type Message = { role: "user" | "assistant"; text: string };
async function post<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(35000),
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error || "Request failed. Please try again.");
  return data;
}
const prompts = [
  {
    icon: ShoppingBag,
    title: "Fill the fridge",
    text: "Find weekly groceries near me under $60",
    detail: "Fresh picks for the week",
    category: "groceries" as Category,
  },
  {
    icon: Wrench,
    title: "Keep life moving",
    text: "Find a trusted car service nearby under $200",
    detail: "Find a trusted car service",
    category: "car" as Category,
  },
  {
    icon: Leaf,
    title: "Shop a little local",
    text: "Find local shops near me under $40",
    detail: "Good things, close to home",
    category: "shops" as Category,
  },
];

export default function Chat() {
  const [location, setLocation] = useState<Location>({ city: "San Francisco" });
  const [cityDraft, setCityDraft] = useState("San Francisco");
  const [editingCity, setEditingCity] = useState(false);
  const [locating, setLocating] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [result, setResult] = useState<ChatResult>();
  const [selected, setSelected] = useState<Merchant>();
  const [asset, setAssetState] = useState<PayAsset>("ETH");
  const [mode, setModeState] = useState<"demo" | "live">("demo");
  const [quote, setQuote] = useState<PaymentQuote>();
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [quoting, setQuoting] = useState(false);
  const [error, setError] = useState("");
  const [help, setHelp] = useState(false);
  const quoteRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const locked = busy || quoting || locating;
  useEffect(() => {
    if (!help) return;
    const previous = document.activeElement as HTMLElement | null;
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setHelp(false);
      if (event.key !== "Tab") return;
      const items = modalRef.current?.querySelectorAll<HTMLElement>(
        "button, a[href], input, select",
      );
      if (!items?.length) return;
      const first = items[0],
        last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
      previous?.focus();
    };
  }, [help]);

  function clearPayment() {
    setQuote(undefined);
    setConfirmed(false);
    setError("");
  }
  function reset() {
    setMessages([]);
    setResult(undefined);
    setSelected(undefined);
    clearPayment();
    setInput("");
  }
  async function send(text: string, category?: Category) {
    if (!text.trim() || locked) return;
    setBusy(true);
    setInput("");
    clearPayment();
    setSelected(undefined);
    setResult(undefined);
    setMessages((prev) => [...prev, { role: "user", text }]);
    try {
      const response = await post<ChatResult>("/api/chat", {
        message: text,
        location,
        category,
      });
      setResult(response);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: response.message },
      ]);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "The request failed. Please retry.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function getQuote(merchant = selected) {
    if (!merchant || locked) return;
    setQuoting(true);
    clearPayment();
    try {
      setQuote(
        await post<PaymentQuote>("/api/quote", {
          merchantId: merchant.id,
          asset,
          mode,
        }),
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Quote unavailable. Please retry.",
      );
    } finally {
      setQuoting(false);
    }
  }
  function choose(merchant: Merchant) {
    setSelected(merchant);
    void getQuote(merchant);
    if (window.innerWidth < 1100)
      quoteRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function shareLocation() {
    if (!navigator.geolocation) {
      setError("Geolocation isn't supported. Enter a city instead.");
      setEditingCity(true);
      return;
    }
    setLocating(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setLocation({
          city: "your shared location",
          latitude: Number(latitude.toFixed(3)),
          longitude: Number(longitude.toFixed(3)),
        });
        setLocating(false);
        setEditingCity(false);
        setResult(undefined);
        setSelected(undefined);
        clearPayment();
      },
      () => {
        setError("Location wasn't shared. You can type a city to continue.");
        setLocating(false);
        setEditingCity(true);
      },
      { timeout: 10000, maximumAge: 60000, enableHighAccuracy: false },
    );
  }
  function confirm() {
    if (!quote || Date.parse(quote.expiresAt) <= Date.now()) {
      setError("That preview expired. Refresh your quote to continue.");
      return;
    }
    setConfirmed(true);
    setError("");
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a href="/" className="brand" aria-label="LocalAgentPay home">
          <span className="brand-symbol">
            <ArrowUpRight size={23} />
            <ArrowDownLeft size={18} />
          </span>
          <span>
            localagent<span className="brand-pay">pay</span>
            <small>LOCAL LIVING. BORDERLESS.</small>
          </span>
        </a>
        <button className="new-chat" onClick={reset} disabled={locked}>
          <Plus size={17} /> New conversation <span>↗</span>
        </button>
        <span className="nav-label">YOUR WORKSPACE</span>
        <nav>
          <button className="nav-item active" onClick={() => setHelp(false)}>
            <MessageSquare size={17} /> Local assistant{" "}
            <span className="nav-dot" />
          </button>
          <button
            className="nav-item"
            onClick={() => {
              quoteRef.current?.scrollIntoView({ behavior: "smooth" });
              if (!selected) setHelp(true);
            }}
          >
            <Wallet size={17} /> Payment preview{" "}
            <span className="soon-tag">{confirmed ? "1" : "0"}</span>
          </button>
        </nav>
        <div className="sidebar-note">
          <span className="note-spark">
            <Sparkles size={20} />
          </span>
          <h3>
            Big possibilities.
            <br />
            Small neighborhood.
          </h3>
          <p>
            Discover local favorites.
            <br />
            Pay beyond borders.
          </p>
          <span className="note-line" />
          <Globe2 size={63} strokeWidth={0.8} className="note-globe" />
        </div>
        <div className="sidebar-bottom">
          <button className="nav-item" onClick={() => setHelp(true)}>
            <CircleHelp size={17} /> How it works <ArrowUpRight size={14} />
          </button>
          <a
            className="nav-item"
            href="https://docs.near-intents.org"
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink size={16} /> NEAR Intents docs
          </a>
          <div className="profile">
            <span>Y</span>
            <div>
              <strong>Your demo workspace</strong>
              <small>No wallet required</small>
            </div>
            <ShieldCheck size={16} />
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <span>/</span> <strong>Local assistant</strong>
          </div>
          <div className="topbar-right">
            <span className="prototype-badge">
              <span /> Hackathon prototype
            </span>
            <button
              className="location-pill"
              disabled={locked}
              onClick={() => setEditingCity(!editingCity)}
            >
              <MapPin size={14} />
              <span>{location.city}</span>
              <ChevronDown size={13} />
            </button>
          </div>
        </header>
        <main>
          <div className="page-kicker">
            <span /> A LITTLE LOCAL. A LOT POSSIBLE.
          </div>
          <div className="intro-row">
            <div>
              <h1>
                Everyday errands.
                <br />
                <span>Meet borderless payments.</span>
              </h1>
              <p>
                Find something good nearby. Let your assets take it from there.
              </p>
            </div>
            <span className="intro-doodle" aria-hidden="true">
              <Compass size={58} strokeWidth={1} />
              <i>near you, for you</i>
            </span>
          </div>
          {editingCity ? (
            <form
              className="city-editor"
              onSubmit={(e) => {
                e.preventDefault();
                if (cityDraft.trim().length < 2) return;
                setLocation({ city: cityDraft.trim() });
                reset();
                setEditingCity(false);
              }}
            >
              <label htmlFor="city">Where are we exploring?</label>
              <input
                id="city"
                value={cityDraft}
                onChange={(e) => setCityDraft(e.target.value)}
                minLength={2}
                maxLength={80}
                required
                placeholder="Enter a city"
              />
              <button className="primary" type="submit">
                Use city <Check size={15} />
              </button>
              <button
                className="secondary"
                type="button"
                onClick={shareLocation}
                disabled={locked}
              >
                <Navigation size={14} /> Share location
              </button>
              <small>
                Sample merchants stay the same in every city. Distances are
                illustrative.
              </small>
            </form>
          ) : null}
          <div className="workspace-grid">
            <section
              className="conversation-column"
              aria-label="Local assistant chat"
            >
              <div className="assistant-panel">
                <div className="panel-top">
                  <div>
                    <span className="assistant-avatar">
                      <Sparkles size={18} />
                    </span>
                    <div>
                      <h2>Your local copilot</h2>
                      <span>
                        <i /> Ready when you are
                      </span>
                    </div>
                  </div>
                  <span className="panel-label">POWERED BY NEAR</span>
                </div>
                <div className="conversation-content">
                  <div className="greeting">
                    <span className="greeting-tag">
                      LESS FRICTION, MORE LIVING
                    </span>
                    <h2>What can I take off your list?</h2>
                    <p>
                      A fridge to fill, a car to care for, a neighborhood to
                      explore.
                      <br className="desktop-break" /> Tell me what you need.
                      We'll figure out the rest.
                    </p>
                  </div>
                  {messages.length === 0 ? (
                    <>
                      <div className="prompt-grid">
                        {prompts.map((p) => (
                          <button
                            key={p.category}
                            className="prompt-card"
                            onClick={() => void send(p.text, p.category)}
                            disabled={locked}
                          >
                            <p.icon size={20} strokeWidth={1.5} />
                            <strong>{p.title}</strong>
                            <span>{p.detail}</span>
                            <ArrowUpRight size={14} className="prompt-arrow" />
                          </button>
                        ))}
                      </div>
                      <div className="start-location">
                        <span>
                          <MapPin size={14} /> A good place to start? Your
                          location.
                        </span>
                        <button onClick={shareLocation} disabled={locked}>
                          {locating ? (
                            <LoaderCircle size={14} className="spin" />
                          ) : (
                            <Navigation size={13} />
                          )}{" "}
                          {locating ? "Locating…" : "Share location"}
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="message-list" aria-live="polite">
                      {messages.map((m, i) => (
                        <div key={i} className={`message ${m.role}`}>
                          {m.role === "assistant" ? (
                            <span className="message-avatar">
                              <Sparkles size={14} />
                            </span>
                          ) : null}
                          <p>{m.text}</p>
                        </div>
                      ))}
                      {busy ? (
                        <div className="thinking">
                          <LoaderCircle size={15} className="spin" /> Looking
                          around the neighborhood…
                        </div>
                      ) : null}
                    </div>
                  )}
                  {result ? (
                    <div className="results">
                      <div className="results-title">
                        <h3>
                          {result.options.length
                            ? "A few good places to start"
                            : "Let's adjust the search"}
                        </h3>
                        <span>
                          {result.source === "near-ai"
                            ? "NEAR AI"
                            : "Demo assistant"}
                        </span>
                      </div>
                      <OptionsList
                        options={result.options}
                        selected={selected?.id}
                        onSelect={choose}
                        disabled={locked}
                      />
                      <p className="sample-note">
                        Fictional merchants · illustrative distance, price &
                        trust · USD estimates
                      </p>
                    </div>
                  ) : null}
                  {error ? (
                    <div className="error-box" role="alert">
                      <CircleHelp size={17} />
                      <span>{error}</span>
                      <button
                        aria-label="Dismiss error"
                        onClick={() => setError("")}
                      >
                        <X size={15} />
                      </button>
                    </div>
                  ) : null}
                </div>
                <div className="composer-wrap">
                  <form
                    className="composer"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void send(input);
                    }}
                  >
                    <label htmlFor="request" className="sr-only">
                      Tell your local copilot what you need
                    </label>
                    <input
                      id="request"
                      maxLength={1000}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Try ‘weekly groceries under $60’"
                      disabled={locked}
                      autoComplete="off"
                    />
                    <button
                      type="submit"
                      aria-label="Send request"
                      disabled={locked || input.trim().length < 2}
                    >
                      {busy ? (
                        <LoaderCircle size={18} className="spin" />
                      ) : (
                        <ArrowRight size={19} />
                      )}
                    </button>
                  </form>
                  <div className="composer-bottom">
                    <span>
                      <LockKeyholeIcon /> You&apos;re always in control of the
                      final step.
                    </span>
                    <span>
                      Enter to send <span>↵</span>
                    </span>
                  </div>
                </div>
              </div>
              <div className="how-strip">
                <span className="how-step">
                  <i>01</i>
                  <span>Say what you need</span>
                </span>
                <ArrowRight size={13} />
                <span className="how-step">
                  <i>02</i>
                  <span>Pick a local favorite</span>
                </span>
                <ArrowRight size={13} />
                <span className="how-step">
                  <i>03</i>
                  <span>Preview your payment</span>
                </span>
              </div>
              <div className="local-note">
                <Leaf size={16} />
                <p>
                  <strong>Keep it local. Make it borderless.</strong> A small
                  idea for a more connected everyday.
                </p>
              </div>
            </section>
            <div ref={quoteRef}>
              <PaymentCard
                merchant={selected}
                asset={asset}
                setAsset={(v) => {
                  setAssetState(v);
                  clearPayment();
                }}
                mode={mode}
                setMode={(v) => {
                  setModeState(v);
                  clearPayment();
                }}
                quote={quote}
                loading={quoting}
                confirmed={confirmed}
                onQuote={() => void getQuote()}
                onConfirm={confirm}
              />
            </div>
          </div>
          <footer>
            <span>
              LocalAgentPay <span>© 2026</span>
            </span>
            <span>
              Made for the NEAR Hackathon <span className="footer-dot">·</span>{" "}
              A working prototype
            </span>
            <button onClick={() => setHelp(true)}>
              About this demo <ArrowUpRight size={12} />
            </button>
          </footer>
        </main>
      </div>
      {help ? (
        <div
          ref={modalRef}
          className="modal-backdrop"
          onClick={() => setHelp(false)}
        >
          <section
            className="help-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="help-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close"
              aria-label="Close help"
              autoFocus
              onClick={() => setHelp(false)}
            >
              <X size={20} />
            </button>
            <span className="assistant-avatar">
              <Sparkles size={22} />
            </span>
            <h2 id="help-title">A local errand, a borderless route.</h2>
            <ol>
              <li>
                Type a city or share approximate coordinates. Listings are
                fictional fixtures in every location.
              </li>
              <li>
                Ask for groceries, a car service, or a local shop. Add a USD
                budget.
              </li>
              <li>
                Select a sample merchant. Choose ETH, USDC, or wNEAR to preview
                a route to USDC on Base.
              </li>
              <li>
                Demo uses fixed rates. Live API preview requires a configured
                merchant address and may require a 1Click JWT.
              </li>
              <li>
                Confirmation is always simulated. No wallet signing,
                transaction, merchant order, or settlement occurs.
              </li>
            </ol>
            <p>
              The assistant uses local rules unless NEAR AI credentials and a
              model are configured. The payment tool only runs after your
              selection.
            </p>
            <button className="primary" onClick={() => setHelp(false)}>
              Let's explore <ArrowRight size={16} />
            </button>
          </section>
        </div>
      ) : null}
    </div>
  );
}
function LockKeyholeIcon() {
  return <ShieldCheck size={12} />;
}
