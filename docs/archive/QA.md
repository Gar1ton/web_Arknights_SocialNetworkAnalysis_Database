# Demo verification — 2026-10-13

## Automated

- `npm test`: 6 tests pass.
- Unique nodes and undirected pairs; valid endpoints and bounded relation metrics.
- Exact one/two-hop graph traversal, cycles and isolated nodes.
- Deterministic finite layouts across organic/force/circular and network/ego/chord modes.
- Empty/singleton layout support; physics parameters affect positions.
- Persisted settings validation, clamping, invalid enum and nonfinite input handling.
- `npm run build`: TypeScript check and production bundle pass.
- `git diff --check`: no whitespace errors.

## Browser verification

The production build was served locally on port 4178. Desktop viewport and 390 × 844 mobile viewport were inspected.

- All three section links and landing CTA work.
- English search `amiya` returns the matching node; missing query presents recovery.
- Rhine Lab filter shows 8 nodes, 16 edges, one community.
- Node and directional relationship profiles show fixture-backed metrics.
- Amiya one-hop view shows 13 nodes; two-hop view reaches all 48 fixture nodes.
- Chord preset changes geometry and palette.
- Palette survives page reload.
- Node and edge activation work through keyboard Enter.
- Zoom updates to 115%; pause updates the visible motion state.
- Dragging Amiya changes its coordinates; reset restores the original position.
- Minimum message threshold 1300 shows zero nodes/edges and an empty-state recovery.
- Clearing filters restores all 48 nodes and 115 edges.
- JSON export downloaded and parsed: schemaVersion 1, explicit illustrative provenance, 48 nodes and 115 edges.
- SVG export generation displays success. Physical SVG/CSV save was not separately confirmed in the browser.
- Final production-page console: no new warnings/errors. Transient Vite hot-reload errors occurred while dependency optimization changed during development; they did not reproduce after reload or in production.
- Mobile page has no horizontal body overflow. Corrected artwork overlap with statistics.

## Scope

This is a frontend showcase using deterministic illustrative fixtures. No connection to the live SNA batch, no backend edits, no production analysis claims. Exported SVG includes the network and scene background; the raster particle field remains a live canvas effect.
