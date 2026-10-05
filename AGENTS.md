# Design Constitution

- The LLM writes prose only; it never decides checks, clues, morale, or endings.
- Every rule change goes through pure, deterministic `engine/step.ts`.
- Saves are versioned action logs; generated room content is logged as an action.
- Authored case data and seeded variants live in `case/`; `solveCase` must pass for every liar.
- The case must be solvable with looks and recipes only; checks are shortcuts, not gates.
- Items are obtainable without checks; hour pages never remove evidence.
- Movement and room content are authored per 10×10 chapter cell; the finale is at `-1:1`.
- The finale can only be completed through `FINALE_INTERACTION` after at least two case groups are locked.
- Tests and simulation enforce replay determinism, no trapped runs, caseBot grade ≥2 success of at least 70% per archetype, and guessBot grade ≥2 success of at most 15% per archetype.
- Run `npm run typecheck`, `npm test`, `npm run sim`, and `npm run build` before delivery. Run the simulation after balance-affecting changes and report its table.
- UI copy remains Chinese; code and comments remain English.
- Art belongs in `art/` and must use tokens from `art/palette.ts`.
