# Évaluation hors ligne du Mode Natif

Généré le 2026-09-14T08:49:21.899Z. Le moteur template-surfaces-v3 est exécuté sans ESV et sans recevoir la position humaine finale en entrée.

| Mesure | Gauche | Droit | Paire |
|---|---:|---:|---:|
| Exemples qualifiés | 5 | 7 | 5 |
| Comparaisons terminées | 3 | 4 | — |
| Rails non résolus | 2 | 3 | — |

Les confirmations serveur `not-observed` sont acceptées en mode Natif et ne sont pas comptées comme une erreur de collecte.

## Limites

- Seuls les points à visibilité de découpe explicitement vérifiée sont transmis au moteur et représentés. Une capture sans preuve de découpe reste exclue.
- Une session ESV réelle courte avec la version corrigée reste obligatoire pour valider la couverture, les repères et la fluidité WebGL.
- Une référence native reste candidate tant qu’elle n’a pas été revue ; usableForTraining demeure faux.
