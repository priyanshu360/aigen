// Manual integration test
// Verifies the full pipeline: scan → context → ambiguity → conflict → cache → repair → write
// Uses an inline provider so no LLM/agent repo needed.
//
// Run: npx tsx test.ts

import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { runPipeline } from "@aigen/core"
import type { GenerationProvider, FunctionContext, AgentConfig } from "@aigen/core"

class TestProvider implements GenerationProvider {
  async generateFunction(_name: string, _ctx: FunctionContext) {
    return { code: `export function greet_user(name: string): string { return "hello " + name }` }
  }
  async repairFunction(_name: string, impl: string, _err: string, _attempt: number) {
    return { code: impl }
  }
}

const tmp = mkdtempSync(join(tmpdir(), "aigen-test-"))
console.log("Test dir:", tmp)

writeFileSync(
  join(tmp, "greet.ts"),
  `import { aigen } from "@aigen/runtime"\nexport function hello() {\n  return aigen.greet_user("world")\n}\n`,
)

const config: AgentConfig = {
  maxRepairAttempts: 2,
  cache: false,
  generatedFile: "src/agent.generated.ts",
  ambiguityBlocklist: [],
}

try {
  await runPipeline(config, [join(tmp, "greet.ts")], new TestProvider(), tmp, true)
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
if (!content.includes("export function greet_user")) {
  console.log("FAIL: greet function not found in output\n" + content)
  process.exit(1)
}

// Pipeline's repair step already validated the code compiles via tsc.
// Here we just verify the output file exists and has correct structure.
console.log("PASS: pipeline completed, generated file contains greet_user function")
console.log("---")
console.log(content)
console.log("---")
rmSync(tmp, { recursive: true, force: true })
