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

  return null
}
