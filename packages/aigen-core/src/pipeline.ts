import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs"
import { join } from "node:path"
import { scanSourceFiles } from "./scanner"
import { collectAllContexts } from "./context"
import { checkAmbiguity } from "./ambiguity"
import { detectConflicts } from "./conflict"
import { computeHash, getCachedImplementation, setCachedImplementation } from "./cache"
import { repairImplementation } from "./repair"
import type { AgentConfig, GenerationProvider } from "./types"

const NAMESPACE = "[AgentGen]"
const LOCK_MARKER = "@aigen-lock"

export async function runPipeline(
  config: AgentConfig,
  sources: string[],
  provider: GenerationProvider,
  rootDir: string,
  noCacheOverride = false
): Promise<void> {
  const useCache = config.cache && !noCacheOverride

  const { calls } = scanSourceFiles(sources)

  if (calls.length === 0) return

  for (const call of calls) {
    const error = checkAmbiguity(call.functionName, config.ambiguityBlocklist)
    if (error) {
      console.error(`${NAMESPACE} ERROR: ${error.message}`)
      if (error.suggestions?.length) {
        console.error(`\nSuggested alternatives:`)
        for (const s of error.suggestions) {
          console.error(`  aigen.${s}`)
        }
        console.error(`\nRename the function call and re-run the build.`)
      }
      process.exit(1)
    }
  }

  const conflict = detectConflicts(calls)
  if (conflict) {
    console.error(
      `${NAMESPACE} ERROR: Conflicting signatures detected for '${conflict.functionName}':\n`
    )
    for (const loc of conflict.locations) {
      console.error(`  ${loc.sourceFile}:${loc.lineNumber}  — ${loc.signature}`)
    }
    console.error(
      `\nResolve the conflict by:\n` +
      `  1. Using the same signature in all call sites, or\n` +
      `  2. Renaming one call to a different function ` +
      `(e.g. ${conflict.functionName}_v2)`
    )
    process.exit(1)
  }

  const lockedFunctions = readLockedFunctions(rootDir, config.generatedFile)
  if (lockedFunctions.size > 0) {
    console.log(`${NAMESPACE} Skipping ${lockedFunctions.size} locked function(s)`)
  }

  const contexts = collectAllContexts(calls)

  const generatedFunctions: string[] = []
  const seen = new Set<string>()

  for (const ctx of contexts) {
    if (lockedFunctions.has(ctx.functionName)) {
      generatedFunctions.push(lockedFunctions.get(ctx.functionName)!)
      seen.add(ctx.functionName)
      continue
    }

    const hintTypes = ctx.hint
      ? ctx.args.slice(0, -1).map((a) => a.type).join(",")
      : ctx.args.map((a) => a.type).join(",")
    const hash = computeHash(ctx.functionName, hintTypes, ctx.hint)

    if (useCache) {
      const cached = getCachedImplementation(rootDir, hash)
      if (cached) {
        generatedFunctions.push(cached)
        seen.add(ctx.functionName)
        continue
      }
    }

    const result = await provider.generateFunction(ctx.functionName, ctx)
    if (!result) {
      console.error(
        `${NAMESPACE} ERROR: Could not generate '${ctx.functionName}'.`
      )
      process.exit(1)
    }

    const compileResult = await repairImplementation(
      ctx.functionName,
      result.code,
      "",
      provider,
      config.maxRepairAttempts
    )

    if (!compileResult.success) {
      console.error(
        `${NAMESPACE} ERROR: Could not generate '${ctx.functionName}' after ${compileResult.attempts} attempts.\n` +
        `Last compiler error: ${compileResult.lastError}\n` +
        `Review the function name and hint, then re-run the build.`
      )
      process.exit(1)
    }

    if (useCache) {
      setCachedImplementation(rootDir, hash, compileResult.implementation)
    }

    generatedFunctions.push(compileResult.implementation)
    seen.add(ctx.functionName)
  }

  for (const [name, code] of lockedFunctions) {
    if (!seen.has(name)) {
      generatedFunctions.push(code)
    }
  }

  writeGeneratedFile(rootDir, config.generatedFile, generatedFunctions)
  console.log(`${NAMESPACE} Generated ${generatedFunctions.length} function(s) in ${config.generatedFile}`)
}

function readLockedFunctions(
  rootDir: string,
  relativePath: string
): Map<string, string> {
  const fullPath = join(rootDir, relativePath)
  if (!existsSync(fullPath)) return new Map()

  const text = readFileSync(fullPath, "utf-8")
  const locked = new Map<string, string>()

  const funcRegex = /^(?:\/\/\s*@aigen-lock\s*\n+)?export\s+function\s+(\w+)/gm
  let match: RegExpExecArray | null
  const funcStarts: { name: string; index: number; locked: boolean }[] = []

  while ((match = funcRegex.exec(text)) !== null) {
    const pos = match.index
    const preceding = text.slice(Math.max(0, pos - 50), pos)
    funcStarts.push({
      name: match[1],
      index: pos,
      locked: preceding.includes(LOCK_MARKER),
    })
  }

  for (let i = 0; i < funcStarts.length; i++) {
    if (!funcStarts[i].locked) continue
    const start = funcStarts[i].index
    const end = i + 1 < funcStarts.length
      ? funcStarts[i + 1].index
      : text.length
    locked.set(funcStarts[i].name, text.slice(start, end).trim())
  }

  return locked
}

function writeGeneratedFile(
  rootDir: string,
  relativePath: string,
  functions: string[]
): void {
  const fullPath = join(rootDir, relativePath)
  const header = `// AUTO GENERATED — do not edit by hand\n` +
    `// To lock a function from regeneration, add: // @aigen-lock\n\n`

  const content = header + functions.join("\n\n") + "\n"

  const dir = fullPath.substring(0, fullPath.lastIndexOf("/"))
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }

  writeFileSync(fullPath, content, "utf-8")
}
