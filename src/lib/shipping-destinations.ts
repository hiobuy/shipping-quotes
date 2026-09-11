import type { FulfillmentLocation } from "./shipping-types";

/** Destination coverage comes from active fulfillment locations; invalid codes are ignored. */
export function collectDestinationCountryCodes(locations: FulfillmentLocation[]): string[] {
  const codes = new Set<string>();
  for (const location of locations) {
    for (const rawCode of location.supported_destinations ?? []) {
      const code = rawCode.trim().toUpperCase();
      if (/^[A-Z]{2}$/.test(code)) codes.add(code);
    }
  }
  return [...codes];
}

export function reconcileSelectedCountry(current: string, available: string[]): string {
  if (available.includes(current)) return current;
  if (available.includes("US")) return "US";
  return available[0] || "";
}
