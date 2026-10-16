# Sykerbos Site / App Prototype Status

_Last updated: 2026-10-14_

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
- Public-site `My Sykerbos` entry opens sign-in or redirects an existing session to the dashboard
- `Preview setup` opens onboarding
- GitHub Pages deployment from `main`
- Approved hero imagery is now wired into the main hero, VyTile range, and commercial section
- VyTile now has a dedicated brand-within-brand lockup in the product range section, reinforcing Sykerbos as ecosystem/master brand and VyTile as the physical sensing family
- Public app-preview cards now use Herbarium plant imagery

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
- Plant identity is loaded from the authenticated user's Supabase plant records
- Responsive desktop and mobile navigation
- App Herbarium navigation now consistently opens the dedicated Herbarium page
- Summary / current plant card
- Live 6-hour and 12-hour net weight change from Supabase readings, anchored to the latest actual device reading and suppressed when the requested window is not covered
- Live latest weight and temperature for claimed devices
- Home dashboard reads real plant records and filters short-term telemetry to the active `run_id` so historical experiments/reboots are not mixed into the live graph
- Live seven-day weight-trend visual
- Sykerbos learning state
- Your Plants section
- Add another VyTile links back to onboarding
- Plant recommendation cards
- Want-to-grow buttons toggle locally
- Device status teaser
- Secure Alpha claim flow exists in backend; claimed-user dashboard no longer shows the temporary claim panel
- Email/password account creation and sign-in
- Guest/anonymous sign-in UI (requires Supabase Anonymous Sign-Ins toggle)
- Supabase user/device ownership schema with RLS
- Plants backend model with plant ↔ device assignment, primary plant, display order, and RLS
- Plant water-learning fields now separate provisional and learned dry/saturated thresholds; `plant_cycles` table is ready to store repeatable irrigation/dry-down cycles
- Plant assignment screen for claimed VyTiles, including main-plant selection
- Existing Alpha readings backfilled to registered devices
- Dedicated plant detail page now loads the selected Supabase plant, real telemetry history, observed range and Herbarium asset
- Plant detail page now filters chart data to the active run and shows a single current-use dry-down rate, recent movement, and projected reserve window
- Intelligence tab now visualizes the experimental dry-down signature, reserve thresholds/current position, evidence summary, and cycle-based confidence growth
- Reserve map now runs saturated/wet → dry left-to-right (blue → green → yellow → orange), positions labels at their actual weights, and preserves null thresholds instead of incorrectly rendering missing values as 0 g
- Valencia-orange prototype model treats the observed 14 → 8 → 6 → 3 g/day decline as experimental expected behaviour and exposes the ~18 g / ~3-day reserve trigger as provisional logic
- Pot B provisional plant-specific thresholds are seeded at ~525 g dry and ~720 g saturated so reserve can be interpreted while future cycles refine those values
- Water-reserve percentage is withheld until stable dry/saturated thresholds are learned; the 72-reading band remains a recent reference only
- Observed-range radial gauge uses the latest 72 readings from the active run, with a robust 5th–95th percentile band so older calibration/temperature experiments do not distort the current moisture position
- Radial moisture scale now communicates dry→ideal→wet with orange/yellow→green→dark blue plus a current-position marker
- Herbarium index page
- Rosemary Herbarium dossier based on locked 7-section template
- Reference Herbarium entries for Basil, Thyme, Mint, Oregano, and Valencia Orange

## Prototype / not yet connected to real systems

These elements look functional but currently use demo or placeholder behaviour:

- Bluetooth discovery
- Device identity / QR claiming
- Google / Apple sign-in
- Wi-Fi network scanning
- Wi-Fi password entry and secure provisioning
- Irrigation-normalized dry-down calculations
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
- `Plants` still points to the single-plant detail route until the dedicated collection page is built
- `Settings` still points to the Home settings section until a dedicated settings page is built
- `See what Sykerbos is learning →` — placeholder
- `Browse Herbarium →` — placeholder
- `Device settings` — visual button only
- Weight-trend selector — visual button only

## Visual placeholders to replace

- Generic fallback thumbnails for plants without a Herbarium image
- Remaining product copy / naming may evolve as hardware is engineered
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
- Herbarium Battles is a serious future retention/competition system, not a throwaway easter egg: biologically grounded plant cards, ranked competition, leaderboards, coveted achievements/rewards, and limited custom VyTile shell designs as prizes.

- Alpha01 is manually marked as maintenance/offline and is sorted below active plants while retaining historical data.

- Herbarium photo direction locked: warm cream studio background, living attached growth, warm natural light, varied species-specific composition; first seven-image set approved pending binary import.

## Next build targets

1. Refine Home layout and plant analytics using real telemetry; add irrigation event recognition next.
2. Replace remaining placeholder plant/product imagery as approved assets become available.
3. Separate authenticated app into `sykerbos-app` once the UX stabilizes.
4. Create `vytile-firmware` repository with semantic firmware versions.
5. Claim current Alpha devices to the first real user account, then connect command queue and richer telemetry history.

## Architecture direction

- `sykerbos-site` → public website at `sykerbos.com`
- `sykerbos-app` → authenticated application at `app.sykerbos.com`
- `vytile-firmware` → ESP32 firmware, releases, build artifacts and later OTA

The current `app.html` remains inside this repository intentionally while the product UX is being prototyped quickly.
