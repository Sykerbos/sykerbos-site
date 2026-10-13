# Sykerbos Site

Public website for **Sykerbos** and the **VyTile** product family.

## Current scope
- Responsive public homepage
- Initial Sykerbos visual system
- Product / Herbarium / Commercial / What’s Growing sections
- Interactive onboarding prototype at `/start.html`
- Mobile swipe + Back/Continue onboarding navigation
- Local onboarding progress persistence

## Deployment
This repository is set up for GitHub Pages via GitHub Actions.

In GitHub:
1. Open **Settings → Pages**.
2. Set **Source** to **GitHub Actions**.
3. Pushes to `main` deploy automatically.

## Architecture direction
- `sykerbos-site` → public website at sykerbos.com
- `sykerbos-app` → authenticated application at app.sykerbos.com
- `vytile-firmware` → ESP32 firmware and versioned releases
