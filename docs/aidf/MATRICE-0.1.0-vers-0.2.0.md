# Matrice d'écarts AIDF 0.1.0 → 0.2.0

- Date: 2026-11-21
- Branche: `feat/aidf-0.2.0`
- Baseline mesurée: `npm test` → **200/200 PASS** (après correction de 3 régressions WIP)
- Méthode: inspection du code réel + exécution réelle des commandes sur `../resources/`
  et sur un projet temporaire (`install --adapter opencode` + `resources inventory --write`
  + `skills sources` + `skills enable owasp-security`).

Statuts utilisés: PROVEN (exécuté et vérifié), CONTRACT-PROVEN (contrat fichiers vérifié,
runtime non prouvé), PARTIAL, NOT_PROVEN, BLOCKED, ABSENT.

## 1. Socle 0.1.0 (LOT 0)

| Domaine | État | Preuve |
|---|---|---|
| 18 verbes CLI | PROVEN | `src/cli.mjs` COMMANDS; e2e `tests/cli.test.mjs` |
| Phases/gates/checks | PROVEN | `assets/workflows/`, `src/core/workflow.mjs`, gates tests |
| Evidence Engine + `verifyEvidenceChain` | PROVEN | `src/core/evidence.mjs`, `evidence verify` |
| Packaging npm | PROVEN | `tests/packaging.test.mjs` (pack → install → init → doctor) |
| `run-demo.mjs` | PROVEN (non rejoué ce jour) | `demo/run-demo.mjs` présent; `npm run demo` non exécuté |
| Idempotence install/uninstall | PROVEN | e2e cli.test.mjs + installer tests |

Régressions WIP corrigées le 2026-11-21:
- `tests/adapters.test.mjs` attendait 2 adaptateurs → mis à jour pour `opencode`.
- `tests/packaging.test.mjs`: `tar` GNU sur Windows interprétait `C:\…` comme hôte
  distant → `--force-local` + chemins relatifs.
- `src/core/resources.mjs` `inspectResource` crashait sur fichier > 2 Gio
  (`sha256File` = `readFile` entier) → hash limité à 64 Mio, comptage `skipped`
  (secrets + oversized), champs `hashedFiles`/`skipped` ajoutés.
- `assets/registry/sources.yaml` MODULES: exclusions médias/binaires ajoutées
  (ISO 3,9 Gio, mp4) — cohérent avec la note « documents de cours uniquement ».

## 2. Resource Engine (LOT 3)

| Capacité | État | Preuve |
|---|---|---|
| Inventaire fichier par fichier (sha256) | PROVEN | `resources inventory --write` réel: 18 ressources, 12 533 fichiers, 914 Mio |
| Secrets jamais lus | PROVEN | 23 chemins skippés (`isSecretPath`), jamais ouverts |
| Politique de licences | PROVEN | `LICENSE_POLICIES` + tests `resources.v2.test.mjs` |
| Couverture déclarée vs inventoriée | PROVEN | `resources coverage` réel: 18/18, complete=true |
| Détection doublons de skills | PROVEN | 7 doublons (6 identiques intra ui-ux-pro-max, 1 `code-review` non identique spec-kit vs mattpocock) |
| Réconciliation lock/manifest | PARTIAL | `resources reconcile` existe; lock `resources.lock.json` requis — non généré dans le projet de test |
| `installGitResource` (vendor épinglé) | NOT_PROVEN | requiert `--allow-network`; non exécuté (pas d'autorisation réseau) |

## 3. Skills Engine (LOT 3)

| Capacité | État | Preuve |
|---|---|---|
| Catalogue skills sources | PROVEN | `skills sources` réel: 81 fichiers SKILL.md, 74 uniques AVAILABLE, 7 DUPLICATE |
| Statuts licence→disponibilité | PROVEN | INDEX_ONLY/BLOCKED/INCOMPATIBLE/DUPLICATE dans `source-skills.mjs` + tests |
| Activation (`skills enable`) | PROVEN | copie réelle `owasp-security` → `.opencode/skills/` (5 fichiers + `AIDF-SOURCE.json`) |
| Scripts exécutables refusés par défaut | PROVEN | `copySourceSkill` skip `.sh/.ps1/…` sauf `--allow-scripts` |
| Sélection contextuelle des skills sources | PARTIAL | `selectSourceSkills` = matching par triggers, pas de moteur de dépendances complet |
| Traçabilité d'usage (preuve d'activation) | PARTIAL | `AIDF-SOURCE.json` enregistre la copie; pas de journal d'usage agent |
| Skills builtin 0.1.0 (13) | PROVEN | registry + adapter install + tests |

## 4. Adaptateurs IDE (LOT 4)

| Adaptateur | État | Limite |
|---|---|---|
| qoder | CONTRACT-PROVEN | runtime (règles activées, hooks, `/skills`) NOT_PROVEN — nécessite session IDE réelle |
| generic (AGENTS.md) | PROVEN | bloc managé idempotent |
| opencode | CONTRACT-PROVEN | plan + vérif fichiers OK; runtime NOT_PROVEN — OpenCode est installé (`opencode.cmd` présent), session réelle non exécutée |
| autres IDE | ABSENT | aucun adaptateur supplémentaire |

## 5. Decision Engine (LOT 5)

| Capacité | État | Preuve |
|---|---|---|
| Moteur déterministe (contraintes dures/mous, ranking) | PROVEN | `src/core/technology-decision/*` + tests |
| Génération document de décision (JSON/MD) | PROVEN | `generator.mjs` + tests |
| Analyse LLM | NOT_PROVEN | `AI_MODEL` non configuré; chemins LLM échouent explicitement (comportement honnête) |
| Exposition CLI (`aidf decision …`) | ABSENT | moteur = bibliothèque interne, non câblé dans `cli.mjs` |
| ADR persistés dans `.aidf/artefacts/` | PARTIAL | schémas `assets/schemas/decision` + validateur; pas de commande CLI |

## 6. Design Engine (LOT 6)

| Capacité | État | Preuve |
|---|---|---|
| Classification de complexité | PROVEN | `complexity-classifier.mjs` + tests |
| Workflows par complexité | PROVEN | `engine.mjs` + tests |
| Wireframes SVG / maquettes HTML (fallback) | PROVEN | `fallback/*` + tests |
| Validateurs Figma | NOT_PROVEN | `figma/validators.mjs` présent; aucune intégration Figma réelle vérifiée |
| Parité visuelle (capture) | NOT_PROVEN | `visual-parity/capture.mjs` présent; navigateur non vérifié |
| Exposition CLI (`aidf design …`) | ABSENT | non câblé |

## 7. Security by Design & Test Engineering (LOT 7)

| Capacité | État | Preuve |
|---|---|---|
| Compétence `aidf-security-review` + skill `owasp-security` (source) | AVAILABLE | registry + catalogue |
| Gates security workflow | PROVEN | `assets/workflows/`, validate tests |
| Modèle de menace STRIDE (`security/threat-model.json`) | PARTIAL | schéma présent; pas de commande de génération |
| Cycle TDD outillé (RED→GREEN→refactor) | ABSENT | skill `testing-validation` conseillée; pas de moteur TDD dédié |
| Tests E2E framework | ABSENT | dépend du projet cible |

## 8. Artefacts & traçabilité (L1)

| Capacité | État | Preuve |
|---|---|---|
| Enveloppe + validation schémas artefacts | PROVEN | `src/core/artefacts/*` + `artefacts.validation.test.mjs` |
| Registre exigences | PROVEN | `src/core/requirements/registry.mjs` + tests |
| Chaîne de traçabilité (liens) | PROVEN | `src/core/traceability/chain.mjs` + tests |
| Contrat de liens L1-C complet | NOT_PROVEN | test `traceability.link.test.mjs` retiré au commit 27a9581 (non prouvé) |
| Commandes CLI artefacts/requirements/traceability/docs generate | ABSENT | ADR-006 proposé, non implémenté |
| Couverture déterministe exigence→test→preuve | PARTIAL | logique dans `traceability/chain.mjs`; non exposée en CLI |

## 9. Delivery & Operations (LOT 8)

| Capacité | État |
|---|---|
| Skill `aidf-devops-engineering` | AVAILABLE |
| Phase `release` + gates | PROVEN (workflow) |
| Moteur build/deploy/rollback/monitoring | ABSENT (conseillé par skills/gates, pas d'outil) |

## 10. Gouvernance obligatoire

| Capacité | État | Limite honnête |
|---|---|---|
| Session-start protocol (AIDF.md) | PROVEN | instructions lues par l'agent |
| Hooks Qoder (`session-context.mjs`) | CONTRACT-PROVEN | exécution runtime IDE non prouvée |
| Contexte assemblé par tâche (`aidf context`) | PROVEN | testé e2e |
| Blocage gate sans preuve | PROVEN | fail-closed testé |
| Détection de contournement | PARTIAL | `scan` + contradictions BLOCKED; pas de mécanisme anti-contournement actif |
| Portée réelle | — | AIDF impose des instructions/fichiers; un agent externe peut les ignorer — à documenter |

## 11. Ressources `../resources/` (LOT 2)

| Élément | Statut |
|---|---|
| 18 ressources déclarées dans `sources.yaml` | 100 % inventoriées (coverage.complete=true) |
| 12 533 fichiers hashés, 81 SKILL.md (74 uniques valides) | PROVEN |
| `dictionary-of-ai-coding` | BLOCKED — licence inconnue (index-only) |
| `pencil` | BLOCKED — GPL-2.0, décision humaine 2026-11-21 |
| `jeremy-web-modules` | PARTIAL — corpus propriétaire, index-only, exclusions appliquées |
| `owasp-asvs` | PRESENT — CC-BY-SA-4.0, référence |

## 12. Décisions humaines requises / blocages

| # | Décision | Statut |
|---|---|---|
| D1 | Licence `dictionary-of-ai-coding` (aucun LICENSE dans le clone) | BLOCKED — lever par le propriétaire ou accepter index-only permanent |
| D2 | Commit du WIP + corrections baseline | En attente d'autorisation |
| D3 | Vérification runtime OpenCode/Qoder (session agent réelle) | Possible localement (binaires installés) — à planifier |
| D4 | `AI_MODEL` pour le Decision Engine LLM | NOT_PROVEN tant que non configuré — le déterministe reste le chemin prouvé |
| D5 | Commandes CLI manquantes (artefacts, requirements, traceability, decision, design) | À prioriser — ADR-006 existe |
| D6 | Publication npm / push git | Non autorisé |
