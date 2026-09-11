import { buildShippingChannelDetailPath, parseFlatChannelDetail, readBusinessFailure } from "./shipping-api-contract";
import type { ShippingChannelDetailOptions } from "./shipping-api-contract";
import type { ChannelCatalog, FulfillmentLocationCatalog, ShippingChannel, ShippingQuoteInput, ShippingQuoteResponse } from "./shipping-types";
export { buildShippingChannelDetailPath } from "./shipping-api-contract";

export class HiobuyApiError extends Error {
  constructor(message: string, public status: number, public code?: string, public requestId?: string) {
    super(message);
    this.name = "HiobuyApiError";
  }
}

function requireApiKey(): string {
  const key = process.env.HIOBUY_API_KEY?.trim();
  if (!key || key === "your_api_key_here" || key.includes("xxxxxxxx")) {
    throw new HiobuyApiError("Missing HIOBUY_API_KEY. Copy .env.example to .env.local and add a Developer Portal API key.", 500, "MISSING_API_KEY");
  }
  return key;
}

function apiBase(): string {
  return (process.env.HIOBUY_API_BASE_URL || "https://api.hiobuy.com").replace(/\/$/, "");
}

function defaultLanguage(): string {
  return process.env.HIOBUY_DEFAULT_LANGUAGE?.trim() || "en";
}

/** Only server Route Handlers call this function, so the Bearer token never reaches the browser. */
async function hiobuyRequest<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${apiBase()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${requireApiKey()}`,
      Accept: "application/json",
      Language: defaultLanguage(),
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
    cache: "no-store",
  });
  const body = (await response.json().catch(() => ({}))) as {
    success?: boolean;
    code?: string;
    msg?: string;
    error?: { code?: string; message?: string; request_id?: string };
    request_id?: string;
  };
  if (!response.ok) {
    throw new HiobuyApiError(body.error?.message || `HIOBuy API error (${response.status})`, response.status, body.error?.code, body.error?.request_id || body.request_id);
  }
  const businessFailure = readBusinessFailure(body);
  if (businessFailure) {
    throw new HiobuyApiError(businessFailure.message, 422, businessFailure.code, businessFailure.requestId);
  }
  return body as T;
}

export type ShippingChannelListOptions = { countryCode?: string; include?: Array<"regions" | "services" | "rate_cards" | "rules">; page?: number; pageSize?: number };

export async function listShippingChannels(options: ShippingChannelListOptions = {}): Promise<ChannelCatalog> {
  const params = new URLSearchParams({ page: String(options.page ?? 1), page_size: String(options.pageSize ?? 50) });
  if (options.countryCode) params.set("country_code", options.countryCode);
  if (options.include?.length) params.set("include", options.include.join(","));
  return hiobuyRequest<ChannelCatalog>(`/v1/fulfillment/shipping/channels?${params}`, { method: "GET" });
}

export async function listFulfillmentLocations(): Promise<FulfillmentLocationCatalog> {
  return hiobuyRequest<FulfillmentLocationCatalog>("/v1/fulfillment/locations?status=ACTIVE", { method: "GET" });
}

/** Detail is a flat channel object; there is no data or pagination wrapper. */
export async function getShippingChannelDetail(code: string, options?: ShippingChannelDetailOptions): Promise<ShippingChannel> {
  const body = await hiobuyRequest<ShippingChannel>(buildShippingChannelDetailPath(code, options), { method: "GET" });
  return parseFlatChannelDetail(body);
}

export async function getShippingQuotes(input: ShippingQuoteInput): Promise<ShippingQuoteResponse> {
  return hiobuyRequest<ShippingQuoteResponse>("/v1/fulfillment/shipping/quotes", { method: "POST", body: JSON.stringify(input) });
}
