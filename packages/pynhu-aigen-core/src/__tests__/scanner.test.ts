import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { writeFileSync, mkdirSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { randomUUID } from "node:crypto"
import { scanSourceFiles } from "../scanner"

function tmpDir(): string {
  return join(tmpdir(), `aigen-scanner-test-${randomUUID()}`)
}

function writeSource(dir: string, name: string, content: string): string {
  const path = join(dir, name)
  writeFileSync(path, content, "utf-8")
  return path
}

describe("scanSourceFiles", () => {
  let dir: string

  beforeEach(() => {
    dir = tmpDir()
    mkdirSync(dir, { recursive: true })
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it("discovers simple aigen calls", () => {
    const file = writeSource(dir, "test.ts", `
import { aigen } from "@pynhu/aigen-runtime"

const emails = aigen.extract_emails_from_text(body)
`)
    const result = scanSourceFiles([file])
    expect(result.calls).toHaveLength(1)
    expect(result.calls[0].functionName).toBe("extract_emails_from_text")
    expect(result.calls[0].sourceFile).toBe(file)
  })

  it("discovers multiple aigen calls in a file", () => {
    const file = writeSource(dir, "test.ts", `
import { aigen } from "@pynhu/aigen-runtime"

const emails = aigen.extract_emails_from_text(body)
const domain = aigen.get_domain_from_email(email)
`)
    const result = scanSourceFiles([file])
    expect(result.calls).toHaveLength(2)
  })

  it("extracts hint from options object with hint key", () => {
    const file = writeSource(dir, "test.ts", `
import { aigen } from "@pynhu/aigen-runtime"

const emails = aigen.extract_emails_from_text(body, { hint: "Return unique emails" })
`)
    const result = scanSourceFiles([file])
    expect(result.calls).toHaveLength(1)
    expect(result.calls[0].hint).toBe("Return unique emails")
    expect(result.calls[0].args).toHaveLength(1)
    expect(result.calls[0].args[0].text).toBe("body")
  })

  it("treats single { hint } object as hint -> zero args", () => {
    const file = writeSource(dir, "test.ts", `
import { aigen } from "@pynhu/aigen-runtime"

const result = aigen.get_time({ hint: "current time in unix" })
`)
    const result = scanSourceFiles([file])
    expect(result.calls).toHaveLength(1)
    expect(result.calls[0].hint).toBe("current time in unix")
    expect(result.calls[0].args).toHaveLength(0)
  })

  it("treats single string arg as real argument, not hint", () => {
    const file = writeSource(dir, "test.ts", `
import { aigen } from "@pynhu/aigen-runtime"

const result = aigen.greet_user("world")
`)
    const result = scanSourceFiles([file])
    expect(result.calls).toHaveLength(1)
    expect(result.calls[0].hint).toBeUndefined()
    expect(result.calls[0].args).toHaveLength(1)
    expect(result.calls[0].args[0].text).toBe('"world"')
  })

  it("detects assignment variable", () => {
    const file = writeSource(dir, "test.ts", `
import { aigen } from "@pynhu/aigen-runtime"

const emails = aigen.extract_emails_from_text(body)
`)
    const result = scanSourceFiles([file])
    expect(result.calls[0].assignmentVar).toBe("emails")
  })

  it("ignores non-aigen calls", () => {
    const file = writeSource(dir, "test.ts", `
import { something } from "other"
const result = something.do_thing(data)
`)
    const result = scanSourceFiles([file])
    expect(result.calls).toHaveLength(0)
  })

  it("captures line numbers", () => {
    const file = writeSource(dir, "test.ts", `
import { aigen } from "@pynhu/aigen-runtime"

const emails = aigen.extract_emails_from_text(body)
`)
    const result = scanSourceFiles([file])
    expect(result.calls[0].lineNumber).toBe(4)
  })
})
