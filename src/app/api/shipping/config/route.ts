import { NextResponse } from "next/server";

export async function GET() {
  const configuredCurrency = process.env.SHIPPING_DISPLAY_CURRENCY?.trim().toUpperCase() || "USD";
  const configuredRate = Number(process.env.SHIPPING_CNY_EXCHANGE_RATE || "0.14");
  return NextResponse.json({
    display_currency: /^[A-Z]{3}$/.test(configuredCurrency) ? configuredCurrency : "USD",
    cny_exchange_rate: Number.isFinite(configuredRate) && configuredRate > 0 ? configuredRate : 0.14,
  });
}
