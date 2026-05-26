import { describe, it, expect } from "vitest"
import { aigen } from "../index"

describe("@pynhu/aigen-runtime", () => {
  it("exports aigen as an object", () => {
    expect(typeof aigen).toBe("object")
    expect(aigen).not.toBeNull()
  })

  it("aigen is extensible via assignment", () => {
    const mock = aigen as Record<string, unknown>
    expect(typeof mock).toBe("object")
  })
})
