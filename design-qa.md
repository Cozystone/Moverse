# Moverse Visual QA

## Visual truth

- Primary reference: `C:/Users/anseo/AppData/Local/Temp/codex-clipboard-e42558b4-a830-4cc3-877d-1a5b6d03b4ac.png` (Zenly map-first UI)
- Secondary reference: `C:/Users/anseo/AppData/Local/Temp/codex-clipboard-289a3129-84a6-4781-a18d-2bc435694ff9.png` (Pokémon GO tilted world and POIs)
- Implementation capture: `docs/screenshots/moverse-map-390x844.png`
- Side-by-side comparison: `docs/screenshots/design-comparison.png`
- Additional states: event detail, dynamic QR, social, and My Verse captures in `docs/screenshots/`

## Test setup

- Viewport: **390 × 844**
- Runtime: optimized Next.js production build
- State: verified demo student, map home and the full event/social flows
- Browser: Codex in-app browser
- Console: **0 errors, 0 warnings**

## Comparison history

### Pass 1

- P1: Moverse header overlapped the embedded map HUD at 390 px.
- P1: duplicate fallback and MapLibre controls/markers made the map feel busier than the reference.
- P2: the map lacked the bold place identity that gives the Zenly reference its immediate personality.
- P2: the map palette was intentionally calmer than the reference, but neon action affordances and POIs still needed a clearer hierarchy.

### Fixes

- Removed the redundant embedded map HUD in the app shell while retaining direct pan/zoom gestures and the app-level search/safety controls.
- Unmounted fallback markers after MapLibre is ready, eliminating duplicate accessible controls.
- Added a bold `YEOUIDO / MOVE WORLD` location signature and a live badge inspired by the reference without copying its layout.
- Preserved Moverse's privacy distinction: nearby strangers are not shown as exact avatar dots before a mutual, on-site activity tag.
- Kept Move Spots and Move Events as high-contrast neon 3D landmarks over the tilted world.

## Functional visual checks

- Onboarding and student verification fit without horizontal overflow.
- Map, night mode, Event detail, QR tag, live activity, completion, Social, Move Again, Create, and My Verse were exercised at 390 × 844.
- Fixed action bars remain reachable and do not cover required content.
- Dialogs expose close/back controls and retain keyboard focus management.
- Night mode clearly disables face-to-face activity while retaining scheduling and DM access.

## Result

final result: passed
