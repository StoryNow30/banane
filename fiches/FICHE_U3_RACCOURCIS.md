# Fiche U3 — Raccourcis `D` et `Maj + Espace` (D-092, 13 octobre 2026)

Statut : **livré dans la 4.9.0.10 (branche `claude/49-test-10`), en essai terrain.** Porte du cahier (§ 6, U3) : MINIMUM, « aucune action d'ESV doublée ou
détournée (essai) ; l'action de chaque raccourci est écrite ». OBJECTIF : aucun.

## Actions (dites par l'opérateur, opérateur, le 13 octobre 2026)

| Raccourci | Action |
|---|---|
| `D` | passer au cut de droite (action d'ESV) |
| `Maj + Espace` | valider un cut (action d'ESV) |

Cela corrige l'étude E, qui lisait `D` comme « rail droit » : l'opérateur fait foi.

## Ce que fait Ariane de ces deux touches

- **Aucun raccourci ajouté** : le manifeste ne déclare aucune commande d'extension ; le code de la page n'émet jamais `D` ni `Maj + Espace` (il ne rejoue que `Maj + Retour arrière`,
  « passer », et `Ctrl + Entrée`, « valider sans passer au suivant », au dernier cut).
- **Orbite** : la garde d'entrée est inactive, les deux touches vont à ESV intactes.
- **Écho et Corrections, garde active** : `D` passe à ESV (non retenu) ; `Maj + Espace` est retenu avant ESV, enregistré, puis transmis **une seule fois** (la frappe rejouée par
  Ariane, non fiable, est la seule qui atteint ESV). Pendant l'enregistrement de la paire (préparation, sauvegarde, attente de navigation), `D` est retenu aussi : on ne déplace pas un
  rail pendant qu'Ariane le sauvegarde. La saisie dans un champ de texte reste libre.
- **Observation d'Écho (garde native)** : passive, jamais de retenue, un relevé par frappe.

## Preuve

`tests/u3-raccourcis.test.cjs` (5 essais, vrai `src/early-input.js` en VM) et `tests/early-input.test.cjs`. Non vérifié : le comportement réel d'ESV sur ces touches (aucun accès
au code d'ESV ici) ; il repose sur ce que l'opérateur a dit.
