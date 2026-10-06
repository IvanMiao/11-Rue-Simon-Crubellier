# Art direction — A1 style lab + A2 cast and props

Direction: **paper theatre × ligne claire archive**. The building is a cut-away dollhouse seen through an
orthographic camera; residents and props are paper cut-outs and simple solids; everything is frozen at
20:00 on 23 June 1975.

Run it: `npm run dev`, then open `/style-lab.html` (press `1` room view, `2` section view, `3` cast sheet, `4` prop library; `?static` renders one frame, `?view=props` opens the library). The cast sheet is `/cast.html`. `node scripts/shoot-art.mjs --props` renders all four to `/home/ubuntu/sim/a2-*.png` (dev server on 5181).

## What is in code

| Layer | File | Notes |
|---|---|---|
| Tokens | `art/palette.ts` | Colours, cast `TONES` (skin, hair, cloth), line weight, cel steps, 20:00 light, print settings. All art must use these. |
| Cast bible | `art/cast.ts` | Closed cast of seven residents: build, head, costume, frozen pose, three signature glyphs, room, card mapping (`castByCard`, `cardArt`). Pure data. |
| Cast drawing | `art/draw/people.ts` | Parametric full-length figure, bust, window silhouette (canvas 2D, no three.js). Deceased residents render sepia. |
| Card glyphs | `art/draw/glyphs.ts`, `art/draw/cardArt.ts`, `art/cardIcons.ts` | One pictogram per case card and signature object; person cards use the bust, testimony cards a balloon in the speaker's colour. Used by `CaseBoard`. |
| Prop library | `art/props.ts` | Turned-leg table, bentwood chair, upholstered armchair, moulded wardrobe, boiler, coal pile, antique-shop counter, stacked frames, `dustSheet()` over any prop. |
| Ink renderer | `art/inkPass.ts` | Colour pass + view-space normal/depth pass → constant-width ink lines, paper grain, 45° halftone in shadows, vignette. |
| Materials | `art/materials.ts` | Three-band toon gradient; section cut faces are unlit ink (poché). |
| Textures | `art/textures.ts` | Procedural canvas textures: paper, wallpaper with jigsaw gap, floorboards, harbour watercolour/puzzle, skyline, clock, books, rug, labels. |
| Cut-outs | `art/figures.ts` | Cast figures with a dilated paper border, alpha-tested cards that cast/receive shadows. |
| Player | `art/knight.ts` | Lacquered Staunton knight (lathe base + extruded head). |
| Rooms | `art/room.ts` | Room shell, furniture kits per room kind, light shaft + frozen dust, 3×3 building section. |
| Page | `art/styleLab.ts`, `style-lab.html`, `art/castSheet.ts`, `cast.html` | Camera views (room, section, props), parallax, HUD cards; 2D cast sheet with 64/32 px card legibility grid. |

## Resolved in A2
- Each resident has an individual build (height, width, stoop), hair, glasses/moustache/beard/hat, costume and one frozen pose holding their signature object: Bartlebooth reaches with the W piece, Winckler saws, Morellet pours from a flask, Mme Nochère sweeps (keys at her hip), Smautf carries his valise, Valène paints, Mme Marquiseaux carries a tray.
- Four-piece kit per resident: window silhouette, full figure, bust, three signature glyphs (`/cast.html`).
- Winckler died in 1973: he appears only sepia, as a photograph on his workshop wall beside his empty chair.
- Every case card has an icon; the icons read at 64 px and mostly at 32 px. `art/cast.test.ts` checks that every person card maps to the cast, every card has art and every cast colour is a palette token.
- Furniture: turned legs with mouldings and aprons, upholstered armchairs with buttons and nail trim, wardrobes with cornice, panels and handles, bentwood chairs.
- Empty rooms now hold dust-sheeted armchair, table and wardrobe whose silhouettes survive under the sheet, plus stacked frames.

## Resolved in A3
- The paper theatre is in the game: every chapter page opens with a plate of that cell's dollhouse room (`art/stage/`, lazy-loaded so three.js stays out of the main chunk; `npm run check:bundle` guards it).
- Case cells have their own compact rooms (`art/stage/cellScenes.ts`, `art/stage/cellRooms.ts`): stairs with Valène's sketchbook, hall mailboxes and lift dial, loge, Bartlebooth's puzzle table and sill, Winckler's bench and empty chair, Smautf, Valène's blank canvas, Morellet's lab, the cellar boiler and coal, the antique-shop counter, Cinoc's slips and the bitten Clinamen cell. Other cells assemble dust-sheeted furniture from their seed.
- Evidence tags sit on the objects in the scene, show the same status glyph as the room sheet and arm the same line; hovering a sheet line highlights its tag.
- Hour light reaches the rooms (sun colour/angle per hour, night windows and lit pendants at 23:00); the case file switches the stage to a blueprint filter.
- The camera pushes in on entering a cell; the knight moves along an L on the canvas.
- Bartlebooth sits at the puzzle (`seatedReach`); checks show a hand holding, shaking and dropping the engine's two dice (`art/draw/hand.ts`).
- The light shaft fades to zero at its side edges, so no rectangle shows over figures.
- `/cells.html` is a contact sheet of every case room (`?hour=23`, `?mode=blueprint`) for visual regression.

## Whole-building stage and S1 interactions

- The playable building is a cut-away paper theatre (`art/stage/`): authored case rooms, painted/sketch flats, chapter-cell movement, and an orthographic camera with edge-clamped framing.
- Bartlebooth's hand is a skin-matched cut-out that continues the navy sleeve, with separated fingers, knuckle creases, and closed, half-open, and palm-up poses. The puzzle's compact charcoal X outline draws on over 500 ms in close-up.
- Freshly visited cells fade from a charcoal room sketch into their painted state; the atlas flat and room detail share the stage's injectable animation clock.
- Notebook, puzzle, hand, Winckler's notes, keyring and loupe are scene mechanisms. Gestures dispatch through the existing WorldScreen actions; the room sheet remains the text and accessibility entry.
- Hover and drop targets use a brass silhouette rim and warm material tint rather than a debug bounds box. The player marker is hidden while a close-up is active; cell `8:7` has a separate landing spot away from the loupe.
- Specialized mechanisms are authored for `3:6`, `3:1` and `6:8`. Generic cells still use the tag plus nearest-mesh behavior; this is the main remaining interaction-art limitation.

## Known shortcomings (to address later)

### Residents (cut-out figures)
- One frozen pose per resident; only Bartlebooth is seated, there are no crouching or lying poses.
- Hands are ovals; contact with objects is implied by overlap, not drawn grips. Morellet's missing fingers only show as a bandaged back hand.
- Busts are the figure head scaled up, not separate portraits; no expression changes.
- The cast covers the seven M2 residents only; the planned ~20-resident cast is not drawn.
- Cut-outs are flat cards with a small foot; no visible paper thickness or slight curl.

### Furniture and props
- The style-lab building section still shows floors II–IV only; the cellar and shop exist as in-game cell rooms.
- The two empty rooms use the same dust-sheet arrangement (only jitter differs); there is no seed-driven room assembly yet, each room kind is still hand-placed in `furnish()`.
- Dust sheets are a recoloured copy of the prop plus a folded skirt; the sheet does not drape over arms or backs.
- Book spines, pegboard tools and shelves are still textures or flat boxes.

### Lighting and rendering
- Dust motes are fixed screen-size points (scaled by zoom); they look busy in the section view.
- Hour light is global per hour; lamps are not yet tied to individual residents or room signals.
- Ink lines come only from depth/normal breaks, so coplanar details (rug border, plank seams) rely on texture lines.
- Screenshots were produced with software WebGL; real-GPU performance has not been profiled.

### Scene and UI
- Room labels on slab fronts are small in the section view.
- Generic-cell hotspots can still sit above the nearest mesh rather than forming an authored physical mechanism.
- The room sheet remains necessary for line labels, status, lock reasons and accessibility.
