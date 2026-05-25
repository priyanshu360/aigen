import type { Plugin } from "esbuild"
import {
  resolveConfig,
  runPipeline,
  MockGenerationProvider,
  type AgentConfig,
  type AigenPluginOptions,
} from "@aigen/core"

export function aigenPlugin(options: AigenPluginOptions = {}): Plugin {
  let agentConfig: AgentConfig

  return {
    name: "@aigen/esbuild",

    setup(build) {
      const root = build.initialOptions.absWorkingDir ?? process.cwd()
      agentConfig = resolveConfig(options)

      build.onStart(async () => {
        const sources = await collectSourceFiles(root)
        const provider = new MockGenerationProvider()

        await runPipeline(
          agentConfig,
          sources,
          provider,
          root,
          options.noCache
        )
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
