export interface Argument {
  name?: string
  type: string
  text: string
}

export interface CallSite {
  functionName: string
  args: Argument[]
  hint?: string
  sourceFile: string
  lineNumber: number
  byteOffset: number
  assignmentVar?: string
  assignmentType?: string
}

export interface FunctionContext extends CallSite {
  nearbyCode: string
  availableImports: string[]
  parentFunction?: {
    name: string
    signature?: string
    jsDoc?: string
  }
  /** When the same function is called with different arg types across multiple call sites */
  argVariants?: { name?: string; type: string }[][]
}

export interface AgentConfig {
  model?: string
  maxRepairAttempts: number
  cache: boolean
  generatedFile: string
}

export interface AigenPluginOptions {
  configFile?: string
  noCache?: boolean
  agentDir?: string
  model?: string
  generatedFile?: string
}

/**
 * Interface for LLM providers.
 * Implement this to plug in a custom generation backend (e.g. GitAgent, OpenAI, mock for tests).
 */
export interface GenerationProvider {
  generateFunction(
    functionName: string,
    context: FunctionContext
  ): Promise<{ code: string } | null>

  repairFunction(
    functionName: string,
    implementation: string,
    errorMessage: string,
    attempt: number
  ): Promise<{ code: string } | null>
}
