# CH-116 : passation (15/11, D-357 « finis Ariane 5 »)

Corpus jugé et banc « GCV2.1 », hors ligne, lecture seule. Mode d'emploi : `outils/LISEZMOI.md`. Rapport : `rapport.md`. Sorties : `sorties/` (une note ou un résumé par jugement).

## Ce qui existe
- **Corpus** `sorties/corpus.jsonl` (4 016 cuts, 24 lots-parties, 7 lots ; `resume.md`) : chaque cut posé ou différé par le lot, joint à l'Écho, classé (juste ≤ 10 mm, 10-50, mauvaise voie > 50, différé corrigé / juste, non jugé ; D-285).
- **Banc** `outils/banc.cjs` : `rejouer` (copie de HEAD, ou d'un arbre donné par `CH116_CODE`, + patchs), `juger` (tableau standard), `fidelite` (`--tol`), `croise` (validation croisée par lot + examen), `garde` (garde d'octobre au banc, 12 lots en parallèle).
- **Outils de lecture** : `comparer.cjs`, `deplacements.cjs`, `chaine.cjs`, `zones.cjs`, `refus.cjs`, `verts-changes.cjs`, `garde-diff.cjs`.
- **Options du banc** (`tools/banc-differes.cjs`, sur la branche, intégrées au tronc par l'intégrateur) : `BANC_ZONES=journal`, `BANC_PASSE_PLAFOND=10`. Banc seulement : `CH116_LISTES` (une liste par partie au lieu de la liste exportée).

## Réglages par défaut (intégrateur, 14/11)
Jugement : `--env BANC_ZONES=journal` ; passe livrée : `--env BANC_PASSE_PLAFOND=10` + `BANC_LEVIERS` avec `"deuxiemePasse":2,"passe2Leviers":{"sansVoieRien":true}`. La référence « livré » se rejoue avec les mêmes réglages. Parité et lots d'octobre : zones par défaut du banc (le journal d'octobre écrit « pn » là où le code dit « adv »).

## Examens vierges (réservés)
- `1211v` (12/11 parties 3, 4) et `1312v` (12/11 soir, parties 6 à 18, Écho du 13/11 matin) : hors du corpus commun (`corpus.cjs --lots 1211v,1312v` seulement), `examen: true, vierge: true` dans `lots.cjs`.
- Lus seulement par CH-116 et l'intégrateur, pour juger un réglage DÉJÀ FIGÉ. Jamais transmis à un chantier (ni chiffres par cut, ni fichiers), jamais utilisés pour régler.
- Réglages déjà jugés dessus : CH-119 D, CH-121 aj3/aj4/aj5, CH-123 v4BS-sd, CH-124 N (sorties de même nom). Ils ne sont plus « vierges » pour ces réglages-là.

## Commandes
```
export CH116_TRAVAIL=~/ch116 CH116_CORPUS=$PWD/chantiers/CH-116/sorties/corpus.jsonl
node chantiers/CH-116/outils/banc.cjs rejouer --nom N [--patch P] [--env K=V …] [--lots …] --jobs 2
node chantiers/CH-116/outils/banc.cjs juger --nom N --ref livre-zj
node chantiers/CH-116/outils/banc.cjs fidelite --nom N [--tol 0.05]
CH116_CODE=<arbre> node chantiers/CH-116/outils/banc.cjs garde --nom N [--env BANC_LEVIERS=JSON] --jobs 2
node chantiers/CH-116/outils/garde-diff.cjs --a eteint --b N --source ancre
```
Préparer depuis zéro (30 à 40 min) : `extraire.sh` puis `preparer.cjs` (LISEZMOI, § Préparer). Lots d'octobre : `BANANE_LOTS` (défaut `CH116_TRAVAIL/oct/lots`).

## Pièges (mesurés)
- Une chaîne de plus de 512 Mo casse `JSON.stringify` / `readFile` : captures en parts de 250 Mo, écritures en flux.
- Un patch qui ne s'applique pas au tronc : composer l'arbre à part et le donner par `CH116_CODE`.
- Liste exportée = dernier instantané de la partie ; l'ancre du service worker lit celle du départ (correctif CH-124). Pour le livré, la liste exportée et celle du départ corrigée donnent le même banc (4 016/4 016, `sorties/audit-liste/AUDIT.md`). La reconstitution d'avant le correctif (cuts du lot « valides sans drapeau ») fausse le banc.
- Pose du banc contre pose du journal réel : un plancher d'environ 0,45 mm (médiane). On compare à 0,05 mm deux rejeux entre eux, pas un rejeu et le lot réel.
- `garde-gcv2 sceller` réécrit le `SHA256SUMS` de son dossier de sortie avec la seule nouvelle base : sceller ailleurs, puis recalculer les sommes de toutes les bases du dossier.
- Les sorties ne portent aucun identifiant de lot : passer `sed` sur les UUID avant de verser une sortie de parité.
- Garde d'octobre : séparer les reculs réels des « verts changés » (`resume.txt`), puis juger les poses changées contre les vérités (`verts-changes.cjs`).

## Ce qui reste
- **Jointure 1312v à refaire** à l'export final de l'Écho du 13/11 (jugé sur les segments 1 à 10, séance alors en cours) : `preparer.cjs --lots 1312v`, puis `corpus.cjs --lots 1312v`.
- Verser `sorties/corpus.jsonl` et `resume.md` dans `banane-data/outils/analyse-lots/CH-116/` (intégrateur).
- Base de la garde Vision 18 : voir `sorties/garde/base-vision18.md`.
