# VyDraw 0.4.2

Internal Sykerbos engineering sketcher.

New in 0.4.2:
- drafting-style coordinate dimensions with extension lines
- dimension offsets: `DIMXY x1 y1 x2 y2 OFFSET 12`
- smaller dimension text
- point labels hidden by default
- toggle named point labels with `POINTLABELS ON` / `POINTLABELS OFF`

Rail test:
```
CLEAR
LAYER REFERENCE
POLYLINE RAIL 0 0 100 0 100 -45 90 -45 90 -35 10 -35 10 -45 0 -45 CLOSE
DIMXY 0 0 100 0 OFFSET 12
DIMXY 100 0 100 -45 OFFSET 12
```

Native units: millimetres.

Safe workflow:
VyDraw -> SVG -> Easel/CAM -> simulate -> CNC
