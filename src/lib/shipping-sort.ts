import type { ShippingQuote } from "./shipping-types";

export type QuoteSortField = "price" | "transit";
export type SortDirection = "asc" | "desc";
export type QuoteSortOptions = {
  primary: QuoteSortField;
  priceDirection: SortDirection;
  transitDirection: SortDirection;
};

function priceValue(quote: ShippingQuote): number | null {
  return quote.total?.amount ?? quote.known_total?.amount ?? null;
}

function transitValue(quote: ShippingQuote): number | null {
  return quote.transit_time?.min_business_days ?? quote.transit_time?.min_days ?? null;
}

function compareNullable(left: number | null, right: number | null, direction: SortDirection): number {
  // Missing values stay last in both directions so incomplete quotes never look best.
  if (left == null && right == null) return 0;
  if (left == null) return 1;
  if (right == null) return -1;
  return direction === "asc" ? left - right : right - left;
}

export function sortShippingQuotes(quotes: ShippingQuote[], options: QuoteSortOptions): ShippingQuote[] {
  const fields: QuoteSortField[] = options.primary === "price" ? ["price", "transit"] : ["transit", "price"];
  return [...quotes].sort((left, right) => {
    for (const field of fields) {
      const comparison = field === "price"
        ? compareNullable(priceValue(left), priceValue(right), options.priceDirection)
        : compareNullable(transitValue(left), transitValue(right), options.transitDirection);
      if (comparison !== 0) return comparison;
    }
    return left.channel.code.localeCompare(right.channel.code);
  });
}
