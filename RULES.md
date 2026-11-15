---
document_role: source
document_kind: repository-rules
visibility: public
license: CC BY-SA 4.0
affiliation: Institut Mariani / C.O.R.S.I.C.A., 1 cours Paoli, F-20250 Corte, Corsica
language: en
date: "2026-09-15"
update_policy: UP-DEFAULT-REVIEWED
status: working-paper
review:
  status: unreviewed
  reviewed_by: []
provenance:
  origin_type: unknown
  origin_repository: unknown
  origin_ref: unknown
  origin_date: unknown
  derived_from: []
---

# Repository Rules

But: short, actionable rules to be enforced by humans and AI tools.

- Scope
  - This repository uses plain JavaScript with ES modules only.
  - Deployement is on Netlify
  - Database is Supabase
  - Do NOT introduce TypeScript files (`*.ts`, `*.tsx`) or compiled artifacts.
  - Do NOT use CommonJS syntax: avoid `require(...)`, `module.exports`, `exports.*`.

- Coding style
  - Use `import` / `export` exclusively.
  - Use top-level `import` where possible for runtime clarity (no mixed `require`).
  - Keep files with `.js` extension (no `.mjs` required if `type: "module"`).

- Rationale
  - Consistency: single module system simplifies imports/exports and avoids transpilation.
  - Runtime clarity: server functions (Netlify, Vercel) are using Node ESM.

See also AI_CSS_RULES.md
