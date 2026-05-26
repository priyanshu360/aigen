import type { FunctionContext } from "./types"

const GENERIC_VAR_NAMES = new Set(["result", "res", "val", "value", "x", "y", "data", "output"])

export function buildPrompt(context: FunctionContext): string {
  const sections: string[] = []

  sections.push("Generate a TypeScript utility function based on the following:")

  sections.push(`Function name: ${context.functionName}`)

  const hasVariants = context.argVariants && context.argVariants.length > 1

  if (context.args.length > 0) {
    if (!hasVariants) {
      sections.push(
        `Arguments: ${context.args.map((a) => `${a.name ?? "arg"}: ${a.type}`).join(", ")}`
      )
    }
  } else {
    sections.push("Arguments: none")
  }

  if (context.hint) {
    sections.push(`Hint: ${context.hint}`)
  }

  if (hasVariants) {
    const variantLines = context.argVariants!
      .map((variant) => {
        const parts = variant.map((a) => `${a.name ?? "arg"}: ${a.type}`).join(", ")
        return `  (${parts})`
      })
      .join("\n")
    sections.push(`This function is called with these argument patterns:\n${variantLines}`)
    sections.push("Generate a single function that handles all patterns using union types.")
  }

  if (context.assignmentVar) {
    if (context.assignmentType) {
      sections.push(
        `The return value is assigned to '${context.assignmentVar}: ${context.assignmentType}'.`
      )
    } else if (!GENERIC_VAR_NAMES.has(context.assignmentVar)) {
      sections.push(
        `The return value is assigned to a variable named '${context.assignmentVar}' — use this to infer the expected return type.`
      )
    }
  }

  if (context.parentFunction) {
    sections.push(`Parent function: ${context.parentFunction.signature ?? context.parentFunction.name}`)
    if (context.parentFunction.jsDoc) {
      sections.push(`Documentation:\n${context.parentFunction.jsDoc}`)
    }
  }

  if (context.nearbyCode) {
    sections.push(`Nearby code:\n\`\`\`typescript\n${context.nearbyCode}\n\`\`\``)
  }

  if (context.availableImports.length > 0) {
    sections.push(
      `The following imports are already available in the file — use them if relevant, do not re-import them:\n${context.availableImports.join("\n")}`
    )
  }

  sections.push("Generate only a single exported TypeScript function. Do not include import statements, type definitions, or helper functions.")
  sections.push("Use standard TypeScript syntax. Do not include any explanation.")

  return sections.join("\n\n")
}
