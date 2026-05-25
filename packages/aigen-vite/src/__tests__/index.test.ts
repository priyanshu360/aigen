import { describe, it, expect } from "vitest"
import { aigenPlugin } from "../index"

describe("@aigen/vite", () => {
  it("returns a plugin object with name", () => {
    const plugin = aigenPlugin({ agentDir: "/tmp/test-agent" })
    expect(plugin.name).toBe("@aigen/vite")
  })

  it("throws when agentDir is missing", () => {
    expect(() => aigenPlugin()).toThrow("agentDir")
  })

  it("accepts options with model", () => {
    const plugin = aigenPlugin({
      agentDir: "/tmp/test-agent",
      model: "anthropic:claude-sonnet-4",
      noCache: true,
    })
    expect(plugin).toBeDefined()
  })
})
