# ARD: Aigen — Build-Time Utility Function Generation for TypeScript

> **Status:** Draft v3
> **Audience:** Coding agent / implementation team
> **Namespace:** `aigen`

---

## 1. Executive Summary

Aigen is a TypeScript build-time code generation tool that lets developers reference utility functions before implementing them. During the build process, Aigen discovers these calls, synthesizes implementations via an LLM-powered agent skill, validates them through TypeScript compilation, and writes the generated code into the repository.

**Core philosophy:**

> Write the flow. Let the build generate the obvious parts.

---

## 2. Problem Statement

Developers spend significant time writing repetitive utility functions:

- `extract_emails_from_text()`
- `slugify_title()`
- `read_lines_from_string()`
- `get_domain_from_email()`
- `remove_duplicate_strings()`

These functions are predictable, small, repetitive, and not central to business logic. Current AI tools require context switching:

```
Need helper → Open AI chat → Describe helper → Copy code → Paste code → Continue work
```

Aigen eliminates this interrupt entirely by making the build pipeline itself the code generator.

---

## 3. Namespace: `aigen`

```typescript
import { aigen } from "@aigen/runtime"

const emails = aigen.extract_emails_from_text(body)
const domain = aigen.get_domain_from_email(email)
const lines  = aigen.read_lines_from_string(content)
```

Before build-time generation, the import resolves to an empty module — calling `aigen.*` will throw a runtime error since no exports exist.

After generation, the build plugin resolves `@aigen/runtime` to the generated file, so `import { aigen }` transparently gets the implementations.

---

## 4. Goals

### Primary Goals
- Generate simple utility functions automatically during build
- Require minimal syntax changes from the developer
- Keep all generated code in source control
- Support iterative compile-and-fix generation
- Validate output through TypeScript compilation before build succeeds

### Non-Goals (V1)
- Repository generation
- SQL generation
- API client generation
- Full application or multi-file architecture generation
- Autonomous coding agents
- Functions with side effects (network calls, file I/O, DB writes)

---

## 5. Syntax

### Basic Usage

```typescript
import { aigen } from "@aigen/runtime"

const emails = aigen.extract_emails_from_text(body)
```

No implementation exists yet. Aigen generates it at build time.

### Optional Hint Object

Developers can append an options object as the **last argument** to guide generation. The object is stripped at build time and never appears in the generated function signature.

```typescript
const emails = aigen.extract_emails_from_text(
  body,
  { hint: "Return unique emails only, lowercase" }
)

const slug = aigen.slugify_title(
  title,
  { hint: "Preserve unicode characters" }
)
```

**Rules:**
- The options object must be the last argument
- If used with no other arguments, the entire call becomes zero-arg (options are purely hint, not a real argument)
- The `hint` value must be a string literal (not a variable)

---

## 6. Naming Rules

### Allowed — Semantic, specific names

```typescript
aigen.extract_emails_from_text(text)
aigen.read_lines_from_string(content)
aigen.slugify_title(title)
aigen.remove_duplicate_strings(values)
aigen.get_domain_from_email(email)
aigen.normalize_phone_number(value)
aigen.parse_csv_rows(csvText)
aigen.truncate_string_to_words(text, limit)
```

---

## 7. Multi-Signature Merging

If the same function name is called with **different argument patterns** across multiple call sites, Aigen merges them into a single function using **union types**:

```
[AgentGen] 'extract_emails_from_text' called with 2 arg patterns: (body: string), (body: string, limit: number)
```

The LLM receives all variant patterns and generates a single function signature that handles both:

```typescript
export function extract_emails_from_text(body: string, limit?: number): string[] { ... }
```

This avoids blocking the build — the pipeline groups contexts, picks the richest variant, and passes all patterns as `argVariants` to the prompt.

---

## 8. Example Workflow

### Developer Code

```typescript
import { aigen } from "@aigen/runtime"

const emails = aigen.extract_emails_from_text(
  body,
  "Return unique emails only"
)

const domain = aigen.get_domain_from_email(email)
const lines  = aigen.read_lines_from_string(content)
```

### Build Command

```bash
npm run build
```

### Generated Output

```typescript
// AUTO GENERATED — do not edit by hand
// Delete a function and re-run the build to regenerate it.

export function extract_emails_from_text(text: string): string[] {
  const matches = text.match(
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
  )
  return [...new Set(matches ?? [])]
}

export function get_domain_from_email(email: string): string {
  return (email.split("@")[1] ?? "").toLowerCase()
}

export function read_lines_from_string(content: string): string[] {
  return content.split(/\r?\n/)
}
```

---

## 9. Context Collection

For each `aigen.*` call discovered, the following context is collected and included in the generation prompt:

| Signal | Example | Purpose |
|---|---|---|
| Function name | `extract_emails_from_text` | Primary semantic signal |
| Arguments | `body: string` | Infer input types |
| Assignment variable | `const emails =` | Infer return type |
| Hint string | `{ hint: "Return unique emails only" }` | Shape the implementation |
| Nearby code (+10 lines) | `for (const email of emails)` | Infer usage intent |
| Available imports | `import fs from "fs"` | Constrain implementation to available libs |

---

## 10. Build-Time Caching

To avoid redundant LLM calls, Aigen maintains a local cache keyed by a SHA-256 hash of:

```
hash(function_name + serialized_argument_types + hint_string)
```

**Cache behaviour:**

- On cache hit: skip generation, use cached implementation
- On cache miss: generate, compile, and write; store in cache on success
- Cache is stored in `.aigen/cache.json` (gitignored by default)
- Developers can force regeneration with `noCache: true` plugin option

---

## 11. Generated Code Management

### File Location

```
src/
├── app.ts
├── users.ts
└── agent.generated.ts     ← all generated functions live here
```

### Source Control

Generated code is **committed to source control** by default. Benefits:
- Deterministic builds (no generation required in CI)
- Code review support — teammates can review and reject bad generations
- Easier debugging — generated code is visible and readable
- No hidden generation state

### Function Existence Check

When a function already exists in `agent.generated.ts`, Aigen skips generation with a message:

```
[AgentGen] Skipping 'extract_emails_from_text' — already exists at src/agent.generated.ts:12
```

**Behaviour:**
- Existing functions are excluded from the generation pipeline and preserved verbatim
- To regenerate, delete the function from the file and re-run the build
- Unused existing functions (no call site in the current scan) are also preserved

---

## 12. Architecture

### Pipeline

```
src/**/*.ts
      ↓
AST scan (ts-morph) — discover aigen.* calls
      ↓
Context collection (args, nearby code, imports, hint, enclosing function)
      ↓
Cache lookup — SHA-256(function_name + arg_types + hint)
      ↓  [cache miss]
Prompt builder — assembles structured prompt
      ↓
LLM agent call (via @open-gitagent/gitagent SDK)
      ↓
Compile validation (real tsc via resolved binary)
      ↓ [error?]
Repair loop — agent receives error, retries (max N)
      ↓ [success]
Write to agent.generated.ts
      ↓
Bundle
```

### Package Structure

```
packages/
├── aigen-core/           ← scanner, context, cache, prompt,
│                           conflict detection, repair, pipeline, config,
│                           GitAgentProvider
├── aigen-runtime/        ← re-exports generated functions
├── aigen-vite/           ← Vite plugin
└── aigen-esbuild/        ← esbuild plugin

examples/
└── basic/                ← minimal Vite example project

aigen-agent/              ← separate repo — agent YAML, SOUL, RULES, skills
```

### `@aigen/runtime`

The runtime package is a lightweight namespace for generated functions. At build time, the plugin resolves `@aigen/runtime` imports to the generated file, so `import { aigen }` transparently gets the implementations. No proxy or runtime overhead.

Before generation, the resolved namespace is empty — calling `aigen.*` before the first build will throw. This is intentional: the build plugin runs before compilation and generates the file.

---

## 13. LLM Agent Integration

### Why the GitAgent SDK

Aigen uses `@open-gitagent/gitagent` which provides:
- Agent definitions stored in Git (versioned prompts)
- Reusable, composable generation skills
- Model abstraction (swap providers without code changes)

### Agent Repository Structure (Separate Repo)

```
aigen-agent/
├── agent.yaml
├── SOUL.md
├── RULES.md
├── skills/
│   ├── utility-function-generation/
│   │   ├── skill.yaml
│   │   └── prompt.md
│   ├── type-inference/
│   │   ├── skill.yaml
│   │   └── prompt.md
│   └── compile-error-repair/
│       ├── skill.yaml
│       └── prompt.md
└── workflows/
    └── generate-function.yaml
```

### `GitAgentProvider`

The `GitAgentProvider` class wraps the `query()` function from `@open-gitagent/gitagent`. It:

1. Builds a prompt via `buildPrompt()` from the context
2. Calls `query({ prompt, dir: agentDir, model })`
3. Extracts the code block from the agent response (` ```typescript ... ``` `)
4. Falls back to brace-balanced extraction for plain `export function` responses
5. Returns `null` on agent error (pipeline exits)

For repairs, it constructs a prompt with the failed implementation and compiler error, and calls the same agent workflow.

---

## 14. Error Handling

### Function Already Exists (Non-blocking)

```
[AgentGen] Skipping 'extract_emails_from_text' — already exists at src/agent.generated.ts:12
```

Existing functions are preserved verbatim. Delete the function from the file and rebuild to regenerate.

### Generation Failure (Blocking)

```
[AgentGen] ERROR: Could not generate 'fn_name' after 3 attempts.
Last compiler error: Property 'flatMap' does not exist on type 'string'.
Review the function name and hint, then re-run the build.
```

### Missing `agentDir` Option (Blocking)

```
[AgentGen] The `agentDir` option is required. Point it to your aigen-agent repo.
```

### TypeScript Compiler Timeout (Blocking)

```
[AgentGen] ERROR: Could not generate 'fn_name' after 3 attempts.
Last compiler error: TypeScript compiler timed out.
```

All blocking errors exit with non-zero. No partial file is written.

---

## 15. Configuration

### Plugin Options

Both `@aigen/vite` and `@aigen/esbuild` accept:

```typescript
interface AigenPluginOptions {
  agentDir: string     // required — path to aigen-agent repo
  configFile?: string  // optional path to aigen.config.ts
  noCache?: boolean    // force regeneration
  model?: string       // LLM model override
}
```

### Config File (`aigen.config.ts`)

```typescript
import { defineConfig } from "@aigen/core"

export default defineConfig({
  model: "anthropic/claude-sonnet-4",
  maxRepairAttempts: 3,
  cache: true,
  generatedFile: "src/agent.generated.ts",
})
```

The config file is loaded at runtime via dynamic `import()`. If absent, all defaults apply.

---

## 16. Success Metrics

### Developer Productivity
- Reduction in time spent writing helper functions (measured via surveys)
- Reduction in context switches during feature development
- Faster prototyping iteration speed

### Technical Metrics
- Successful generation rate (generations that compile on first attempt)
- Compile repair success rate (repairs that succeed within retry budget)
- Average repair attempts per function
- Build latency impact (target: < 2s per new function generation, 0s on cache hit)
- Cache hit rate across builds

---

## 17. Resolved Design Decisions

| Question | Decision | Rationale |
|---|---|---|
| Namespace | `aigen` | Short, memorable, tied to brand |
| Hint syntax | Options object `{ hint: "..." }` as last argument | Explicit named field, no ambiguity with string args |
| Generated file location | Single `src/agent.generated.ts` (V1) | Simpler; multi-file in V2 when warranted |
| Commit strategy | Always commit generated file | Deterministic builds, code review, CI safety |
| Function ownership | Preserve existing by default; delete to regenerate | Simple predictable behavior, no annotation needed |
| Model selection | Configurable via plugin options + config file | GitAgent abstraction handles provider swap |
| Multi-signature handling | Merge with union types via `argVariants` in prompt | Non-blocking — LLM generates one function for all patterns |
| Caching | SHA-256 hash of name + arg types + hint | Avoids redundant LLM calls; `noCache` escape hatch |
| Runtime | Build plugin resolves `@aigen/runtime` to generated file | No Proxy overhead, TypeScript sees real types |
| Package organization | Monolithic `@aigen/core` + thin plugin packages | Fewer packages to publish and manage |
| CLI | No CLI package — Vite/esbuild plugins instead | Natural integration with existing build pipelines |
| CI behaviour | No special CI mode — committed file is always used | Simpler, no env-based branching |
| Compile validation | Real `tsc` binary (resolved from node_modules) | Full type checking accuracy vs. `transpileModule` |

---

## 18. Open Questions (V2 Scope)

- **Multi-file generated output** — split `agent.generated.ts` by domain when function count exceeds ~20
- **Watch mode** — regenerate incrementally on file save during `npm run dev`
- **Test generation** — generate unit tests alongside function implementations
- **Dependency-aware generation** — if `aigen.fn_a` is used inside a hand-written function that also calls `aigen.fn_b`, generate them in dependency order
- **VSCode extension** — inline preview of what would be generated, without running the full build

