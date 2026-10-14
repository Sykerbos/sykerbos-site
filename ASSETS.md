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

## Asset rules

- Prefer a real user photo when one exists.
- Otherwise use the canonical Herbarium image for that species.
- If no species match exists, show a quiet botanical fallback rather than inventing an image.
- Keep image source and licence metadata here when external material is introduced.
- Long term, move approved external images into version-controlled local assets so Sykerbos does not depend on third-party hotlinks.
