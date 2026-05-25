import { describe, it, expect } from "vitest"
import { aigenPlugin } from "../index"

describe("@aigen/vite", () => {
  it("returns a plugin object with name", () => {
    const plugin = aigenPlugin()
    expect(plugin.name).toBe("@aigen/vite")
  })

  it("accepts options", () => {
    const plugin = aigenPlugin({ noCache: true })
    expect(plugin).toBeDefined()
  })
})
