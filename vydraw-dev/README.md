# VyDraw DEV 0.9.0

Tiny browser CAD for Sykerbos engineering work.

New in 0.9 — interactive CAD command line:
- `LINE` → click first point, then click successive nodes
- Enter or Space finishes the active line
- Esc cancels the active drawing command
- `LINE 100` → each clicked direction creates an exact 100 mm segment
- `RECT 120 40` → click once to place a 120 × 40 mm rectangle
- `SQUARE 40` → click once to place a 40 mm square
- `CIRCLE 20` → click once to place a 20 mm radius circle
- `DIM` dimensions the currently selected line/segment
- `DELETE` deletes the selected line/segment

Top Line / Square / Circle buttons now activate placement modes.

Existing:
- drag line = move segment
- drag green node = shorten / extend / reshape
- local Save Draft / Load Draft
- JSON and SVG export

Native units: millimetres.