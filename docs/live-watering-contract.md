# Alpha direct watering connection

The website planner reads stored history for context. It never treats those rows as a live weighing feed.
The current device firmware lives on the owner's Mac and has not been inspected or changed here.
Direct operation remains unverified until that firmware is supplied, adapted and tested on hardware.

## Device read-only endpoint required by watering.js

Use a local private-IP or .local URL chosen explicitly by the owner. The frontend does not scan the LAN or assume an existing firmware route.
The endpoint should serve fresh HX711 measurements independently of the cloud-upload cadence, about once per second or faster, without resetting the device tare/calibration.

Return JSON:

```json
{"device_code":"Mini02","weight_g":531.5,"sample_seq":123,"sample_age_ms":150}
```

- device_code must match the plant's claimed device code.
- weight_g is calibrated whole-pot weight in grams.
- sample_seq is a nonnegative, increasing safe integer for actual sensor samples (not HTTP requests). Reboot resets require reconnecting.
- sample_age_ms is computed from sensor sample acquisition, not response generation; maximum accepted age is 2000 ms.
- Use Cache-Control: no-store. Never generate fresh sequence numbers for cached measurements.
- Allow GET from the exact website origin https://sykerbos.com through CORS. Do not allow wildcard origins, arbitrary commands, credentials, or network forwarding.
- Honour the browser's local-network permission. Do not disable browser protections or expose the device with router port forwarding.
- The site polls at roughly one second plus response time and marks its display stale after three seconds without an accepted sample. No automatic irrigation or device commands are sent.

Authentication/pairing and any existing endpoint configuration must be reviewed against the actual firmware before deployment. No new firmware or network access configuration is installed by this site change.

## Planning

Suggested gain is max(0, saved wet reference - planning weight). A manual target can override that amount.
A scenario's retained target is capped at the wet reference; excess is flagged as possible runoff.
Days are reserve above the saved dry reference divided by an explicitly displayed daily-loss assumption.
The initial assumption fits at least six hours of recent, uninterrupted active-run dry-down. It excludes clear jumps and is not a validated post-irrigation or holiday forecast.
The page does not write plant thresholds, telemetry, or watering events to the database.
