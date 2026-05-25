import { query } from "@open-gitagent/gitagent"
import { buildPrompt } from "./prompt"
import type { FunctionContext, GenerationProvider } from "./types"

export interface GitAgentProviderOptions {
  agentDir: string
  model?: string
}

export class GitAgentProvider implements GenerationProvider {
  private options: GitAgentProviderOptions

  constructor(options: GitAgentProviderOptions) {
    this.options = options
  }

  async generateFunction(
    functionName: string,
    context: FunctionContext
  ): Promise<{ code: string } | null> {
    const prompt = buildPrompt(context)
    let fullResponse = ""

    try {
      for await (const msg of query({
        prompt,
        dir: this.options.agentDir,
        model: this.options.model ?? "anthropic:claude-sonnet-4-5-20250929",
      })) {
        if (msg.type === "delta") {
          fullResponse += msg.content
        }
        if (msg.type === "system" && msg.subtype === "error") {
          console.error(`[AgentGen] Agent error: ${msg.content}`)
          return null
        }
      }

      const code = extractCodeBlock(fullResponse)

      if (!code) {
        console.error(
          `[AgentGen] Could not extract code from agent response for '${functionName}'`
        )
        return null
      }

      return { code }
    } catch (err) {
      console.error(
        `[AgentGen] Agent call failed for '${functionName}': ${err}`
      )
      return null
    }
  }

  async repairFunction(
    functionName: string,
    implementation: string,
    errorMessage: string,
    attempt: number
  ): Promise<{ code: string } | null> {
    const prompt =
      `The following TypeScript function has a compilation error. Fix it.\n\n` +
      `Function: ${functionName}\n\n` +
      `Implementation:\n\`\`\`typescript\n${implementation}\n\`\`\`\n\n` +
      `Error:\n${errorMessage}\n\n` +
      `Attempt ${attempt} of 3. Output only the corrected function.`

    let fullResponse = ""

    try {
      for await (const msg of query({
        prompt,
        dir: this.options.agentDir,
        model: this.options.model ?? "anthropic:claude-sonnet-4-5-20250929",
      })) {
        if (msg.type === "delta") {
          fullResponse += msg.content
        }
        if (msg.type === "system" && msg.subtype === "error") return null
      }

      const code = extractCodeBlock(fullResponse)
      return code ? { code } : { code: implementation }
    } catch {
      return { code: implementation }
    }
  }
}

function extractCodeBlock(response: string): string | null {
  const codeBlockRegex = /```(?:typescript|ts)?\s*\n?([\s\S]*?)```/
  const match = response.match(codeBlockRegex)
  if (match) return match[1].trim()

  const exportRegex = /export\s+function\s+\w+[\s\S]*?(?=\n(?:export|\/\/|$)|$)/
  const exportMatch = response.match(exportRegex)
  if (exportMatch) return exportMatch[0].trim()

  return null
}
