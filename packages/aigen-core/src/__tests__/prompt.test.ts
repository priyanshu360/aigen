import { describe, it, expect } from "vitest"
import { buildPrompt } from "../prompt"
import type { FunctionContext } from "../types"

function makeContext(overrides: Partial<FunctionContext> & { functionName: string }): FunctionContext {
  return {
    args: overrides.args ?? [],
    hint: overrides.hint,
    sourceFile: overrides.sourceFile ?? "src/test.ts",
    lineNumber: overrides.lineNumber ?? 1,
    assignmentVar: overrides.assignmentVar,
    nearbyCode: overrides.nearbyCode ?? "",
    availableImports: overrides.availableImports ?? [],
    ...overrides,
  }
}

describe("buildPrompt", () => {
  it("includes function name", () => {
    const ctx = makeContext({ functionName: "extract_emails" })
    const prompt = buildPrompt(ctx)
    expect(prompt).toContain("extract_emails")
  })

  it("includes arguments", () => {
    const ctx = makeContext({
      functionName: "extract_emails",
      args: [{ name: "text", type: "string", text: "body" }],
    })
    const prompt = buildPrompt(ctx)
    expect(prompt).toContain("text: string")
  })

  it("includes hint when present", () => {
    const ctx = makeContext({
      functionName: "extract_emails",
      hint: "Return unique emails only",
    })
    const prompt = buildPrompt(ctx)
    expect(prompt).toContain("Return unique emails only")
  })

  it("includes assignment variable", () => {
    const ctx = makeContext({
      functionName: "extract_emails",
      assignmentVar: "emails",
    })
    const prompt = buildPrompt(ctx)
    expect(prompt).toContain("emails")
  })

  it("includes nearby code", () => {
    const ctx = makeContext({
      functionName: "extract_emails",
      nearbyCode: "const emails = aigen.extract_emails_from_text(body)",
    })
    const prompt = buildPrompt(ctx)
    expect(prompt).toContain("extract_emails_from_text")
  })

  it("includes available imports", () => {
    const ctx = makeContext({
      functionName: "extract_emails",
      availableImports: ['import { readFileSync } from "node:fs"'],
    })
    const prompt = buildPrompt(ctx)
    expect(prompt).toContain("readFileSync")
  })
})
