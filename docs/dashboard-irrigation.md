# Dashboard response to refills

The home dashboard infers a recent refill from an abrupt loaded-pot increase near its own saturated reference. It does not write an irrigation event or increment validated cycles. Only readings from the latest measurement run are analysed.

- A near-empty reading (below max(50 g, half the dry reference)) interrupts the rate window. Returning the same pot without a net increase is not classified as watering.
- A loaded-pot step of at least max(10 g, 15% of the reference capacity) interrupts the window. An upward step near saturation (within max(5 g, 25% of capacity)) is a likely refill. A gap over 90 minutes interrupts the window without asserting watering.
- Large downward steps interrupt the window too, avoiding interpreting drainage or handling as daily use. Small zero shifts are not automatically called refills.
- A recent inferred refill is shown for 12 hours, with settling wording for the first two hours. Offline/maintenance reserve states take precedence.
- Six- and twelve-hour rates use only the uninterrupted segment after the latest change, with at least three readings and coverage within half an hour of the stated window. Positive slopes show Settling/Learning rather than a positive dry-down rate.
- The chart marks the latest inferred refill and positions samples by time. The learning indicator restarts with the new segment. Current-run counts are filtered to that run instead of showing lifetime totals.
- The dashboard refreshes every 60 seconds while visible and when the tab becomes visible. It uses stored telemetry; actual event visibility still depends on the tile's upload interval.

`app.html?demo=watering` shows an explicitly simulated refill without account access or writes. Test with `node tests/irrigation-state.mjs`.

These are initial heuristics, not definitive irrigation recognition. Added objects, repotting and large zero shifts can resemble watering. Explicit user-confirmed watering records can replace this inference later.
