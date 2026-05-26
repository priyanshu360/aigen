import type { Plugin } from "vite"
import {
  resolveConfig,
  runPipeline,
  GitAgentProvider,
  type AigenPluginOptions,
} from "@pynhu/aigen-core"
import { resolve } from "node:path"

const DEFAULT_GENERATED_FILE = "src/agent.generated.ts"

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

  // Compute the generated file path at plugin creation so the alias is available
  // before any build lifecycle hook runs.
  const root = process.cwd()
  const generatedFile = options.generatedFile || DEFAULT_GENERATED_FILE
  const generatedFilePath = resolve(root, generatedFile)

  return {
    name: "@pynhu/aigen-vite",

    config(cfg) {
      cfg.resolve = cfg.resolve || {}
      cfg.resolve.alias = [
        { find: /^@aigen\/runtime$/, replacement: generatedFilePath },
        ...(Array.isArray(cfg.resolve.alias) ? cfg.resolve.alias : []),
      ]
    },

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
