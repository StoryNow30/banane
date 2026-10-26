# Protocole du jugement G1-c de la GCV2 (pré-déclaré, 19 octobre 2026)

Écrit **avant** l'ouverture de tout résultat de jugement, à la suite de l'audit externe
(`audit/chantiers/audit-gcv2-g1b-astra.md`, verdict « G1-c peut partir après P1 »). Ce protocole ne change plus une
fois les parties d'examen ouvertes ; toute modification passe par une décision écrite **avant** l'ouverture.

## 1. Ce qui est jugé

- **Une seule candidate : V1** (D-205) : GCV2 sur les verts de PN et d'ADV ; règle prudente figée (D-180, D-190) sur les
  verts des abords ; rien ailleurs, jamais sur les différés. Corrigée des défauts de validité P1 de l'audit (jeu causal,
  référence exacte, porte unique), **sans** nouveau réglage choisi sur les résultats.
- **Chaîne figée** : moteur GCV1 (`src/engine.js`, inchangé), hauteur apprise figée (apprise sur 1:17, 1:24, 1:29, 2:1 :
  **déclaré**), réglages métier figés (`datasets/reglages-figes.json`), générateur d'hypothèses, paramètres
  `datasets/gcv2-parametres.json`, règle prudente, zones, évaluateur. Les **empreintes SHA-256** de chaque pièce sont
  consignées dans `datasets/gcv2-g1c-empreintes.json` avant l'ouverture.
- **Portée revendiquée** : « développement conditionnel » au moteur et à la hauteur apprise figés. La validation croisée
  de G1-b n'est pas une preuve hors apprentissage de toute la chaîne ; le jugement G1-c l'est, pour la chaîne entière.
- **H6 et V1+** (D-207) ne sont **pas** jugés ici. Ils suivent leur propre chemin de développement et auront leur propre
  examen neuf, déclaré à part. Aucun remplacement de candidate après un échec sur les mêmes parties.

## 2. Parties d'examen

- **Registre des expositions** (ce qui a déjà été lu, par qui, pour quoi) :

| Partie | Exposition | Classement |
|---|---|---|
| 1:11, 1:25 | témoins ; résultats lus en G1-a (rappel), RM-2 (marges), relecture autonome | **témoins de régression**, pas confirmatoires |
| 2:6 | examen D-198 (règle prudente, zones), RM-2 et RM-12 jugés dessus (D-202, D-203), vérité PN 3931–3935 connue | **exposée** : diagnostic seulement |
| 2:7 | examen D-209 (règle prudente, zones) lu par l'orchestrateur ; aucun réglage changé ; GCV2 jamais lue dessus | **exposée à la lecture** : non confirmatoire |
| 2:13 | examen en cours (RM-5), règle prudente et zones seront lus ; GCV2 jamais lue | **exposée à la lecture** : non confirmatoire |

- **Parties confirmatoires : les cinq prochaines parties nouvelles** reçues avec un Écho de Mic après la date de ce
  protocole, prises **dans l'ordre d'arrivée**, sans choix selon leurs résultats, en couvrant si possible les deux
  projets. Pour chacune, l'examen de terrain (RM-5) ne publie que **Orbite contre Mic** et **les zones contre les
  notes** ; la partie « règle prudente et GCV2 » est calculée, écrite dans un fichier **scellé** (non lu, empreinte
  consignée) et ouverte seulement au jugement.
- **Expositions minimales** avant ouverture : au moins 150 cuts mesurables en PN et 150 en ADV cumulés, et au moins
  40 actions de V1 attendues par zone active (d'après le taux d'action de la validation croisée). Si les cinq parties
  n'y suffisent pas, on ajoute des parties **dans l'ordre d'arrivée** jusqu'à les atteindre, **avant** toute ouverture.
- 2:6, 2:7 et 2:13 passent en apprentissage après l'ouverture (rotation D-192).

## 3. Porte unique (écrite, exécutable, appariée)

Sur les cuts mesurables des parties confirmatoires, V1 contre la règle prudente **réellement rejouée**, cut par cut :

1. **0 mauvaise voie** observée (erreur finale > 50 mm, ou rail déplacé de plus de 45 mm en travers depuis la pose de
   départ) ;
2. **borne haute de Wilson à 95 % de l'erreur parmi les actions ≤ 9 %** (pas seulement le taux observé) ;
3. **0 mauvaise pose ajoutée** : aucun cut que la règle prudente laisse ou pose à 10 mm de Mic et que V1 pose à plus de
   10 mm (comparaison appariée, pas le total des abîmés) ;
4. **corrections justes ≥ règle prudente** et **erreur médiane par zone ≤ règle prudente** sur chaque zone active ;
5. résultats aussi **par partie** : aucune partie avec une mauvaise voie ; une partie peut rater 4 sans faire échouer la
   porte si le total la tient, mais c'est écrit.

Effectif insuffisant pour la condition 2 → **« non démontré »**, ni succès ni échec. Trois issues possibles et écrites
d'avance : **succès**, **échec**, **non démontré**.

## 4. Règle d'arrêt

- Pas d'arrêt anticipé pour succès. Pas d'ajout de parties après ouverture « jusqu'à ce que la borne passe ».
- Arrêt anticipé pour **sécurité** : une mauvaise voie observée sur une partie ouverte met fin à l'examen en **échec**.
- En cas d'échec ou de « non démontré » : nouveau plan écrit, nouvelles parties ; jamais une seconde candidate sur les
  mêmes parties.

## 5. Ce que l'examen publie

Par usage (relecture ; lot seulement si le jeu lot est généré sans appui humain, F3 de l'audit), par zone, par rôle et
par partie : actions, corrections justes, à 5 mm, abîmés, mauvaises voies, erreur et borne de Wilson, mauvaises poses
ajoutées (appariées), abstentions, grosses laissées fausses, erreur médiane ; la même table pour la règle prudente et
pour le hasard ; le nombre d'actions exposées. Les témoins 1:11 et 1:25 sont lus en plus, comme régression, et
présentés à part.
