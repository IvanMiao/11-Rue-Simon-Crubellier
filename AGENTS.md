# Design Constitution

- The LLM writes prose only; it never decides checks, clues, morale, or endings.
- Every rule change goes through pure, deterministic `engine/step.ts`.
- Saves are versioned action logs; generated room content is logged as an action.
- Tests and simulation enforce replay determinism, no trapped runs, and finale ownership by `FINALE_INTERACTION`.
- Run `npm run typecheck`, `npm test`, `npm run sim`, and `npm run build` before delivery. Run the simulation after balance-affecting changes and report its table.
- UI copy remains Chinese; code and comments remain English.
- Art belongs in `art/` and must use tokens from `art/palette.ts`.
