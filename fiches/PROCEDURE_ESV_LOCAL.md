# Procédure : rejouer un lot réel sur l'ESV local (cinq commandes)

Pour Mic. Mise à jour le 15 octobre 2026. Détails et certitudes : `tests/esv-maquette/README.md` ; audit et résultats : `fiches/AUDIT_ESV_LOCALE.md`.

## Ce que c'est

Un faux ESV sur la machine (`tests/esv-maquette/`), sans code ni contenu d'ESV, qu'Ariane ne distingue pas du vrai : mêmes identifiants, boutons, compteur, liste, écritures, nuage. On y rejoue un export réel d'Ariane avec n'importe quelle version, sans jeton, sans session, sans toucher au vrai ESV. Prouvé le 15 octobre : 515 cuts réels rejoués, pose à 0,3 mm de la pose du terrain.

## Règles

- Les exports, rapports et jeux d'apprentissage restent **hors dépôt** (un dossier privé, jamais commité).
- Avant tout commit ou envoi : `node tools/controle-confinement.cjs DOSSIER` (code 1 = quelque chose à retirer).
- Un rejeu complet dure environ 50 min par version sur une machine ordinaire ; une fenêtre de 50 cuts prend 5 min.

## Les cinq commandes

Prérequis une fois : Node 22, Playwright et son Chromium (`npx playwright install chromium`).

1. **Inventaire de l'export** (sans navigateur) : ce qui est rejouable, combien de cuts, quel monde.
   ```
   node tests/esv-maquette/lecteur-export.cjs DOSSIER_EXPORT
   ```

2. **Rejouer l'export avec une version d'Ariane** (le dépôt courant, ou un paquet décompressé).
   ```
   node tools/banc-esv.cjs --export DOSSIER_EXPORT --extension DOSSIER_PAQUET --json rapport-49.json
   node tools/banc-esv.cjs --export DOSSIER_EXPORT --json rapport-486.json
   ```
   Fenêtre courte : ajouter `--decalage 85 --cuts 50` (indices dans la liste des cuts rejouables).

3. **Comparer deux versions**, cut par cut (issue, durée, écart à la pose du terrain en mm).
   ```
   node tools/banc-comparer.cjs rapport-486.json rapport-49.json --md comparaison.md
   ```

4. **Jeu d'apprentissage** (hors ligne) : départ, référence, voisins, interpolation, et écart du rejeu si un rapport est donné.
   ```
   node tools/jeu-apprentissage.cjs DOSSIER_EXPORT --rejeu rapport-49.json --sortie jeu.json
   ```

5. **Pannes** : écriture refusée, liste illisible, nuage vide ou instable, changement de partie.
   ```
   node tools/banc-esv.cjs --export DOSSIER_EXPORT --extension DOSSIER_PAQUET --decalage 85 --cuts 70 \
     --pannes '{"ecritureRefusee":{"cuts":[1932,1965],"http":500},"nuageVide":{"cuts":[2110]}}' --json rapport-pannes.json
   ```

## Lire un rapport

Dans `rapport.json`, la clé `resume` :

| Clé | Ce qu'elle dit |
|---|---|
| `etatFinal`, `notice` | fin du lot vue par Ariane (`STOPPED` en fin de lot = normal ; `PAUSED` = Ariane a demandé l'opérateur) |
| `cutsPoses`, `differes` | cuts posés et validés, cuts passés sans décision |
| `ecrituresServeur` | chaque écriture reçue par le faux serveur (toutes doivent être `valid` ou `skipped`) |
| `ecartsReferenceMm` | par cut, écart gauche / droit entre la pose rejouée et la pose du terrain |
| `pannes.refus` | les écritures refusées par réglage, pour vérifier ce qu'Ariane en a fait |
| `erreurs` | erreurs de page ou de banc : la liste doit être vide |

Repères du 15 octobre (partie 24, 515 cuts) : médiane 0,3 mm par rail, P90 0,5 mm, aucun rail au-delà de 1 mm. Au-delà de 2 mm sur plusieurs cuts, chercher d'abord un changement de la maquette ou de l'export, pas du moteur.

## Vérifier la maquette elle-même

```
node tests/esv-maquette/essais.cjs
```
23 essais (adaptateur, extension réelle, lecteur d'export, pannes, outils). Si le vrai ESV change : relevé en lecture seule de trois minutes (`tools/esv-contrat-releve.js`, jamais pendant une validation, jamais de jeton), puis `tools/esv-contrat-comparer.cjs` contre `tests/esv-maquette/contrat-esv.json`.
