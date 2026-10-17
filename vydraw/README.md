# VyDraw 0.5.0

Internal Sykerbos engineering sketcher.

New in 0.5:
- polyline segments are directly draggable with the mouse
- horizontal segments move vertically
- vertical segments move horizontally
- diagonal segments move freely
- adjacent segments stay connected because shared vertices move with the selected segment
- the object list labels segments as `RAIL-S1`, `RAIL-S2`, etc.
- Undo reverses a drag

Current rail test:
```
CLEAR
LAYER REFERENCE
POLYLINE RAIL 0 0 0 45 10 45 10 35 90 35 90 45 100 45 100 0
DIMXY 0 0 100 0 OFFSET -12
DIMXY 100 0 100 45 OFFSET -12
```

After drawing it, click and drag any rail segment.

Native units: millimetres.

Safe workflow:
VyDraw -> SVG -> Easel/CAM -> simulate -> CNC
