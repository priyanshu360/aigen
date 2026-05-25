import type { Plugin } from "esbuild"
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
    name: "@aigen/esbuild",

    async setup(build) {
      const root = build.initialOptions.absWorkingDir ?? process.cwd()
      const agentConfig = await resolveConfig(options)

      build.onStart(async () => {
        const sources = await collectSourceFiles(root)

        await runPipeline(agentConfig, sources, provider, root, options.noCache)
      })
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
