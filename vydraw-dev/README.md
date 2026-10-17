# VyDraw DEV 1.1.0

Tiny browser CAD for Sykerbos engineering work.

New in 1.1:
- rail/reference layer is blue
- clip/fixed layer is green
- live layer is orange
- dimensions are selectable
- Delete removes the selected dimension, line, segment, or object
- Clear dims removes all dimensions
- command `CLEARDIMS` or `DELDIMS` removes all dimensions
- object selection/move/resize behavior from 1.0.1 retained

Shape editing:
- rectangle/square: click to select, then drag blue corner handles
- circle: click to select, drag centre or radius handle
- simple line: endpoint handles
- polyline: editable green nodes
- `M` / `MOVE`: move selected object freely

Drafts:
- Save Draft persists to localStorage for the same browser/site
- Load Draft restores it after refresh

Native units: millimetres.
