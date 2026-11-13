"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Copy,
  Hotel,
  Info,
  LoaderCircle,
  MapPin,
  Plane,
  RefreshCw,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { countries, type CountryCode } from "@/lib/commerce/config";
import { knownCity, type MapLocation } from "@/lib/maps/geo";
import { marketAirports } from "@/lib/checkout/markets";
import {
  displayMoney,
  type FundingQuote,
  type HotelRate,
  type PreparedCheckout,
  type TravelKind,
  type TravelOffer,
  isPayableStatus,
} from "@/lib/checkout/types";
import {
  connectNear,
  connectSolana,
  nearAccount,
  sendNear,
  signBooking,
} from "@/lib/checkout/wallets";
const STORAGE = "localagentpay:checkout:v1",
  SIGNATURE = "localagentpay:approved-payment:v1";
type Person = {
  given_name: string;
  family_name: string;
  born_on: string;
  title: "mr" | "mrs" | "ms" | "miss" | "dr";
  gender: "m" | "f";
};
type OrderStatus = {
  status: string;
  intentStatus: string;
  reference: string;
  paymentReceived: boolean;
  submitted?: boolean;
  message?: string;
};
type Props = {
  country: CountryCode | "";
  city: string;
  initialKind: TravelKind;
  onCountry: (country: CountryCode) => void;
  onFocus: (place: MapLocation) => void;
};
const newPerson = (): Person => ({
  given_name: "",
  family_name: "",
  born_on: "",
  title: "mr",
  gender: "m",
});
const dateAfter = (days: number) =>
  new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
const short = (value: string) => `${value.slice(0, 6)}…${value.slice(-5)}`;
const finalStatus = (value: string) =>
  /confirmed|ticketed|issued|refunded|failed|cancelled|expired|completed/i.test(
    value,
  );
async function call<T = any>(input: Record<string, unknown>): Promise<T> {
  const response = await fetch("/api/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(55000),
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(
      result.error || "The provider could not complete this request.",
    );
  return result;
}
function save(data: {
  checkout?: PreparedCheckout;
  funding?: FundingQuote;
  fundingSent?: boolean;
  method?: string;
}) {
  try {
    if (data.checkout)
      localStorage.setItem(
        STORAGE,
        JSON.stringify({
          token: data.checkout.token,
          funding: data.funding,
          fundingSent: data.fundingSent,
          method: data.method,
        }),
      );
  } catch {}
}
export default function TravelCheckout({
  country,
  city,
  initialKind,
  onCountry,
  onFocus,
}: Props) {
  const code = country || "US";
  const [finalAccepted, setFinalAccepted] = useState(false);
  const [kind, setKind] = useState<TravelKind>(initialKind),
    [origin, setOrigin] = useState(code === "US" ? "SFO" : "KHI"),
    [destination, setDestination] = useState(marketAirports[code][0].code),
    [place, setPlace] = useState(city || marketAirports[code][0].city),
    [departure, setDeparture] = useState(dateAfter(14)),
    [returnDate, setReturnDate] = useState(""),
    [checkOut, setCheckOut] = useState(dateAfter(17)),
    [adults, setAdults] = useState(1);
  const [offers, setOffers] = useState<TravelOffer[]>([]),
    [selected, setSelected] = useState<TravelOffer>(),
    [rates, setRates] = useState<HotelRate[]>([]),
    [rate, setRate] = useState<HotelRate>(),
    [people, setPeople] = useState<Person[]>([newPerson()]),
    [email, setEmail] = useState(""),
    [phone, setPhone] = useState(""),
    [terms, setTerms] = useState(false);
  const [wallet, setWallet] = useState(""),
    [near, setNear] = useState(""),
    [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [searched, setSearched] = useState(false),
    [inventoryState, setInventoryState] = useState(""),
    [checkout, setCheckout] = useState<PreparedCheckout>(),
    [balance, setBalance] = useState<string>(),
    [method, setMethod] = useState("usdc"),
    [funding, setFunding] = useState<FundingQuote>(),
    [fundingSent, setFundingSent] = useState(false),
    [fundingState, setFundingState] = useState(""),
    [status, setStatus] = useState<OrderStatus>(),
    [pendingPayment, setPendingPayment] = useState(""),
    [recovery, setRecovery] = useState(""),
    [cancelName, setCancelName] = useState(""),
    [cancelReason, setCancelReason] = useState(""),
    [cancelConfirmed, setCancelConfirmed] = useState(false);
  const generation = useRef(0),
    root = useRef<HTMLDivElement>(null),
    mounted = useRef(false);
  useEffect(() => {
    setDestination(marketAirports[code][0].code);
    setPlace(city || marketAirports[code][0].city);
    setOffers([]);
    setSearched(false);
    setSelected(undefined);
    setRates([]);
    setRate(undefined);
  }, [code, city]);
  useEffect(() => {
    setPeople((previous) =>
      Array.from(
        { length: adults },
        (_, index) => previous[index] || newPerson(),
      ),
    );
  }, [adults]);
  useEffect(() => {
    mounted.current = true;
    void connectSolana(true)
      .then((value) => {
        if (mounted.current) setWallet(value);
      })
      .catch(() => {});
    void nearAccount()
      .then((value) => {
        if (mounted.current) setNear(value);
      })
      .catch(() => {});
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE) || "null");
      if (saved?.token) {
        setBusy("Restoring your order…");
        void call<PreparedCheckout>({ action: "restore", token: saved.token })
          .then((restored) => {
            if (!mounted.current) return;
            setCheckout(restored);
            setFinalAccepted(false);
            setKind(restored.summary.kind);
            setFunding(saved.funding);
            setFundingSent(!!saved.fundingSent);
            setMethod(saved.method || "usdc");
            try {
              const signed = JSON.parse(
                localStorage.getItem(SIGNATURE) || "null",
              );
              if (signed?.token === restored.token)
                setPendingPayment(signed.payment);
            } catch {}
            return call<OrderStatus>({
              action: "status",
              token: restored.token,
            }).then((value) => {
              if (mounted.current) setStatus(value);
            });
          })
          .catch(() => {
            if (mounted.current)
              setNotice(
                "An order recovery code is saved. Paste it below to retry if the provider is unavailable.",
              );
          })
          .finally(() => {
            if (mounted.current) setBusy("");
          });
      }
    } catch {}
    return () => {
      mounted.current = false;
      generation.current++;
    };
  }, []);
  useEffect(() => {
    if (checkout) save({ checkout, funding, fundingSent, method });
  }, [checkout, funding, fundingSent, method]);
  useEffect(() => {
    if (!checkout) return;
    let gone = false;
    void call<{ amountAtomic: string }>({
      action: "balance",
      wallet: checkout.summary.wallet,
    })
      .then((result) => {
        if (!gone) setBalance(result.amountAtomic);
      })
      .catch(() => {});
    return () => {
      gone = true;
    };
  }, [checkout]);
  useEffect(() => {
    if (
      !checkout ||
      !funding ||
      !fundingSent ||
      /SUCCESS|FAILED|REFUNDED/.test(fundingState)
    )
      return;
    let active = true;
    const check = async () => {
      try {
        const result = await call<{ status: string }>({
          action: "fundingStatus",
          token: funding.token,
        });
        if (!active) return;
        setFundingState(result.status);
        if (result.status === "SUCCESS") {
          const result = await call<{ amountAtomic: string }>({
            action: "balance",
            wallet: checkout.summary.wallet,
          });
          if (active) setBalance(result.amountAtomic);
        }
      } catch {}
    };
    void check();
    const timer = setInterval(() => void check(), 6000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [checkout, funding, fundingSent, fundingState]);
  useEffect(() => {
    if (
      !checkout ||
      !status ||
      finalStatus(status.status) ||
      !!status.reference ||
      !(
        status.submitted ||
        status.paymentReceived ||
        !isPayableStatus(status.intentStatus)
      )
    )
      return;
    let active = true;
    const timer = setInterval(() => {
      void call<OrderStatus>({ action: "status", token: checkout.token })
        .then((next) => {
          if (active)
            setStatus((previous) => ({
              ...next,
              submitted: previous?.submitted,
            }));
        })
        .catch(() => {});
    }, 8000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [
    checkout,
    status?.status,
    status?.intentStatus,
    status?.paymentReceived,
    status?.submitted,
  ]);
  async function run(label: string, work: () => Promise<void>) {
    if (busy) return;
    setBusy(label);
    setError("");
    setNotice("");
    try {
      await work();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Please try again.");
    } finally {
      setBusy("");
    }
  }
  async function search() {
    await run("Searching live inventory…", async () => {
      const id = ++generation.current;
      setSelected(undefined);
      setRates([]);
      setRate(undefined);
      setOffers([]);
      setSearched(true);
      const data = await call<{
        offers: TravelOffer[];
        status?: string;
        searchId?: string;
      }>(
        kind === "flight"
          ? {
              action: "flights",
              country: code,
              origin: origin.toUpperCase(),
              destination: destination.toUpperCase(),
              departure,
              returnDate: returnDate || undefined,
              adults,
            }
          : {
              action: "hotels",
              country: code,
              location: place,
              checkIn: departure,
              checkOut,
              adults,
            },
      );
      if (id !== generation.current) return;
      setOffers(data.offers);
      setInventoryState(data.status || "complete");
      let next = data;
      for (
        let attempt = 0;
        next.status === "enriching" && next.searchId && attempt < 15;
        attempt++
      ) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        if (id !== generation.current) return;
        next = await call({ action: "flightUpdates", searchId: next.searchId });
        setOffers(next.offers);
        setInventoryState(next.status || "complete");
      }
      if (next.status === "enriching")
        setNotice(
          "Some flight inventory is still loading. Search again before choosing a fare.",
        );
    });
  }
  async function choose(offer: TravelOffer) {
    if (inventoryState === "enriching") return;
    await run(
      offer.kind === "hotel" ? "Loading room rates…" : "Selecting fare…",
      async () => {
        setSelected(offer);
        setTerms(false);
        setRate(undefined);
        setRates([]);
        if (offer.location) onFocus(offer.location);
        else if (offer.kind === "flight") {
          const city = marketAirports[code].find(
            (airport) => airport.code === destination,
          )?.city;
          const center = city ? knownCity(city, code) : undefined;
          if (center) onFocus(center);
        }
        if (offer.kind === "hotel") {
          const data = await call<{ rates: HotelRate[] }>({
            action: "rates",
            hotelId: offer.id,
          });
          setRates(data.rates);
        }
        root.current?.scrollIntoView({ block: "start", behavior: "smooth" });
      },
    );
  }
  async function prepare() {
    await run("Confirming the provider quote…", async () => {
      if (!wallet)
        throw new Error(
          "Connect your Solana wallet first. It authorizes payment and receives any refund.",
        );
      const prepared = await call<PreparedCheckout>({
        action: "prepare",
        kind,
        offerId: kind === "hotel" ? rate?.id : selected?.id,
        wallet,
        travellers: people.map((person) =>
          kind === "flight"
            ? person
            : {
                given_name: person.given_name,
                family_name: person.family_name,
              },
        ),
        email,
        phone,
        termsAccepted: terms,
      });
      setCheckout(prepared);
      setFinalAccepted(false);
      setStatus(undefined);
      setPendingPayment("");
      setFunding(undefined);
      setFundingSent(false);
      setFundingState("");
      save({ checkout: prepared, method });
      root.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  }
  async function checkOrder() {
    if (!checkout) return;
    await run("Checking order status…", async () => {
      setStatus(await call({ action: "status", token: checkout.token }));
    });
  }
  async function pay() {
    if (!checkout) return;
    await run(
      pendingPayment
        ? "Retrying the same approved payment…"
        : "Waiting for your wallet approval…",
      async () => {
        const before = await call<OrderStatus>({
          action: "status",
          token: checkout.token,
        });
        setStatus(before);
        if (!isPayableStatus(before.intentStatus) || before.paymentReceived) {
          setNotice(
            "This order is already processing or closed. No new payment was requested.",
          );
          return;
        }
        if (
          !pendingPayment &&
          Date.parse(checkout.summary.expiresAt) <= Date.now()
        )
          throw new Error(
            "This quote expired. Check its order status before starting a fresh search.",
          );
        if (!pendingPayment) {
          const live = await call<{ amountAtomic: string }>({
            action: "balance",
            wallet: checkout.summary.wallet,
          });
          setBalance(live.amountAtomic);
          if (BigInt(live.amountAtomic) < BigInt(checkout.summary.amountAtomic))
            throw new Error(
              "Your connected Solana wallet needs the quoted USDC amount. Convert NEAR or fund it before approving the booking.",
            );
        }
        const signed = pendingPayment || (await signBooking(checkout));
        setPendingPayment(signed);
        try {
          sessionStorage.setItem(
            SIGNATURE,
            JSON.stringify({ token: checkout.token, payment: signed }),
          );
        } catch {}
        setBusy("Submitting your approved payment…");
        const result = await call<OrderStatus>({
          action: "execute",
          token: checkout.token,
          payment: signed,
        });
        setStatus({ ...result, submitted: true });
        setNotice(
          "Payment submitted to the provider. A booking is confirmed only when its confirmation/reference appears below.",
        );
      },
    );
  }
  async function convertNear() {
    if (!checkout) return;
    await run("Getting your exact NEAR quote…", async () => {
      if (!near)
        throw new Error(
          "Connect a NEAR wallet for the conversion and any failed-swap refund.",
        );
      const quote = await call<FundingQuote & { alreadyFunded?: boolean }>({
        action: "fund",
        token: checkout.token,
        nearAccount: near,
      });
      if (quote.alreadyFunded) {
        const result = await call<{ amountAtomic: string }>({
          action: "balance",
          wallet: checkout.summary.wallet,
        });
        setBalance(result.amountAtomic);
        setNotice(
          "Your Solana wallet already holds enough USDC for this booking.",
        );
        return;
      }
      setFunding(quote);
      setFundingSent(false);
      setFundingState("");
    });
  }
  async function approveNear() {
    if (!funding || !checkout) return;
    await run("Approve the NEAR conversion in your wallet…", async () => {
      setFundingSent(true);
      save({ checkout, funding, fundingSent: true, method });
      try {
        await sendNear(funding, near);
      } catch (error) {
        if (
          error instanceof Error &&
          /reject|cancel|declin/i.test(error.message)
        ) {
          setFundingSent(false);
          save({ checkout, funding, fundingSent: false, method });
        }
        throw error;
      }
      setNotice(
        "NEAR deposit submitted. Wait for USDC to reach your own Solana wallet before approving the booking.",
      );
    });
  }
  async function restore(text = recovery) {
    await run("Restoring order…", async () => {
      const restored = await call<PreparedCheckout>({
        action: "restore",
        token: text.trim(),
      });
      setCheckout(restored);
      setFinalAccepted(false);
      setKind(restored.summary.kind);
      setStatus(await call({ action: "status", token: restored.token }));
      save({ checkout: restored, method });
    });
  }
  function newSearch() {
    setCheckout(undefined);
    setStatus(undefined);
    setPendingPayment("");
    setFunding(undefined);
    setFundingSent(false);
    setOffers([]);
    setSelected(undefined);
    setRate(undefined);
    setRates([]);
    setSearched(false);
    setTerms(false);
    setNotice("");
    try {
      localStorage.removeItem(STORAGE);
      localStorage.removeItem(SIGNATURE);
    } catch {}
  }
  const closed =
    !!status &&
    (status.paymentReceived || !isPayableStatus(status.intentStatus));
  const enough =
    balance !== undefined &&
    !!checkout &&
    BigInt(balance) >= BigInt(checkout.summary.amountAtomic);
  return (
    <div className="travel-checkout" ref={root}>
      <div className="checkout-heading">
        <span className="commerce-eyebrow">SHOP WITHOUT LEAVING THE MAP</span>
        <h2>{checkout ? "Review. Approve. Go." : "Your next journey."}</h2>
        <span className="checkout-live">
          <i />
          Live inventory · BRIJ
        </span>
      </div>
      <p className="checkout-intro">
        Flights and hotel stays, booked here. No merchant-site redirects. Search
        is free; provider booking fees are included in the final quote.
      </p>
      <div className="checkout-wallet">
        <Wallet size={17} />
        <div>
          <strong>{wallet ? short(wallet) : "Your travel wallet"}</strong>
          <small>Solana · USDC payments & refunds</small>
        </div>
        <button
          disabled={!!busy}
          onClick={() =>
            void run("Connecting wallet…", async () =>
              setWallet(await connectSolana()),
            )
          }
        >
          {wallet ? "Reconnect" : "Connect wallet"}
        </button>
      </div>
      {busy ? (
        <p className="checkout-progress" role="status">
          <LoaderCircle size={15} className="spin" />
          {busy}
        </p>
      ) : null}
      {error ? (
        <p className="map-message error" role="alert">
          {error}
          {pendingPayment
            ? " Your approved payment is saved in this browser. Check status or retry the same payment; do not sign another."
            : ""}
        </p>
      ) : null}
      {notice ? (
        <p className="map-message" role="status">
          {notice}
        </p>
      ) : null}
      {!checkout ? (
        <>
          <div className="travel-kind">
            <button
              aria-pressed={kind === "flight"}
              disabled={!!busy}
              onClick={() => {
                setKind("flight");
                setSelected(undefined);
                setOffers([]);
                setSearched(false);
              }}
            >
              <Plane size={15} />
              Flights
            </button>
            <button
              aria-pressed={kind === "hotel"}
              disabled={!!busy}
              onClick={() => {
                setKind("hotel");
                setSelected(undefined);
                setOffers([]);
                setSearched(false);
              }}
            >
              <Hotel size={15} />
              Stays
            </button>
          </div>
          {!selected ? (
            <>
              <form
                className="travel-search"
                onSubmit={(event) => {
                  event.preventDefault();
                  void search();
                }}
              >
                <label>
                  Destination country
                  <select
                    aria-label="Travel destination country"
                    value={code}
                    disabled={!!busy}
                    onChange={(event) =>
                      onCountry(event.target.value as CountryCode)
                    }
                  >
                    {countries.map((item) => (
                      <option key={item.code} value={item.code}>
                        {item.name}
                      </option>
                    ))}
                    <option disabled>Other countries — Coming soon</option>
                  </select>
                </label>
                {kind === "flight" ? (
                  <div className="checkout-form-row">
                    <label>
                      From (IATA)
                      <input
                        aria-label="Departure airport"
                        value={origin}
                        onChange={(event) =>
                          setOrigin(event.target.value.toUpperCase())
                        }
                        maxLength={3}
                        minLength={3}
                        pattern="[A-Z]{3}"
                        required
                        list="travel-airports"
                      />
                    </label>
                    <label>
                      To
                      <select
                        aria-label="Arrival airport"
                        value={destination}
                        onChange={(event) => setDestination(event.target.value)}
                      >
                        {marketAirports[code].map((airport) => (
                          <option value={airport.code} key={airport.code}>
                            {airport.city} ({airport.code})
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                ) : (
                  <label>
                    City or area
                    <input
                      aria-label="Hotel city"
                      value={place}
                      onChange={(event) => setPlace(event.target.value)}
                      minLength={2}
                      maxLength={100}
                      required
                    />
                  </label>
                )}
                <div className="checkout-form-row">
                  <label>
                    {kind === "flight" ? "Departure" : "Check-in"}
                    <input
                      aria-label={
                        kind === "flight" ? "Departure date" : "Check-in date"
                      }
                      type="date"
                      value={departure}
                      min={dateAfter(0)}
                      onChange={(event) => setDeparture(event.target.value)}
                      required
                    />
                  </label>
                  <label>
                    {kind === "flight" ? "Return (optional)" : "Check-out"}
                    <input
                      aria-label={
                        kind === "flight" ? "Return date" : "Check-out date"
                      }
                      type="date"
                      value={kind === "flight" ? returnDate : checkOut}
                      min={departure}
                      onChange={(event) =>
                        kind === "flight"
                          ? setReturnDate(event.target.value)
                          : setCheckOut(event.target.value)
                      }
                      required={kind === "hotel"}
                    />
                  </label>
                </div>
                <label>
                  Adult travellers
                  <select
                    aria-label="Adult travellers"
                    value={adults}
                    onChange={(event) => setAdults(Number(event.target.value))}
                  >
                    {[1, 2, 3, 4].map((count) => (
                      <option key={count} value={count}>
                        {count} {count === 1 ? "adult" : "adults"}
                        {kind === "hotel" ? " · 1 room" : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="find-route-button" disabled={!!busy}>
                  <span>
                    {kind === "flight"
                      ? "Search live flights"
                      : "Search live stays"}
                  </span>
                  <ArrowRight size={17} />
                </button>
                <datalist id="travel-airports">
                  {Object.values(marketAirports)
                    .flat()
                    .map((airport) => (
                      <option key={airport.code} value={airport.code}>
                        {airport.city}
                      </option>
                    ))}
                </datalist>
              </form>
              <p className="checkout-small">
                Availability is confirmed by the provider for your dates. More
                countries, groceries, shopping and mobile top-ups are coming
                soon.
              </p>
              {searched ? (
                <section
                  className="travel-results"
                  aria-label="Live travel results"
                >
                  <span className="commerce-eyebrow">
                    {offers.length} LIVE {kind === "flight" ? "FARES" : "STAYS"}
                    {inventoryState === "enriching" ? " · STILL LOADING" : ""}
                  </span>
                  {offers.map((offer) => (
                    <button
                      className="travel-offer"
                      key={offer.id}
                      disabled={!!busy || inventoryState === "enriching"}
                      onClick={() => void choose(offer)}
                    >
                      {offer.photo ? (
                        <img
                          src={offer.photo}
                          alt=""
                          loading="lazy"
                          referrerPolicy="no-referrer"
                        />
                      ) : null}
                      <div>
                        <strong>{offer.title}</strong>
                        <span>{offer.subtitle}</span>
                        {offer.departure ? (
                          <small>
                            {offer.departure.replace("T", " ").slice(0, 16)} ·{" "}
                            {offer.stops === 0
                              ? "Nonstop"
                              : `${offer.stops} stop(s)`}
                          </small>
                        ) : null}
                        {offer.fare ? (
                          <small>
                            {offer.fare} · {offer.baggage}
                          </small>
                        ) : null}
                        {offer.dueAtHotel && Number(offer.dueAtHotel) > 0 ? (
                          <small>
                            + {displayMoney(offer.dueAtHotel)} at hotel
                          </small>
                        ) : null}
                        <div className="offer-price">
                          <b>{displayMoney(offer.price, offer.currency)}</b>
                          <span>
                            {kind === "hotel"
                              ? "stay total from"
                              : "all travellers"}
                            <ArrowRight size={13} />
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                  {!offers.length && !busy ? (
                    <p className="map-message">
                      No bookable inventory for these dates. Try another route
                      or city; we won’t invent an available merchant.
                    </p>
                  ) : null}
                </section>
              ) : null}
            </>
          ) : (
            <>
              <button
                className="back-to-matches"
                disabled={!!busy}
                onClick={() => {
                  setSelected(undefined);
                  setRate(undefined);
                  setRates([]);
                  setTerms(false);
                }}
              >
                <ArrowLeft size={14} />
                Back to live results
              </button>
              <div className="chosen-travel">
                <span className="commerce-eyebrow">
                  YOUR {kind === "flight" ? "FLIGHT" : "STAY"}
                </span>
                <h3>{selected.title}</h3>
                <p>{selected.subtitle}</p>
                {selected.departure ? (
                  <p>
                    {selected.departure.replace("T", " ").slice(0, 16)} →{" "}
                    {selected.arrival?.replace("T", " ").slice(0, 16)}
                    <small>Times local to each airport · {selected.fare}</small>
                  </p>
                ) : null}
                {selected.location ? (
                  <button onClick={() => onFocus(selected.location!)}>
                    <MapPin size={13} />
                    Show hotel on map
                  </button>
                ) : null}
              </div>
              {kind === "flight" && selected.alternatives?.length ? (
                <label className="fare-picker">
                  Fare option
                  <select
                    aria-label="Fare option"
                    value={selected.id}
                    onChange={(event) => {
                      const alternative = selected.alternatives!.find(
                        (fare) => fare.id === event.target.value,
                      )!;
                      setSelected({
                        ...selected,
                        id: alternative.id,
                        price: alternative.price,
                        fare: alternative.name,
                        refundable: alternative.refundable,
                        changeable: alternative.changeable,
                      });
                      setTerms(false);
                    }}
                  >
                    {selected.alternatives.map((fare) => (
                      <option key={fare.id} value={fare.id}>
                        {fare.name} · {displayMoney(fare.price)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {kind === "hotel" ? (
                <div className="hotel-rates" aria-label="Hotel room rates">
                  {rates.map((option) => (
                    <button
                      key={option.id}
                      aria-pressed={rate?.id === option.id}
                      onClick={() => {
                        setRate(option);
                        setTerms(false);
                      }}
                    >
                      <div>
                        <strong>{option.room}</strong>
                        <span>{option.board}</span>
                        <small>
                          {option.refundability ||
                            "Cancellation policy at quote"}
                        </small>
                      </div>
                      <b>{displayMoney(option.price)}</b>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="checkout-small">
                  {selected.refundable === undefined
                    ? "Refund terms unknown"
                    : selected.refundable
                      ? "Refundable under the airline’s conditions"
                      : "Non-refundable fare"}{" "}
                  ·{" "}
                  {selected.changeable === undefined
                    ? "Change terms unknown"
                    : selected.changeable
                      ? "Changes allowed under fare conditions"
                      : "Changes not allowed"}
                  . Final availability and total are refreshed before payment.
                </p>
              )}
              {kind === "flight" || rate ? (
                <form
                  className="traveller-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void prepare();
                  }}
                >
                  {people.map((person, index) => (
                    <fieldset key={index}>
                      <legend>
                        Traveller {index + 1} · as on travel document
                      </legend>
                      <div className="checkout-form-row">
                        <label>
                          Given name
                          <input
                            aria-label={`Traveller ${index + 1} given name`}
                            autoComplete="given-name"
                            value={person.given_name}
                            required
                            maxLength={80}
                            onChange={(event) =>
                              setPeople((value) =>
                                value.map((item, i) =>
                                  i === index
                                    ? {
                                        ...item,
                                        given_name: event.target.value,
                                      }
                                    : item,
                                ),
                              )
                            }
                          />
                        </label>
                        <label>
                          Family name
                          <input
                            aria-label={`Traveller ${index + 1} family name`}
                            autoComplete="family-name"
                            value={person.family_name}
                            required
                            maxLength={80}
                            onChange={(event) =>
                              setPeople((value) =>
                                value.map((item, i) =>
                                  i === index
                                    ? {
                                        ...item,
                                        family_name: event.target.value,
                                      }
                                    : item,
                                ),
                              )
                            }
                          />
                        </label>
                      </div>
                      {kind === "flight" ? (
                        <>
                          <label>
                            Date of birth
                            <input
                              aria-label={`Traveller ${index + 1} date of birth`}
                              type="date"
                              value={person.born_on}
                              required
                              max={dateAfter(0)}
                              onChange={(event) =>
                                setPeople((value) =>
                                  value.map((item, i) =>
                                    i === index
                                      ? { ...item, born_on: event.target.value }
                                      : item,
                                  ),
                                )
                              }
                            />
                          </label>
                          <div className="checkout-form-row">
                            <label>
                              Title
                              <select
                                aria-label={`Traveller ${index + 1} title`}
                                value={person.title}
                                onChange={(event) =>
                                  setPeople((value) =>
                                    value.map((item, i) =>
                                      i === index
                                        ? {
                                            ...item,
                                            title: event.target
                                              .value as Person["title"],
                                          }
                                        : item,
                                    ),
                                  )
                                }
                              >
                                {["mr", "mrs", "ms", "miss", "dr"].map(
                                  (title) => (
                                    <option key={title} value={title}>
                                      {title.toUpperCase()}
                                    </option>
                                  ),
                                )}
                              </select>
                            </label>
                            <label>
                              Sex on document
                              <select
                                aria-label={`Traveller ${index + 1} sex on document`}
                                value={person.gender}
                                onChange={(event) =>
                                  setPeople((value) =>
                                    value.map((item, i) =>
                                      i === index
                                        ? {
                                            ...item,
                                            gender: event.target
                                              .value as Person["gender"],
                                          }
                                        : item,
                                    ),
                                  )
                                }
                              >
                                <option value="m">Male</option>
                                <option value="f">Female</option>
                              </select>
                            </label>
                          </div>
                        </>
                      ) : null}
                    </fieldset>
                  ))}
                  <label>
                    Contact email
                    <input
                      type="email"
                      aria-label="Booking contact email"
                      autoComplete="email"
                      required
                      value={email}
                      maxLength={200}
                      onChange={(event) => setEmail(event.target.value)}
                    />
                  </label>
                  <label>
                    Phone with country code
                    <input
                      type="tel"
                      aria-label="Booking contact phone"
                      autoComplete="tel"
                      required
                      pattern="\+[1-9][0-9]{6,14}"
                      placeholder="+12025550123"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                    />
                  </label>
                  {rate ? (
                    <div className="hotel-terms">
                      <p>
                        Due at hotel: <b>{displayMoney(rate.dueAtHotel)}</b> in
                        addition to the prepaid amount.
                      </p>
                      <p>{rate.refundability}</p>
                      <details>
                        <summary>
                          Property and cancellation terms — read before paying
                        </summary>
                        {rate.conditions.map((condition, index) => (
                          <div key={index}>
                            <strong>{condition.title}</strong>
                            <p>{condition.description}</p>
                          </div>
                        ))}
                        <p>
                          Provider cancellation fees can be retained even on a
                          refundable rate.
                        </p>
                      </details>
                    </div>
                  ) : null}
                  <label className="checkout-consent">
                    <input
                      type="checkbox"
                      checked={terms}
                      required
                      onChange={(event) => setTerms(event.target.checked)}
                    />
                    <span>
                      I reviewed the traveller details and fare/property
                      cancellation terms. I understand this is a real booking
                      and fees apply.
                    </span>
                  </label>
                  <p className="checkout-small">
                    Booking details are shared with BRIJ and its travel supplier
                    for fulfillment. Preparing a quote does not pay or confirm a
                    reservation.
                  </p>
                  <button
                    className="find-route-button"
                    disabled={!!busy || !terms}
                  >
                    <span>Get final booking quote</span>
                    <ArrowRight size={16} />
                  </button>
                </form>
              ) : null}
            </>
          )}
        </>
      ) : (
        <>
          <section className="booking-review" aria-label="Final booking quote">
            <h3>{checkout.summary.title}</h3>
            <p>
              {checkout.summary.travellers} traveller(s) ·{" "}
              {checkout.review.travellers
                .map((person) => `${person.given_name} ${person.family_name}`)
                .join(", ")}
            </p>
            <p>
              {checkout.review.email} · {checkout.review.phone}
            </p>
            <div className="booking-cost">
              <span>Travel price & taxes</span>
              <b>{displayMoney(checkout.summary.ticketAmount)}</b>
              <span>Provider service fee</span>
              <b>{displayMoney(checkout.summary.serviceFee)}</b>
              <strong>Pay into booking escrow</strong>
              <strong>{checkout.summary.amount} USDC</strong>
            </div>
            {Number(checkout.summary.dueAtHotel) > 0 ? (
              <p className="hotel-extra">
                Plus {displayMoney(checkout.summary.dueAtHotel!)} due at the
                hotel. Property deposits or a card at check-in can also be
                required.
              </p>
            ) : null}
            <details className="hotel-terms">
              <summary>Final fare and property terms</summary>
              {(checkout.policy || []).map((term, index) => (
                <p key={index}>{term}</p>
              ))}
            </details>
            <label className="checkout-consent">
              <input
                aria-label="Accept final booking quote and terms"
                type="checkbox"
                checked={finalAccepted}
                onChange={(event) => setFinalAccepted(event.target.checked)}
              />
              <span>
                I reviewed this final total, traveller details and
                cancellation/property terms.
              </span>
            </label>
            <dl className="booking-addresses">
              <dt>Network</dt>
              <dd>Solana mainnet · USDC</dd>
              <dt>Paying & refund wallet</dt>
              <dd>{checkout.summary.wallet}</dd>
              <dt>Booking escrow</dt>
              <dd>{checkout.summary.escrow}</dd>
              <dt>Quote valid until</dt>
              <dd>
                {new Date(checkout.summary.expiresAt).toLocaleTimeString()}
              </dd>
            </dl>
            <p className="checkout-small">
              <ShieldCheck size={13} />
              Wallet approval sends only the reviewed amount to this provider
              escrow. Confirmation comes from the travel provider.
            </p>
          </section>
          {!closed ? (
            <>
              <div className="payment-methods">
                <label>
                  <input
                    type="radio"
                    name="payment-method"
                    checked={method === "usdc"}
                    disabled={!!busy || !!pendingPayment || fundingSent}
                    onChange={() => setMethod("usdc")}
                  />
                  USDC on Solana
                </label>
                <label>
                  <input
                    type="radio"
                    name="payment-method"
                    checked={method === "near"}
                    disabled={!!busy || !!pendingPayment || fundingSent}
                    onChange={() => setMethod("near")}
                  />
                  Pay with NEAR
                </label>
              </div>
              <div className="checkout-balance">
                <span>
                  {balance === undefined
                    ? "Balance not checked"
                    : `Available: ${(BigInt(balance) / 1000000n).toString()}.${(BigInt(balance) % 1000000n).toString().padStart(6, "0")} USDC`}
                </span>
                <button
                  aria-label="Refresh USDC balance"
                  disabled={!!busy}
                  onClick={() =>
                    void run("Refreshing USDC…", async () => {
                      const data = await call<{ amountAtomic: string }>({
                        action: "balance",
                        wallet: checkout.summary.wallet,
                      });
                      setBalance(data.amountAtomic);
                    })
                  }
                >
                  <RefreshCw size={13} />
                </button>
              </div>
              {method === "near" ? (
                <div className="near-funding">
                  <h3>NEAR → your Solana USDC → booking</h3>
                  <p>
                    This provider settles in USDC. Connect a NEAR wallet and a
                    Solana wallet. Conversion funds your own Solana wallet; the
                    booking is a separate approval. Failed swaps refund the NEAR
                    account; booking refunds return as Solana USDC.
                  </p>
                  <button
                    className="secondary-checkout-button"
                    disabled={!!busy || fundingSent}
                    onClick={() =>
                      void run("Connecting NEAR wallet…", async () => {
                        save({ checkout, funding, fundingSent, method });
                        const callback = new URL(location.href);
                        callback.searchParams.set("checkout", "1");
                        history.replaceState(null, "", callback);
                        setNear(await connectNear());
                      })
                    }
                  >
                    <Wallet size={14} />
                    {near ? near : "Connect NEAR wallet"}
                  </button>
                  {!enough && !funding ? (
                    <button
                      className="secondary-checkout-button"
                      disabled={!!busy || !near || !finalAccepted}
                      onClick={() => void convertNear()}
                    >
                      Get exact NEAR conversion quote
                    </button>
                  ) : null}
                  {funding ? (
                    <>
                      <p>
                        <b>{funding.nearAmount} NEAR</b> →{" "}
                        {funding.destinationAmount} USDC
                        <br />
                        <small>
                          Conversion fees/slippage included in the quoted input;
                          wallet network gas is additional. Quote expires{" "}
                          {new Date(funding.expiresAt).toLocaleTimeString()}.
                        </small>
                      </p>
                      {!fundingSent ? (
                        <button
                          className="find-route-button"
                          disabled={
                            !!busy ||
                            !finalAccepted ||
                            Date.parse(funding.expiresAt) <= Date.now()
                          }
                          onClick={() => void approveNear()}
                        >
                          <span>Approve NEAR conversion</span>
                          <ArrowRight size={16} />
                        </button>
                      ) : (
                        <p className="funding-state">
                          Conversion: {fundingState || "Waiting for deposit"}
                        </p>
                      )}
                      <button
                        className="secondary-checkout-button"
                        disabled={!!busy}
                        onClick={() =>
                          void run("Checking conversion…", async () => {
                            const next = await call<{ status: string }>({
                              action: "fundingStatus",
                              token: funding.token,
                            });
                            setFundingState(next.status);
                            const bal = await call<{ amountAtomic: string }>({
                              action: "balance",
                              wallet: checkout.summary.wallet,
                            });
                            setBalance(bal.amountAtomic);
                          })
                        }
                      >
                        Check the same conversion
                      </button>
                    </>
                  ) : null}
                </div>
              ) : null}
              <button
                className="find-route-button approve-booking"
                disabled={
                  !!busy ||
                  (!pendingPayment &&
                    (!finalAccepted ||
                      !enough ||
                      wallet !== checkout.summary.wallet ||
                      Date.parse(checkout.summary.expiresAt) <= Date.now()))
                }
                onClick={() => void pay()}
              >
                <Wallet size={16} />
                <span>
                  {pendingPayment
                    ? "Retry approved payment"
                    : `Approve ${checkout.summary.amount} USDC & book`}
                </span>
              </button>
              <p className="checkout-small">
                No payment happens when you connect a wallet. The final button
                requests your explicit wallet signature. If submission is
                uncertain, check status before paying again.
              </p>
            </>
          ) : null}
          <section className="order-status" aria-label="Booking status">
            <span className="commerce-eyebrow">ORDER STATUS</span>
            <h3>{status?.status || "Unpaid · awaiting your approval"}</h3>
            <p>
              {status?.reference
                ? `Confirmation: ${status.reference}`
                : "No confirmed booking reference yet."}
            </p>
            <small>{checkout.summary.intentId}</small>
            <button
              className="secondary-checkout-button"
              disabled={!!busy}
              onClick={() => void checkOrder()}
            >
              <RefreshCw size={14} />
              Check order status
            </button>
          </section>
          <button
            className="copy-recovery"
            onClick={() =>
              void run("Copying recovery code…", async () => {
                await navigator.clipboard.writeText(checkout.token);
                setNotice(
                  "Encrypted order recovery code copied. Keep it private; it restores order details and refund access.",
                );
              })
            }
          >
            <Copy size={13} />
            Copy encrypted order recovery code
          </button>
          {closed &&
          !/refunded|cancelled|failed|expired/i.test(status?.status || "") ? (
            <details className="refund-panel">
              <summary>Request cancellation or a refund</summary>
              <p>
                Fare/property rules determine eligibility and refund amount.
                This does not guarantee a full refund.
              </p>
              <label>
                Lead traveller family name
                <input
                  value={cancelName}
                  onChange={(event) => setCancelName(event.target.value)}
                />
              </label>
              <label>
                Reason
                <textarea
                  value={cancelReason}
                  onChange={(event) => setCancelReason(event.target.value)}
                  maxLength={500}
                />
              </label>
              <label className="checkout-consent">
                <input
                  type="checkbox"
                  checked={cancelConfirmed}
                  onChange={(event) => setCancelConfirmed(event.target.checked)}
                />
                <span>
                  I want the provider to process this cancellation/refund
                  request under its policy.
                </span>
              </label>
              <button
                className="secondary-checkout-button"
                disabled={
                  !!busy ||
                  !cancelConfirmed ||
                  cancelName.length < 1 ||
                  cancelReason.length < 5
                }
                onClick={() =>
                  void run("Sending your cancellation request…", async () => {
                    const next = await call<OrderStatus>({
                      action: "cancel",
                      token: checkout.token,
                      familyName: cancelName,
                      reason: cancelReason,
                      confirm: true,
                    });
                    setStatus(next);
                    setNotice(
                      next.message ||
                        "Cancellation request sent to the provider.",
                    );
                  })
                }
              >
                Submit cancellation/refund request
              </button>
            </details>
          ) : null}
          <details className="new-search-warning">
            <summary>Start another search</summary>
            <p>
              Keep your recovery code before clearing this view. A new search
              does not cancel an existing booking or reverse a conversion.
            </p>
            <button
              className="secondary-checkout-button"
              disabled={!!busy}
              onClick={newSearch}
            >
              Keep existing order, start new search
            </button>
          </details>
        </>
      )}
      <details className="recover-order">
        <summary>Recover an existing order</summary>
        <textarea
          aria-label="Encrypted order recovery code"
          value={recovery}
          onChange={(event) => setRecovery(event.target.value)}
          placeholder="Paste your encrypted recovery code"
          maxLength={30000}
        />
        <button
          className="secondary-checkout-button"
          disabled={!!busy || recovery.length < 30}
          onClick={() => void restore()}
        >
          Restore order
        </button>
      </details>
      <div className="checkout-availability">
        <Info size={15} />
        <p>
          Other merchants are coming soon. We enable checkout only when
          ordering, payment and fulfillment are connected. Travel availability
          is checked live for your exact request.
        </p>
      </div>
    </div>
  );
}
