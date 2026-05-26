import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { randomUUID } from "node:crypto"
import { computeHash, getCachedImplementation, setCachedImplementation, clearCache } from "../cache"

function tmpRoot(): string {
  return join(tmpdir(), `aigen-cache-test-${randomUUID()}`)
}

describe("cache", () => {
  let root: string

  beforeEach(() => {
    root = tmpRoot()
    mkdirSync(root, { recursive: true })
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  describe("computeHash", () => {
    it("produces consistent hashes", () => {
      const h1 = computeHash("extract_emails", "string", "Return unique")
      const h2 = computeHash("extract_emails", "string", "Return unique")
      expect(h1).toBe(h2)
    })

    it("produces different hashes for different inputs", () => {
      const h1 = computeHash("extract_emails", "string", undefined)
      const h2 = computeHash("get_domain", "string", undefined)
      expect(h1).not.toBe(h2)
    })

    it("includes hint in hash", () => {
      const h1 = computeHash("extract_emails", "string", "hint a")
      const h2 = computeHash("extract_emails", "string", "hint b")
      expect(h1).not.toBe(h2)
    })
  })

  describe("get/set", () => {
    it("returns null for missing entry", () => {
      expect(getCachedImplementation(root, "nonexistent")).toBeNull()
    })

    it("stores and retrieves implementations", () => {
      const hash = computeHash("test_fn", "string", undefined)
      const impl = "export function test_fn(x: string) { return x }"

      setCachedImplementation(root, hash, impl)
      const retrieved = getCachedImplementation(root, hash)

      expect(retrieved).toBe(impl)
    })

    it("persists to disk", () => {
      const hash = computeHash("persist_test", "number", undefined)
      const impl = "export function persist_test(n: number) { return n + 1 }"

      setCachedImplementation(root, hash, impl)
      const filePath = join(root, ".aigen", "cache.json")
      expect(existsSync(filePath)).toBe(true)

      const stored = JSON.parse(readFileSync(filePath, "utf-8"))
      expect(stored[hash].implementation).toBe(impl)
    })

    it("clearCache removes all entries", () => {
      const hash = computeHash("fn", "string", undefined)
      setCachedImplementation(root, hash, "export function fn() {}")
      clearCache(root)
      expect(getCachedImplementation(root, hash)).toBeNull()
    })
  })
})
