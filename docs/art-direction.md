# Art direction — A1 style lab

Direction: **paper theatre × ligne claire archive**. The building is a cut-away dollhouse seen through an
orthographic camera; residents and props are paper cut-outs and simple solids; everything is frozen at
20:00 on 23 June 1975.

Run it: `npm run dev`, then open `/style-lab.html` (press `1` room view, `2` section view; `?static` renders one frame).

## What is in code

| Layer | File | Notes |
|---|---|---|
| Tokens | `art/palette.ts` | Colours, resident signature colours, line weight, cel steps, 20:00 light, print settings. All art must use these. |
| Ink renderer | `art/inkPass.ts` | Colour pass + view-space normal/depth pass → constant-width ink lines, paper grain, 45° halftone in shadows, vignette. |
| Materials | `art/materials.ts` | Three-band toon gradient; section cut faces are unlit ink (poché). |
| Textures | `art/textures.ts` | Procedural canvas textures: paper, wallpaper with jigsaw gap, floorboards, harbour watercolour/puzzle, skyline, clock, books, rug, labels. |
| Cut-outs | `art/figures.ts` | Canvas-drawn residents with a dilated paper border, alpha-tested cards that cast/receive shadows. |
| Player | `art/knight.ts` | Lacquered Staunton knight (lathe base + extruded head). |
| Rooms | `art/room.ts` | Room shell, furniture kits per room kind, light shaft + frozen dust, 3×3 building section. |
| Page | `art/styleLab.ts`, `style-lab.html` | Camera views, parallax, HUD cards. |

## Known shortcomings (to address in A2 / later)

### Residents (cut-out figures)
- Figures are a single programmatic template (three-quarter view, same proportions) with recoloured coats; they read as placeholders next to the room detail.
- Only four poses (`stand`, `reach`, `tray`, `paint`); no seated, crouching or lying poses, no hands-on-object contact.
- Faces are minimal (one eye, brow, mouth); no per-resident silhouette features beyond hair/glasses.
- No half-length portraits or window silhouettes yet; the four-piece kit per resident (silhouette, frozen pose, bust, three signature objects) is still A2 work and needs the user's design decisions.
- Cut-outs are flat cards with a small foot; no visible paper thickness or slight curl.

### Furniture and props
- Neighbour rooms use thin furniture kits: workshop, studio, servant room, parlor and kitchen have 3–6 primitive pieces each; the two empty rooms are only dust-sheet boxes.
- Furniture is built from boxes and cylinders; no turned legs, upholstery seams, handles or mouldings.
- Book spines, pegboard tools and shelves are textures or flat boxes; nothing is individually readable as a clue object at 64 px except the puzzle and the wallpaper gap.
- No prop library or seed-driven assembly yet; each room kind is hand-placed in `furnish()`.

### Lighting and rendering
- The light shaft is an additive prism; its side faces can show as faint rectangles over figures standing in it.
- Dust motes are fixed screen-size points (scaled by zoom); they look busy in the section view.
- Rooms all share one sun; there is no per-room lamp light, night state or hourly page-turn yet.
- Ink lines come only from depth/normal breaks, so coplanar details (rug border, plank seams) rely on texture lines.
- Screenshots were produced with software WebGL; real-GPU performance has not been profiled.

### Scene and UI
- Room labels on slab fronts are small in the section view.
- Camera transition is a straight zoom; the planned L-shaped knight-move camera path is not implemented.
- The blueprint (case-file) filter mode is not implemented.
