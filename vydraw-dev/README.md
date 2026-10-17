# VyDraw DEV 1.0.0

Tiny browser CAD for Sykerbos engineering work.

New in 1.0:
- objects can be selected
- selected object highlights blue
- `M` or `MOVE` arms free object movement; drag the selected object in any direction
- Move button added to top toolbar
- rectangles/squares are selectable and get four editable corner handles
- circles are selectable and get a centre handle plus radius handle
- legacy/simple lines now get editable endpoint handles
- polylines keep their existing node editing
- Save Draft / Load Draft still uses browser localStorage, so a refresh on the same browser/origin should restore the saved draft

Existing CAD commands:
- LINE / LINE 100
- RECT 120 40 / SQUARE 40
- CIRCLE 20
- DIM
- DELETE

Native units: millimetres.
