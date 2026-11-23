---
name: aidf-version-planning
description: Maintain the version lock of a project — classify every feature into its target version, keep the IN/OUT scope frozen, and block work outside the active version. Use when planning releases, scoping features, or before starting any implementation phase.
metadata:
  aidf:
    id: version-planning
    version: 1.0.0
    phases: [specification, planning]
    documents: [VERSIONS, USECASES, WIREFRAMES, PLAN]
---

# AIDF Version Planning

## Procedure

1. Read `.aidf/docs/VERSIONS.md` and `.aidf/docs/versions/Vx.md` of the **active version**.
2. For every requested feature or change, classify it:
   - already IN the active version → proceed;
   - IN a future version → record it there, do not implement;
   - not classified anywhere → propose the right version and get human
     validation **before** writing code.
3. Never implement something marked OUT of the active version.
4. When the scope of a version changes, update its file **and** record an
   ADR in `DECISIONS.md`.
5. Before a version starts, verify its exit gate is PASS for the previous
   version.

## Version file checklist

Each `versions/Vx.md` must contain:

- IN scope (features, screens, data, engines, integrations)
- OUT scope (explicit exclusions)
- dependencies on previous versions
- exit gate with measurable criteria

## Rules

- A version file is the contract: code outside it is a defect.
- Ideas are cheap; locks are decisions — record them, don't guess.
- Re-qualify future versions when source documents change.

## Output

- Updated `versions/Vx.md` + `VERSIONS.md` index.
- ADR for any scope change.
- Clear statement of what is codable now vs deferred.
