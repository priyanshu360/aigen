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
  assignmentVar?: string
}

export interface FunctionContext extends CallSite {
  nearbyCode: string
  availableImports: string[]
}

export interface AgentConfig {
  model?: string
  maxRepairAttempts: number
  cache: boolean
  generatedFile: string
  ambiguityBlocklist: string[]
}

export interface AigenPluginOptions {
  configFile?: string
  noCache?: boolean
  agentDir?: string
  model?: string
}

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
