const BUILTIN_BLOCKLIST = [
  "process", "run", "execute", "compute", "handle", "do", "perform", "apply",
  "transform", "convert", "get", "set", "update", "parse", "format", "check",
  "validate", "fetch", "load", "save", "send", "receive", "map", "filter", "reduce",
]

export interface AmbiguityError {
  functionName: string
  message: string
  suggestions?: string[]
}

export function checkAmbiguity(
  functionName: string,
  extraBlocklist: string[] = []
): AmbiguityError | null {
  const blocklist = [...BUILTIN_BLOCKLIST, ...extraBlocklist]
  const name = functionName.trim()

  if (blocklist.includes(name)) {
    return {
      functionName: name,
      message: `Function name '${name}' is too ambiguous to generate.`,
      suggestions: [
        `${name}_user_csv(data)`,
        `${name}_invoice_rows(data)`,
        `${name}_payment_event(data)`,
      ],
    }
  }

  const tokens = name.split("_")
  if (tokens.length < 2) {
    return {
      functionName: name,
      message: `Function name '${name}' is too ambiguous. Use a descriptive name with at least two parts (e.g. '${name}_user_data').`,
    }
  }

  if (tokens.length === 2 && blocklist.includes(tokens[0])) {
    return {
      functionName: name,
      message: `Function name '${name}' is too ambiguous. Combine '${tokens[0]}' with a more specific subject (e.g. '${tokens[0]}_sorted_${tokens[1]}').`,
      suggestions: [
        `${tokens[0]}_sorted_${tokens[1]}(data)`,
        `${tokens[0]}_filtered_${tokens[1]}(data)`,
      ],
    }
  }

  return null
}
