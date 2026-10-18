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
- The site polls at a nominal 500 ms request cadence, with no overlapping requests and marks its display stale after three seconds without an accepted sample. No automatic irrigation or device commands are sent.

Authentication/pairing and any existing endpoint configuration must be reviewed against the actual firmware before deployment. No new firmware or network access configuration is installed by this site change.

## Planning

Suggested gain is max(0, saved wet reference - planning weight). A manual target can override that amount.
A scenario's retained target is capped at the wet reference; excess is flagged as possible runoff.
Days are reserve above the saved dry reference divided by an explicitly displayed daily-loss assumption.
The orange/citrus model starts at its highest assumed stage, 14 g/day (existing experimental stages: 14, 8, 6, 3). It never uses a recent low-use tail as a post-watering forecast. Plants without a high-use model require a manual rate; the basil demo uses an illustrative 18.6 g/day. The rate remains editable and days are estimates, not a validated holiday forecast.
The page does not write plant thresholds, telemetry, or watering events to the database.

## Remembered connection

The account-owned plants.live_connection JSON stores url, device_id and verified_at.
Existing plants RLS applies; no new public or cross-account access is granted.
The watering page restores a preference only when its device_id matches the plant's
currently assigned device. It validates a private IP/.local URL and still verifies
the device identity, advancing sequence and sample freshness on every reading.
A successful changed address is saved with plant, account and device filters.
The browser keeps a fallback and the page attempts the saved connection on opening.
Network permission remains a browser/user decision. No LAN scanning is performed.
Manual connection settings and estimate assumptions are collapsed below the main
watering view. Remembering an address does not discover a changed DHCP address;
a future setup/device-announcement flow can update the same preference.
