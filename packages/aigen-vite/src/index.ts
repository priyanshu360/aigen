import type { Plugin } from "vite"
import {
  resolveConfig,
  runPipeline,
  GitAgentProvider,
  type AigenPluginOptions,
} from "@aigen/core"

export function aigenPlugin(options: AigenPluginOptions = {}): Plugin {
  if (!options.agentDir) {
    throw new Error(
      "[AgentGen] The `agentDir` option is required. Point it to your aigen-agent repo."
    )
  }

  const provider = new GitAgentProvider({
    agentDir: options.agentDir,
    model: options.model,
  })

  return {
    name: "@aigen/vite",

    async buildStart() {
      const agentConfig = await resolveConfig(options)
      const root = process.cwd()
      const sources = await collectSourceFiles(root)

      await runPipeline(agentConfig, sources, provider, root, options.noCache)
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
