# Sykerbos Site / App Prototype Status

_Last updated: 2026-10-13_

This file is the working implementation map for the current prototype. It distinguishes working navigation from visual/demo-only elements so we do not lose track as the interface grows.

## Working now

### Public site
- `index.html` public Sykerbos landing page
- Responsive desktop / tablet / phone layout
- Main in-page navigation:
  - VyTile
  - How it works
  - Herbarium section
  - Commercial section
  - About / What’s Growing section
- `Set up VyTile` opens onboarding
- `Preview setup` opens onboarding
- GitHub Pages deployment from `main`

### Onboarding
- `start.html`
- 10-step guided setup flow
- Visible Back / Continue controls
- Horizontal swipe navigation on mobile
- Browser Back moves through onboarding state
- Local progress persistence
- Plant name persistence
- Finish setup sends user to `app.html`
- Current prototype steps:
  1. Welcome
  2. Power VyTile
  3. Find / select VyTile
  4. Account
  5. Wi-Fi
  6. Choose plant
  7. Name plant
  8. Place pot on VyTile
  9. Stable reading
  10. Sykerbos learning / setup complete

### App prototype
- `app.html`
- Home is the default dashboard
- Plant name is carried over from onboarding
- Responsive desktop and mobile navigation
- Summary / current plant card
- Demo dry-down / irrigation-derived metrics
- Live latest weight and temperature for claimed devices
- Demo weight-trend visual
- Sykerbos learning state
- Your Plants section
- Add another VyTile links back to onboarding
- Plant recommendation cards
- Want-to-grow buttons toggle locally
- Device status teaser
- Secure one-time Alpha claim flow via Supabase Edge Function
- Email/password account creation and sign-in
- Guest/anonymous sign-in UI (requires Supabase Anonymous Sign-Ins toggle)
- Supabase user/device ownership schema with RLS
- Plants backend model with plant ↔ device assignment, primary plant, display order, and RLS
- Existing Alpha readings backfilled to registered devices
- Dedicated plant detail page with Today / Intelligence / Herbarium tabs
- Herbarium index page
- Rosemary Herbarium dossier based on locked 7-section template
- Reference Herbarium entries for Basil, Thyme, Mint, and Oregano

## Prototype / not yet connected to real systems

These elements look functional but currently use demo or placeholder behaviour:

- Bluetooth discovery
- Device identity / QR claiming
- Google / Apple sign-in
- Wi-Fi network scanning
- Wi-Fi password entry and secure provisioning
- Real temperature / weight / dry-down calculations
- Irrigation-event recognition
- Prediction engine
- Herbarium database
- Plant search / identification
- User wishlist persistence
- Achievements / badges
- Device settings
- Firmware version reporting
- Firmware update / OTA
- Notifications
- Subscription / purchasing

## Known dead-end or placeholder links

### Public site
- `Explore commercial →` — placeholder
- Product `Get VyTile` / purchase path — no commerce yet

### App
- Desktop `Plants`, `Herbarium`, and `Settings` currently jump to sections on Home rather than dedicated pages
- Mobile nav does the same
- `See what Sykerbos is learning →` — placeholder
- `Browse Herbarium →` — placeholder
- `Device settings` — visual button only
- Weight-trend selector — visual button only

## Visual placeholders to replace

- Placeholder plant thumbnails
- Placeholder product-range illustrations
- Demo chart
- Temporary icons / symbols

## Locked UX decisions

- Sykerbos is the ecosystem; VyTile is the physical product.
- Consumer experience is plant-first, not device-first.
- Home is the normal landing page after onboarding and on future app opens.
- Onboarding supports swipe but never relies on swipe alone.
- Progress is resumable.
- Phone layouts may scroll; do not compress content just to fit one viewport.
- Interface should summarize first, explain second, expose raw data on demand.
- Avoid spreadsheet / control-room visual language.
- Herbarium is collectible and educational.
- Plant achievements are based on observed behaviour, not arbitrary clicks.
- Users may mark plants as `Want to grow`.
- Future recommendations can use habitat and observed growing style.

## Next build targets

1. Bind claimed VyTiles to real plant records, then redesign Home around a primary plant plus the rest of the user's plants.
2. Replace remaining placeholder plant/product imagery as approved assets become available.
3. Separate authenticated app into `sykerbos-app` once the UX stabilizes.
4. Create `vytile-firmware` repository with semantic firmware versions.
5. Claim current Alpha devices to the first real user account, then connect command queue and richer telemetry history.

## Architecture direction

- `sykerbos-site` → public website at `sykerbos.com`
- `sykerbos-app` → authenticated application at `app.sykerbos.com`
- `vytile-firmware` → ESP32 firmware, releases, build artifacts and later OTA

The current `app.html` remains inside this repository intentionally while the product UX is being prototyped quickly.
