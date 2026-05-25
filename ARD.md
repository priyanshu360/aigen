# ARD: AgentGen — Build-Time Utility Function Generation for TypeScript

> **Status:** Draft v2  
> **Audience:** Coding agent / implementation team  
> **Namespace:** `aigen` (short for Aigen)

---

## 1. Executive Summary

AgentGen is a TypeScript build-time code generation tool that lets developers reference utility functions before implementing them. During the build process, AgentGen discovers these calls, synthesizes implementations via a Aigen-backed LLM skill, validates them through TypeScript compilation, and writes the generated code into the repository.

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

AgentGen eliminates this interrupt entirely by making the build pipeline itself the code generator.

---

## 3. Namespace: `aigen`

The import namespace is `aigen`, short for **Aigen**. This replaces the generic `agent` prefix from earlier drafts.

```typescript
import { aigen } from "@aigen/runtime"

const emails = aigen.extract_emails_from_text(body)
const domain = aigen.get_domain_from_email(email)
const lines  = aigen.read_lines_from_string(content)
```

`aigen` is a Proxy object at runtime. Before build-time generation has run, calling any `aigen.*` method throws a clear error:

```
[AgentGen] Function 'extract_emails_from_text' has not been generated yet.
Run `npm run build` to generate it.
```

After generation, the Proxy delegates to the implementations in `agent.generated.ts`.

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

No implementation exists yet. AgentGen generates it at build time.

### Optional Hint String

Developers can append a plain string as the **last argument** to guide generation. This string is stripped at build time and never appears in the generated function signature.

```typescript
const emails = aigen.extract_emails_from_text(
  body,
  "Return unique emails only, lowercase"
)

const slug = aigen.slugify_title(
  title,
  "Preserve unicode characters"
)
```

**Rule:** The hint must always be a string literal (not a variable). The build scanner detects it via AST and excludes it from the inferred function signature.

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

### Disallowed — Ambiguous names

```typescript
aigen.process(data)      // ❌ too generic
aigen.execute(payload)   // ❌ too generic
aigen.run(input)         // ❌ too generic
aigen.compute(value)     // ❌ too generic
aigen.handle(event)      // ❌ too generic
aigen.do(thing)          // ❌ too generic
```

**Ambiguity rule:** A function name is rejected at build time if it:
1. Consists of a single generic verb from the blocklist: `process`, `run`, `execute`, `compute`, `handle`, `do`, `perform`, `apply`, `transform`, `convert`, `get`, `set`, `update`, `parse` (when used alone without a subject noun)
2. Contains fewer than two semantic tokens (e.g. `process_data` has subject `data` but is still too vague — prefer `normalize_user_csv`)

**Build failure output:**

```
[AgentGen] ERROR: Function name 'process' is too ambiguous to generate.

Suggested alternatives:
  aigen.process_user_csv(data)
  aigen.process_invoice_rows(data)
  aigen.process_payment_event(data)

Rename the function call and re-run the build.
```

---

## 7. Signature Conflict Detection

If the same function name is called in multiple places with **different argument shapes**, AgentGen emits an error rather than guessing:

```
[AgentGen] ERROR: Conflicting signatures detected for 'extract_emails_from_text':

  src/mailer.ts:12  — (body: string)
  src/parser.ts:34  — (body: string, limit: number)

Resolve the conflict by:
  1. Using the same signature in all call sites, or
  2. Renaming one call to a different function (e.g. extract_first_n_emails_from_text)
```

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

### Pipeline

```
TypeScript source
      ↓
AST scan — discover aigen.* calls
      ↓
Signature conflict check
      ↓
Ambiguity check
      ↓
Context collection (name, args, assignment var, nearby code, imports)
      ↓
Cache lookup — hash(function_name + context)
      ↓  [cache miss]
Prompt builder
      ↓
Aigen runtime (LLM call via agent repo skills)
      ↓
Write to agent.generated.ts
      ↓
TypeScript compile
      ↓ [error?]
Compile error repair skill → retry (max N attempts)
      ↓ [success]
Bundle
```

### Generated Output

```typescript
// AUTO GENERATED — do not edit by hand
// To lock a function from regeneration, add: // @aigen-lock

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
| Hint string | `"Return unique emails only"` | Shape the implementation |
| Nearby code (±10 lines) | `for (const email of emails)` | Infer usage intent |
| Available imports | `import fs from "fs"` | Constrain implementation to available libs |

---

## 10. Build-Time Caching

To avoid redundant LLM calls, AgentGen maintains a local cache keyed by a SHA-256 hash of:

```
hash(function_name + serialized_argument_types + hint_string)
```

**Cache behaviour:**

- On cache hit: skip generation, use cached implementation
- On cache miss: generate, compile, and write; store in cache on success
- Cache is stored in `.aigen/cache.json` (gitignored by default)
- Developers can force regeneration with `--no-cache` flag:

```bash
npm run build -- --no-cache
```

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
- Deterministic builds (no generation required in CI if the file is present)
- Code review support — teammates can review and reject bad generations
- Easier debugging — generated code is visible and readable
- No hidden generation state

### Function Ownership and Locking

By default, all functions in `agent.generated.ts` are regenerated if their call-site context changes.

To **lock** a function and prevent future builds from overwriting manual edits:

```typescript
// @aigen-lock
export function extract_emails_from_text(text: string): string[] {
  // custom hand-written implementation
  // AgentGen will not touch this function
}
```

**Lock behaviour:**

- Locked functions are excluded from the generation pipeline entirely
- If a locked function's signature conflicts with a call site, the build emits a warning (not an error)
- To unlock, remove the comment and re-run the build

---

## 12. Architecture

### TypeScript Source → AST → Generation → Compile

```
src/**/*.ts
      ↓
@aigen/scanner  (ts-morph AST parser)
      ↓
Discovers all aigen.* calls
      ↓
@aigen/context  (collects per-call context)
      ↓
@aigen/cache    (SHA-256 hash lookup)
      ↓
@aigen/prompt   (builds structured prompt)
      ↓
@aigen/runtime  (calls Aigen)
      ↓
agent.generated.ts
      ↓
tsc (TypeScript compiler)
      ↓ error?
@aigen/repair   (calls Aigen repair skill with error message)
      ↓ retry loop (max attempts: configurable, default 3)
      ↓ success
bundle
```

### `@aigen/runtime` Package

The `aigen` export is a `Proxy` object:

```typescript
// @aigen/runtime/index.ts

export const aigen = new Proxy({} as Record<string, (...args: unknown[]) => unknown>, {
  get(_, fnName: string) {
    return (...args: unknown[]) => {
      throw new Error(
        `[AgentGen] '${fnName}' has not been generated yet. Run \`npm run build\`.`
      )
    }
  }
})
```

At runtime (post-build), the generated file is imported and its exports are merged into the Proxy target, so `aigen.extract_emails_from_text` resolves to the real implementation.

---

## 13. Aigen Integration

### Why Aigen

Aigen provides:
- Agent definitions stored in Git (versioned prompts)
- Reusable, composable generation skills
- Model abstraction (swap OpenAI / Anthropic / Gemini / local without code changes)
- Workflow orchestration

### Agent Repository Structure

```
typescript-function-agent/
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

### Skill Responsibilities

**Utility Generation Skill**

Input:
```
Function name: extract_emails_from_text
Arguments: text: string
Return type (inferred): string[]
Hint: "Return unique emails only"
Nearby code: for (const email of emails) { ... }
```

Output:
```typescript
export function extract_emails_from_text(text: string): string[] {
  const matches = text.match(
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
  )
  return [...new Set(matches ?? [])]
}
```

**Type Inference Skill**

- Infers argument types from call-site usage (variable names, surrounding code, TypeScript inference where available)
- Infers return type from assignment variable name and downstream usage
- Falls back to `unknown` with a build warning if inference is impossible

**Compile Error Repair Skill**

Input: original implementation + TypeScript compiler error message  
Output: corrected implementation  
Retries up to `maxRepairAttempts` (default: 3, configurable in `aigen.config.ts`)

### Model Abstraction

Aigen supports configurable model backends. `aigen.config.ts` specifies:

```typescript
export default {
  model: "anthropic/claude-sonnet-4",   // or openai/gpt-4o, google/gemini-pro, etc.
  maxRepairAttempts: 3,
  cache: true,
  generatedFile: "src/agent.generated.ts",
}
```

---

## 14. Error Handling

### Ambiguous Name

```
[AgentGen] ERROR: 'process' is too ambiguous.
Suggested: process_user_csv, process_invoice_rows
```

### Signature Conflict

```
[AgentGen] ERROR: Conflicting signatures for 'fn_name' across call sites.
See section 7 for resolution steps.
```

### Generation Failure (LLM could not produce valid output)

```
[AgentGen] ERROR: Could not generate 'fn_name' after 3 attempts.
Last compiler error: Property 'flatMap' does not exist on type 'string'.
Review the function name and hint, then re-run the build.
```

### All errors are blocking

No generated file is written if any generation step fails. The build exits non-zero. This prevents partial states.

---

## 15. File Structure (Implementation)

```
packages/
├── aigen-scanner/       ← ts-morph AST scanner, discovers aigen.* calls
├── aigen-context/       ← context collector (args, nearby code, imports)
├── aigen-cache/         ← SHA-256 hash cache, .aigen/cache.json
├── aigen-prompt/        ← builds structured prompts per call
├── aigen-runtime/       ← aigen Proxy export, @aigen/runtime npm package
├── aigen-repair/        ← compile error repair loop
└── aigen-cli/           ← npm run build integration, aigen.config.ts loader

agent-repo/                 ← Aigen skill repository
├── agent.yaml
├── skills/
└── workflows/
```

---

## 16. Configuration

`aigen.config.ts` at project root:

```typescript
import { defineConfig } from "@aigen/cli"

export default defineConfig({
  // LLM model (via Aigen abstraction)
  model: "anthropic/claude-sonnet-4",

  // Max repair attempts on compile error
  maxRepairAttempts: 3,

  // Enable/disable build cache
  cache: true,

  // Output file for generated functions
  generatedFile: "src/agent.generated.ts",

  // Blocklist of ambiguous single-token names (appended to built-in list)
  ambiguityBlocklist: [],

  // CI mode: skip generation if generatedFile already exists
  // Set to true in CI to treat committed generated file as source of truth
  ciMode: process.env.CI === "true",
})
```

---

## 17. CI Behaviour

In CI (`ciMode: true` or `CI=true`):

- If `agent.generated.ts` exists in the repo, skip all generation and use it as-is
- TypeScript compilation still runs against the committed file
- If `agent.generated.ts` is missing, CI fails with:

```
[AgentGen] ERROR: agent.generated.ts not found and ciMode is enabled.
Commit the generated file before pushing, or disable ciMode.
```

This ensures CI builds are fast, deterministic, and never call the LLM.

---

## 18. Success Metrics

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

## 19. Resolved Design Decisions

| Question | Decision | Rationale |
|---|---|---|
| Namespace | `aigen` (Aigen) | Short, memorable, tied to brand |
| Hint syntax | Final string literal argument | Simpler than `aigen.desc()`; hint is obvious from position |
| Generated file location | Single `src/agent.generated.ts` (V1) | Simpler; multi-file in V2 when function count warrants it |
| Commit strategy | Always commit generated file | Deterministic builds, code review, CI safety |
| Function ownership | Regenerate by default; `// @aigen-lock` to freeze | Explicit lock prevents surprise overwrites |
| Model selection | Configurable via `aigen.config.ts` | Aigen abstraction handles provider swap |
| Ambiguity detection | Blocklist of generic single-verb names + two-token minimum rule | Precise enough to enforce without false positives |
| Signature conflicts | Build error — developer must resolve | Guessing the "right" signature silently would produce wrong code |
| Caching | SHA-256 hash of name + arg types + hint | Avoids redundant LLM calls; `--no-cache` escape hatch |
| CI behaviour | Skip generation if file committed | LLM calls in CI are slow, expensive, and non-deterministic |

---

## 20. Open Questions (V2 Scope)

- **Multi-file generated output** — split `agent.generated.ts` by domain when function count exceeds ~20
- **Watch mode** — regenerate incrementally on file save during `npm run dev`
- **Test generation** — generate unit tests alongside function implementations
- **Dependency-aware generation** — if `aigen.fn_a` is used inside a hand-written function that also calls `aigen.fn_b`, generate them in dependency order
- **VSCode extension** — inline preview of what would be generated, without running the full build

---

## Appendix A — Ambiguity Blocklist (Built-In)

Single-token names on this list always fail the build:

```
process, run, execute, compute, handle, do, perform, apply,
transform, convert, get, set, update, parse, format, check,
validate, fetch, load, save, send, receive, map, filter, reduce
```

These are only blocked when used **alone** (e.g. `aigen.process`). Combined with a subject noun they are allowed:

```typescript
aigen.process_csv_rows(data)    // ✅ allowed
aigen.parse_iso_date(str)       // ✅ allowed — subject noun "iso_date" is specific
aigen.filter_inactive_users(users) // ✅ allowed
```
