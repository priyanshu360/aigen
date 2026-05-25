import type { Plugin, ResolvedConfig } from "vite"
import {
  resolveConfig,
  runPipeline,
  MockGenerationProvider,
  type AgentConfig,
  type AigenPluginOptions,
} from "@aigen/core"

export function aigenPlugin(options: AigenPluginOptions = {}): Plugin {
  let resolvedConfig: ResolvedConfig
  let agentConfig: AgentConfig

  return {
    name: "@aigen/vite",

    configResolved(config) {
      resolvedConfig = config
      agentConfig = resolveConfig(options)
    },

    async buildStart() {
      const root = resolvedConfig.root
      const sources = await collectSourceFiles(root)

      const provider = new MockGenerationProvider()

      await runPipeline(
        agentConfig,
        sources,
        provider,
        root,
        options.noCache
      )
    },
  }
}

async function collectSourceFiles(root: string): Promise<string[]> {
  const { glob } = await import("node:fs/promises")
  const files: string[] = []
  for await (const file of glob("src/**/*.ts", { cwd: root })) {
    files.push(file)
  }
  return files
}
