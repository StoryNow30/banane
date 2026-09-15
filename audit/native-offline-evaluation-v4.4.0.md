# Évaluation hors ligne du Mode Natif

Généré le 2026-09-13T06:23:09.390Z. Le moteur template-surfaces-v3 est exécuté sans ESV et sans recevoir la position humaine finale en entrée.

| Mesure | Gauche | Droit | Paire |
|---|---:|---:|---:|
| Exemples qualifiés | 0 | 0 | 0 |
| Comparaisons terminées | 0 | 0 | — |
| Rails non résolus | 0 | 0 | — |

Les confirmations serveur `not-observed` sont acceptées en mode Natif et ne sont pas comptées comme une erreur de collecte.

## Limites

- Les trois exports V4.4 antérieurs au correctif ne contiennent aucun exemple qualifié par le contrat V2 ; ils servent à mesurer la perte, pas la précision.
- Une session ESV réelle courte avec la version corrigée reste obligatoire pour valider la couverture, les repères et la fluidité WebGL.
- Une référence native reste candidate tant qu’elle n’a pas été revue ; usableForTraining demeure faux.
