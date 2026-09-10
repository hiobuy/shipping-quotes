export type ChannelDetailInclude = "regions" | "services" | "rate_cards" | "rules";

export type ShippingChannelDetailOptions = {
  countryCode?: string;
  include?: ChannelDetailInclude[];
};

export function buildShippingChannelDetailPath(code: string, options: ShippingChannelDetailOptions = {}): string {
  const params = new URLSearchParams();
  if (options.countryCode) params.set("country_code", options.countryCode);
  params.set("include", (options.include ?? ["regions", "services", "rate_cards"]).join(","));
  return `/v1/fulfillment/shipping/channels/${encodeURIComponent(code)}?${params.toString()}`;
}

export type BusinessFailure = { code?: string; message: string; requestId?: string };

/** Warehouse business errors may use HTTP 200, so success must be inspected. */
export function readBusinessFailure(body: unknown): BusinessFailure | null {
  if (!body || typeof body !== "object" || !("success" in body) || (body as { success?: unknown }).success !== false) return null;
  const record = body as { code?: unknown; msg?: unknown; request_id?: unknown; error?: { code?: unknown; message?: unknown; request_id?: unknown } };
  return {
    code: typeof record.code === "string" ? record.code : typeof record.error?.code === "string" ? record.error.code : undefined,
    message: typeof record.msg === "string" ? record.msg : typeof record.error?.message === "string" ? record.error.message : "HIOBuy API business error",
    requestId: typeof record.request_id === "string" ? record.request_id : typeof record.error?.request_id === "string" ? record.error.request_id : undefined,
  };
}

/** A successful detail response is already flat; never unwrap data. */
export function parseFlatChannelDetail<T extends { code?: string }>(body: T): T {
  return body;
}
