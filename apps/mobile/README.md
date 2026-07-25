# SMP Customer Mobile

Expo Router customer application for Surgical Medical Equipment. It follows the
customer web app's mobile visual system and uses the same `/api/v1` customer
contracts for authentication, catalog, cart, addresses, checkout, payments, and
orders.

## Configure

Copy `.env.example` to `.env` and set:

```dotenv
EXPO_PUBLIC_API_URL=http://10.0.2.2:4000/api/v1
```

Use `10.0.2.2` for an Android emulator, `localhost` for iOS Simulator, or the
development machine's LAN IP for a physical device. Production builds must use
the public HTTPS API URL. iOS development builds include a local-network usage
description and permit local-network HTTP only for development API access.

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
