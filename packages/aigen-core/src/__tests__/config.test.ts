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
      generatedFile: "src/custom.ts",
    })
    expect(config.maxRepairAttempts).toBe(5)
    expect(config.cache).toBe(false)
  })
})

describe("resolveConfig", () => {
  it("returns defaults when no options are provided", async () => {
    const config = await resolveConfig()
    expect(config.maxRepairAttempts).toBe(3)
    expect(config.cache).toBe(true)
  })

  it("applies noCache option", async () => {
    const config = await resolveConfig({ noCache: true })
    expect(config.cache).toBe(false)
  })
})
