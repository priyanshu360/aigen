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

  it("allows specific multi-token names", () => {
    const allowed = [
      "extract_emails_from_text",
      "slugify_title",
      "remove_duplicate_strings",
      "get_domain_from_email",
      "normalize_phone_number",
      "parse_csv_rows",
      "truncate_string_to_words",
    ]
    for (const name of allowed) {
      expect(checkAmbiguity(name)).toBeNull()
    }
  })

  it("blocks single-token names not in blocklist", () => {
    const result = checkAmbiguity("data")
    expect(result).not.toBeNull()
    expect(result!.message).toContain("too ambiguous")
  })

  it("blocks verb+generic subject two-token names", () => {
    const result = checkAmbiguity("process_data")
    expect(result).not.toBeNull()
    expect(result!.message).toContain("too ambiguous")
  })

  it("allows verb+specific multi-token names", () => {
    expect(checkAmbiguity("process_user_csv")).toBeNull()
    expect(checkAmbiguity("parse_iso_date")).toBeNull()
    expect(checkAmbiguity("filter_inactive_users")).toBeNull()
  })

  it("accepts extra blocklist from config", () => {
    expect(checkAmbiguity("serialize", ["serialize"])).not.toBeNull()
    expect(checkAmbiguity("serialize_user_data", ["serialize"])).toBeNull()
  })

  it("allows non-blocklisted single-token names with 2+ parts", () => {
    expect(checkAmbiguity("slugify_title")).toBeNull()
    expect(checkAmbiguity("normalize_phone")).toBeNull()
  })
})
