# @aigen/example-basic

Minimal example showing how to use the Aigen Vite plugin.

## Prerequisites

You need the **aigen-agent** repository cloned alongside this monorepo:

```bash
git clone <aigen-agent-url> ../aigen-agent
```

## Usage

```bash
pnpm install
pnpm build
```

On build, Vite will:
1. Scan `src/` for `aigen.*(...)` calls
2. Generate implementations using the LLM agent
3. Write them to `src/agent.generated.ts`
4. Compile everything together

## Customization

- Add a **hint** by passing a string as the last argument: `aigen.sayHello("world", "return a friendly greeting")`
- **Lock** a generated function by adding `// @aigen-lock` above it in `src/agent.generated.ts`
- Set `noCache: true` in the plugin options to force regeneration
