import type { FunctionContext } from "./types"

export function buildPrompt(context: FunctionContext): string {
  const sections: string[] = []

  sections.push("Generate a TypeScript utility function based on the following:\n")

  sections.push(`Function name: ${context.functionName}`)

  const primaryArgs = context.hint
    ? context.args.slice(0, -1)
    : context.args

  if (primaryArgs.length > 0) {
    sections.push(
      `Arguments: ${primaryArgs.map((a) => `${a.name ?? "arg"}: ${a.type}`).join(", ")}`
    )
  } else {
    sections.push("Arguments: none")
  }

  if (context.argVariants && context.argVariants.length > 1) {
    const variantLines = context.argVariants
      .map((variant) => {
        const parts = variant.map((a) => `${a.name ?? "arg"}: ${a.type}`).join(", ")
        return `  (${parts})`
      })
      .join("\n")
    sections.push(`\nThis function is called with these argument patterns:\n${variantLines}`)
    sections.push("Generate a single function that handles all patterns using union types.")
  }

  if (context.assignmentVar) {
    sections.push(`Return type (inferred from usage): the result is assigned to '${context.assignmentVar}'`)
  }

  if (context.parentFunction) {
    sections.push(`\nParent function: ${context.parentFunction.signature ?? context.parentFunction.name}`)
    if (context.parentFunction.jsDoc) {
      sections.push(`Documentation:\n${context.parentFunction.jsDoc}`)
    }
  }

  if (context.hint) {
    sections.push(`Hint: ${context.hint}`)
  }

  if (context.nearbyCode) {
    sections.push(`\nNearby code:\n\`\`\`typescript\n${context.nearbyCode}\n\`\`\``)
  }

  if (context.availableImports.length > 0) {
    sections.push(`\nAvailable imports in the source file:\n${context.availableImports.join("\n")}`)
  }

  sections.push("\nGenerate only the function implementation (a single exported TypeScript function).")
  sections.push("Use standard TypeScript syntax. Do not include any explanation.")

  return sections.join("\n")
}
