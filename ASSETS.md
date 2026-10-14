# Sykerbos visual asset register

This register tracks plant imagery used by the public site, app dashboard, and Herbarium. The goal is one reusable canonical image per Herbarium species first, followed later by user-uploaded plant photography.

| Plant | Botanical name | Current asset | Source / licence | Status |
| --- | --- | --- | --- | --- |
| Rosemary | *Salvia rosmarinus* | `assets/hero/rosemary-vytile.png` | Sykerbos project photo | In use |
| Basil | *Ocimum basilicum* | Wikimedia botanical illustration | Public domain | In use |
| Thyme | *Thymus vulgaris* | Wikimedia Köhler botanical illustration | Public domain | In use |
| Mint / Peppermint | *Mentha × piperita* | Wikimedia 1903 botanical illustration | Public domain | In use |
| Oregano | *Origanum vulgare* | Wikimedia historical botanical illustration | Public domain | In use |
| Valencia orange | *Citrus × sinensis* | USDA pomological watercolor via Wikimedia | Public domain | In use for Alpha dashboard |
| Peace lily | *Spathiphyllum* spp. | None yet | — | Needed |

Runtime mapping lives in `plant-assets.js`.

## Approved Herbarium photo direction — 2026-10-13

The first matched set is approved in principle for:
- Rosemary
- Basil
- Thyme
- Mint
- Oregano
- Valencia orange seedling
- Peace lily

Locked visual language:
- realistic living botanical photography, not vector art or watercolor
- soft warm cream / off-white studio background
- warm natural-light feel rather than cool shade
- plant grows naturally into frame; avoid the cut-specimen look
- compositions may vary by species; do not repeat a rigid “two twigs” formula
- clear focal stem / bloom, restrained secondary growth, useful negative space
- no pots, props, scenery, labels, or text baked into the image
- full portrait can serve Herbarium; tighter crops can serve dashboard cards

The generated binary image files are awaiting import into version-controlled local assets. Once imported, runtime mapping should use local paths only.

## Asset rules

- Prefer a real user photo when one exists.
- Otherwise use the canonical Herbarium image for that species.
- If no species match exists, show a quiet botanical fallback rather than inventing an image.
- Keep image source and licence metadata here when external material is introduced.
- Long term, move approved external images into version-controlled local assets so Sykerbos does not depend on third-party hotlinks.
