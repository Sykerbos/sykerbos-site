# VyDraw 0.6.0

Internal Sykerbos engineering sketcher.

New in 0.6:
- every polyline vertex now has a draggable green node
- drag a green node to shorten, lengthen, or reshape connected lines
- drag the line itself to move the whole segment
- Undo reverses either kind of drag

Interaction:
- line drag: horizontal lines move vertically; vertical lines move horizontally
- node drag: endpoint moves freely in X/Y

This makes rough mechanical sketching much faster: move a segment to reposition it, then drag its end nodes to trim or extend it.

Native units: millimetres.

Safe workflow:
VyDraw -> SVG -> Easel/CAM -> simulate -> CNC
