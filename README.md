# Aigen — Build-Time TypeScript Function Generation

Write the flow. Let the build generate the implementations.

```typescript
import { aigen } from "@pynhu/aigen-runtime"

const emails = aigen.extract_emails_from_text(body)
const slug   = aigen.slugify_title(title)
```

During `vite build`, Aigen scans your source for `aigen.*` calls, generates implementations via an LLM agent, validates them with `tsc`, and writes them to `src/agent.generated.ts`.

## Prerequisites

- Node.js >= 18
- An **Anthropic API key** set as `ANTHROPIC_API_KEY` in your environment
- The **aigen-agent** repo cloned alongside your project:

```bash
git clone <aigen-agent-repo-url> ../aigen-agent
```

## Setup

### 1. Install the packages

```bash
pnpm add @pynhu/aigen-vite @pynhu/aigen-runtime
```

### 2. Configure the plugin

**`vite.config.ts`**

```ts
import { defineConfig } from "vite"
import { aigenPlugin } from "@pynhu/aigen-vite"

export default defineConfig({
  plugins: [aigenPlugin({ agentDir: "../aigen-agent" })],
})
```

### 3. Use aigen in your code

**`src/main.ts`**

```ts
import { aigen } from "@pynhu/aigen-runtime"

const domain = aigen.get_domain_from_email("user@example.com")
console.log(domain)
```

### 4. Build

```bash
pnpm build
```

The first build generates all functions, writes `src/agent.generated.ts`, and compiles everything together.

## How It Works

```
Source (aigen.* calls)
    │
    ▼
Scanner ──▶ Context Collector ──▶ LLM Agent ──▶ tsc Validation
    │                                              │
    └── Cache (SHA-256) ◄──────────────────────────┘
                                                    │
                                                    ▼
                                        src/agent.generated.ts
                                                    │
                                                    ▼
                                        Vite/esbuild bundle
```

1. **Scanner** finds all `aigen.*(...)` calls across your source files
2. **Context Collector** gathers nearby code, imports, parent function signatures
3. **LLM Agent** generates implementations using your agent-repo skills
4. **tsc Validation** compiles the generated code and retries on failure
5. **Writing** appends `export const aigen = { fn1, fn2 }` to the generated file
6. **Alias** redirects `@pynhu/aigen-runtime` imports to the real generated file

## Hints

Steer generation with a `{ hint }` options object as the last argument:

```ts
aigen.extract_emails_from_text(body, { hint: "Return unique emails only, lowercase" })
```

## Skipping Existing Functions

If a function already exists in `src/agent.generated.ts`, Aigen skips it:

```
[AgentGen] Skipping 'extract_emails_from_text' — already exists at src/agent.generated.ts:12
```

Delete the function from the generated file and re-run to regenerate.

## Multi-File

`aigen.*` calls can span multiple files — same-named calls are merged into a single function:

```ts
// src/shapes/circle.ts
aigen.computeArea("circle", radius)

// src/shapes/rect.ts
aigen.computeArea("rect", width, height)
```

Both contribute to one `computeArea` function with a switch on the shape.

## Caching

Generated functions are cached in `.aigen/cache.json` by SHA-256 hash of `name + arg types + hint`. Pass `noCache: true` to force regeneration.

## Packages

| Package | Description |
|---|---|
| `@pynhu/aigen-core` | Scanner, context collector, cache, prompt builder, repair loop, pipeline orchestrator |
| `@pynhu/aigen-runtime` | Runtime re-export (`import { aigen } from "@pynhu/aigen-runtime"`) |
| `@pynhu/aigen-vite` | Vite plugin |
| `@pynhu/aigen-esbuild` | esbuild plugin |

## Example

See [examples/basic/](examples/basic/) for a full multi-file Vite project.

## Manual Test

```bash
npx tsx examples/basic/test.ts
```

Runs the pipeline end-to-end with an inline test provider (no LLM needed).
