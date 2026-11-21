# Changelog

All notable changes to AIDF are documented here. This project does not use
conventional commits; each entry names real, verified behaviour changes.

## [Unreleased] — 0.2.0 (2026-11-21)

L0 stabilises the 0.1.0 base before any persisted artefact schema change. The
version is intentionally not bumped until L0 is accepted.

### Added (verified 2026-11-21)
- Resource Engine v2: `aidf resources inventory|coverage|reconcile` produce a
  file-level sha256 manifest, a licence policy per resource, duplicate-skill
  detection and lock/manifest drift reconciliation. Verified on the real
  `resources/` corpus: 18 resources, 12 533 files, 81 SKILL.md (74 unique
  AVAILABLE, 7 DUPLICATE), 23 secret-like paths skipped.
- Skills Engine v2: `aidf skills sources|catalog` builds the third-party skill
  catalogue with licence-derived statuses; `aidf skills enable <id>` copies one
  canonical skill into the active adapter directory with an `AIDF-SOURCE.json`
  provenance file; executables and secrets are never copied unless
  `--allow-scripts` is given. Verified by a real copy of `owasp-security`.
- OpenCode adapter: `aidf install --adapter opencode` writes `AGENTS.md` and
  the 13 built-in skills under `.opencode/skills/`; verification is
  CONTRACT-PROVEN (runtime discovery NOT_PROVEN).
- Artefact schemas and validation (`src/core/artefacts`, `assets/schemas/`),
  requirements registry and traceability chain (L1-B/L1-C partial).
- Technology Decision Engine (deterministic analyzer + decision document
  generator; LLM analyzer present but NOT_PROVEN without `AI_MODEL`).
- Design Engineering engine (complexity classifier, per-complexity workflows,
  SVG/HTML fallback mockups; Figma integration NOT_PROVEN).
- Gap matrix: `docs/aidf/MATRICE-0.1.0-vers-0.2.0.md`.
- CLI commands exposing the L1/L2/L3 engines: `aidf artefacts
  list|show|validate|verify`, `aidf requirements
  list|show|add|update|delete|coverage`, `aidf traceability
  report|verify|missing|broken`, `aidf decision evaluate` (persists a DRAFT
  artefact under `.aidf/artefacts/decisions/`, human approval required) and
  `aidf design classify|run` (writes real SVG/CSS/Markdown fallback outputs).
- `aidf security analyze|show`: deterministic STRIDE threat model generated
  from project detection (assets, trust boundaries, threats grounded in
  detected surface), persisted as `TM-###` under
  `.aidf/artefacts/security/` with a Markdown report option.
- `aidf tests plan|coverage`: generates a `TP-###` test-plan artefact (one
  planned case per acceptance criterion, type inferred from wording) and
  reports requirement coverage across planned cases and `TEST-*` artefacts.
- `aidf docs generate [--check]`: renders canonical artefacts to Markdown
  under `.aidf/docs/generated/` with provenance headers and manual-edit
  divergence detection.
- `aidf release report [--record] [--strict]`: read-only release readiness
  report aggregating gate evaluations, document statuses, CHANGELOG,
  evidence and artefacts; writes `.aidf/reports/RELEASE-<date>.{json,md}`.
- Artefact discovery now recurses into subdirectories (`decisions/`,
  `security/`), so nested artefacts appear in `artefacts list`, link
  resolution and traceability; `createLink` writes back to the real path.
- OpenCode runtime verification (2026-11-21): a real `opencode run` session
  quoted the AIDF instructions and listed the installed skills; `opencode
  debug skill` discovers project skills only inside a git worktree, so
  adapter verification now reports a `git-worktree` check (PARTIAL without
  `.git`).

### Fixed (2026-11-21)
- `getAllArtefactIds` imported `../util/fsx.mjs` from `core/artefacts/`,
  silently resolving no artefact ids and marking every link unresolved.
- `findMissingLinks` searched link *values* for type names instead of
  resolving targets; it now matches resolved artefact types plus documented
  ID prefixes (`REQ-`, `DES-`, `BACKEND-`, `TEST-`, `EVID-`).
- `resources inspect` crashed on files larger than 2 GiB (whole-file
  `readFile`): hashing is now capped at 64 MiB with explicit `skipped`
  counters; secret-like paths are never opened.
- MODULES corpus exclusions extended to media/binaries (ISO, mp4, archives,
  installers) matching its documented course-document scope.
- Packaging test: GNU tar on Windows treated `C:\…` tarballs as remote hosts;
  `--force-local` and relative paths fix pack/list/extract/pack-install.
- Adapter registry test updated for the new `opencode` adapter.

Test suite: 211/211 PASS (`node --test "tests/**/*.test.mjs"`).

### Fixed
- npm packaging now ships `INSTALLATION.md`, `UTILISATION.md`, `QODER.md`,
  `CHANGELOG.md` and `demo/`; a packaging test packs, installs, runs
  `--version`, `init` and `doctor` in a temporary prefix.
- `npm run demo` now runs a real install/doctor/context/gate/resources flow in
  a temporary project; it never prints predefined results.
- `doc-status` reads the real document frontmatter and fails when it diverges
  from `config.json`; a missing document is `BLOCKED`.
- A blocking check can no longer be `NOT_APPLICABLE`; a gate with no applicable
  blocking check is `NOT_PROVEN`; a gate with no blocking check must declare
  `applicability: informative` to PASS.
- `evidence verify` now verifies the whole chain (hashes, `previous` links,
  order, `index.lastHash`, duplicates, missing and unindexed files) and never
  repairs history. `doctor` uses the same verification.

### Added
- Declared vs authenticated approval: `--human --by` records
  `approval.authenticated: false`; `security.requireAuthenticatedApproval`
  (optional, default false) rejects declared-only approval for human-required
  gates. Existing `approvedBy` is preserved.
- GitHub Actions CI (syntax, test suite, demo, diagnostics); CI execution is
  `NOT_PROVEN` until the repository is under Git.
- Tests for config, detect, context, resources, docs, evidence, doctor,
  speckit, packaging, and the new gate/approval semantics. 87 tests pass.

## [0.1.0] — 2026-10-31

### Added
- Core action engine (`Installer`): `write/copy/mkdir/managed-block/merge-json/
  junction` with manifest ownership, SHA-256 tracking, backups, conflict
  refusal, atomic writes and full dry-run support (`WOULD_*` statuses).
- Portable install layout: `.aidf/framework` self-contained copy, launcher
  `.aidf/bin/aidf.mjs`, docs/registry/workflows/knowledge/evidence/state, and
  idempotent re-installation.
- CLI commands with `--json` and the 0/1/2 exit contract: `install`, `init`,
  `update`, `uninstall`, `setup resources`, `resources list|inspect`, `doctor`,
  `scan`, `skills list|validate|show|refresh|link`, `workflow status|enter|exit|
  next|reset`, `validate --list|--phase|--gate`, `evidence list|show|add|
  capture|verify`, `docs list|show|status`, `context --task`, `speckit
  status|init|sync`, `config list|get|set|validate`, `help`, `version`.
- 11 project document templates with status frontmatter and explicit
  `[TO FILL]` honesty; `aidf docs status` updates frontmatter + manifest.
- Qoder adapter: 3 rules (00-core, 10-security, 20-context), 13 first-party
  skills, `aidf-orchestrator` agent, optional hooks with redacted audit and
  session context; verifier returning CONTRACT-PROVEN (files) vs NOT_PROVEN
  (runtime UI checks).
- Generic adapter: AGENTS.md managed block only.
- Phase workflow (8 phases, 16 gates) with typed checks (`file-exists`,
  `doc-status`, `evidence`, `command`, `previous-gate`, `manual`), command
  execution opt-in (`--allow-exec` or config), shell-free runner rejecting
  shell operators, output captured as evidence.
- Hash-chained evidence with human approvals (`--by`) and verification tooling.
- Context assembler with always-on/phase/keyword activation map, caps, and a
  BLOCKED status for contradiction-sensitive documents.
- Spec Kit integration: status/init/sync; qodercli init; explicit
  `--specify-force` for non-empty projects; copy-with-hash constitution sync
  (CONFLICT never overwrites Spec Kit content); mapping export to
  `.specify/aidf/mapping.md`.
- Resource registry + lock (`resources.lock.json`) with licence gating:
  unknown licence ⇒ BLOCKED, index-only.
- 43 tests (unit + CLI end-to-end) passing on Node 24.21.0 / Windows 11 x64.

### Fixed
- YAML dumper emitted invalid sequence-of-maps (first entry glued to the
  second); roundtrip now verified, including nested arrays and block scalars.
- `specKitStatus` now detects the real `speckit-*` (hyphen) skill dirs
  generated by specify 1.2.3's qodercli integration.
- `setup resources` resolution order (project → parent → framework parent →
  framework root) stops installed-copy internal paths (`.aidf/skills`)
  from shadowing real sibling clones.
- Dry-run installs no longer create `.aidf/logs` (no side effects at all).
- `Installer.apply` returns only the current batch's results (previously
  accumulated, breaking idempotency reporting in tests).
- `speckit init` against a non-empty (already installed) project reports
  BLOCKED with an actionable message instead of a raw specify failure.

### Known limitations
- Qoder rule activation and runtime skill discovery remain manual/human-evidenced
  (by design, not a bug).
- Spec Kit project-vs-user skill precedence in Qoder docs is contradictory;
  AIDF ignores driver-specific resolution order (project scope only).
