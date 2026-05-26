import { execSync } from "node:child_process"
import { writeFileSync, mkdtempSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { createRequire } from "node:module"
import type { GenerationProvider } from "./types"

const _require = createRequire(import.meta.url)

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

    const tscPath = resolveTscPath()
    if (!tscPath) return "TypeScript compiler not found"

    try {
      execSync(
        `"${tscPath}" --noEmit --strict --target es2022 --module esnext test.ts`,
        {
          cwd: dir,
          stdio: ["ignore", "pipe", "pipe"],
          timeout: 10000,
        }
      )
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

function resolveTscPath(): string | null {
  try {
    const tsPkg = _require.resolve("typescript")
    return join(tsPkg, "../../bin/tsc")
  } catch {
    const fromCwd = join(process.cwd(), "node_modules", "typescript", "bin", "tsc")
    try {
      _require.resolve(fromCwd)
      return fromCwd
    } catch {
      return null
    }
  }
}
