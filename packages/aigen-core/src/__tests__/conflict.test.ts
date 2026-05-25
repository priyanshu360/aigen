import { describe, it, expect } from "vitest"
import { detectConflicts } from "../conflict"
import type { CallSite } from "../types"

function makeCall(overrides: Partial<CallSite> & { functionName: string }): CallSite {
  return {
    args: overrides.args ?? [{ type: "string", text: "x" }],
    sourceFile: overrides.sourceFile ?? "src/test.ts",
    lineNumber: overrides.lineNumber ?? 1,
    assignmentVar: overrides.assignmentVar,
    hint: overrides.hint,
    ...overrides,
  }
}

describe("detectConflicts", () => {
  it("returns null when no calls exist", () => {
    expect(detectConflicts([])).toBeNull()
  })

  it("returns null for a single call", () => {
    const calls = [makeCall({ functionName: "extract_emails" })]
    expect(detectConflicts(calls)).toBeNull()
  })

  it("returns null when same function has matching signatures", () => {
    const calls = [
      makeCall({
        functionName: "extract_emails",
        args: [{ type: "string", text: "body" }],
        sourceFile: "src/a.ts",
        lineNumber: 10,
      }),
      makeCall({
        functionName: "extract_emails",
        args: [{ type: "string", text: "text" }],
        sourceFile: "src/b.ts",
        lineNumber: 20,
      }),
    ]
    expect(detectConflicts(calls)).toBeNull()
  })

  it("detects signature conflicts across call sites", () => {
    const calls = [
      makeCall({
        functionName: "extract_emails",
        args: [{ type: "string", text: "body" }],
        sourceFile: "src/a.ts",
        lineNumber: 10,
      }),
      makeCall({
        functionName: "extract_emails",
        args: [{ type: "string", text: "body" }, { type: "number", text: "limit" }],
        sourceFile: "src/b.ts",
        lineNumber: 20,
      }),
    ]
    const result = detectConflicts(calls)
    expect(result).not.toBeNull()
    expect(result!.functionName).toBe("extract_emails")
    expect(result!.locations).toHaveLength(2)
  })

  it("ignores hint argument when comparing signatures", () => {
    const calls = [
      makeCall({
        functionName: "extract_emails",
        args: [{ type: "string", text: "body" }],
        sourceFile: "src/a.ts",
        lineNumber: 10,
      }),
      makeCall({
        functionName: "extract_emails",
        args: [{ type: "string", text: "body" }, { type: "string", text: "Return unique" }],
        hint: "Return unique",
        sourceFile: "src/b.ts",
        lineNumber: 20,
      }),
    ]
    expect(detectConflicts(calls)).toBeNull()
  })

  it("returns null when different functions have different signatures", () => {
    const calls = [
      makeCall({ functionName: "extract_emails", args: [{ type: "string", text: "body" }] }),
      makeCall({ functionName: "get_domain", args: [{ type: "string", text: "email" }] }),
    ]
    expect(detectConflicts(calls)).toBeNull()
  })
})
