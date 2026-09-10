import type { ReferenceTransitTime, ServiceRegionPrice } from "./shipping-types";

/** API amounts are CNY minor units (fen); the rate is target-currency units per 1 CNY. */
export function formatConvertedMoney(amountInFen: number | null | undefined, currency = "CNY", cnyExchangeRate = 1): string {
  if (amountInFen == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format((amountInFen / 100) * cnyExchangeRate);
}

/** Prefer structured ranges. reference_time/text is compatibility copy only. */
export function formatTransitTime(transit: ReferenceTransitTime | null | undefined): string {
  if (!transit) return "Not provided";
  const minimum = transit.min_business_days ?? transit.min_days;
  const maximum = transit.max_business_days ?? transit.max_days;
  if (minimum == null || maximum == null) return transit.text || "Not provided";
  if (minimum === maximum) return `${minimum} business ${minimum === 1 ? "day" : "days"}`;
  return `${minimum}–${maximum} business days`;
}

/** PERCENT values are already percentage points: 10 means 10%, not 1000%. */
export function formatServicePrice(price: ServiceRegionPrice, currency: string, rate: number): string {
  if (price.value_unit === "PERCENT") return `${price.value}%`;
  return formatConvertedMoney(price.value, currency, rate);
}

export function describePricingBasis(basis: string): string {
  const labels: Record<string, string> = {
    BASE_FREIGHT_PERCENT: "of base freight",
    DECLARED_VALUE_PERCENT: "of declared value",
    PER_SHIPMENT: "per shipment",
    PER_BOX: "per box",
    PER_CHARGEABLE_WEIGHT: "per chargeable weight unit",
    PER_VOLUME: "per volume unit",
    PER_PACKAGE: "per package",
  };
  return labels[basis] || basis.toLowerCase().replaceAll("_", " ");
}

export function formatDeliveryMethod(method: string): string {
  const labels: Record<string, string> = {
    DOOR_DELIVERY: "Door delivery",
    PICKUP: "Pickup point",
    POST_OFFICE_PICKUP: "Post office pickup",
  };
  return labels[method] || formatEnumLabel(method);
}

export function formatBillingBasis(basis: string): string {
  const labels: Record<string, string> = {
    WEIGHT: "Charged by weight",
    VOLUME: "Charged by volume",
    DENSITY: "Charged by density",
  };
  return labels[basis] || formatEnumLabel(basis);
}

export function formatCalculationModel(model: string): string {
  const labels: Record<string, string> = {
    FIRST_NEXT_WEIGHT: "First + additional quantity",
    TIERED_PRICE: "Tiered pricing",
    UNIT_PRICE: "Unit pricing",
    UNIT_PRICE_PLUS_GRADE: "Unit price + tiered rate",
    MULTI_LEVEL_NEXT_WEIGHT: "Multi-tier additional weight",
    RANGE_FIRST_NEXT_WEIGHT: "Range-based first + additional weight",
  };
  return labels[model] || formatEnumLabel(model);
}

export function formatMultiPackageBilling(calculationScope: string, aggregation: string): string {
  if (calculationScope === "COMBINED" && aggregation === "PRICE_COMBINED_QUANTITY") {
    return "Combine package quantities, then calculate one price";
  }
  if (calculationScope === "PER_PACKAGE" && aggregation === "SUM_PACKAGE_CHARGES") {
    return "Price each package separately, then add the charges";
  }

  const scopes: Record<string, string> = {
    COMBINED: "Combine package quantities",
    PER_PACKAGE: "Price each package separately",
  };
  const aggregations: Record<string, string> = {
    PRICE_COMBINED_QUANTITY: "calculate one price",
    SUM_PACKAGE_CHARGES: "add the package charges",
  };
  return `${scopes[calculationScope] || formatEnumLabel(calculationScope)}; ${aggregations[aggregation] || formatEnumLabel(aggregation)}`;
}

export function formatEnumLabel(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}
