# VyDraw 0.4

Internal Sykerbos engineering sketcher.

New in 0.4:
- layers with `LAYER name`
- multi-segment `POLYLINE`
- `CLOSE` for closed profiles
- coordinate dimensions with `DIMXY x1 y1 x2 y2`

Examples:
- `LAYER REFERENCE`
- `POLYLINE RAIL 0 0 100 0 100 -45 90 -45 90 -35 10 -35 10 -45 0 -45 CLOSE`
- `DIMXY 0 0 100 0`
- `DIMXY 100 0 100 -45`

Native units: millimetres.

Safe workflow:
VyDraw -> SVG -> Easel/CAM -> simulate -> CNC
