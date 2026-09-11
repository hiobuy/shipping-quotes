# HIOBuy Shipping Quotes Demo

[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A developer reference implementation for discovering available shipping channels, inspecting channel details, and estimating international shipping costs with the HIOBuy Fulfillment API.

Built with Next.js and designed to keep your HIOBuy API key server-side.

## Live demo

[HioBuy Shipping Quotes Live Demo](https://shipping-quotes.demo.hiobuy.com)

## What this demo covers

This repository demonstrates three core shipping APIs:

* Discover shipping channels available to your warehouse.
* Inspect channel regions, transit time, billing configuration, services, rate cards, and channel rules.
* Estimate international shipping costs using destination, package, declared-value, and service data.

Shipment creation, payment, and tracking are intentionally outside the scope of this demo.

## Features

* Lists shipping channels available to the warehouse associated with the API key.
* Discovers destination countries dynamically from available channel regions.
* Displays structured channel configuration and reference transit times.
* Calculates shipping estimates using declared package data.
* Supports price and transit-time sorting in ascending or descending order.
* Supports optional channel services and declared-value-based services.
* Keeps `HIOBUY_API_KEY` inside server-only Next.js Route Handlers.
* Converts CNY API amounts into a configurable display currency.
* Handles both HTTP transport errors and HIOBuy business-level errors.
* Hides unavailable quotes from shopper-facing results while preserving the API contract server-side.

## Quick start

Requirements:

* Node.js 20 or newer
* pnpm
* A HIOBuy Developer API key

Clone the repository:

```bash
git clone https://github.com/hiobuy/shipping-quotes.git
cd shipping-quotes
```

Create your local environment file and start the development server:

```bash
cp .env.example .env.local
pnpm install
pnpm dev
```

Add your sandbox or test API key to `.env.local`:

```env
HIOBUY_API_KEY=your_api_key_here
```

Then open:

```text
http://localhost:3000
```

## Environment variables

| Variable                     | Required | Example                  | Purpose                                      |
| ---------------------------- | -------- | ------------------------ | -------------------------------------------- |
| `HIOBUY_API_KEY`             | Yes      | `your_api_key_here`      | Server-only HIOBuy Developer API key.        |
| `HIOBUY_API_BASE_URL`        | No       | `https://api.hiobuy.com` | HIOBuy API origin.                           |
| `HIOBUY_DEFAULT_LANGUAGE`    | No       | `en`                     | Value sent in the `Language` request header. |
| `SHIPPING_DISPLAY_CURRENCY`  | No       | `USD`                    | ISO 4217 currency displayed by the demo UI.  |
| `SHIPPING_CNY_EXCHANGE_RATE` | No       | `0.14`                   | Target-currency units for one CNY.           |

### Display currency

HIOBuy shipping money objects use CNY minor units.

For example:

```json
{
  "amount": 1250,
  "currency": "CNY"
}
```

represents:

```text
¥12.50
```

If:

```env
SHIPPING_CNY_EXCHANGE_RATE=0.14
```

the demo interprets this as:

```text
1 CNY = 0.14 USD
```

Display conversion:

```text
(CNY minor units ÷ 100) × exchange rate
```

Declared-value conversion works in the opposite direction:

```text
entered display currency ÷ exchange rate = CNY
```

The CNY result is converted to minor units before being submitted to the API.

For example, with a `0.14` USD exchange rate:

```text
14 USD → 100 CNY → 10000 CNY minor units
```

The configured exchange rate is for demonstration purposes only. It is not a live foreign-exchange feed.

## API coverage

| Purpose           | HIOBuy API                                                      | Local demo endpoint                                  |
| ----------------- | --------------------------------------------------------------- | ---------------------------------------------------- |
| Channel catalog   | `GET /v1/fulfillment/shipping/channels`                         | `GET /api/shipping/channels`                         |
| Channel detail    | `GET /v1/fulfillment/shipping/channels/{shipping_channel_code}` | `GET /api/shipping/channels/{shipping_channel_code}` |
| Shipping estimate | `POST /v1/fulfillment/shipping/quotes`                          | `POST /api/shipping/quotes`                          |

## Request flow

The browser never calls the HIOBuy API directly.

```text
Browser
  │
  ▼
Next.js /api/shipping/*
  │
  │ Authorization: Bearer <server-only API key>
  ▼
HIOBuy Fulfillment API
  │
  ▼
https://api.hiobuy.com/v1/fulfillment/shipping/*
```

`HIOBUY_API_KEY` remains on the server and is never exposed to browser JavaScript.

Channel codes are URL-encoded before being passed into the public channel-detail path.

## Destination discovery

The destination selector is generated from the active fulfillment locations rather than from a hard-coded global country list.

The server requests:

```http
GET /v1/fulfillment/locations?status=ACTIVE
```

It then collects, validates, normalizes, and deduplicates:

```text
data[].supported_destinations[]
```

Country values remain ISO 3166-1 alpha-2 codes. The browser may use `Intl.DisplayNames` to display localized country names.

This represents destination coverage reported by the active fulfillment locations visible to the warehouse associated with the current API key.

It does **not** guarantee that a particular shipment can use a destination.

Actual availability may depend on:

* postal code
* package weight
* package dimensions
* product characteristics
* selected services
* channel rules
* warehouse configuration

`POST /v1/fulfillment/shipping/quotes` is authoritative for shipment-specific availability and pricing.

## Channel details

The channel detail view can display:

* warehouse identity
* supported regions and countries
* channel capabilities
* billing basis and billing model
* quantity unit and supported range
* minimum charges
* rounding rules
* multi-package scope
* volumetric-weight rules
* structured reference transit time
* complete reference price rows, grouped by billing range where required
* available services
* channel rule details

By default, the demo requests:

```text
regions,services,rate_cards,rules
```

The detail request loads these expansions together so the dialog does not require a second action to reveal its rules.

## Transit time

Structured transit-time fields are preferred:

```text
reference_transit_time.min_business_days
reference_transit_time.max_business_days
```

A single value is displayed as:

```text
5 business days
```

A range is displayed as:

```text
5–8 business days
```

The compatibility `text` value is used only when structured transit-time values are unavailable.

Transit times are estimates and should not be treated as guaranteed delivery dates.

## Shipping quotes

Shipping quotes are shipment-specific.

Reference rate cards are useful for understanding a channel's pricing structure, but they should not be used as the final shipping price.

Use:

```http
POST /v1/fulfillment/shipping/quotes
```

for shipment-specific availability and estimated charges.

Quotes may depend on:

* destination
* package weight
* package dimensions
* chargeable weight
* declared value
* selected services
* channel rules

Final shipping charges may change after warehouse measurement, packing, or service review.

## Optional services

Channel services may be:

```text
MANDATORY
```

or:

```text
OPTIONAL
```

Percentage values are already expressed as percentage points.

For example:

```text
10
```

means:

```text
10%
```

not `1000%`.

Service pricing may be based on:

* base freight
* declared value
* fixed amount per shipment
* fixed amount per box
* chargeable-weight units

If a selected service requires declared value, the demo requires the user to provide it before requesting a quote.

The quote request always sends:

```text
services.channel
```

When all optional services are removed, the demo sends an empty array rather than omitting the field. This prevents provider defaults from being unintentionally reapplied.

## Rule aggregation

The demo understands the following rule aggregation modes.

### `SUM_ALL`

Every matched and calculable charge is added to the quote.

### `HIGHEST_ONLY`

Matched charges are compared and only the highest applicable charge is used.

Equal highest amounts are considered equivalent.

### Caps

```text
cap: null
```

or:

```text
cap.amount: 0
```

means that no cap is applied.

Pending or inapplicable rules do not contribute to the quote total.

## Error handling

HIOBuy transport errors use standard HTTP status codes and the standard API error object.

Some warehouse business failures may return HTTP `200` with:

```json
{
  "success": false
}
```

The server client therefore checks both:

* HTTP status
* response body

A missing, invisible, or country-filtered shipping channel is exposed locally as:

```json
{
  "error": {
    "code": "CHANNEL_NOT_FOUND",
    "message": "Shipping channel not found.",
    "request_id": "..."
  }
}
```

The demo intentionally keeps error handling on the server so developers have one normalized browser-facing error path.

## Project structure

```text
src/
  app/
    api/
      shipping/                     # Server-only Route Handlers

  components/
    channel-details.tsx             # Channel configuration/details
    shipping-calculator.tsx         # Shipping quote UI

  lib/
    hiobuy.ts                       # Authenticated HIOBuy server client
    shipping-api-contract.ts        # API contract helpers
    shipping-format.ts              # Money, transit and service formatting
    shipping-types.ts               # Normalized public API types

tests/
  shipping-contract.test.ts
```

## Security

The demo intentionally proxies HIOBuy requests through server-side Next.js Route Handlers.

For production applications:

* Never expose `HIOBUY_API_KEY` to the browser.
* Never prefix the API key with `NEXT_PUBLIC_`.
* Store production keys in your deployment platform's secret manager.
* Do not log authorization headers or environment variables.
* Keep `.env.local`, `.next`, and logs out of Git.
* Apply application-level rate limiting before exposing public proxy endpoints.
* Add appropriate monitoring and abuse protection.

## Limitations

This repository is a reference implementation, not a production shipping application.

Keep in mind:

* Shipping quotes are estimates based on declared shipment data.
* Final charges may change after warehouse measurement and packing.
* Transit times are estimates.
* Destination availability is derived from channels visible to the current warehouse and API key and should not be treated as a complete list of globally supported destinations.
* The configured exchange rate is static and may become stale.
* Reference rate cards explain configured pricing but must not be used to reproduce final quote calculations in the browser.
* Production applications should implement their own authentication, authorization, rate limiting, monitoring, and business rules.

## Documentation

For the complete API contract and additional HIOBuy capabilities, see:

* [HioBuy Shipping Quotes API documentation](https://hiobuy.com/en/api-docs/fulfillment-freight-estimate)
* [HioBuy Developer Platform](https://developers.hiobuy.com)
* [HioBuy OpenAPI document](https://api.hiobuy.com/openapi.json)

## Related HIOBuy examples

This repository focuses specifically on **shipping channel discovery and shipping quotes**.

Other HIOBuy API capabilities, including shipment lifecycle and tracking, may be provided as separate examples so each repository remains small, focused, and easy to understand.

## License

This project is licensed under the [MIT License](LICENSE).
