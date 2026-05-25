import type { FunctionContext } from "./types"

export function buildPrompt(context: FunctionContext): string {
  const sections: string[] = []

  sections.push("Generate a TypeScript utility function based on the following:\n")

  sections.push(`Function name: ${context.functionName}`)

  const args = context.hint
    ? context.args.slice(0, -1)
    : context.args

  if (args.length > 0) {
    sections.push(
      `Arguments: ${args.map((a) => `${a.name ?? "arg"}: ${a.type}`).join(", ")}`
    )
  } else {
    sections.push("Arguments: none")
  }

  if (context.assignmentVar) {
    sections.push(`Return type (inferred from usage): the result is assigned to '${context.assignmentVar}'`)
  }

  if (context.hint) {
    sections.push(`Hint: ${context.hint}`)
  }

  if (context.nearbyCode) {
    sections.push(`\nNearby code:\n\`\`\`typescript\n${context.nearbyCode}\n\`\`\``)
  }

  sections.push("\nGenerate only the function implementation (a single exported TypeScript function).")
  sections.push("Use standard TypeScript syntax. Do not include any explanation.")

  return sections.join("\n")
}
