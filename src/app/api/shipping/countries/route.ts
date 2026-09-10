import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-response";
import { listShippingChannels } from "@/lib/hiobuy";
import { collectDestinationCountryCodes } from "@/lib/shipping-destinations";
import type { ChannelCatalog } from "@/lib/shipping-types";

export async function GET() {
  try {
    const pages: ChannelCatalog[] = [];
    const seenPages = new Set<number>();
    let page = 1;
    let hasMore = true;
    // Do not filter by country: this endpoint discovers coverage across the full catalog.
    while (hasMore) {
      if (seenPages.has(page)) throw new Error("Shipping channel pagination repeated a page.");
      seenPages.add(page);
      const catalog = await listShippingChannels({ include: ["regions"], page, pageSize: 50 });
      pages.push(catalog);
      hasMore = catalog.pagination.has_more;
      page += 1;
      if (page > 100 && hasMore) throw new Error("Shipping channel pagination exceeded the 100-page safety limit.");
    }
    return NextResponse.json({ countries: collectDestinationCountryCodes(pages) });
  } catch (error) {
    return jsonError(error);
  }
}
