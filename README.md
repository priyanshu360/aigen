# Aigen — Build-Time TypeScript Function Generation

Write the flow. Let the build generate the obvious parts.

```typescript
import { aigen } from "@aigen/runtime"

const emails = aigen.extract_emails_from_text(body)
const slug   = aigen.slugify_title(title)
```

During `vite build` (or `esbuild`), Aigen discovers `aigen.*` calls, generates implementations via an LLM agent, validates them with `tsc`, and writes them to `src/agent.generated.ts`.

## Quickstart

```bash
git clone <aigen-agent-repo-url> ../aigen-agent   # agent skills
pnpm add @aigen/vite @aigen/runtime
```

**`vite.config.ts`**

```ts
import { defineConfig } from "vite"
import { aigenPlugin } from "@aigen/vite"

export default defineConfig({
  plugins: [aigenPlugin({ agentDir: "../aigen-agent" })],
})
```

**`src/main.ts`**

```ts
import { aigen } from "@aigen/runtime"

const domain = aigen.get_domain_from_email("user@example.com")
console.log(domain)
```

Run `npm run build`. The first build generates and compiles all functions.

## Packages

| Package | Description |
|---|---|
| `@aigen/core` | Scanner, context collector, cache, prompt builder, ambiguity/conflict checks, repair loop, pipeline orchestrator |
| `@aigen/runtime` | Runtime re-export of generated functions (`import { aigen } from "@aigen/runtime"`) |
| `@aigen/vite` | Vite plugin |
| `@aigen/esbuild` | esbuild plugin |

## Hints

Append a string literal as the last argument to steer generation:

```ts
aigen.extract_emails_from_text(body, "Return unique emails only, lowercase")
```

## Locking Generated Functions

Add `// @aigen-lock` above a function in `src/agent.generated.ts` to prevent future builds from overwriting it.

## Caching

Aigen caches generated functions in `.aigen/cache.json` by SHA-256 hash of `name + arg types + hint`. Pass `noCache: true` to the plugin to force regeneration.

## Example

See [examples/basic/](examples/basic/) for a full Vite project.

## Manual Test

```bash
npx tsx examples/basic/test.ts
```

Runs the full pipeline end-to-end with an inline provider (no LLM needed).
