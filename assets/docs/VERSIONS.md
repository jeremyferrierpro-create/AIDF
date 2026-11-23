---
doc: VERSIONS
status: DRAFT
version: 1.0.0
source: aidf-template
---

# Version Lock — [Project Name]

> **Principe** : chaque version a son fichier dans `versions/` avec un
> périmètre **verrouillé** (IN/OUT), ses écrans, ses données, ses moteurs,
> ses intégrations et son gate de sortie. On ne code **que** ce qui est
> dans le verrou de la version active. Toute idée nouvelle est classée
> dans la bonne version avant d'être spécifiée — jamais codée hors
> périmètre.

| Version | Fichier | Statut | Contenu dominant |
|---|---|---|---|
| V1 | `versions/V1.md` | DRAFT | `[TO FILL: périmètre V1]` |
| V2 | `versions/V2.md` | — | `[TO FILL]` |
| V3 | `versions/V3.md` | — | `[TO FILL]` |
| V4 | `versions/V4.md` | — | `[TO FILL]` |
| V5 | `versions/V5.md` | — | `[TO FILL]` |

## Règles du verrou

1. **IN** = spécifié (UC + écran + données) et validé → codable.
2. **OUT** = explicitement interdit dans cette version.
3. Une fonctionnalité ne change de version que par ADR dans
   `DECISIONS.md` + mise à jour du fichier de version.
4. Le statut du fichier suit le cycle AIDF : `DRAFT` → `VALIDATED`
   (quand le périmètre est figé) → la version peut démarrer.
5. Dépendances : une version ne démarre que si les gates des versions
   précédentes sont PASS.

## Traçabilité transverse

- UC par version : `USECASES.md`
- Écrans par version : `WIREFRAMES.md`
- Architecture figée : `TRD.md`, `BACKEND.md`, `SECURITY.md`
- Tâches/plan : `PLAN.md`
