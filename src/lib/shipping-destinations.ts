import type { ChannelCatalog } from "./shipping-types";

/** Country coverage comes from every visible channel page; invalid codes are ignored. */
export function collectDestinationCountryCodes(catalogs: ChannelCatalog[]): string[] {
  const codes = new Set<string>();
  for (const catalog of catalogs) {
    for (const channel of catalog.items ?? []) {
      for (const region of channel.regions ?? []) {
        for (const rawCode of region.countries ?? []) {
          const code = rawCode.trim().toUpperCase();
          if (/^[A-Z]{2}$/.test(code)) codes.add(code);
        }
      }
    }
  }
  return [...codes];
}

export function reconcileSelectedCountry(current: string, available: string[]): string {
  if (available.includes(current)) return current;
  if (available.includes("US")) return "US";
  return available[0] || "";
}
