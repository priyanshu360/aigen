import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs"
import { join, resolve, sep } from "node:path"
import { scanSourceFiles } from "./scanner"
import { collectAllContexts } from "./context"
import { computeHash, getCachedImplementation, setCachedImplementation } from "./cache"
import { repairImplementation } from "./repair"
import type { AgentConfig, GenerationProvider, FunctionContext, Argument } from "./types"

const NAMESPACE = "[AgentGen]"

/**
 * Main pipeline orchestrator.
 * Scans source files for aigen.*() calls, generates implementations via the provider,
 * validates with tsc, repairs failures, and writes src/agent.generated.ts.
 *
 * @param config - AgentConfig with settings (repair attempts, cache, output path, etc.)
 * @param sources - File paths to scan (e.g. ["src/main.ts"])
 * @param provider - LLM provider implementing generateFunction + repairFunction
 * @param rootDir - Project root for output path and .aigen/cache.json
 * @param noCacheOverride - Skip cache even if config.cache is true
 */
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

  const existingFunctions = readGeneratedFunctions(rootDir, config.generatedFile)

  const contexts = collectAllContexts(calls)

  // Group contexts by function name to handle multiple call-site variants
  const grouped = groupContexts(contexts)

  const generatedFunctions: string[] = []
  const seen = new Set<string>()

  for (const [, group] of grouped) {
    let ctx = pickBestContext(group)
    if (!ctx.hint) {
      const hint = group.find((g) => g.hint)?.hint
      if (hint) ctx = { ...ctx, hint }
    }
    const existing = existingFunctions.get(ctx.functionName)
    if (existing) {
      console.log(
        `${NAMESPACE} Skipping '${ctx.functionName}' — already exists at ${config.generatedFile}:${existing.line}`
      )
      generatedFunctions.push(existing.code)
      seen.add(ctx.functionName)
      continue
    }

    // Collect unique arg patterns across all call sites for the same function
    const allPatterns = collectArgPatterns(group)
    if (allPatterns.length > 1) {
      ctx.argVariants = allPatterns
      const variants = allPatterns.map((p) => `(${p.map((a) => a.type).join(", ")})`).join(", ")
      console.log(`${NAMESPACE} '${ctx.functionName}' called with ${allPatterns.length} arg patterns: ${variants}`)
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

  for (const [name, { code }] of existingFunctions) {
    if (!seen.has(name)) {
      generatedFunctions.push(code)
      seen.add(name)
    }
  }

  writeGeneratedFile(rootDir, config.generatedFile, generatedFunctions, seen)
  console.log(`${NAMESPACE} Generated ${generatedFunctions.length} function(s) in ${config.generatedFile} + aigen namespace`)
}

function resolvePathSafe(rootDir: string, relativePath: string): string {
  const safeRoot = resolve(rootDir) + sep
  const resolved = resolve(join(rootDir, relativePath))
  if (!resolved.startsWith(safeRoot)) {
    throw new Error(`generatedFile path '${relativePath}' escapes project root`)
  }
  return resolved
}

function readGeneratedFunctions(
  rootDir: string,
  relativePath: string
): Map<string, { code: string; line: number }> {
  const fullPath = resolvePathSafe(rootDir, relativePath)
  if (!existsSync(fullPath)) return new Map()

  const text = readFileSync(fullPath, "utf-8")
  const existing = new Map<string, { code: string; line: number }>()

  const funcRegex = /export\s+function\s+(\w+)/g
  let match: RegExpExecArray | null
  const funcStarts: { name: string; index: number }[] = []

  while ((match = funcRegex.exec(text)) !== null) {
    funcStarts.push({ name: match[1], index: match.index })
  }

  for (let i = 0; i < funcStarts.length; i++) {
    const start = funcStarts[i].index
    let end = i + 1 < funcStarts.length
      ? funcStarts[i + 1].index
      : text.length

    // Stop before the namespace export if it's in this range
    const nsIndex = text.indexOf("\nexport const aigen =", start)
    if (nsIndex !== -1 && nsIndex < end) {
      end = nsIndex
    }

    const line = text.slice(0, start).split("\n").length
    existing.set(funcStarts[i].name, { code: text.slice(start, end).trim(), line })
  }

  return existing
}

function groupContexts(contexts: FunctionContext[]): Map<string, FunctionContext[]> {
  const grouped = new Map<string, FunctionContext[]>()
  for (const ctx of contexts) {
    const existing = grouped.get(ctx.functionName) ?? []
    existing.push(ctx)
    grouped.set(ctx.functionName, existing)
  }
  return grouped
}

function pickBestContext(group: FunctionContext[]): FunctionContext {
  return group.reduce((best, ctx) => {
    const score = (ctx.parentFunction ? 2 : 0) + (ctx.hint ? 1 : 0) + (ctx.availableImports.length > 0 ? 1 : 0)
    const bestScore = (best.parentFunction ? 2 : 0) + (best.hint ? 1 : 0) + (best.availableImports.length > 0 ? 1 : 0)
    return score > bestScore ? ctx : best
  })
}

function collectArgPatterns(group: FunctionContext[]): Argument[][] {
  const seen = new Set<string>()
  const patterns: Argument[][] = []
  for (const ctx of group) {
    const sig = ctx.args.map((a) => `${a.type}`).join("|")
    if (seen.has(sig)) continue
    seen.add(sig)
    patterns.push(ctx.args)
  }
  return patterns
}

function writeGeneratedFile(
  rootDir: string,
  relativePath: string,
  functions: string[],
  functionNames: Set<string>
): void {
  const fullPath = resolvePathSafe(rootDir, relativePath)
  const header = `// AUTO GENERATED — do not edit by hand\n` +
    `// Delete a function and re-run the build to regenerate it.\n\n`

  const names = [...functionNames].sort()
  const nsExport = `\nexport const aigen = { ${names.join(", ")} }\n`
  const content = header + functions.join("\n\n") + nsExport

  const dir = fullPath.substring(0, fullPath.lastIndexOf("/"))
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }

  writeFileSync(fullPath, content, "utf-8")
}
