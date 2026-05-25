import { existsSync } from "node:fs"
import { join } from "node:path"
import type { AgentConfig, AigenPluginOptions } from "./types"

const DEFAULT_CONFIG: AgentConfig = {
  model: "anthropic/claude-sonnet-4",
  maxRepairAttempts: 3,
  cache: true,
  generatedFile: "src/agent.generated.ts",
  ambiguityBlocklist: [],
}

export function resolveConfig(options?: AigenPluginOptions): AgentConfig {
  let config: AgentConfig = { ...DEFAULT_CONFIG }

  if (options?.configFile) {
    const fileConfig = loadConfigFile(options.configFile)
    if (fileConfig) config = { ...config, ...fileConfig }
  } else {
    const defaultConfigPath = join(process.cwd(), "aigen.config.ts")
    if (existsSync(defaultConfigPath)) {
      const fileConfig = loadConfigFile(defaultConfigPath)
      if (fileConfig) config = { ...config, ...fileConfig }
    }
  }

  if (options?.noCache !== undefined) config.cache = !options.noCache

  return config
}

export function defineConfig(config: Partial<AgentConfig>): AgentConfig {
  return { ...DEFAULT_CONFIG, ...config }
}

function loadConfigFile(_filePath: string): Partial<AgentConfig> | null {
  try {
    return null
  } catch {
    return null
  }
}
