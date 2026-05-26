# @pynhu/aigen-example-basic

Demonstrates multi-file usage — `aigen.computeArea()` is called from three shape modules with different argument signatures, and the pipeline generates a single merged function.

```
src/
  main.ts          -- entry point, imports shape modules
  shapes/
    circle.ts      -- calls aigen.computeArea("circle", radius)
    rect.ts        -- calls aigen.computeArea("rect", width, height)
    triangle.ts    -- calls aigen.computeArea("triangle", base, height, { hint: ... })
```

## Usage

```bash
pnpm build
```

On build, Vite will:
1. Scan `src/` for `aigen.*(...)` calls across all files
2. Merge same-named calls (e.g., all `computeArea` calls become one function)
3. Generate implementations via LLM
4. Write `src/agent.generated.ts`
5. Compile everything together

## Customization

- **Hint**: `aigen.fn(arg, { hint: "..." })` — last arg as object with `hint` key
- **Skip**: leave an existing function in `agent.generated.ts` to skip regeneration
- **Cache**: set `noCache: true` in plugin opts to force regeneration
