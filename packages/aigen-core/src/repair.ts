import { execSync } from "node:child_process"
import { writeFileSync, mkdtempSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import type { GenerationProvider } from "./types"

export interface RepairResult {
  success: boolean
  implementation: string
  attempts: number
  lastError?: string
}

export async function repairImplementation(
  functionName: string,
  implementation: string,
  compileError: string,
  provider: GenerationProvider,
  maxAttempts: number
): Promise<RepairResult> {
  let current = implementation
  let lastError = compileError

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = await provider.repairFunction(
      functionName,
      current,
      lastError,
      attempt
    )
    if (!result) {
      return {
        success: false,
        implementation: current,
        attempts: attempt,
        lastError,
      }
    }

    const check = checkTypeScript(result.code)
    if (check === true) {
      return {
        success: true,
        implementation: result.code,
        attempts: attempt,
      }
    }

    current = result.code
    lastError = check
  }

  return {
    success: false,
    implementation: current,
    attempts: maxAttempts,
    lastError,
  }
}

function checkTypeScript(code: string): string | true {
  const dir = mkdtempSync(join(tmpdir(), "aigen-tsc-"))
  const file = join(dir, "test.ts")

  try {
    writeFileSync(file, code, "utf-8")

    try {
      execSync("npx tsc --noEmit --strict --target es2022 --module esnext test.ts", {
        cwd: dir,
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 10000,
      })
      return true
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      const cleaned = msg
        .split("\n")
        .filter((l) => l.includes("error TS") || l.includes("error:"))
        .join("\n")
        .trim()
      return cleaned || "Unknown compilation error"
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}
