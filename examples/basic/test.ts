// Manual integration test — verifies multi-file scan with same function name
// Run: npx tsx test.ts

import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { runPipeline } from "@aigen/core"
import type { GenerationProvider, FunctionContext, AgentConfig } from "@aigen/core"

class TestProvider implements GenerationProvider {
  async generateFunction(_name: string, _ctx: FunctionContext) {
    const code = `export function computeArea(shape: string, ...dims: number[]): number {
  switch (shape) {
    case "circle": return Math.PI * dims[0] * dims[0]
    case "rect": return dims[0] * dims[1]
    case "triangle": return 0.5 * dims[0] * dims[1]
    default: return 0
  }
}`
    return { code }
  }
  async repairFunction(_name: string, impl: string, _err: string, _attempt: number) {
    return { code: impl }
  }
}

const tmp = mkdtempSync(join(tmpdir(), "aigen-test-"))
console.log("Test dir:", tmp)

// Create multi-file source with same function name across files
writeFileSync(
  join(tmp, "circle.ts"),
  `import { aigen } from "@aigen/runtime"\nexport function area(r: number) { return aigen.computeArea("circle", r) }\n`,
)
writeFileSync(
  join(tmp, "rect.ts"),
  `import { aigen } from "@aigen/runtime"\nexport function area(w: number, h: number) { return aigen.computeArea("rect", w, h) }\n`,
)
writeFileSync(
  join(tmp, "triangle.ts"),
  `import { aigen } from "@aigen/runtime"\nexport function area(b: number, h: number) { return aigen.computeArea("triangle", b, h, { hint: "half base times height" }) }\n`,
)

const config: AgentConfig = {
  maxRepairAttempts: 2,
  cache: false,
  generatedFile: "src/agent.generated.ts",
}

try {
  await runPipeline(config, [
    join(tmp, "circle.ts"),
    join(tmp, "rect.ts"),
    join(tmp, "triangle.ts"),
  ], new TestProvider(), tmp, true)
} catch (err) {
  console.log("FAIL: pipeline threw:", err instanceof Error ? err.message : err)
  process.exit(1)
}

const genFile = join(tmp, "src/agent.generated.ts")
if (!existsSync(genFile)) {
  console.log("FAIL: agent.generated.ts not created")
  process.exit(1)
}

const content = readFileSync(genFile, "utf-8")
if (!content.includes("export function computeArea")) {
  console.log("FAIL: computeArea not found in output\n" + content)
  process.exit(1)
}

if (!content.includes("export const aigen = { computeArea }")) {
  console.log("FAIL: aigen namespace not found in output\n" + content)
  process.exit(1)
}

// Should only have one computeArea function (same name merged)
const funcMatches = content.match(/export function computeArea/g)
if (funcMatches && funcMatches.length > 1) {
  console.log("FAIL: duplicate computeArea functions\n" + content)
  process.exit(1)
}

console.log("PASS: multi-file pipeline with same function name merged correctly")
console.log("---")
console.log(content)
console.log("---")
rmSync(tmp, { recursive: true, force: true })
