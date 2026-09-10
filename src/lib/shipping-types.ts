export type Money = { amount: number; currency: "CNY" };
export type Quantity = { value: number; unit: "KG" | "M3" | "KG_PER_M3" };

export type ReferenceTransitTime = {
  text?: string;
  min_business_days?: number;
  max_business_days?: number;
  min_days?: number;
  max_days?: number;
  day_type?: string;
};

export type ShippingRegion = {
  code: string;
  name: string;
  match_type: "COUNTRY_REGION" | "POSTAL_CODE";
  countries: string[];
  postal_code_required: boolean;
  reference_transit_time: ReferenceTransitTime | null;
};

export type ServiceRegionPrice = {
  region_code: string;
  value: number;
  value_unit: "PERCENT" | "MINOR_UNIT";
  fixed_charge: Money;
};

export type ValueAddedService = {
  code: string;
  name: string;
  description?: string | null;
  request_mode: "MANDATORY" | "OPTIONAL";
  pricing_type: string;
  pricing_scope: string;
  pricing_basis: string;
  region_prices: ServiceRegionPrice[];
  final_quote_required: boolean;
  may_be_adjusted: boolean;
};

export type RateCard = {
  region_code: string;
  billing_basis: string;
  calculation_model: string;
  quantity_unit: string;
  currency?: string;
  supported_range?: { minimum: Quantity; maximum: Quantity; out_of_range_behavior?: string };
  out_of_range_behavior?: string;
  reference_only: boolean;
  price_rows: Array<{
    type: string;
    pricing_basis?: string | null;
    range?: { minimum: number; maximum: number; unit: string; minimum_inclusive?: boolean; maximum_inclusive?: boolean };
    first_quantity?: Quantity;
    step?: Quantity;
    charge: Money;
  }>;
};

export type ChannelRule = {
  code?: string | null;
  rule_id?: string | null;
  name: string;
  rule_type?: string | null;
  charge_mode?: string | null;
  charge_value?: number | Money | null;
  min_charge?: Money | null;
  max_charge?: Money | null;
};

export type ShippingChannel = {
  success?: boolean;
  msg?: string;
  code: string;
  name: string;
  description?: string | null;
  logo_url?: string | null;
  status?: string;
  tags?: string[];
  warehouse?: { code: string; name: string };
  capabilities?: {
    delivery_methods: string[];
    multi_package_supported: boolean;
    tracking_supported: boolean;
    shipping_label_supported: boolean;
  };
  billing?: {
    basis: string;
    calculation_model: string;
    quantity_unit: string;
    supported_range: { minimum: Quantity; maximum: Quantity; out_of_range_behavior: string };
    minimum: Quantity & { ceil_to_minimum: boolean };
    rounding: { single_package_step: Quantity; multi_package_step: Quantity; ignore_below: Quantity };
    multi_package: { mode: string; calculation_scope: string; aggregation: string; minimum_per_package: Quantity; minimum_total: Quantity };
    volumetric_weight: { enabled: boolean; divisor: number | null; average_with_actual: boolean; exemption: unknown };
    range_right_closed: boolean;
  };
  regions?: ShippingRegion[];
  rate_cards?: RateCard[];
  value_added_services?: ValueAddedService[];
  rule_summary?: {
    aggregation: "SUM_ALL" | "HIGHEST_ONLY";
    cap: Money | null;
    has_surcharges: boolean;
    has_order_restrictions: boolean;
    has_dispatch_restrictions: boolean;
    evaluated_by_quote: boolean;
  };
  channel_rules?: { aggregation: "SUM_ALL" | "HIGHEST_ONLY"; cap: Money | null; items: ChannelRule[] };
  final_quote_required?: boolean;
  config_updated_at?: string;
};

export type ChannelCatalog = {
  items: ShippingChannel[];
  pagination: { page: number; page_size: number; total: number; has_more: boolean };
  monetary_unit: "CNY_minor";
  generated_at: string;
  request_id: string;
};

export type QuoteWarning = { code?: string; message?: string; affects?: string[] };
export type ChargeGroup = { amount?: number | null; known_amount?: number; currency?: string; items?: Array<{ name?: string; amount?: Money | null }> };
export type ShippingQuote = {
  channel: ShippingChannel;
  available: boolean;
  quote_status: "COMPLETE" | "PARTIAL" | "REVIEW_REQUIRED" | "UNAVAILABLE";
  unavailable_reason?: { code?: string; message?: string } | null;
  matched_region?: { code?: string; name?: string; match_type?: string } | null;
  weights?: { actual?: { value: number; unit: string }; volumetric?: { value: number; unit: string }; chargeable?: { value: number; unit: string } } | null;
  transit_time?: ReferenceTransitTime | null;
  charges?: { base_freight?: Money; channel_services?: ChargeGroup; channel_rules?: ChargeGroup; outbound_services?: ChargeGroup; inbound_services?: ChargeGroup; adjustments?: ChargeGroup } | null;
  total?: Money | null;
  known_total: Money;
  warnings?: QuoteWarning[];
};

export type ShippingQuoteResponse = {
  success: boolean;
  estimate_type: "DECLARED";
  completeness?: { level?: string; [key: string]: unknown };
  warnings?: QuoteWarning[];
  quotes: ShippingQuote[];
  generated_at?: string;
  request_id?: string;
  disclaimer?: string;
  display_currency?: string;
  cny_exchange_rate?: number;
};

export type ShippingQuoteInput = {
  destination: { country_code: string; subdivision_code?: string; postal_code?: string };
  weight_kg: number;
  length_cm?: number;
  width_cm?: number;
  height_cm?: number;
  declared_value?: Money;
  channel_codes?: string[];
  services?: { channel: Array<{ code: string; quantity: number }> };
};
