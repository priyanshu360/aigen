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

    const compileOk = await checkCompilation(result.code)
    if (compileOk) {
      return {
        success: true,
        implementation: result.code,
        attempts: attempt,
      }
    }

    current = result.code
    lastError = compileOk
  }

  return {
    success: false,
    implementation: current,
    attempts: maxAttempts,
    lastError,
  }
}

async function checkCompilation(_code: string): Promise<string | true> {
  return true
}
