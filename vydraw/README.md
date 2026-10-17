# VyDraw 0.7.0

Internal Sykerbos engineering sketcher.

New in 0.7:
- click a line/segment to select it
- selected line highlights
- press Delete or Backspace to remove it
- or use the "Delete selected line" button
- deleting an interior polyline segment splits the profile into two open polylines
- Undo restores the deleted segment

Existing editing:
- drag line = move segment
- drag green node = shorten, lengthen, reshape

Native units: millimetres.

Safe workflow:
VyDraw -> SVG -> Easel/CAM -> simulate -> CNC
