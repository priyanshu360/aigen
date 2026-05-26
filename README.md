# Aigen — Build-Time TypeScript Function Generation

Write the flow. Let the build generate the obvious parts.

```typescript
import { aigen } from "@pynhu/aigen-runtime"

const emails = aigen.extract_emails_from_text(body)
const slug   = aigen.slugify_title(title)
```

During `vite build` (or `esbuild`), Aigen discovers `aigen.*` calls, generates implementations via an LLM agent, validates them with `tsc`, and writes them to `src/agent.generated.ts`.

## Quickstart

```bash
git clone <aigen-agent-repo-url> ../aigen-agent   # agent skills
pnpm add @pynhu/aigen-vite @pynhu/aigen-runtime
```

**`vite.config.ts`**

```ts
import { defineConfig } from "vite"
import { aigenPlugin } from "@pynhu/aigen-vite"

export default defineConfig({
  plugins: [aigenPlugin({ agentDir: "../aigen-agent" })],
})
```

**`src/main.ts`**

```ts
import { aigen } from "@pynhu/aigen-runtime"

const domain = aigen.get_domain_from_email("user@example.com")
console.log(domain)
```

Run `npm run build`. The first build generates and compiles all functions.

## Packages

| Package | Description |
|---|---|
| `@pynhu/aigen-core` | Scanner, context collector, cache, prompt builder, repair loop, pipeline orchestrator |
| `@pynhu/aigen-runtime` | Runtime re-export of generated functions (`import { aigen } from "@pynhu/aigen-runtime"`) |
| `@pynhu/aigen-vite` | Vite plugin |
| `@pynhu/aigen-esbuild` | esbuild plugin |

## Hints

Pass an options object as the last argument to steer generation:

```ts
aigen.extract_emails_from_text(body, { hint: "Return unique emails only, lowercase" })
```

## Skipping Existing Functions

If a function already exists in `src/agent.generated.ts`, Aigen skips it with a message:

```
[AgentGen] Skipping 'extract_emails_from_text' — already exists at src/agent.generated.ts:12
```

Delete the function from the generated file and re-run the build to regenerate it.

## Caching

Aigen caches generated functions in `.aigen/cache.json` by SHA-256 hash of `name + arg types + hint`. Pass `noCache: true` to the plugin to force regeneration.

## Example

See [examples/basic/](examples/basic/) for a full Vite project.

## Manual Test

```bash
npx tsx examples/basic/test.ts
```

Runs the full pipeline end-to-end with an inline provider (no LLM needed).
