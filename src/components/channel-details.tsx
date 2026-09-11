"use client";

import { useEffect, useState } from "react";
import { describePricingBasis, formatBillingBasis, formatCalculationModel, formatConvertedMoney, formatDeliveryMethod, formatEnumLabel, formatMultiPackageBilling, formatServicePrice, formatTransitTime } from "@/lib/shipping-format";
import type { ChannelRule, ChargeGroup, Money, RateCard, ShippingChannel, ShippingChargeItem, ShippingQuote, ShippingServiceOption, ValueAddedService } from "@/lib/shipping-types";

type DetailState = { status: "loading" | "success" | "empty" | "error"; channel?: ShippingChannel; message?: string };
const detailCache = new Map<string, ShippingChannel>();

export function ChannelDetails({ code, countryCode, currency, rate, quote, selectedServices, onToggleService, onClose }: {
  code: string;
  countryCode: string;
  currency: string;
  rate: number;
  quote?: ShippingQuote;
  selectedServices: string[];
  onToggleService: (service: ValueAddedService) => void;
  onClose: () => void;
}) {
  const [state, setState] = useState<DetailState>({ status: "loading" });

  async function load() {
    const cacheKey = `${code}:${countryCode}`;
    const cached = detailCache.get(cacheKey);
    if (cached) {
      setState({ status: "success", channel: cached });
      return;
    }
    setState({ status: "loading" });
    const include = "regions,services,rate_cards,rules";
    try {
      const response = await fetch(`/api/shipping/channels/${encodeURIComponent(code)}?country_code=${encodeURIComponent(countryCode)}&include=${include}`);
      const body = await response.json();
      if (!response.ok || body.error) throw new Error(body.error?.message || "Could not load channel details.");
      if (!body.code) {
        setState({ status: "empty", message: "Channel details were not found for this destination." });
        return;
      }
      detailCache.set(cacheKey, body);
      setState({ status: "success", channel: body });
    } catch (error) {
      setState({ status: "error", message: error instanceof Error ? error.message : "Could not load channel details." });
    }
  }

  useEffect(() => { void load(); }, [code, countryCode]); // eslint-disable-line react-hooks/exhaustive-deps

  return <section className="details-panel" aria-live="polite">
    <div className="details-toolbar"><div><span className="step">03</span><h2>Channel details</h2></div><button type="button" autoFocus onClick={onClose} aria-label="Close channel details">Close</button></div>
    {state.status === "loading" && <div className="details-state"><div className="loader" /><p>Loading channel configuration…</p></div>}
    {state.status === "empty" && <div className="details-state"><h3>Channel not found</h3><p>{state.message}</p></div>}
    {state.status === "error" && <div className="details-state"><h3>Could not load details</h3><p>{state.message}</p><button type="button" onClick={() => void load()}>Try again</button></div>}
    {state.status === "success" && state.channel && <ChannelDetailContent channel={state.channel} quote={quote} currency={currency} rate={rate} selectedServices={selectedServices} onToggleService={onToggleService} />}
  </section>;
}

function ChannelDetailContent({ channel, quote, currency, rate, selectedServices, onToggleService }: {
  channel: ShippingChannel;
  quote?: ShippingQuote;
  currency: string;
  rate: number;
  selectedServices: string[];
  onToggleService: (service: ValueAddedService) => void;
}) {
  const billing = channel.billing;
  return <div className="details-content">
    <div className="details-title"><div><span className="channel-code">{channel.code}</span><h3>{channel.name}</h3><p>{channel.description || "No description provided."}</p></div><span className="active-badge">{channel.status || "ACTIVE"}</span></div>
    <div className="detail-grid">
      <Fact label="Warehouse" value={channel.warehouse ? `${channel.warehouse.name} (${channel.warehouse.code})` : "Not provided"} />
      <Fact label="Delivery methods" value={channel.capabilities?.delivery_methods.map(formatDeliveryMethod).join(", ") || "Not provided"} />
      <Fact label="Billing basis" value={billing ? formatBillingBasis(billing.basis) : "Not provided"} />
      <Fact label="Calculation model" value={billing ? formatCalculationModel(billing.calculation_model) : "Not provided"} />
      <Fact label="Quantity unit" value={billing?.quantity_unit || "Not provided"} />
      <Fact label="Supported range" value={billing ? `${billing.supported_range.minimum.value}–${billing.supported_range.maximum.value} ${billing.quantity_unit}` : "Not provided"} />
      <Fact label="Minimum chargeable quantity" value={billing ? `${billing.minimum.value} ${billing.minimum.unit}${billing.minimum.ceil_to_minimum ? " · rounded up" : ""}` : "Not provided"} />
      <Fact label="Rounding" value={billing ? `${billing.rounding.single_package_step.value} ${billing.rounding.single_package_step.unit} per shipment` : "Not provided"} />
      <Fact label="Multi-package pricing" value={billing ? formatMultiPackageBilling(billing.multi_package.calculation_scope, billing.multi_package.aggregation) : "Not provided"} />
      <Fact label="Volumetric weight" value={billing?.volumetric_weight.enabled ? `Enabled · divisor ${billing.volumetric_weight.divisor ?? "not provided"}${billing.volumetric_weight.average_with_actual ? " · averaged with actual" : ""}` : "Disabled"} />
    </div>

    <DetailSection title="Destination regions">
      {channel.regions?.length ? <div className="region-list">{channel.regions.map((region) => <div key={region.code}><b>{region.name || region.code}</b><span>{region.countries.join(", ")} · {formatEnumLabel(region.match_type)}</span><strong>{formatTransitTime(region.reference_transit_time)}</strong></div>)}</div> : <p className="detail-note">No expanded regions returned.</p>}
    </DetailSection>

    <DetailSection title="Reference rate cards" emphasis="Pricing details">
      <p className="detail-note">These are reference rates from the channel configuration. API amounts are CNY minor units (fen), converted here to {currency} with the configured fixed rate. The shipping quote remains the final amount.</p>
      {channel.rate_cards?.length ? <div className="rate-card-list">{channel.rate_cards.map((card) => <RateCardDetails key={card.region_code} card={card} regionName={channel.regions?.find((region) => region.code === card.region_code)?.name} currency={currency} rate={rate} />)}</div> : <p className="detail-note">No reference price rows are available.</p>}
    </DetailSection>

    <DetailSection title="Value-added services" emphasis={quote ? "This quote" : undefined}>
      {quote && <ChargeGroupSummary label="Services in this quote" group={quote.charges?.channel_services} currency={currency} rate={rate} emptyCopy="No value-added service charge was included in this quote." />}
      {channel.value_added_services?.length ? <div className="service-list">{channel.value_added_services.map((service) => <ServiceRow key={service.code} service={service} quoteOption={quote?.service_options?.find((option) => option.code === service.code)} chargeItem={quote?.charges?.channel_services?.items?.find((item) => item.code === service.code)} baseFreight={quote?.charges?.base_freight} currency={currency} rate={rate} selected={selectedServices.includes(service.code)} onToggle={() => onToggleService(service)} />)}</div> : <p className="detail-note">No value-added services returned.</p>}
      <QuoteOnlyServiceCharges group={quote?.charges?.channel_services} configuredServices={channel.value_added_services} currency={currency} rate={rate} />
    </DetailSection>

    <DetailSection title="Channel rules" emphasis={quote ? "This quote" : undefined}>
      {quote && <QuoteRuleCharges group={quote.charges?.channel_rules} currency={currency} rate={rate} />}
      <h5 className="configuration-heading">Configured rules</h5>
      <p className="detail-note">{aggregationCopy(channel.rule_summary?.aggregation)} {capCopy(channel.rule_summary?.cap, currency, rate)} Pending or inapplicable rules are not included in quote totals.</p>
      {channel.channel_rules?.items.length ? <div className="configured-rule-list">{channel.channel_rules.items.map((rule, index) => <ConfiguredRuleCard key={rule.rule_id || rule.code || index} rule={rule} currency={currency} rate={rate} />)}</div> : <p className="detail-note">No additional channel rules apply.</p>}
    </DetailSection>
  </div>;
}

function RateCardDetails({ card, regionName, currency, rate }: { card: RateCard; regionName?: string; currency: string; rate: number }) {
  const supportedRange = card.supported_range ? `${card.supported_range.minimum.value}–${card.supported_range.maximum.value} ${card.quantity_unit}` : null;
  return <article className="rate-card-detail">
    <header><div><span>Region</span><b>{regionName || card.region_code}</b>{regionName && <small>{card.region_code}</small>}</div><div><span>Pricing model</span><b>{formatCalculationModel(card.calculation_model)}</b></div><div><span>Supported range</span><b>{supportedRange || formatBillingBasis(card.billing_basis)}</b></div></header>
    <p className="rate-formula">{rateFormula(card.calculation_model)}</p>
    {card.price_rows.length ? <RateRows card={card} currency={currency} rate={rate} /> : <p className="detail-note">This rate card does not contain any price rows.</p>}
    {(card.out_of_range_behavior || card.supported_range?.out_of_range_behavior) === "UNAVAILABLE" && <p className="rate-warning">Outside the supported range, this channel is unavailable. The last price tier is not extended.</p>}
  </article>;
}

function RateRows({ card, currency, rate }: { card: RateCard; currency: string; rate: number }) {
  const groups = groupRateRows(card.price_rows);
  if (card.calculation_model === "TIERED_PRICE") return <div className="rate-table-wrap"><table className="rate-table"><thead><tr><th>Quantity range</th><th>Base charge</th><th>Rate per unit</th></tr></thead><tbody>{groups.map(({ range, rows }, index) => {
    const base = rows.find((row) => row.type === "GRADE_BASE_PRICE");
    const unit = rows.find((row) => row.type === "GRADE_UNIT_PRICE");
    return <tr key={index}><td>{formatRateRange(range)}</td><td>{base ? <RateMoney amount={base.charge.amount} sourceCurrency={base.charge.currency} currency={currency} rate={rate} /> : "—"}</td><td>{unit ? <><RateMoney amount={unit.charge.amount} sourceCurrency={unit.charge.currency} currency={currency} rate={rate} /><small>per {unit.step?.value || 1} {unit.step?.unit || unit.range?.unit || card.quantity_unit}</small></> : "—"}</td></tr>;
  })}</tbody></table></div>;

  if (card.calculation_model === "RANGE_FIRST_NEXT_WEIGHT") return <div className="rate-table-wrap"><table className="rate-table"><thead><tr><th>Quantity range</th><th>First weight</th><th>First-weight charge</th><th>Additional weight</th></tr></thead><tbody>{groups.map(({ range, rows }, index) => {
    const first = rows.find((row) => row.type.includes("FIRST"));
    const next = rows.find((row) => row.type.includes("NEXT"));
    return <tr key={index}><td>{formatRateRange(range)}</td><td>{first?.first_quantity?.value ? `${first.first_quantity.value} ${first.first_quantity.unit}` : "—"}</td><td>{first ? <RateMoney amount={first.charge.amount} sourceCurrency={first.charge.currency} currency={currency} rate={rate} /> : "—"}</td><td>{next ? <><RateMoney amount={next.charge.amount} sourceCurrency={next.charge.currency} currency={currency} rate={rate} /><small>every {next.step?.value || "—"} {next.step?.unit || card.quantity_unit}</small></> : "—"}</td></tr>;
  })}</tbody></table></div>;

  return <div className="rate-table-wrap"><table className="rate-table"><thead><tr><th>Charge type</th><th>Applies to</th><th>Billing increment</th><th>Charge</th></tr></thead><tbody>{card.price_rows.map((row, index) => <tr key={`${row.type}-${index}`}><td>{formatPriceRowType(row.type)}</td><td>{formatRateRange(row.range)}</td><td>{formatRateIncrement(row)}</td><td><RateMoney amount={row.charge.amount} sourceCurrency={row.charge.currency} currency={currency} rate={rate} /></td></tr>)}</tbody></table></div>;
}

function RateMoney({ amount, sourceCurrency, currency, rate }: { amount: number; sourceCurrency: string; currency: string; rate: number }) {
  return <><strong>{formatConvertedMoney(amount, currency, rate)}</strong>{currency !== sourceCurrency && <small>{formatOriginalMoney(amount, sourceCurrency)}</small>}</>;
}

function groupRateRows(rows: RateCard["price_rows"]) {
  const groups = new Map<string, { range: RateCard["price_rows"][number]["range"]; rows: RateCard["price_rows"] }>();
  for (const row of rows) {
    const key = JSON.stringify(row.range || null);
    const group = groups.get(key) || { range: row.range, rows: [] };
    group.rows.push(row);
    groups.set(key, group);
  }
  return [...groups.values()];
}

function rateFormula(model: string): string {
  const formulas: Record<string, string> = {
    TIERED_PRICE: "Reference formula: choose the matching quantity range, then calculate base charge + quantity × unit rate. The shipping quote is final.",
    FIRST_NEXT_WEIGHT: "Reference formula: first-weight charge + each additional billing increment. Rounding, minimums, and the final amount come from the shipping quote.",
    MULTI_LEVEL_NEXT_WEIGHT: "The first-weight charge is followed by each configured additional-weight tier in sequence. Use the shipping quote for the final calculation.",
    RANGE_FIRST_NEXT_WEIGHT: "First choose the range for the total quantity, then use that range’s own first-weight and additional-weight rates. The shipping quote is final.",
    UNIT_PRICE: "Multiply the chargeable quantity by the unit rate shown below.",
  };
  return formulas[model] || "The quote service applies the matching configured row to the chargeable quantity.";
}

function formatPriceRowType(type: string): string {
  const labels: Record<string, string> = { GRADE_BASE_PRICE: "Base charge", GRADE_UNIT_PRICE: "Rate per unit", FIRST_WEIGHT: "First-weight charge", NEXT_WEIGHT: "Additional-weight charge", UNIT_PRICE: "Rate per unit" };
  return labels[type] || formatEnumLabel(type);
}

function formatRateRange(range: RateCard["price_rows"][number]["range"]): string {
  if (!range) return "All supported quantities";
  if (range.minimum === range.maximum) return `${range.maximum} ${range.unit}`;
  return `${range.minimum_inclusive === false ? ">" : "≥"} ${range.minimum} and ${range.maximum_inclusive ? "≤" : "<"} ${range.maximum} ${range.unit}`;
}

function formatRateIncrement(row: RateCard["price_rows"][number]): string {
  if (row.step?.value) return `Every ${row.step.value} ${row.step.unit}`;
  if (row.first_quantity?.value) return `First ${row.first_quantity.value} ${row.first_quantity.unit}`;
  if (row.type === "GRADE_UNIT_PRICE" || row.type === "UNIT_PRICE") return `Per 1 ${row.range?.unit || "unit"}`;
  return "Once per matched range";
}

function formatOriginalMoney(amountInFen: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amountInFen / 100);
}

function ChargeGroupSummary({ label, group, currency, rate, emptyCopy }: { label: string; group?: ChargeGroup | null; currency: string; rate: number; emptyCopy: string }) {
  const amount = group?.amount ?? group?.known_amount;
  return <div className="quote-charge-summary"><div><span>{label}</span><small>{formatCalculationStatus(group?.calculation_status)}{group?.amount == null && group?.known_amount != null ? " · known charges only" : ""}</small></div><strong>{amount == null ? "Pending" : formatConvertedMoney(amount, currency, rate)}</strong>{!group?.items?.length && <p>{emptyCopy}</p>}</div>;
}

function QuoteRuleCharges({ group, currency, rate }: { group?: ChargeGroup | null; currency: string; rate: number }) {
  return <div className="actual-charge-block"><ChargeGroupSummary label="Rules charged in this quote" group={group} currency={currency} rate={rate} emptyCopy="No channel rule charge was included in this quote." /><p className="actual-rule-policy">{aggregationCopy(group?.aggregation)} {capCopy(group?.cap, currency, rate)} The group subtotal returned by the quote is authoritative.</p>{group?.items?.length ? <div className="actual-charge-list">{group.items.map((item, index) => <ActualChargeRow key={item.rule_id || item.code || index} item={item} currency={currency} rate={rate} />)}</div> : null}</div>;
}

function QuoteOnlyServiceCharges({ group, configuredServices, currency, rate }: { group?: ChargeGroup | null; configuredServices?: ValueAddedService[]; currency: string; rate: number }) {
  const configuredCodes = new Set(configuredServices?.map((service) => service.code));
  const unmatchedItems = group?.items?.filter((item) => !item.code || !configuredCodes.has(item.code)) || [];
  if (!unmatchedItems.length) return null;
  return <div className="actual-charge-list">{unmatchedItems.map((item, index) => <ActualChargeRow key={item.code || index} item={item} currency={currency} rate={rate} />)}</div>;
}

function ConfiguredRuleCard({ rule, currency, rate }: { rule: ChannelRule; currency: string; rate: number }) {
  const conditions = rule.conditions || [];
  const regionNames = rule.regions?.map((region) => region.name || region.code).filter(Boolean).join(", ");
  return <article className="configured-rule-card">
    <header><div><b>{rule.name || "Channel rule"}</b><small>{regionNames ? `Applies to ${regionNames}` : "Applies to matching destinations"}{rule.rule_id ? ` · Rule ${rule.rule_id}` : ""}</small></div><span>{rule.rule_type === "FORBID_ORDERING" ? "Order restriction" : "Surcharge"}</span></header>
    <div className="configured-rule-body">
      <div><h6>When it applies</h6>{conditions.length ? <><p>{rule.condition_match === "ANY" ? "Any one of these conditions:" : "All of these conditions:"}</p><ul>{conditions.map((condition, index) => <li key={index}>{formatConfiguredCondition(condition)}</li>)}</ul></> : <p>Evaluated by the quote service.</p>}</div>
      <div><h6>Result</h6><strong>{formatRuleResult(rule, currency, rate)}</strong>{rule.formula && <p>{rule.formula}</p>}{(rule.min_charge || rule.max_charge) && <p>{formatRuleLimits(rule, currency, rate)}</p>}</div>
    </div>
  </article>;
}

function formatConfiguredCondition(condition: NonNullable<ChannelRule["conditions"]>[number]): string {
  if (condition.parameter === "REMOTE_AREA" && condition.operator === "CONTAINS") return "Destination postal code is in the configured remote-area list";
  const parameters: Record<string, string> = {
    THREE_SIDE_SUM: "Sum of length, width, and height",
    SHIPMENT_CHARGEABLE_WEIGHT: "Shipment chargeable weight",
    LONGEST_SIDE: "Longest side",
    ACTUAL_WEIGHT: "Actual weight",
    VOLUMETRIC_WEIGHT: "Volumetric weight",
    DECLARED_VALUE: "Declared value",
    PACKAGE_COUNT: "Package count",
  };
  const operators: Record<string, string> = { GT: "is greater than", GTE: "is at least", LT: "is less than", LTE: "is at most", EQ: "equals", CONTAINS: "contains" };
  const parameter = parameters[condition.parameter || ""] || formatEnumLabel(condition.parameter || "Condition");
  const operator = operators[condition.operator || ""] || formatEnumLabel(condition.operator || "matches").toLowerCase();
  return `${parameter} ${operator} ${formatConfiguredThreshold(condition.threshold_value, condition.unit)}`;
}

function formatConfiguredThreshold(value: Money | number | string | null | undefined, unit?: string | null): string {
  if (value && typeof value === "object" && "amount" in value) return `${value.amount / 100} ${value.currency}`;
  if (value == null) return "the configured value";
  return `${value}${unit ? ` ${unit}` : ""}`;
}

function formatRuleResult(rule: ChannelRule, currency: string, rate: number): string {
  if (rule.rule_type === "FORBID_ORDERING") return "This shipment cannot be ordered through this channel.";
  if (rule.charge_mode === "FIXED" && rule.charge_value && typeof rule.charge_value === "object") return `Add ${formatConvertedMoney(rule.charge_value.amount, currency, rate)} per shipment.`;
  if (rule.charge_mode === "BASE_FREIGHT_PERCENT" && typeof rule.charge_value === "number") return `Add ${rule.charge_value}% of the base freight.`;
  if (rule.charge_mode === "DECLARED_VALUE_PERCENT" && typeof rule.charge_value === "number") return `Add ${rule.charge_value}% of the declared value.`;
  if (rule.charge_mode === "FIXED" && typeof rule.charge_value === "number") return `Add ${rule.charge_value} per shipment.`;
  return rule.charge_mode ? `${formatEnumLabel(rule.charge_mode)} charge calculated with the quote.` : "The quote service determines whether this shipment is allowed.";
}

function formatRuleLimits(rule: ChannelRule, currency: string, rate: number): string {
  const limits = [];
  if (rule.min_charge) limits.push(`minimum ${formatConvertedMoney(rule.min_charge.amount, currency, rate)}`);
  if (rule.max_charge) limits.push(`maximum ${formatConvertedMoney(rule.max_charge.amount, currency, rate)}`);
  return `Charge limits: ${limits.join(" · ")}.`;
}

function ActualChargeRow({ item, currency, rate }: { item: ShippingChargeItem; currency: string; rate: number }) {
  return <div className="actual-charge-row"><div><b>{item.name || item.code || "Channel charge"}</b><span>{item.code || item.rule_id || "Applied rule"}{item.source ? ` · ${formatEnumLabel(item.source)}` : ""}{item.included_in_total === false ? " · not included in total" : " · included in total"}</span>{item.matched_conditions?.map((condition, index) => <small key={index}>Matched: {formatCondition(condition)}</small>)}<small>{formatActualFormula(item, currency, rate)}</small></div><strong>{formatMaybeMoney(item.amount, currency, rate)}</strong></div>;
}

function ServiceRow({ service, quoteOption, chargeItem, baseFreight, currency, rate, selected, onToggle }: { service: ValueAddedService; quoteOption?: ShippingServiceOption; chargeItem?: ShippingChargeItem; baseFreight?: Money; currency: string; rate: number; selected: boolean; onToggle: () => void }) {
  const price = service.region_prices[0];
  const priceText = price ? `${formatServicePrice(price, currency, rate)} ${describePricingBasis(service.pricing_basis)}` : "Calculated with the quote";
  const mandatory = service.request_mode === "MANDATORY";
  const changedAfterQuote = !mandatory && quoteOption && Boolean(quoteOption.selected) !== selected;
  const actualAmount = chargeItem?.amount ?? quoteOption?.amount;
  return <div className="service-row"><div className="service-copy"><b>{service.name || service.code}</b><span className={mandatory ? "mandatory" : "optional-service"}>{formatEnumLabel(service.request_mode)}</span><p>{service.description || priceText}</p><small>Configured charge: {priceText} · {formatEnumLabel(service.pricing_scope)}</small>{quoteOption && <div className={`service-quote-state ${quoteOption.included_in_total ? "included" : ""}`}><span>This quote · {formatCalculationStatus(quoteOption.calculation_status)}</span><b>{actualAmount == null ? "Not charged" : formatMaybeMoney(actualAmount, currency, rate)}</b><p>{chargeItem ? formatServiceChargeFormula(chargeItem, quoteOption, baseFreight, currency, rate) : quoteOption.reason || serviceOptionFormula(quoteOption, currency, rate)}</p>{changedAfterQuote && <em>Selection changed. Compare rates again to update this charge.</em>}</div>}</div>{!mandatory && <button type="button" className={selected ? "service-selected" : ""} onClick={onToggle}>{selected ? "Selected" : "Add to quote"}</button>}</div>;
}

function formatServiceChargeFormula(item: ShippingChargeItem, option: ShippingServiceOption, baseFreight: Money | undefined, currency: string, rate: number): string {
  const price = option.region_price;
  if (typeof price?.value === "number" && price.value_unit === "PERCENT") {
    const basis = option.pricing_basis === "BASE_FREIGHT_PERCENT" && baseFreight ? `Base freight ${formatConvertedMoney(baseFreight.amount, currency, rate)}` : formatEnumLabel((option.pricing_basis || "charge basis").replace("_PERCENT", ""));
    const fixed = price.fixed_charge?.amount ? ` + ${formatConvertedMoney(price.fixed_charge.amount, currency, rate)} fixed charge` : "";
    return `${basis} × ${price.value}%${fixed} = ${formatMaybeMoney(item.amount, currency, rate)}`;
  }
  return formatActualFormula(item, currency, rate);
}

function serviceOptionFormula(option: ShippingServiceOption, currency: string, rate: number): string {
  const price = option.region_price;
  if (typeof price?.value === "number" && price.value_unit === "PERCENT") return `${price.value}% ${describePricingBasis(option.pricing_basis || "")}; final amount calculated by the quote service.`;
  if (price?.fixed_charge) return `${formatConvertedMoney(price.fixed_charge.amount, currency, rate)} ${describePricingBasis(option.pricing_basis || "")}.`;
  return option.selected ? "Calculated by the shipping quote service." : "Not selected for this quote.";
}

function formatActualFormula(item: ShippingChargeItem, currency: string, rate: number): string {
  if (item.formula) return item.formula;
  if (item.quantity != null && item.unit_price) return `${item.quantity} × ${formatConvertedMoney(item.unit_price.amount, currency, rate)} = ${formatMaybeMoney(item.amount, currency, rate)}`;
  return item.reason || (item.calculation_status === "REVIEW_REQUIRED" ? "Final amount requires warehouse review." : "Calculated by the shipping quote service.");
}

function formatCalculationStatus(status?: string): string {
  const labels: Record<string, string> = { CALCULATED: "Calculated", NOT_SELECTED: "Not selected", PENDING_INPUT: "Waiting for shipment data", REVIEW_REQUIRED: "Warehouse review required", NOT_APPLICABLE: "Not applicable" };
  return labels[status || ""] || (status ? formatEnumLabel(status) : "No calculation status");
}

function formatMaybeMoney(value: Money | number | null | undefined, currency: string, rate: number): string {
  const amount = typeof value === "number" ? value : value?.amount;
  return amount == null ? "Pending" : formatConvertedMoney(amount, currency, rate);
}

function formatCondition(condition: NonNullable<ShippingChargeItem["matched_conditions"]>[number]): string {
  const actual = formatConditionValue(condition.actual_value, condition.unit);
  const threshold = formatConditionValue(condition.threshold_value, condition.unit);
  const operators: Record<string, string> = { GT: ">", GTE: "≥", LT: "<", LTE: "≤", EQ: "=" };
  return `${formatEnumLabel(condition.parameter || "condition")} ${actual} ${operators[condition.operator || ""] || formatEnumLabel(condition.operator || "matches")} ${threshold}`;
}

function formatConditionValue(value: Money | number | string | null | undefined, unit?: string | null): string {
  if (value && typeof value === "object" && "amount" in value) return `${value.amount / 100} ${value.currency}`;
  return `${value ?? "—"}${unit ? ` ${unit}` : ""}`;
}

function DetailSection({ title, emphasis, children }: { title: string; emphasis?: string; children: React.ReactNode }) {
  return <section className={`detail-section${emphasis ? " detail-section-emphasis" : ""}`}><div className="detail-section-heading"><h4>{title}</h4>{emphasis && <span>{emphasis}</span>}</div>{children}</section>;
}
function Fact({ label, value }: { label: string; value: string }) { return <div className="fact"><span>{label}</span><b>{value}</b></div>; }
function aggregationCopy(value?: string) { return value === "HIGHEST_ONLY" ? "Rules charge only the highest amount; ties are equivalent." : "All matched rule charges are added."; }
function capCopy(cap: { amount: number } | null | undefined, currency: string, rate: number) { return !cap || cap.amount === 0 ? "There is no rule-charge cap." : `Rule charges are capped at ${formatConvertedMoney(cap.amount, currency, rate)}.`; }
