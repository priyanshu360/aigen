import type { CallSite } from "./types"

export interface ConflictError {
  functionName: string
  locations: { sourceFile: string; lineNumber: number; signature: string }[]
}

export function detectConflicts(calls: CallSite[]): ConflictError | null {
  const grouped = new Map<string, typeof calls>()

  for (const call of calls) {
    const existing = grouped.get(call.functionName) ?? []
    existing.push(call)
    grouped.set(call.functionName, existing)
  }

  for (const [functionName, sites] of grouped) {
    if (sites.length < 2) continue

    const sigs = new Set<string>()
    const locations: ConflictError["locations"] = []

    for (const site of sites) {
      const sig = signatureString(site)
      sigs.add(sig)
      locations.push({
        sourceFile: site.sourceFile,
        lineNumber: site.lineNumber,
        signature: sig,
      })
    }

    if (sigs.size > 1) {
      return { functionName, locations }
    }
  }

  return null
}

function signatureString(call: CallSite): string {
  const args = call.hint
    ? call.args.slice(0, -1)
    : call.args
  return `(${args.map((a) => a.type).join(", ")})`
}
