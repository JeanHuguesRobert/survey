**Repository Policy**

- **Runtimes:** Edge functions run on Deno (ESM). Developer scripts and frontend tooling run on Node
  (ESM).
- **Formatting:** Prettier is the canonical formatter for the repo. Use `npm run format` to format
  JS/TS/CSS/MD/etc. Use `npm run fmt:deno` to format Deno edge code when needed.
- **Linting:** `deno lint` is used for edge functions; ESLint (or repo linters) apply for
  Node/frontend. CI runs both.
- **Pre-commit hooks:** Husky + lint-staged are optionally configured — enable locally with
  `npm install` and `npm run prepare`.

**Local developer commands**

- Install dependencies:

```bash
npm ci
```

- Format everything (Prettier + Deno):

```bash
npm run format:full
```

- Quick Prettier-only format:

```bash
npm run format
```

- Run project checks (Deno check/lint + node checks):

```bash
npm run check
```

- Run the RAG CLI (requires `.env` configured):

```bash
node scripts/rag_chat_cli.js "Your question here"
```

**Adding new edge code**

- Keep Deno modules ESM-only and import with absolute or relative URLs consistent with Deno
  resolution.
- Run `deno check` and `deno lint` locally before opening PRs.

**CI**

- GitHub Actions run `deno lint`, `deno check`, and `npm run check` on pushes and PRs to `main`.
