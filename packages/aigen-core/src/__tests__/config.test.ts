import { describe, it, expect } from "vitest"
import { resolveConfig, defineConfig } from "../config"

describe("defineConfig", () => {
  it("returns config with defaults merged", () => {
    const config = defineConfig({ model: "test-model" })
    expect(config.model).toBe("test-model")
    expect(config.maxRepairAttempts).toBe(3)
    expect(config.cache).toBe(true)
    expect(config.generatedFile).toBe("src/agent.generated.ts")
  })

  it("preserves all overridden fields", () => {
    const config = defineConfig({
      maxRepairAttempts: 5,
      cache: false,
      ciMode: true,
      generatordFile: "src/custom.ts",
    })
    expect(config.maxRepairAttempts).toBe(5)
    expect(config.cache).toBe(false)
    expect(config.ciMode).toBe(true)
  })
})

describe("resolveConfig", () => {
  it("returns defaults when no options are provided", () => {
    const config = resolveConfig()
    expect(config.maxRepairAttempts).toBe(3)
    expect(config.cache).toBe(true)
    expect(config.ciMode).toBe(false)
  })

  it("applies noCache option", () => {
    const config = resolveConfig({ noCache: true })
    expect(config.cache).toBe(false)
  })

  it("applies ciMode option", () => {
    const config = resolveConfig({ ciMode: true })
    expect(config.ciMode).toBe(true)
  })
})
