"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { ChannelDetails } from "@/components/channel-details";
import { formatConvertedMoney, formatTransitTime } from "@/lib/shipping-format";
import { reconcileSelectedCountry } from "@/lib/shipping-destinations";
import { sortShippingQuotes } from "@/lib/shipping-sort";
import type { QuoteSortField, SortDirection } from "@/lib/shipping-sort";
import type { ShippingQuote, ShippingQuoteResponse, ValueAddedService } from "@/lib/shipping-types";

const chargeAmount = (group: { amount?: number | null; known_amount?: number }) => group.amount ?? group.known_amount;
const fallbackCountryCodes = ["US", "CA", "GB", "DE", "AU", "JP"];
type DestinationsSource = "live" | "fallback" | "empty";

export function ShippingCalculator() {
  const [country, setCountry] = useState("");
  const [countryCodes, setCountryCodes] = useState<string[]>([]);
  const [countriesLoading, setCountriesLoading] = useState(true);
  const [destinationsSource, setDestinationsSource] = useState<DestinationsSource>("live");
  const [destinationsError, setDestinationsError] = useState("");
  const [postalCode, setPostalCode] = useState("10001");
  const [weight, setWeight] = useState("2.5");
  const [length, setLength] = useState("");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [declaredValue, setDeclaredValue] = useState("75");
  const [displayCurrency, setDisplayCurrency] = useState("USD");
  const [cnyExchangeRate, setCnyExchangeRate] = useState(0.14);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [detailCode, setDetailCode] = useState<string | null>(null);
  const [sortPrimary, setSortPrimary] = useState<QuoteSortField>("price");
  const [priceDirection, setPriceDirection] = useState<SortDirection>("asc");
  const [transitDirection, setTransitDirection] = useState<SortDirection>("asc");
  const [result, setResult] = useState<ShippingQuoteResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const declaredValueInput = useRef<HTMLInputElement>(null);

  async function loadDestinations() {
    setCountriesLoading(true);
    setDestinationsError("");
    try {
      const response = await fetch("/api/shipping/countries");
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message || "Could not load destinations.");
      const liveCountries = (body as { countries: string[] }).countries;
      setCountryCodes(liveCountries);
      setCountry((current) => reconcileSelectedCountry(current, liveCountries));
      setDestinationsSource(liveCountries.length ? "live" : "empty");
      if (!liveCountries.length) setError("No destinations are configured for the channels available to this API key.");
    } catch (reason) {
      setCountryCodes(fallbackCountryCodes);
      setCountry((current) => reconcileSelectedCountry(current, fallbackCountryCodes));
      setDestinationsSource("fallback");
      setDestinationsError(reason instanceof Error ? reason.message : "Could not load destinations.");
    } finally {
      setCountriesLoading(false);
    }
  }

  useEffect(() => { void loadDestinations(); }, []);

  useEffect(() => {
    if (!country) return;
    setSelectedServices([]);
    setDetailCode(null);
    setResult(null);
  }, [country]);

  useEffect(() => {
    fetch("/api/shipping/config")
      .then((response) => response.json())
      .then((config) => {
        if (typeof config.display_currency === "string") setDisplayCurrency(config.display_currency);
        if (typeof config.cny_exchange_rate === "number" && config.cny_exchange_rate > 0) setCnyExchangeRate(config.cny_exchange_rate);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!detailCode) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDetailCode(null);
    };
    document.addEventListener("keydown", closeOnEscape);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [detailCode]);

  const dimensionValues = [length, width, height];
  const countryNames = useMemo(() => new Intl.DisplayNames(["en"], { type: "region" }), []);
  const sortedCountryCodes = useMemo(() => [...countryCodes].sort((left, right) => (countryNames.of(left) || left).localeCompare(countryNames.of(right) || right)), [countryCodes, countryNames]);
  const dimensionsEmpty = dimensionValues.every((value) => value === "");
  const dimensionsReady = dimensionValues.every((value) => value !== "" && Number(value) > 0);
  const sortedQuotes = useMemo(() => sortShippingQuotes(
    (result?.quotes || []).filter((quote) => quote.available && quote.quote_status !== "UNAVAILABLE"),
    { primary: sortPrimary, priceDirection, transitDirection },
  ), [result, sortPrimary, priceDirection, transitDirection]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!dimensionsEmpty && !dimensionsReady) {
      setError("Enter all three dimensions, or leave all three blank.");
      return;
    }
    setLoading(true); setError(""); setResult(null);
    const payload = { destination: { country_code: country, ...(postalCode.trim() ? { postal_code: postalCode.trim() } : {}) }, weight_kg: Number(weight), ...(dimensionsReady ? { length_cm: Number(length), width_cm: Number(width), height_cm: Number(height) } : {}), ...(declaredValue !== "" && Number(declaredValue) >= 0 ? { declared_value: { amount: Math.round((Number(declaredValue) / cnyExchangeRate) * 100), currency: "CNY" } } : {}), services: { channel: selectedServices.map((code) => ({ code, quantity: 1 })) } };
    try { const response = await fetch("/api/shipping/quotes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); const json = await response.json(); if (!response.ok) throw new Error(json.error?.message || "Quote request failed."); setResult(json); }
    catch (err) { setError(err instanceof Error ? err.message : "Quote request failed."); }
    finally { setLoading(false); }
  }
  function toggleService(service: ValueAddedService) {
    if (service.pricing_basis === "DECLARED_VALUE_PERCENT" && declaredValue === "") {
      setError("Enter a declared value before selecting this service.");
      declaredValueInput.current?.focus();
      return;
    }
    setSelectedServices((current) => current.includes(service.code) ? current.filter((code) => code !== service.code) : [...current, service.code]);
  }

  return <main>
    <header className="topbar"><a className="brand" href="/" aria-label="HIOBuy home"><span className="brand-mark">H</span><span>HIOBuy</span></a><span className="demo-pill">Developer demo</span><nav className="header-links" aria-label="Developer resources"><a className="docs-link" href="https://developers.hiobuy.com/" target="_blank" rel="noreferrer">Developer Console ↗</a><a className="docs-link" href="https://hiobuy.com/en/api-docs/fulfillment-freight-estimate" target="_blank" rel="noreferrer">API docs ↗</a></nav></header>
    <div className="demo-data-warning" role="note"><strong>Demo data only.</strong><span>Prices, transit times, channels, availability, services, and exchange rates shown here are sample data for demonstration purposes—not real shipping quotes or carrier commitments.</span></div>
    <section className="intro"><p className="eyebrow">International fulfillment</p><h1>Get a shipping estimate<br /><span>before you ship.</span></h1><p>Enter the declared parcel details to compare available HIOBuy shipping channels, estimated charges, and delivery times.</p></section>
    <div className="workspace">
      <form className="quote-form panel" onSubmit={submit}>
        <div className="panel-heading"><span className="step">01</span><div><h2>Shipment details</h2><p>Weight in kilograms · dimensions in centimeters</p></div></div>
        <label>Destination<select value={country} disabled={countriesLoading || destinationsSource === "empty"} required onChange={(e) => setCountry(e.target.value)}><option value="">{countriesLoading ? "Loading destinations…" : "Choose a destination"}</option>{sortedCountryCodes.map((code) => <option key={code} value={code}>{countryNames.of(code) || code}</option>)}</select></label>
        {destinationsSource === "fallback" && <div className="destination-notice">Live destinations could not be loaded. Showing fallback destinations. <button type="button" disabled={countriesLoading} onClick={() => void loadDestinations()}>Retry</button>{destinationsError && <span className="sr-only">{destinationsError}</span>}</div>}
        {destinationsSource === "empty" && <div className="destination-notice empty-notice">No destinations are configured for the channels available to this API key.</div>}
        <label>Postal code <span className="optional">Optional</span><input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} placeholder="10001" /></label>
        <div className="dimension-heading"><span>Parcel measurements</span><span>Optional</span></div>
        <div className="field-grid four">
          <label>Weight<input type="number" min="0.01" step="0.01" required value={weight} onChange={(e) => setWeight(e.target.value)} /><span className="unit">kg</span></label>
          <label>Length<input type="number" min="0" step="any" value={length} onChange={(e) => setLength(e.target.value)} placeholder="—" /><span className="unit">cm</span></label>
          <label>Width<input type="number" min="0" step="any" value={width} onChange={(e) => setWidth(e.target.value)} placeholder="—" /><span className="unit">cm</span></label>
          <label>Height<input type="number" min="0" step="any" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="—" /><span className="unit">cm</span></label>
        </div>
        <label>Declared value <span className="optional">Optional · converted to CNY on submit</span><input ref={declaredValueInput} type="number" min="0" step="0.01" value={declaredValue} onChange={(e) => setDeclaredValue(e.target.value)} /><span className="unit">{displayCurrency}</span></label>
        <p className="conversion-note">Fixed demo rate: 1 CNY = {cnyExchangeRate} {displayCurrency}. Submitted CNY = entered {displayCurrency} ÷ {cnyExchangeRate}; for example, 14 {displayCurrency} becomes 100 CNY.</p>
        {error && <div className="error" role="alert">{error}</div>}
        <button className="submit" disabled={loading || countriesLoading || destinationsSource === "empty" || !country}>{loading ? "Calculating…" : "Compare shipping rates"}<span>→</span></button><p className="secure">Your API key stays on the server.</p>
      </form>
      <section className="results" aria-live="polite">
        <div className="results-head"><div><span className="step">02</span><h2>Shipping options</h2></div>{result && <span>{sortedQuotes.length} option{sortedQuotes.length === 1 ? "" : "s"}</span>}</div>
        {result && sortedQuotes.length > 1 && <div className="sort-controls">
          <label>Priority<select value={sortPrimary} onChange={(event) => setSortPrimary(event.target.value as QuoteSortField)}><option value="price">Price first</option><option value="transit">Transit time first</option></select></label>
          <label>Price<select value={priceDirection} onChange={(event) => setPriceDirection(event.target.value as SortDirection)}><option value="asc">Low to high</option><option value="desc">High to low</option></select></label>
          <label>Transit time<select value={transitDirection} onChange={(event) => setTransitDirection(event.target.value as SortDirection)}><option value="asc">Fast to slow</option><option value="desc">Slow to fast</option></select></label>
        </div>}
        {!result && !loading && <div className="empty"><div className="parcel">↗</div><h3>Ready when you are</h3><p>Your available channels and full cost breakdown will appear here.</p><div className="route-line"><span>CN</span><i /><span>{country}</span></div></div>}
        {loading && <div className="empty"><div className="loader" /><h3>Checking live rates</h3><p>Matching your parcel with available destinations and channel rules.</p></div>}
        {result && sortedQuotes.length === 0 && <div className="empty"><h3>No shipping options found</h3><p>Try another destination or remove the channel filter.</p></div>}
        <div className="quote-list">{sortedQuotes.map((quote, index) => <QuoteCard key={`${quote.channel.code}-${index}`} quote={quote} best={index === 0 && quote.available && sortPrimary === "price" && priceDirection === "asc"} currency={result?.display_currency} rate={result?.cny_exchange_rate} onViewDetails={() => setDetailCode(quote.channel.code)} />)}</div>
        {result?.disclaimer && <p className="disclaimer">ⓘ {result.disclaimer}</p>}
      </section>
    </div>
    {detailCode && <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDetailCode(null); }}><div className="details-dialog" role="dialog" aria-modal="true" aria-label="Shipping channel details"><ChannelDetails code={detailCode} countryCode={country} currency={displayCurrency} rate={cnyExchangeRate} selectedServices={selectedServices} onToggleService={toggleService} onClose={() => setDetailCode(null)} /></div></div>}
    <section className="how-it-works"><p className="eyebrow">How this demo works</p><h2>Three APIs, one server-safe flow</h2><div className="flow"><div><b>Browser</b><span>Collects declared shipment data and service choices.</span></div><i>→</i><div><b>Local Route Handlers</b><span>Validate requests and keep the API key server-side.</span></div><i>→</i><div><b>HIOBuy API</b><span>Lists channels, returns channel details, and calculates quotes.</span></div></div><p>The browser calls <code>/api/shipping/*</code>. Only the local handlers call <code>https://api.hiobuy.com/v1/fulfillment/shipping/*</code>.</p></section>
  </main>;
}

function QuoteCard({ quote, best, currency = "CNY", rate = 1, onViewDetails }: { quote: ShippingQuote; best: boolean; currency?: string; rate?: number; onViewDetails: () => void }) {
  const groups = quote.charges ? Object.entries(quote.charges) : [];
  return <article className={`quote-card ${!quote.available ? "unavailable" : ""}`}><div className="quote-top"><div className="quote-name">{quote.channel.name || quote.channel.code}{best && <span className="best">Best value</span>}</div><span className={`status ${quote.quote_status.toLowerCase()}`}>{quote.quote_status.replace("_", " ")}</span></div>
    {quote.available ? <><div className="quote-facts"><div><span>Estimated total · {currency}</span><strong>{formatConvertedMoney(quote.total?.amount ?? quote.known_total?.amount, currency, rate)}</strong>{!quote.total && <small>known charges</small>}</div><div><span>Delivery</span><b>{formatTransitTime(quote.transit_time)}</b></div><div><span>Chargeable weight</span><b>{quote.weights?.chargeable ? `${quote.weights.chargeable.value} ${quote.weights.chargeable.unit}` : "—"}</b></div></div>{groups.length > 0 && <details><summary>View cost breakdown</summary><div className="breakdown">{groups.map(([name, group]) => <div key={name}><span>{name.replaceAll("_", " ")}</span><b>{formatConvertedMoney(chargeAmount(group), currency, rate)}</b></div>)}</div></details>}<button type="button" className="quote-detail-link" onClick={onViewDetails}>View channel details</button></> : <div className="unavailable-copy">{quote.unavailable_reason?.message || "This channel is unavailable for the selected shipment."}</div>}
    {!!quote.warnings?.length && <p className="warning">{quote.warnings[0].message}</p>}</article>;
}
