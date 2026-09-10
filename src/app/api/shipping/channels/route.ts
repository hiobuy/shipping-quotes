import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-response";
import { listShippingChannels } from "@/lib/hiobuy";

export async function GET(request: Request) {
  try {
    const countryCode = new URL(request.url).searchParams.get("country_code")?.trim().toUpperCase();
    return NextResponse.json(await listShippingChannels({ countryCode }));
  } catch (error) { return jsonError(error); }
}
