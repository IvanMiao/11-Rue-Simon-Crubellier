# S3 audio provenance

All 50 delivered files are CC0-1.0. Attribution is not required, but source credits are retained here for provenance. Each file row gives the local runtime filename, cue/use, authorized source alias, exact original filename, license, and applied processing. The source record immediately above a table supplies the source title, creator, canonical page, direct download/archive URL, and exact license evidence for every row in that table.

The six renamed local downloads (`map-use.wav`, `map-close.wav`, `clock-antum.ogg`, `boiler-bart.wav`, `rain-kresiek.ogg`, and `piano-anewstart.wav`) are the exact authorized downloads identified by their original filenames and direct URLs below; they are aliases, not substitute sources.

The source-root prefixes in table rows resolve under `/home/ubuntu/audio-src/`. In particular, `kenney_casino-audio/Audio/`, `kenney_rpg-audio/Audio/`, `kenney_impact-sounds/Audio/`, and `kenney_interface-sounds/Audio/` are the exact roots named in the brief.

## Encoding and mix

- SFX are Ogg Vorbis, mono, 44.1 kHz, approximately 64 kbps. Beds, bell, and music are Ogg Vorbis, mono, 44.1 kHz, approximately 96 kbps.
- Source-level trims and the boiler low-pass follow `SOUND_MAP.md`; runtime gains, deterministic pitch for the lift cable, loops, and crossfades are applied by `audio/`.
- No per-file loudness normalization was applied. Per-cue gains remain in the runtime manifest.
- Total size of `public/audio/`: **1,763,598 bytes** (50 files; below the 3 MB budget).

## Kenney Casino Audio

- Creator: Kenney Vleugels (kenney.nl)
- Canonical page: https://kenney.nl/assets/casino-audio
- Direct archive: https://kenney.nl/media/pages/assets/casino-audio/2472606a04-1721639069/kenney_casino-audio.zip
- License: `CC0-1.0`
- Exact registry evidence: `License.txt in zip: Creative Commons Zero, CC0`

| Local filename | Cue / use | Authorized local source alias | Original filename | License | Modifications |
|---|---|---|---|---|---|
| `public/audio/paper-peel-1.ogg` | `paper.peel`, variant 1 | `kenney_casino-audio/Audio/card-slide-1.ogg` | `card-slide-1.ogg` | CC0-1.0 | Lead silence trimmed; mono 44.1 kHz; Vorbis 64 kbps. |
| `public/audio/paper-peel-3.ogg` | `paper.peel`, variant 2 | `kenney_casino-audio/Audio/card-slide-3.ogg` | `card-slide-3.ogg` | CC0-1.0 | Lead silence trimmed; mono 44.1 kHz; Vorbis 64 kbps. |
| `public/audio/paper-peel-5.ogg` | `paper.peel`, variant 3 | `kenney_casino-audio/Audio/card-slide-5.ogg` | `card-slide-5.ogg` | CC0-1.0 | Lead silence trimmed; mono 44.1 kHz; Vorbis 64 kbps. |
| `public/audio/paper-land-1.ogg` | `paper.land`, variant 1 | `kenney_casino-audio/Audio/card-place-1.ogg` | `card-place-1.ogg` | CC0-1.0 | Mono 44.1 kHz; Vorbis 64 kbps. |
| `public/audio/paper-land-2.ogg` | `paper.land`, variant 2 | `kenney_casino-audio/Audio/card-place-2.ogg` | `card-place-2.ogg` | CC0-1.0 | Mono 44.1 kHz; Vorbis 64 kbps. |
| `public/audio/paper-land-4.ogg` | `paper.land`, variant 3 | `kenney_casino-audio/Audio/card-place-4.ogg` | `card-place-4.ogg` | CC0-1.0 | Mono 44.1 kHz; Vorbis 64 kbps. |
| `public/audio/paper-fan-1.ogg` | `paper.fan`, variant 1 | `kenney_casino-audio/Audio/card-fan-1.ogg` | `card-fan-1.ogg` | CC0-1.0 | Mono 44.1 kHz; Vorbis 64 kbps. |
| `public/audio/paper-fan-2.ogg` | `paper.fan`, variant 2 | `kenney_casino-audio/Audio/card-fan-2.ogg` | `card-fan-2.ogg` | CC0-1.0 | Mono 44.1 kHz; Vorbis 64 kbps. |
| `public/audio/dice-grab-1.ogg` | `dice.grab`, variant 1 | `kenney_casino-audio/Audio/dice-grab-1.ogg` | `dice-grab-1.ogg` | CC0-1.0 | Mono 44.1 kHz; Vorbis 64 kbps. |
| `public/audio/dice-grab-2.ogg` | `dice.grab`, variant 2 | `kenney_casino-audio/Audio/dice-grab-2.ogg` | `dice-grab-2.ogg` | CC0-1.0 | Mono 44.1 kHz; Vorbis 64 kbps. |
| `public/audio/dice-shake-1.ogg` | `dice.shake`, variant 1 | `kenney_casino-audio/Audio/dice-shake-1.ogg` | `dice-shake-1.ogg` | CC0-1.0 | Mono 44.1 kHz; Vorbis 64 kbps. |
| `public/audio/dice-shake-2.ogg` | `dice.shake`, variant 2 | `kenney_casino-audio/Audio/dice-shake-2.ogg` | `dice-shake-2.ogg` | CC0-1.0 | Mono 44.1 kHz; Vorbis 64 kbps. |
| `public/audio/dice-shake-3.ogg` | `dice.shake`, variant 3 | `kenney_casino-audio/Audio/dice-shake-3.ogg` | `dice-shake-3.ogg` | CC0-1.0 | Mono 44.1 kHz; Vorbis 64 kbps. |
| `public/audio/dice-throw-1.ogg` | `dice.throw`, variant 1 | `kenney_casino-audio/Audio/dice-throw-1.ogg` | `dice-throw-1.ogg` | CC0-1.0 | Mono 44.1 kHz; Vorbis 64 kbps. |
| `public/audio/dice-throw-2.ogg` | `dice.throw`, variant 2 | `kenney_casino-audio/Audio/dice-throw-2.ogg` | `dice-throw-2.ogg` | CC0-1.0 | Mono 44.1 kHz; Vorbis 64 kbps. |
| `public/audio/dice-throw-3.ogg` | `dice.throw`, variant 3 | `kenney_casino-audio/Audio/dice-throw-3.ogg` | `dice-throw-3.ogg` | CC0-1.0 | Mono 44.1 kHz; Vorbis 64 kbps. |

## 10 Book Page Flips

- Creator: StarNinjas
- Canonical page: https://opengameart.org/content/10-book-page-flips
- Direct archive: https://opengameart.org/sites/default/files/book_flips_-_starninjas.zip
- License: `CC0-1.0`
- Exact registry evidence: `OpenGameArt license field: CC0`

| Local filename | Cue / use | Authorized local source alias | Original filename | License | Modifications |
|---|---|---|---|---|---|
| `public/audio/paper-flip-1.ogg` | `paper.flip`, variant 1 | `bookflips-starninjas/book_flip.1.ogg` | `book_flip.1.ogg` | CC0-1.0 | Mono 44.1 kHz; Vorbis 64 kbps. |
| `public/audio/paper-flip-2.ogg` | `paper.flip`, variant 2 | `bookflips-starninjas/book_flip.2.ogg` | `book_flip.2.ogg` | CC0-1.0 | Mono 44.1 kHz; Vorbis 64 kbps. |
| `public/audio/paper-flip-4.ogg` | `paper.flip`, variant 3 | `bookflips-starninjas/book_flip.4.ogg` | `book_flip.4.ogg` | CC0-1.0 | Mono 44.1 kHz; Vorbis 64 kbps. |
| `public/audio/paper-flip-9.ogg` | `paper.flip`, variant 4 | `bookflips-starninjas/book_flip.9.ogg` | `book_flip.9.ogg` | CC0-1.0 | Mono 44.1 kHz; Vorbis 64 kbps. |

## RPG Audio

- Creator: Kenney Vleugels (kenney.nl)
- Canonical page: https://kenney.nl/assets/rpg-audio
- Direct archive: https://kenney.nl/media/pages/assets/rpg-audio/8e99002d76-1677590336/kenney_rpg-audio.zip
- License: `CC0-1.0`
- Exact registry evidence: `License.txt in zip: Creative Commons Zero, CC0`

| Local filename | Cue / use | Authorized local source alias | Original filename | License | Modifications |
|---|---|---|---|---|---|
| `public/audio/book-open.ogg` | `book.open` | `kenney_rpg-audio/Audio/bookOpen.ogg` | `bookOpen.ogg` | CC0-1.0 | Mono 44.1 kHz; Vorbis 64 kbps. |
| `public/audio/book-close.ogg` | `book.close` | `kenney_rpg-audio/Audio/bookClose.ogg` | `bookClose.ogg` | CC0-1.0 | Mono 44.1 kHz; Vorbis 64 kbps. |
| `public/audio/cloth-lift-1.ogg` | `cloth.lift`, variant 1 | `kenney_rpg-audio/Audio/cloth1.ogg` | `cloth1.ogg` | CC0-1.0 | Mono 44.1 kHz; Vorbis 64 kbps. |
| `public/audio/cloth-lift-2.ogg` | `cloth.lift`, variant 2 | `kenney_rpg-audio/Audio/cloth2.ogg` | `cloth2.ogg` | CC0-1.0 | Mono 44.1 kHz; Vorbis 64 kbps. |
| `public/audio/cloth-lift-3.ogg` | `cloth.lift`, variant 3 | `kenney_rpg-audio/Audio/cloth3.ogg` | `cloth3.ogg` | CC0-1.0 | Mono 44.1 kHz; Vorbis 64 kbps. |
| `public/audio/cloth-lift-4.ogg` | `cloth.lift`, variant 4 | `kenney_rpg-audio/Audio/cloth4.ogg` | `cloth4.ogg` | CC0-1.0 | Mono 44.1 kHz; Vorbis 64 kbps. |
| `public/audio/lock-metal-click.ogg` | `lock.rattle`, first layer | `kenney_rpg-audio/Audio/metalClick.ogg` | `metalClick.ogg` | CC0-1.0 | Mono 44.1 kHz; Vorbis 64 kbps. |
| `public/audio/lock-creak.ogg` | `lock.rattle`, second layer (+40 ms) | `kenney_rpg-audio/Audio/creak1.ogg` | `creak1.ogg` | CC0-1.0 | Mono 44.1 kHz; Vorbis 64 kbps. |
| `public/audio/lift-metal-latch.ogg` | `lift.gate`, first layer | `kenney_rpg-audio/Audio/metalLatch.ogg` | `metalLatch.ogg` | CC0-1.0 | Mono 44.1 kHz; Vorbis 64 kbps. |
| `public/audio/lift-door-close.ogg` | `lift.gate`, second layer (+120 ms) | `kenney_rpg-audio/Audio/doorClose_1.ogg` | `doorClose_1.ogg` | CC0-1.0 | Mono 44.1 kHz; Vorbis 64 kbps. |
| `public/audio/lift-cable.ogg` | `lift.cable`, looped under elevator travel | `kenney_rpg-audio/Audio/creak2.ogg` | `creak2.ogg` | CC0-1.0 | Mono 44.1 kHz; Vorbis 64 kbps; runtime rate 0.8. |

## Opening and closing a map sounds

- Creator: Spring Spring
- Canonical page: https://opengameart.org/content/opening-and-closing-a-map-sounds
- Direct downloads: https://opengameart.org/sites/default/files/snd_use_map.wav and https://opengameart.org/sites/default/files/snd_close_map.wav
- License: `CC0-1.0`
- Exact registry evidence: `OpenGameArt license field: CC0`

| Local filename | Cue / use | Authorized local source alias | Original filename | License | Modifications |
|---|---|---|---|---|---|
| `public/audio/map-open.ogg` | `map.open` | `/home/ubuntu/audio-src/map-use.wav` | `snd_use_map.wav` | CC0-1.0 | Alias retained; downmixed mono, resampled to 44.1 kHz, Vorbis 64 kbps. |
| `public/audio/map-close.ogg` | `map.close` | `/home/ubuntu/audio-src/map-close.wav` | `snd_close_map.wav` | CC0-1.0 | Alias retained; downmixed mono, resampled to 44.1 kHz, Vorbis 64 kbps. |

## Interface Sounds

- Creator: Kenney Vleugels (kenney.nl)
- Canonical page: https://kenney.nl/assets/interface-sounds
- Direct archive: https://kenney.nl/media/pages/assets/interface-sounds/fa43c1dd4d-1677589452/kenney_interface-sounds.zip
- License: `CC0-1.0`
- Exact registry evidence: `License.txt in zip: Creative Commons Zero, CC0`

| Local filename | Cue / use | Authorized local source alias | Original filename | License | Modifications |
|---|---|---|---|---|---|
| `public/audio/pencil-tick-1.ogg` | `pencil.tick`, variant 1 | `kenney_interface-sounds/Audio/scratch_001.ogg` | `scratch_001.ogg` | CC0-1.0 | Mono 44.1 kHz; Vorbis 64 kbps. |
| `public/audio/pencil-tick-3.ogg` | `pencil.tick`, variant 2 | `kenney_interface-sounds/Audio/scratch_003.ogg` | `scratch_003.ogg` | CC0-1.0 | Mono 44.1 kHz; Vorbis 64 kbps. |
| `public/audio/pencil-tick-5.ogg` | `pencil.tick`, variant 3 | `kenney_interface-sounds/Audio/scratch_005.ogg` | `scratch_005.ogg` | CC0-1.0 | Mono 44.1 kHz; Vorbis 64 kbps. |

## Impact Sounds

- Creator: Kenney Vleugels (kenney.nl)
- Canonical page: https://kenney.nl/assets/impact-sounds
- Direct archive: https://kenney.nl/media/pages/assets/impact-sounds/87b4ddecda-1677589768/kenney_impact-sounds.zip
- License: `CC0-1.0`
- Exact registry evidence: `License.txt in zip: Creative Commons Zero, CC0`

| Local filename | Cue / use | Authorized local source alias | Original filename | License | Modifications |
|---|---|---|---|---|---|
| `public/audio/drop-nothing.ogg` | `drop.nothing` | `kenney_impact-sounds/Audio/impactSoft_medium_000.ogg` | `impactSoft_medium_000.ogg` | CC0-1.0 | Mono 44.1 kHz; Vorbis 64 kbps. |
| `public/audio/knight-land-0.ogg` | `knight.land`, variant 1 | `kenney_impact-sounds/Audio/impactWood_light_000.ogg` | `impactWood_light_000.ogg` | CC0-1.0 | Mono 44.1 kHz; Vorbis 64 kbps. |
| `public/audio/knight-land-2.ogg` | `knight.land`, variant 2 | `kenney_impact-sounds/Audio/impactWood_light_002.ogg` | `impactWood_light_002.ogg` | CC0-1.0 | Mono 44.1 kHz; Vorbis 64 kbps. |
| `public/audio/knight-land-4.ogg` | `knight.land`, variant 3 | `kenney_impact-sounds/Audio/impactWood_light_004.ogg` | `impactWood_light_004.ogg` | CC0-1.0 | Mono 44.1 kHz; Vorbis 64 kbps. |
| `public/audio/step-wood-0.ogg` | `step.wood`, variant 1 | `kenney_impact-sounds/Audio/footstep_wood_000.ogg` | `footstep_wood_000.ogg` | CC0-1.0 | Mono 44.1 kHz; Vorbis 64 kbps. |
| `public/audio/step-wood-2.ogg` | `step.wood`, variant 2 | `kenney_impact-sounds/Audio/footstep_wood_002.ogg` | `footstep_wood_002.ogg` | CC0-1.0 | Mono 44.1 kHz; Vorbis 64 kbps. |
| `public/audio/step-wood-4.ogg` | `step.wood`, variant 3 | `kenney_impact-sounds/Audio/footstep_wood_004.ogg` | `footstep_wood_004.ogg` | CC0-1.0 | Mono 44.1 kHz; Vorbis 64 kbps. |

## Cloche de l'Eglise de Sainte-Marie-des-Batignolles

- Creator: milo (freesound.org/people/milo)
- Canonical page: https://commons.wikimedia.org/wiki/File:Cloche_de_l%27Eglise_de_Sainte-Marie-des-Batignolles.ogg
- Original recording page: https://freesound.org/people/milo/sounds/164776/
- Direct download: https://upload.wikimedia.org/wikipedia/commons/6/61/Cloche_de_l%27Eglise_de_Sainte-Marie-des-Batignolles.ogg
- License: `CC0-1.0`
- Exact registry evidence: `Wikimedia Commons LicenseShortName=CC0; description: bells of Sainte-Marie-des-Batignolles, Paris 17e`

| Local filename | Cue / use | Authorized local source alias | Original filename | License | Modifications |
|---|---|---|---|---|---|
| `public/audio/hour-bell.ogg` | `hour.bell`, hour turn | `/home/ubuntu/audio-src/bell-batignolles.ogg` | `Cloche_de_l'Eglise_de_Sainte-Marie-des-Batignolles.ogg` | CC0-1.0 | Trim 0.8–9.2 s; mono 44.1 kHz; Vorbis 96 kbps; 1.5 s runtime fade-out. |

## Ticking Clock

- Creator: AntumDeluge
- Canonical page: https://opengameart.org/content/ticking-clock-0
- Direct download: https://opengameart.org/sites/default/files/clock-1.ogg
- License: `CC0-1.0`
- Exact registry evidence: `OpenGameArt license field: CC0`

| Local filename | Cue / use | Authorized local source alias | Original filename | License | Modifications |
|---|---|---|---|---|---|
| `public/audio/bed-clock.ogg` | `bed.clock`, 4 s loop | `/home/ubuntu/audio-src/clock-antum.ogg` | `clock-1.ogg` | CC0-1.0 | Authorized alias retained; trim to 4 s; mono 44.1 kHz; Vorbis 96 kbps. |

## Steam boiler sound loop

- Creator: bart
- Canonical page: https://opengameart.org/content/steam-boiler-sound-loop
- Direct download: https://opengameart.org/sites/default/files/generator_loop.wav
- License: `CC0-1.0`
- Exact registry evidence: `OpenGameArt license field: CC0`

| Local filename | Cue / use | Authorized local source alias | Original filename | License | Modifications |
|---|---|---|---|---|---|
| `public/audio/bed-boiler.ogg` | `bed.boiler`, cellar/boiler loop | `/home/ubuntu/audio-src/boiler-bart.wav` | `generator_loop.wav` | CC0-1.0 | Authorized alias retained; 900 Hz low-pass; mono 44.1 kHz; Vorbis 96 kbps. |

## Amb rain loop 1

- Creator: Kresiek
- Canonical page: https://opengameart.org/content/amb-rain-loop-1
- Direct download: https://opengameart.org/sites/default/files/amb_rain_loop_1.ogg
- License: `CC0-1.0`
- Exact registry evidence: `OpenGameArt license field: CC0`

| Local filename | Cue / use | Authorized local source alias | Original filename | License | Modifications |
|---|---|---|---|---|---|
| `public/audio/bed-rain.ogg` | `bed.rain`, loop begins at source 3 s | `/home/ubuntu/audio-src/rain-kresiek.ogg` | `amb_rain_loop_1.ogg` | CC0-1.0 | Authorized alias retained; trim 0–2.4 s dropout and start loop at 3 s; mono 44.1 kHz; Vorbis 96 kbps. |

## 4 Music Box Tracks

- Creator: Aureolus_Omicron
- Canonical page: https://opengameart.org/content/4-music-box-tracks
- Direct archive: https://opengameart.org/sites/default/files/4_music_box_tracks_ogg.zip
- License: `CC0-1.0`
- Exact registry evidence: `OpenGameArt license field: CC0`

| Local filename | Cue / use | Authorized local source alias | Original filename | License | Modifications |
|---|---|---|---|---|---|
| `public/audio/music-chapter.ogg` | `music.chapter`, first phrase only | `musicbox/musicbox3_sad_tune.ogg` | `musicbox3_sad_tune.ogg` | CC0-1.0 | Trim 0–7 s; mono 44.1 kHz; Vorbis 96 kbps; 2 s runtime fade-out. |
| `public/audio/music-clinamen.ogg` | `music.clinamen`, 12 s phrase | `musicbox/musicbox1_spooky_waltz.ogg` | `musicbox1_spooky_waltz.ogg` | CC0-1.0 | Trim 0–12 s; mono 44.1 kHz; Vorbis 96 kbps; runtime fade-out. |

## A New Start (short solo piano)

- Creator: Wolfgang_
- Canonical page: https://opengameart.org/content/a-new-start-short-solo-piano
- Direct download: https://opengameart.org/sites/default/files/anewstart-short_0.wav
- License: `CC0-1.0`
- Exact registry evidence: `OpenGameArt license field: CC0`

| Local filename | Cue / use | Authorized local source alias | Original filename | License | Modifications |
|---|---|---|---|---|---|
| `public/audio/music-solved.ogg` | `music.solved`, sparse solved-run phrase | `/home/ubuntu/audio-src/piano-anewstart.wav` | `anewstart-short_0.wav` | CC0-1.0 | Authorized alias retained; trim to 22 s; mono 44.1 kHz; Vorbis 96 kbps. |
