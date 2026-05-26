import { existsSync } from "node:fs"
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import type { AgentConfig, AigenPluginOptions } from "./types"

const DEFAULT_CONFIG: AgentConfig = {
  model: "anthropic/claude-sonnet-4",
  maxRepairAttempts: 3,
  cache: true,
  generatedFile: "src/agent.generated.ts",
  ambiguityBlocklist: [],
}

/**
 * Resolve AgentConfig from plugin options and optional aigen.config.ts file.
 * Falls back to defaults for any unset values.
 */
export async function resolveConfig(options?: AigenPluginOptions): Promise<AgentConfig> {
  let config: AgentConfig = { ...DEFAULT_CONFIG }

  if (options?.configFile) {
    const fileConfig = await loadConfigFile(options.configFile)
    if (fileConfig) config = { ...config, ...fileConfig }
  } else {
    const defaultConfigPath = join(process.cwd(), "aigen.config.ts")
    if (existsSync(defaultConfigPath)) {
      const fileConfig = await loadConfigFile(defaultConfigPath)
      if (fileConfig) config = { ...config, ...fileConfig }
    }
  }

  if (options?.noCache !== undefined) config.cache = !options.noCache

  return config
}

/**
 * Helper to define an AgentConfig with type safety.
 * Use in aigen.config.ts:
 * @example
 * export default defineConfig({
 *   model: "anthropic/claude-sonnet-4",
 *   cache: true,
 * })
 */
export function defineConfig(config: Partial<AgentConfig>): AgentConfig {
  return { ...DEFAULT_CONFIG, ...config }
}

async function loadConfigFile(filePath: string): Promise<Partial<AgentConfig> | null> {
  try {
    const url = pathToFileURL(filePath).href
    const mod = await import(url)
    return mod.default || null
  } catch {
    return null
  }
}
