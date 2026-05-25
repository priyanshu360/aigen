import { describe, it, expect } from "vitest"
import { aigenPlugin } from "../index"

describe("@aigen/esbuild", () => {
  it("returns a plugin object with name", () => {
    const plugin = aigenPlugin()
    expect(plugin.name).toBe("@aigen/esbuild")
  })

  it("accepts options", () => {
    const plugin = aigenPlugin({ noCache: true })
    expect(plugin).toBeDefined()
  })
})
