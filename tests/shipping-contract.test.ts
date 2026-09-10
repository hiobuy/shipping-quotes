import test from "node:test";
import assert from "node:assert/strict";
import { buildShippingChannelDetailPath, parseFlatChannelDetail, readBusinessFailure } from "../src/lib/shipping-api-contract.ts";
import { formatBillingBasis, formatCalculationModel, formatDeliveryMethod, formatMultiPackageBilling, formatServicePrice, formatTransitTime } from "../src/lib/shipping-format.ts";
import { collectDestinationCountryCodes, reconcileSelectedCountry } from "../src/lib/shipping-destinations.ts";
import type { ChannelCatalog } from "../src/lib/shipping-types.ts";
import { sortShippingQuotes } from "../src/lib/shipping-sort.ts";
import type { ShippingQuote } from "../src/lib/shipping-types.ts";

test("keeps a successful channel detail response flat", () => {
  const detail = { success: true, msg: "ok", code: "DHL/ECO", name: "DHL Economy" };
  assert.equal(parseFlatChannelDetail(detail), detail);
  assert.equal("data" in parseFlatChannelDetail(detail), false);
});

test("detects CHANNEL_NOT_FOUND even when upstream HTTP status is 200", () => {
  assert.deepEqual(readBusinessFailure({ success: false, code: "CHANNEL_NOT_FOUND", msg: "Shipping channel not found." }), {
    code: "CHANNEL_NOT_FOUND",
    message: "Shipping channel not found.",
    requestId: undefined,
  });
});

test("URL-encodes the channel code", () => {
  const path = buildShippingChannelDetailPath("DHL/ECO +", { countryCode: "US" });
  assert.match(path, /DHL%2FECO%20%2B/);
});

test("includes rules only when requested", () => {
  const defaultPath = buildShippingChannelDetailPath("DHL", { countryCode: "US" });
  const rulesPath = buildShippingChannelDetailPath("DHL", { include: ["regions", "services", "rate_cards", "rules"] });
  assert.match(defaultPath, /include=regions%2Cservices%2Crate_cards/);
  assert.doesNotMatch(defaultPath, /rules/);
  assert.match(rulesPath, /rules/);
});

test("formats structured transit time before compatibility text", () => {
  assert.equal(formatTransitTime({ text: "legacy", min_business_days: 7, max_business_days: 12 }), "7–12 business days");
  assert.equal(formatTransitTime({ min_days: 1, max_days: 1 }), "1 business day");
});

test("does not multiply percentage points by 100", () => {
  assert.equal(formatServicePrice({ region_code: "US", value: 10, value_unit: "PERCENT", fixed_charge: { amount: 0, currency: "CNY" } }, "USD", 0.14), "10%");
});

test("turns shipping contract enums into customer-readable labels", () => {
  assert.equal(formatDeliveryMethod("DOOR_DELIVERY"), "Door delivery");
  assert.equal(formatDeliveryMethod("PICKUP"), "Pickup point");
  assert.equal(formatBillingBasis("WEIGHT"), "Charged by weight");
  assert.equal(formatCalculationModel("TIERED_PRICE"), "Tiered pricing");
  assert.equal(formatMultiPackageBilling("COMBINED", "PRICE_COMBINED_QUANTITY"), "Combine package quantities, then calculate one price");
  assert.equal(formatMultiPackageBilling("PER_PACKAGE", "SUM_PACKAGE_CHARGES"), "Price each package separately, then add the charges");
});

function catalog(items: ChannelCatalog["items"], page: number): ChannelCatalog {
  return { items, pagination: { page, page_size: 50, total: items.length, has_more: false }, monetary_unit: "CNY_minor", generated_at: "2026-09-10T00:00:00Z", request_id: `page-${page}` };
}

test("collects, normalizes, validates, and deduplicates countries across pages", () => {
  const countries = collectDestinationCountryCodes([
    catalog([{ code: "A", name: "A", regions: [{ code: "R1", name: "One", match_type: "COUNTRY_REGION", postal_code_required: false, reference_transit_time: null, countries: ["us", "CA", "USA"] }] }], 1),
    catalog([{ code: "B", name: "B", regions: [{ code: "R2", name: "Two", match_type: "COUNTRY_REGION", postal_code_required: false, reference_transit_time: null, countries: ["US", " gb ", "1A"] }] }], 2),
  ]);
  assert.deepEqual(countries, ["US", "CA", "GB"]);
});

test("distinguishes successful empty destination data", () => {
  assert.deepEqual(collectDestinationCountryCodes([catalog([], 1)]), []);
});

test("replaces a selection that is not in refreshed live coverage", () => {
  assert.equal(reconcileSelectedCountry("DE", ["CA", "US"]), "US");
  assert.equal(reconcileSelectedCountry("DE", []), "");
});

function quote(code: string, price: number | null, days: number | null): ShippingQuote {
  return {
    channel: { code, name: code }, available: true, quote_status: "COMPLETE",
    known_total: { amount: price ?? 0, currency: "CNY" },
    total: price == null ? null : { amount: price, currency: "CNY" },
    transit_time: days == null ? null : { min_business_days: days, max_business_days: days },
  };
}

test("combines price and transit directions using the chosen priority", () => {
  const quotes = [quote("A", 1000, 8), quote("B", 1000, 5), quote("C", 2000, 2)];
  assert.deepEqual(sortShippingQuotes(quotes, { primary: "price", priceDirection: "asc", transitDirection: "asc" }).map((item) => item.channel.code), ["B", "A", "C"]);
  assert.deepEqual(sortShippingQuotes(quotes, { primary: "transit", priceDirection: "desc", transitDirection: "asc" }).map((item) => item.channel.code), ["C", "B", "A"]);
});

test("supports descending directions and keeps missing values last", () => {
  const quotes = [quote("A", 1000, 4), quote("B", 2000, 8), quote("C", null, null)];
  assert.deepEqual(sortShippingQuotes(quotes, { primary: "price", priceDirection: "desc", transitDirection: "desc" }).map((item) => item.channel.code), ["B", "A", "C"]);
});
