// Manual integration test
// Verifies the full pipeline: scan → context → ambiguity → conflict → cache → repair → write
// Uses an inline provider so no LLM/agent repo needed.
//
// Run: node test.mjs

import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { runPipeline } from "@aigen/core"

/** @typedef {import("@aigen/core").GenerationProvider} GenerationProvider */
/** @typedef {import("@aigen/core").FunctionContext} FunctionContext */
/** @typedef {import("@aigen/core").AgentConfig} AgentConfig */

class TestProvider implements GenerationProvider {
  async generateFunction(name: string, ctx: FunctionContext) {
    return { code: `export function ${name}(name: string): string { return "hello " + name }` }
  }
  async repairFunction(name: string, impl: string, err: string, attempt: number) {
    return { code: impl }
  }
}

const tmp = mkdtempSync(join(tmpdir(), "aigen-test-"))
console.log("Test dir:", tmp)

// Create source file with aigen call
const srcDir = join(tmp, "src")
writeFileSync(join(tmp, "greet.ts"), `import { aigen } from "@aigen/runtime"\nexport function hello() {\n  return aigen.greet("world")\n}\n`)

const config: AgentConfig = {
  maxRepairAttempts: 2,
  cache: false,
  generatedFile: "src/agent.generated.ts",
  ambiguityBlocklist: [],
}

try {
  await runPipeline(config, [join(tmp, "greet.ts")], new TestProvider(), tmp, true)
} catch (err) {
  console.log("FAIL: pipeline threw:", err.message)
  process.exit(1)
}

// Verify output
const genFile = join(tmp, "src/agent.generated.ts")
if (!existsSync(genFile)) {
  console.log("FAIL: agent.generated.ts not created")
  process.exit(1)
}

const content = readFileSync(genFile, "utf-8")
if (!content.includes("export function greet")) {
  console.log("FAIL: greet function not found in output")
  console.log(content)
  process.exit(1)
}

// Verify it actually compiles
import { execSync } from "node:child_process"
writeFileSync(join(tmp, "tsconfig.json"), JSON.stringify({
  compilerOptions: { strict: true, target: "ES2022", module: "ESNext", noEmit: true, moduleResolution: "bundler" },
  include: ["src/**/*.ts"],
}))

try {
  execSync("npx tsc --noEmit", { cwd: tmp, stdio: "pipe", timeout: 15000 })
  console.log("PASS: pipeline completed, generated file compiles with tsc")
} catch (e) {
  console.log("FAIL: generated file does not compile")
  console.log(e.stderr?.toString() || e.message)
  process.exit(1)
} finally {
  rmSync(tmp, { recursive: true, force: true })
}
