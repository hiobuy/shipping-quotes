import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-response";
import { getShippingChannelDetail } from "@/lib/hiobuy";

const allowedIncludes = new Set(["regions", "services", "rate_cards", "rules"]);

export async function GET(request: Request, context: { params: Promise<{ shipping_channel_code: string }> }) {
  try {
    const { shipping_channel_code: code } = await context.params;
    const search = new URL(request.url).searchParams;
    const include = (search.get("include") || "regions,services,rate_cards").split(",").map((item) => item.trim()).filter((item) => allowedIncludes.has(item)) as Array<"regions" | "services" | "rate_cards" | "rules">;
    const countryCode = search.get("country_code")?.trim().toUpperCase();
    const channel = await getShippingChannelDetail(code, { countryCode, include });
    return NextResponse.json(channel);
  } catch (error) {
    return jsonError(error);
  }
}
