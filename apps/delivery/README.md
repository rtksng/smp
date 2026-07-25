# Surgical Delivery

Expo Router delivery-partner app for OTP authentication, assignment handling,
COD collection, proof-of-delivery upload, location attachment, offline status
queueing, and push-device registration.

## Runtime configuration

- `EXPO_PUBLIC_API_URL` must point to the API version root, for example
  `https://api.example.com/api/v1`. The local iOS simulator fallback is
  `http://localhost:4000/api/v1`; production builds should always use HTTPS.
- `EXPO_PUBLIC_EAS_PROJECT_ID` should be the EAS project UUID used to obtain an
  Expo push token. EAS builds can also supply this through
  `Constants.easConfig.projectId`. Push registration is skipped when no project
  identity is available rather than prompting for a permission the app cannot
  use.

The iOS app also needs APNs credentials attached to the EAS project. Camera,
Photos, foreground Location, and notification permissions are requested only
when the related delivery workflow needs them.

## Validation

```powershell
corepack pnpm --filter @surgical/delivery lint
corepack pnpm --filter @surgical/delivery typecheck
corepack pnpm --filter @surgical/delivery test
corepack pnpm --filter @surgical/delivery exec expo install --check
corepack pnpm --filter @surgical/delivery build:ios
```

`expo run:ios`, signing, APNs receipt, camera capture, Photos selection,
location accuracy, phone calls, and Apple Maps handoff require macOS and/or a
physical iPhone for final release QA.
