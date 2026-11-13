"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronRight,
  Crosshair,
  ExternalLink,
  Globe2,
  Info,
  Leaf,
  LoaderCircle,
  MapPin,
  Navigation,
  Plane,
  Route,
  Search,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Sparkles,
  UtensilsCrossed,
  Wrench,
  X,
} from "lucide-react";
import {
  countries,
  commerceCategories,
  type CountryCode,
  type CommerceCategory,
} from "@/lib/commerce/config";
import type { CommerceResult, CommerceRoute } from "@/lib/commerce/types";
import {
  countryViews,
  knownCity,
  locationsBounds,
  parseCoordinates,
  type MapLocation,
  type MapTarget,
} from "@/lib/maps/geo";
import MapCanvas from "./MapCanvas";
const TravelCheckout = dynamic(() => import("./TravelCheckout"), {
  ssr: false,
  loading: () => <p className="map-message">Opening in-app checkout…</p>,
});

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
    label: "Groceries in Karachi",
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
    label: "Mobile in Nigeria",
    icon: Smartphone,
  },
];
const branchBrands: Record<string, string> = {
  "walmart-us": "Walmart",
  "tesco-gb": "Tesco",
  "rewe-de": "REWE",
  "fairprice-sg": "FairPrice",
  "woolworths-au": "Woolworths",
  "carrefour-fr": "Carrefour",
};
function routeStatus(route: CommerceRoute) {
  return route.availability === "live" ? "In-app checkout" : "Coming soon";
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
  const [tab, setTab] = useState<"explore" | "route" | "checkout">("explore");
  const [expanded, setExpanded] = useState(false);
  const [checkoutKind, setCheckoutKind] = useState<"flight" | "hotel">("hotel");
  useEffect(() => {
    try {
      if (
        new URLSearchParams(window.location.search).has("checkout") ||
        localStorage.getItem("localagentpay:checkout:v1")
      )
        setTab("checkout");
    } catch {}
  }, []);
  function openCheckout(kind: "flight" | "hotel" = "hotel") {
    setCheckoutKind(kind);
    setTab("checkout");
    if (!country && !result?.country) {
      setCountry("US");
      focusCountry("US");
    } else if (!country && result?.country) setCountry(result.country);
    scroll.current?.scrollTo({ top: 0 });
  }
  function focusCheckoutPlace(place: MapLocation) {
    setLocation(place);
    setPlaces([place]);
    setTarget((value) => ({
      id: value.id + 1,
      kind: "location",
      label: place.name,
      center: place.coordinates,
      zoom: place.source === "city-center" ? 11 : 15,
    }));
  }

  const [location, setLocation] = useState<MapLocation>();
  const [locationText, setLocationText] = useState("");
  const [places, setPlaces] = useState<MapLocation[]>([]);
  const [locationBusy, setLocationBusy] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [locating, setLocating] = useState(false);
  const [target, setTarget] = useState<MapTarget>({
    id: 0,
    kind: "world",
    label: "Your next stop starts here",
    center: [35, 25],
    zoom: 2.4,
  });
  const requestId = useRef(0);
  const locationRequestId = useRef(0);
  const locationCache = useRef(new Map<string, MapLocation[]>());
  const scroll = useRef<HTMLDivElement>(null);
  const selected = result?.routes.find((route) => route.id === selectedId);
  const activeMarket = countries.find(
    (item) => item.code === (result?.country || country),
  );
  function focusCountry(code: CountryCode) {
    const market = countries.find((item) => item.code === code)!;
    setTarget((value) => ({
      id: value.id + 1,
      kind: "country",
      label: market.name,
      ...countryViews[code],
    }));
  }
  function invalidate() {
    requestId.current++;
    setBusy(false);
    setResult(undefined);
    setSelectedId("");
    setError("");
    setTab("explore");
  }
  function changeCountry(code: CountryCode | "") {
    invalidate();
    locationRequestId.current++;
    setLocationBusy(false);
    setLocating(false);
    setCountry(code);
    setCity("");
    setLocation(undefined);
    setPlaces([]);
    setLocationText("");
    setLocationError("");
    if (code) focusCountry(code);
    else
      setTarget((value) => ({
        id: value.id + 1,
        kind: "world",
        label: "Explore the world",
        center: [35, 25],
        zoom: 2.4,
      }));
  }
  function pickLocation(place: MapLocation) {
    locationRequestId.current++;
    setLocationBusy(false);
    setLocating(false);
    const code = countries.find(
      (item) => item.code === place.countryCode,
    )?.code;
    if (place.city !== city || (code && country !== code)) invalidate();
    if (code && country !== code) {
      setCountry(code);
    }
    setLocation(place);
    setCity(place.city || "");
    setLocationText(place.name);
    setLocationError("");
    setTarget((value) => ({
      id: value.id + 1,
      kind: "location",
      label: place.name,
      center: place.coordinates,
      bounds: place.bounds,
      zoom: place.source === "city-center" ? 11 : 16,
    }));
  }
  async function search(text = query, example = false) {
    if (busy || text.trim().length < 3) return;
    const id = ++requestId.current;
    setBusy(true);
    setError("");
    setResult(undefined);
    setSelectedId("");
    setTab("explore");
    setQuery(text);
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
      if (id !== requestId.current) return;
      const next = data as CommerceResult;
      setResult(next);
      setSelectedId(next.routes[0]?.id || "");
      const requestedCity = knownCity(text, next.country);
      const center = requestedCity || knownCity(city, next.country);
      const keepFocus =
        location &&
        (location.countryCode === next.country ||
          (!location.countryCode && country === next.country));
      if (example) {
        setCountry("");
        setCity("");
        setCategory("");
      }
      if (
        center &&
        (example ||
          !keepFocus ||
          (requestedCity && requestedCity.city !== location?.city))
      ) {
        locationRequestId.current++;
        setLocationBusy(false);
        setLocating(false);
        setLocationError("");
        setLocation(center);
        setLocationText(center.name);
        setPlaces([]);
        setTarget((value) => ({
          id: value.id + 1,
          kind: "location",
          label: center.name,
          center: center.coordinates,
          zoom: 11,
        }));
      } else if (example || !keepFocus) {
        locationRequestId.current++;
        setLocationBusy(false);
        setLocating(false);
        setLocationError("");
        setLocationText("");
        setLocation(undefined);
        setPlaces([]);
        focusCountry(next.country);
      }
    } catch (e) {
      if (id === requestId.current)
        setError(
          e instanceof Error
            ? e.message
            : "Couldn't find routes. Please try again.",
        );
    } finally {
      if (id === requestId.current) setBusy(false);
    }
  }
  async function findPlaces(text = locationText, near = false) {
    if (text.trim().length < 2 || locationBusy) return;
    const id = ++locationRequestId.current;
    setLocating(false);
    setLocationError("");
    const coordinates = parseCoordinates(text);
    if (coordinates) {
      setPlaces([]);
      pickLocation({
        id: `coordinates-${coordinates.join(",")}`,
        name: "Selected coordinates",
        address: `${coordinates[1].toFixed(5)}, ${coordinates[0].toFixed(5)} · latitude, longitude`,
        coordinates,
        source: "coordinates",
      });
      return;
    }
    const market = countries.find(
      (item) =>
        item.name.toLowerCase() === text.trim().toLowerCase() ||
        item.code.toLowerCase() === text.trim().toLowerCase(),
    );
    if (market && !near) {
      changeCountry(market.code);
      return;
    }
    const center = knownCity(text, country || undefined);
    if (
      center &&
      text.trim().toLowerCase() === center.name.toLowerCase() &&
      !near
    ) {
      setPlaces([]);
      pickLocation(center);
      return;
    }
    setLocationBusy(true);
    try {
      const params = new URLSearchParams({ q: text.trim() });
      const code = country || result?.country;
      if (code) params.set("country", code);
      if (near && location) {
        params.set("lng", String(location.coordinates[0]));
        params.set("lat", String(location.coordinates[1]));
      }
      const key = params.toString();
      let found = locationCache.current.get(key);
      if (!found) {
        const response = await fetch(`/api/map/search?${params}`, {
          signal: AbortSignal.timeout(13000),
        });
        const data = await response.json();
        if (!response.ok)
          throw new Error(
            data.error ||
              "Location search is unavailable. Try a city or coordinates.",
          );
        found = data.places as MapLocation[];
        if (locationCache.current.size >= 20)
          locationCache.current.delete(
            locationCache.current.keys().next().value!,
          );
        locationCache.current.set(key, found);
      }
      if (id !== locationRequestId.current) return;
      setPlaces(found);
      if (!found.length)
        setLocationError(
          "No map listings found here. Try a fuller address, another city, or latitude, longitude.",
        );
      else
        setTarget((value) => ({
          id: value.id + 1,
          kind: "places",
          label: `${found.length} map ${found.length === 1 ? "match" : "matches"}`,
          bounds: locationsBounds(found),
        }));
    } catch (e) {
      if (id === locationRequestId.current)
        setLocationError(
          e instanceof Error ? e.message : "Location search is unavailable.",
        );
    } finally {
      if (id === locationRequestId.current) setLocationBusy(false);
    }
  }
  function locate() {
    if (locating) return;
    setLocationError("");
    if (!navigator.geolocation) {
      setLocationError(
        "This browser doesn't support location. Search an address or enter coordinates instead.",
      );
      return;
    }
    const id = ++locationRequestId.current;
    setLocationBusy(false);
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (id !== locationRequestId.current) return;
        setLocating(false);
        setPlaces([]);
        pickLocation({
          id: "device-location",
          name: "Your device location",
          address: `Device estimate · accuracy ±${Math.round(position.coords.accuracy)} m`,
          coordinates: [position.coords.longitude, position.coords.latitude],
          accuracy: position.coords.accuracy,
          source: "gps",
        });
      },
      (error) => {
        if (id !== locationRequestId.current) return;
        setLocating(false);
        setLocationError(
          error.code === 1
            ? "Location permission is off. Allow it in your browser, or search an address or coordinates below."
            : "Couldn't get your device location. Search an address or coordinates instead.",
        );
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  }
  function selectRoute(route: CommerceRoute) {
    if (route.embeddedCheckout === "brij") {
      openCheckout(/\b(flight|airline)\b/i.test(query) ? "flight" : "hotel");
      return;
    }
    setSelectedId(route.id);
    setTab("route");
    scroll.current?.scrollTo({ top: 0 });
    if (location)
      setTarget((value) => ({
        id: value.id + 1,
        kind: "location",
        label: location.name,
        center: location.coordinates,
        bounds: location.bounds,
        zoom: location.source === "city-center" ? 11 : 16,
      }));
    else if (result) focusCountry(result.country);
  }
  return (
    <div className={`map-workspace ${expanded ? "panel-expanded" : ""}`}>
      <MapCanvas
        target={target}
        location={location}
        places={places}
        onPick={pickLocation}
        onLocate={locate}
        locating={locating}
      />
      <div className="map-topline">
        <span>
          <Globe2 size={14} /> LOCAL LIVING. BORDERLESS PAYMENTS.
        </span>
        <a href="https://intents.near.org/" target="_blank" rel="noreferrer">
          Powered by possibilities <ArrowUpRight size={14} />
        </a>
      </div>
      <aside className="map-app-panel" aria-label="Merchant route finder">
        <button
          className="sheet-handle"
          onClick={() => setExpanded((value) => !value)}
          aria-label={expanded ? "Collapse app panel" : "Expand app panel"}
          aria-expanded={expanded}
        >
          <span />
        </button>
        <header className="map-app-header">
          <a href="/" className="commerce-brand">
            <span className="brand-mark">
              <Navigation size={21} fill="currentColor" />
            </span>
            localagent<span className="pay-word">pay</span>
            <span className="beta-label">BETA</span>
          </a>
          <a
            className="sandbox-link"
            href="/demo"
            title="Simulated payment sandbox"
          >
            <Route size={16} />
            <span>Sandbox</span>
          </a>
        </header>
        <div className="map-panel-tabs">
          <button
            aria-pressed={tab !== "checkout"}
            onClick={() => setTab("explore")}
          >
            <Search size={15} /> Explore
          </button>
          <button
            aria-pressed={tab === "checkout"}
            onClick={() => openCheckout()}
          >
            <Route size={15} /> Checkout {selected ? <i /> : null}
          </button>
        </div>
        <div className="map-panel-scroll" ref={scroll}>
          {tab === "checkout" ? (
            <TravelCheckout
              country={country || result?.country || ""}
              city={city}
              initialKind={checkoutKind}
              onCountry={(code) => {
                changeCountry(code);
                setTab("checkout");
              }}
              onFocus={focusCheckoutPlace}
            />
          ) : tab === "explore" ? (
            <>
              <div className="map-intro">
                <span className="commerce-eyebrow">
                  YOUR WORLD, WITHIN REACH
                </span>
                <h1>
                  Go local.
                  <br />
                  <span>Pay borderless.</span>
                </h1>
                <p>
                  Book flights and hotel stays right here. Pay with your wallet.
                  More everyday merchants are coming soon.
                </p>
              </div>
              <button
                className="live-checkout-entry"
                onClick={() => openCheckout("hotel")}
              >
                <Plane size={18} />
                <span>
                  <strong>Flights & stays are live</strong>
                  <small>Search, book and pay inside this app</small>
                </span>
                <ArrowRight size={17} />
              </button>
              <div className="map-location-section">
                <label className="field-label" htmlFor="country">
                  Where are we headed?
                </label>
                <div className="country-field">
                  <Globe2 size={17} />
                  <select
                    id="country"
                    value={country}
                    onChange={(event) =>
                      changeCountry(event.target.value as CountryCode | "")
                    }
                  >
                    <option value="">Choose a country, or ask below</option>
                    {countries.map((item) => (
                      <option key={item.code} value={item.code}>
                        {item.name} · Travel
                      </option>
                    ))}
                    <option disabled>Other countries — Coming soon</option>
                  </select>
                  <ChevronDown size={15} />
                </div>
                <p className="coverage-note">
                  <strong>Flights & stays available</strong> · Other categories
                  and unlisted countries are coming soon.
                </p>
                <form
                  className="location-search"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void findPlaces();
                  }}
                >
                  <MapPin size={17} />
                  <input
                    aria-label="City, address or coordinates"
                    placeholder="City, address or lat, lng"
                    value={locationText}
                    onChange={(event) => setLocationText(event.target.value)}
                    maxLength={160}
                  />
                  <button
                    aria-label="Search map locations"
                    disabled={locationBusy || locationText.trim().length < 2}
                  >
                    {locationBusy ? (
                      <LoaderCircle size={17} className="spin" />
                    ) : (
                      <Search size={17} />
                    )}
                  </button>
                </form>
                <div className="location-actions">
                  <button onClick={locate} disabled={locating}>
                    <Crosshair size={13} />
                    {locating ? "Locating…" : "Use device location"}
                  </button>
                  <span>Search when you’re ready</span>
                </div>
                {locationError ? (
                  <p className="map-message error" role="alert">
                    {locationError}
                  </p>
                ) : null}
                {places.length ? (
                  <div
                    className="place-results"
                    aria-label="Map search results"
                  >
                    {places.map((place, index) => (
                      <button
                        key={place.id}
                        onClick={() => pickLocation(place)}
                      >
                        <span>{index + 1}</span>
                        <div>
                          <strong>{place.name}</strong>
                          <small>
                            {place.address || "OpenStreetMap listing"}
                          </small>
                        </div>
                        <ArrowUpRight size={14} />
                      </button>
                    ))}
                    <p>
                      OpenStreetMap listings · payment acceptance and stock
                      unverified
                    </p>
                  </div>
                ) : null}
              </div>
              <form
                className="purchase-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void search();
                }}
              >
                <label htmlFor="purchase" className="field-label">
                  What do you need?
                </label>
                <div className="purchase-input">
                  <textarea
                    id="purchase"
                    placeholder="A hotel in Dubai, paid in NEAR…"
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value);
                      invalidate();
                    }}
                    maxLength={500}
                    rows={2}
                  />
                  <Sparkles size={18} />
                </div>
                <div className="purchase-filters">
                  <select
                    aria-label="Purchase category"
                    value={category}
                    onChange={(event) => {
                      setCategory(event.target.value as CommerceCategory | "");
                      invalidate();
                    }}
                  >
                    <option value="">All categories</option>
                    {commerceCategories.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                        {item.id === "travel" ? " · Live" : " · Coming soon"}
                      </option>
                    ))}
                  </select>
                  <label>
                    <input
                      type="checkbox"
                      checked={cryptoOnly}
                      onChange={(event) => {
                        setCryptoOnly(event.target.checked);
                        invalidate();
                      }}
                    />
                    Crypto options only
                  </label>
                </div>
                <button
                  className="find-route-button"
                  disabled={busy || query.trim().length < 3}
                >
                  {busy ? (
                    <LoaderCircle size={17} className="spin" />
                  ) : (
                    <Route size={17} />
                  )}
                  <span>{busy ? "Finding your route…" : "Find my route"}</span>
                  <ArrowRight size={18} />
                </button>
              </form>
              {error ? (
                <p className="map-message error" role="alert">
                  {error}
                </p>
              ) : null}
              {result ? (
                <section
                  className="map-merchant-results"
                  aria-label="Merchant matches"
                  aria-live="polite"
                >
                  <div className="results-heading">
                    <div>
                      <span className="commerce-eyebrow">
                        YOUR LOCAL OPTIONS
                      </span>
                      <h2>{result.countryName}</h2>
                    </div>
                    <span>{result.routes.length} matches</span>
                  </div>
                  <p className="results-message">{result.message}</p>
                  {result.routes.length ? (
                    result.routes.map((route, index) => (
                      <RouteOption
                        key={route.id}
                        route={route}
                        index={index}
                        selected={selectedId === route.id}
                        onSelect={() => selectRoute(route)}
                      />
                    ))
                  ) : (
                    <p className="map-message">
                      No matches with these filters. Try all categories or turn
                      off crypto-only.
                    </p>
                  )}
                  <p className="results-warning">
                    <Info size={14} />
                    {result.warning}
                  </p>
                </section>
              ) : (
                <div className="map-examples">
                  <span className="commerce-eyebrow">A LITTLE INSPIRATION</span>
                  {examples.map((example) => (
                    <button
                      key={example.label}
                      disabled={busy}
                      onClick={() => void search(example.text, true)}
                    >
                      <example.icon size={17} />
                      <span>{example.label}</span>
                      <ArrowUpRight size={15} />
                    </button>
                  ))}
                </div>
              )}
              <details className="ranking-details">
                <summary>How we find your route</summary>
                <p>
                  We match country and category and prioritize working in-app
                  checkout. BRIJ provides live flight and hotel search, quotes
                  and wallet payment here. Other merchant integrations are
                  coming soon. Directory ranking is not a live price comparison;
                  final travel prices, fees, eligibility and terms come from the
                  provider.
                </p>
              </details>
            </>
          ) : selected ? (
            <>
              <button
                className="back-to-matches"
                onClick={() => setTab("explore")}
              >
                <ArrowLeft size={15} />
                Back to matches
              </button>
              <RouteDetail
                route={selected}
                onTravel={() => openCheckout("hotel")}
              />
              <div className="map-merchant-note">
                <MapPin size={17} />
                <p>
                  {location
                    ? `Map focus: ${location.name}. `
                    : `${result?.countryName || "Country"} overview. `}
                  This provider serves a market; its card is not a verified
                  branch pin.
                </p>
              </div>
              {branchBrands[selected.id] ? (
                <div className="branch-search">
                  <button
                    disabled={locationBusy}
                    onClick={() => {
                      setTab("explore");
                      void findPlaces(
                        `${branchBrands[selected.id]} ${city || result?.countryName || ""}`,
                        true,
                      );
                    }}
                  >
                    <Search size={15} />
                    Find store locations on map
                  </button>
                  <small>
                    This explicit search shares the map focus coordinates with
                    Photon if selected. Listings do not confirm payment support.
                  </small>
                </div>
              ) : null}
            </>
          ) : (
            <div className="route-empty">
              <span>
                <Route size={30} />
              </span>
              <h2>
                Your next move,
                <br />
                step by step.
              </h2>
              <p>
                Find a merchant in Explore, then choose a result to see its
                payment methods and next steps.
              </p>
              <button onClick={() => setTab("explore")}>
                Explore merchants <ArrowRight size={16} />
              </button>
            </div>
          )}
          <div className="map-panel-footnote">
            <ShieldCheck size={15} />
            <span>Your wallet. Your approval. Every payment.</span>
          </div>
          <div className="map-panel-footer">
            <span>Travel live · More merchants soon</span>
            <a
              href="https://github.com/gsas-bit23/localagentpay"
              target="_blank"
              rel="noreferrer"
            >
              Source <ArrowUpRight size={12} />
            </a>
          </div>
        </div>
      </aside>
      <div className="map-context-chips" aria-label="Explore categories">
        {(["groceries", "food", "shopping", "travel"] as const).map((id) => {
          const Icon = icons[id];
          return (
            <button
              key={id}
              aria-pressed={category === id}
              onClick={() => {
                setCategory((value) => (value === id ? "" : id));
                invalidate();
                setExpanded(true);
              }}
            >
              <Icon size={16} />
              {commerceCategories.find((item) => item.id === id)!.name}
            </button>
          );
        })}
      </div>
      <div className="map-destination-card">
        <div className="destination-icon">
          {location ? <MapPin size={20} /> : <Globe2 size={21} />}
        </div>
        <div>
          <span>
            {location
              ? location.source === "gps"
                ? "DEVICE ESTIMATE"
                : location.source === "city-center"
                  ? "CITY CENTER"
                  : "MAP LOCATION"
              : "EXPLORE YOUR NEXT POSSIBILITY"}
          </span>
          <strong>
            {location?.name ||
              activeMarket?.name ||
              "A world of local possibilities"}
          </strong>
          <p>
            {location?.address ||
              "Choose a country. Let the map take you there."}
          </p>
          {location ? (
            <small>
              {location.coordinates[1].toFixed(5)},{" "}
              {location.coordinates[0].toFixed(5)}
            </small>
          ) : null}
        </div>
        {location ? (
          <button
            aria-label="Clear map location"
            onClick={() => {
              locationRequestId.current++;
              setLocationBusy(false);
              setLocating(false);
              setLocationError("");
              invalidate();
              setLocation(undefined);
              setPlaces([]);
              setCity("");
              setLocationText("");
              if (country || result?.country)
                focusCountry((country || result?.country)!);
              else
                setTarget((value) => ({
                  id: value.id + 1,
                  kind: "world",
                  label: "Explore the world",
                  center: [35, 25],
                  zoom: 2.4,
                }));
            }}
          >
            <X size={16} />
          </button>
        ) : (
          <Navigation size={24} strokeWidth={1.4} />
        )}
      </div>
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
              {route.availability === "live"
                ? "Available in this app"
                : "Planned merchant"}
            </span>
          ) : null}
        </div>
        <p>{route.description}</p>
        <div className="route-option-tags">
          <span className={`payment-status ${route.availability}`}>
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

function RouteDetail({
  route,
  onTravel,
}: {
  route: CommerceRoute;
  onTravel: () => void;
}) {
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
      <div className="coming-soon-detail">
        <span className="coming-soon-badge">Coming soon</span>
        <h3>In-app checkout isn’t connected yet.</h3>
        <p>
          We’re waiting for a usable ordering, payment and fulfillment
          integration for this merchant. There is no pay button or merchant
          redirect for an unsupported checkout.
        </p>
        <button className="provider-cta" onClick={onTravel}>
          Explore live flights & stays <ArrowRight size={16} />
        </button>
      </div>
      <p className="detail-caveat">{route.caveat}</p>
    </div>
  );
}
