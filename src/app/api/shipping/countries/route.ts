import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-response";
import { listFulfillmentLocations } from "@/lib/hiobuy";
import { collectDestinationCountryCodes } from "@/lib/shipping-destinations";

export async function GET() {
  try {
    const locations = await listFulfillmentLocations();
    return NextResponse.json({ countries: collectDestinationCountryCodes(locations.data ?? []) });
  } catch (error) {
    return jsonError(error);
  }
}
