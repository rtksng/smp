# SMP Customer Mobile

Expo Router customer application for Surgical Medical Equipment. It follows the
customer web app's mobile visual system and uses the same `/api/v1` customer
contracts for authentication, catalog, cart, addresses, checkout, payments, and
orders.

## Configure

Copy `.env.example` to `.env` and set:

```dotenv
EXPO_PUBLIC_API_URL=https://smp-production-bfda.up.railway.app/api/v1
```

Use `10.0.2.2` for an Android emulator, `localhost` for iOS Simulator, or the
development machine's LAN IP for a physical device. Production builds must use
the public HTTPS API URL. iOS development builds include a local-network usage
description and permit local-network HTTP only for development API access.

The visual reference is the current mobile viewport of `apps/web`: its home
rails, full-width category and product images, catalog filters and pagination,
account sections, footer, and shopping actions. Native routes map web product
listings and category filters to `/search`, with the same customer API data.

Invoices use an authenticated PDF request and the native share sheet. Product
and category images retain their absolute Railway storage URLs on native;
the website's relative `/uploads` proxy is specific to the web app.

## Run and validate

From the monorepo root:

```sh
corepack pnpm --filter @surgical/mobile dev
corepack pnpm --filter @surgical/mobile test
corepack pnpm --filter @surgical/mobile lint
corepack pnpm --filter @surgical/mobile typecheck
corepack pnpm --filter @surgical/mobile build
corepack pnpm --filter @surgical/mobile build:ios
```

Catalog, authentication, cart, COD checkout, addresses, and order management can
run in Expo Go. Online checkout uses the official Razorpay React Native native
module, so test and release it from a development or production native build:

```sh
corepack pnpm --filter @surgical/mobile android
corepack pnpm --filter @surgical/mobile ios
```

The iOS build config supports iPhone and iPad rotation, Keychain-backed session
storage, keyboard-safe forms, SMS one-time-code autofill and paste, and the UPI
application schemes required by Razorpay Checkout. A Mac with Xcode is required
for the iOS Simulator or a local signed iOS build; Windows can still validate
the JavaScript iOS export and generated Expo configuration.
