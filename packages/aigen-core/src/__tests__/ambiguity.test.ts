import { describe, it, expect } from "vitest"
import { checkAmbiguity } from "../ambiguity"

describe("checkAmbiguity", () => {
  it("blocks single blocklisted verbs", () => {
    const blocked = [
      "process", "run", "execute", "compute", "handle", "do",
      "perform", "apply", "get", "set", "parse",
    ]
    for (const name of blocked) {
      const result = checkAmbiguity(name)
      expect(result).not.toBeNull()
      expect(result!.functionName).toBe(name)
    }
  })

  it("allows any name not in blocklist", () => {
    const allowed = [
      "data",
      "process_data",
      "extract_emails_from_text",
      "slugify_title",
      "getArea",
      "extractEmailsFromText",
      "parseCsvRows",
      "filter_inactive_users",
      "normalize_phone",
    ]
    for (const name of allowed) {
      expect(checkAmbiguity(name)).toBeNull()
    }
  })

  it("accepts extra blocklist from config", () => {
    expect(checkAmbiguity("serialize", ["serialize"])).not.toBeNull()
    expect(checkAmbiguity("serialize_user_data", ["serialize"])).toBeNull()
  })
})
