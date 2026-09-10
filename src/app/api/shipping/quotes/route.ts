import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-response";
import { getShippingQuotes } from "@/lib/hiobuy";
import type { ShippingQuoteInput } from "@/lib/shipping-types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<ShippingQuoteInput>;
    const country = body.destination?.country_code?.trim().toUpperCase();
    if (!country || !/^[A-Z]{2}$/.test(country)) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Please choose a destination country." } }, { status: 400 });
    if (!body.weight_kg || body.weight_kg <= 0) return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Weight must be greater than 0 kg." } }, { status: 400 });
    const data = await getShippingQuotes({ ...body, destination: { ...body.destination!, country_code: country }, weight_kg: Number(body.weight_kg) } as ShippingQuoteInput);
    const configuredCurrency = process.env.SHIPPING_DISPLAY_CURRENCY?.trim().toUpperCase() || "USD";
    const configuredRate = Number(process.env.SHIPPING_CNY_EXCHANGE_RATE || "0.14");
    const displayCurrency = /^[A-Z]{3}$/.test(configuredCurrency) ? configuredCurrency : "USD";
    const cnyExchangeRate = Number.isFinite(configuredRate) && configuredRate > 0 ? configuredRate : 0.14;
    return NextResponse.json({ ...data, display_currency: displayCurrency, cny_exchange_rate: cnyExchangeRate });
  } catch (error) { return jsonError(error); }
}
