# CH-120 : passation (13/11, vers 12 h 30, arrêt pour relance sur ordre de l'opérateur)

## État exact (ÉTABLI sauf mention)
- Cible écrite avant tout rejeu : `cible.md` (9f66346). Réglages figés : `reglages-figes.json` (lot 1 be38322 ; lot 2 9df07b5, conçu après lecture de gTE : jugement au mieux PROBABLE).
- Rappel du pool au livré (747 cuts jugés avec nuage) : `mesure-rappel-livre.md`. Bonne paire dans le pool effectif (H0-H6 plus la recherche recentrée livrée) : 82,9 % ; ADV 79,6 % (A 309, B 61, C 18). Cause dominante d'absence : rail hors de la fenêtre du moteur (±80 mm) ou du cadre (180 mm) alors que le nuage le porte. 14 des 30 mauvaises voies avaient la bonne paire dans le pool (faute du choix).
- Éteint = livré : 4 016 / 4 016 cuts identiques au banc ; le crochet de mesure est neutre (4 016 / 4 016) ; garde d'octobre de l'éteint : retour 0.
- Code : `generateurs.patch` (src/gcv2-l1.js et essais, tout éteint ; 10 essais verts, 95 essais GCV2 verts dans la copie patchée). Leviers : genTronques, genEcartement, genVoie, genLargeMm (+ genLargeSnapMm), genNouveauMm, genZones (['adv']), seuils genMin*, genSnapMm, genMaxHyp. Hypothèses générées : origine `H7`, ajoutées après les livrées, jamais à leur place.
- Patchs de banc (mesure seulement) : `banc-mesure-pool.patch` (BANC_POOL_DUMP, BANC_POOL_MODULE, BANC_POOL_VERITE ; cuts jugés seulement), `banc-leviers-plus.patch` (inutile depuis `banc.cjs garde` du tronc).
- Outils : `outils/` (mesure-pool, rappel, verites, identiques, chaine-touchee, axes).

## Verdicts des réglages
| réglage | banc (corpus) | garde d'octobre | verdict |
|---|---|---|---|
| gT (tronquées) | 4 pools agrandis, 0 classe, 0 pose changée | non passée | nul |
| gTE (+ écartement) | pool ADV A 309→327 ; > 50 mm 29→26 ; 17 différés reposés justes ; 2 justes > 10 mm, 4 reposés faux, 8 justes différés | ROUGE : 3 nouvelles mauvaises voies (2-11 8283, 8284 ; 0-2310 lot 2 1169) | écarté |
| gTEV (+ voie) | identique à gTE pour les poses | non passée (contient gTE) | écarté de fait |
| gTEVL (+ voie déplacée) | rejeu interrompu (23/24 lots, 1111-p16 manquant) | non passée | abandonné |
| gTEVL-ab | jamais rejoué | — | abandonné |
| gTEn (lot 2) | non rejoué | ROUGE (2-11 8283, 8284 en mauvaise voie) | écarté |
| gTEnF (lot 2) | non rejoué | ROUGE (3-0 870 en mauvaise voie à 259 mm ; 3 justes dégradés) | écarté |
| gTEVLn, gTEVLnF (lot 2) | non rejoués | non passée | non jugés |
| gA (génération à l'ancre de CH-124) | à peine commencé : graines calculées, aucun code dans gcv2-l1, rien figé, rien rejoué | — | à faire |
- Mécanisme de l'échec (8283) : l'hypothèse générée complète la paire de l'AUTRE voie (145 mm) à l'écartement exact de la liste ; le modèle lui donne p 0,73 et la valide. En ADV, compléter des paires sans ancre rend la mauvaise voie aussi plausible. Les générateurs ne touchent aucune pose de la chaîne (0 / 2 797 au banc, R3) ; restent les ricochets (6/202 puis 213-221).
- Faux reposés de gTE au banc : écartement corrigé appliqué (23/3737, 6/202, 16/4501, p 0,53 à 0,60), consensus (23/4668), recherche ADV (16/9175, 16/9178).

## Ce qui tournait et n'a pas fini
Rejeu gTEVL (lot 1111-p16) : arrêté. Mesure du rappel avec la graine à l'axe : pas lancée. Tous les processus sont arrêtés.

## Prochaine étape : gA (consigne de l'intégrateur)
1. Ajouter à `generateurs.patch` un levier `genAncre` : graine par rail à un demi-écartement (720 mm) de chaque côté de l'axe prédit par CH-124 ; H7 gardée seulement à θ = 75 mm au plus (fixé, non réglé) ; l'ancre est donnée de l'extérieur (le banc la lit dans un fichier ; en production, ce sera le module de CH-124).
2. Graines déjà calculables : `outils/axes.cjs` (lib de CH-124 utilisée telle quelle, copie de travail de `chantier/CH-124` 233fd8e) → `ancres-corpus.json` (24 lots-parties) et `ancres-octobre.json` (12 lots de la garde). Ces fichiers portent des débuts d'identifiants de lot : hors dépôt seulement. Contrôle fait sur 1111 16/3960 : axe à 46,6 mm du milieu de départ, graines G [16,6 ; -0,8], D [76,5 ; 3,8] (repère profil) ; vérité G 137, D 184. La conversion du repère « coupe » au repère profil est À VÉRIFIER (le signe ou le côté peut être faux) avant toute mesure.
3. Mesurer d'abord le rappel avec la graine à l'axe sur les cuts ADV sans la bonne paire. Puis figer gA, passer la garde au banc (`banc.cjs garde` du tronc), puis la validation croisée.

## Pièges
- Chemins hors dépôt à refaire : `~/ch116` (extraire.sh puis preparer.cjs, ~25 min, 3,1 Go de captures ; `corpus.jsonl` copié de banane-data CH-116/sorties) ; `~/lots-oct` (12 lots d'octobre, 4,8 Go, script : copier depuis les zips des collections 2026-10-* de banane-data, noms dans `datasets/garde-gcv2/manifeste.json`) ; `~/w124` (copie de travail de CH-124) ; `~/tronc` (copie de travail du tronc pour `banc.cjs garde`).
- Durées : rejeu complet du banc 15 min (livré) à 30 min (générateurs, 4 tâches) ; garde au banc environ 30 min (2 tâches) ; `garde-gcv2 --rejouer` environ 40 min. R7 : deux rejeux lourds au plus à la fois.
- Disque : environ 16 Go libres après tout cela ; vider le clone de banane-data (sparse) après extraction.
- Le conteneur a redémarré une fois : les processus `nohup` meurent, et les `.part` comme les sorties de mesure partielles sont à effacer avant la reprise (le banc saute les lots déjà finis).
- La garde (`garde-gcv2`) impose BANC_LEVIERS ; `banc.cjs garde` du tronc fusionne les leviers de la base et du réglage.
- La recherche recentrée livrée s'arrête au premier choix sûr : le pool « effectif » peut perdre des cellules quand une décision change (A→B sans perte réelle du pool H).
