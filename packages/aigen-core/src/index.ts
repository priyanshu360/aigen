export { scanSourceFiles } from "./scanner"
export type { ScanResult } from "./scanner"
export { collectAllContexts, collectContext } from "./context"
export { checkAmbiguity } from "./ambiguity"
export type { AmbiguityError } from "./ambiguity"
export { detectConflicts } from "./conflict"
export type { ConflictError } from "./conflict"
export { buildPrompt } from "./prompt"
export { computeHash, getCachedImplementation, setCachedImplementation, clearCache } from "./cache"
export { repairImplementation } from "./repair"
export type { RepairResult } from "./repair"
export { runPipeline } from "./pipeline"
export { GitAgentProvider } from "./gitagent-provider"
export type { GitAgentProviderOptions } from "./gitagent-provider"
export { resolveConfig, defineConfig } from "./config"
export type {
  CallSite,
  FunctionContext,
  Argument,
  AgentConfig,
  AigenPluginOptions,
  GenerationProvider,
} from "./types"
