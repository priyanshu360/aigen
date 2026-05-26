import type { Plugin } from "esbuild"
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

  const root = process.cwd()
  const generatedFile = options.generatedFile || DEFAULT_GENERATED_FILE
  const generatedFilePath = resolve(root, generatedFile)

  return {
    name: "@pynhu/aigen-esbuild",

    async setup(build) {
      const buildRoot = build.initialOptions.absWorkingDir ?? root
      const agentConfig = await resolveConfig(options)

      build.initialOptions.alias = {
        "@pynhu/aigen-runtime": generatedFilePath,
        ...build.initialOptions.alias,
      }

      build.onStart(async () => {
        const sources = await collectSourceFiles(buildRoot)
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
