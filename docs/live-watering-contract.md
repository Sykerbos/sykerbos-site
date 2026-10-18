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

Suggested gain is max(0, confirmed saturated weight - planning weight). Only learned_saturated_g is accepted for guided watering; an experimental provisional value cannot set an automatic target. The learned wet reference is independent of whether the dry reference is learned or provisional. Manual goals must also fit within this capacity; excessive goals disable Start and suppress reserve projections. The click handler rechecks the live weight against capacity. Old browser-saved goals are clamped at page initialization. A live reading at/above the saturated weight shows Stop pouring, irrespective of session gain. Weight thresholds do not directly detect runoff. Pot B was explicitly updated to 640 g by the user after free drainage on 2026-10-18; both learned and provisional saturated fields now match that observation.
Days are reserve above the saved dry reference divided by an explicitly displayed daily-loss assumption.
Reserve planning uses Supabase readings from the linked device's current measurement run, up to the last 30 days (paginated, capped at 5,000 newest records). A reliable completed UTC day needs at least 24 readings, 22 hours of coverage, endpoints within one hour of midnight, no gap over 90 minutes, positive net loss and no reading at/below the dry reference. Days with an upward step over 2 g or a downward step over max(5 g, 8 times the median absolute step) are excluded as possible watering, handling or zero shifts. Loss is normalized to 24 hours. Once at least three days qualify, the estimate averages the higher-use half (rounded up) of those days. This is measured pot weight loss, including evaporation, not isolated plant uptake. The UI shows the rate and supporting day count; fewer than seven qualifying days is labelled an early estimate in details. No species constant or recent low-use fallback is used. Insufficient/unavailable history leaves reserve time Learning without blocking live watering. The basil demo retains illustrative 18.6 g/day. Days remain estimates, not a validated holiday forecast.
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
