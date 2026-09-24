# Chantier 6 — prompt du relecteur (relecture indépendante 4.7.13 à 4.7.16)

**Pour :** Astra (relecteur indépendant), ou un autre relecteur qui n’a pas écrit ce code. **Branche :** `chantier-48/relecture-4716`. **Rapport :** `audit/chantiers/relecture-4716.md`.
Aucune intervention de ta part. Ne lui donne pas les conclusions de l’équipe au-delà de ce que contient le dépôt.

Copie tout le bloc ci-dessous, tel quel, comme premier message.

```text
TON RÔLE
Tu es relecteur indépendant : tu n'as écrit aucune ligne de ce que tu relis.
Tu ne corriges pas, tu établis. Un test qui démontre un défaut est bienvenu
sur ta branche ; une correction du code, non. La relecture précédente
(audit/chantiers/relecture-478.md, sur la 4.7.12) sert de modèle de
rapport ; elle ne couvre rien de ce qui suit.

CONTEXTE
Banane est une extension Chrome/Edge (Manifest V3) qui aide un opérateur à
poser les rails sur ESV LiDAR, outil web de validation de coupes LiDAR
ferroviaires. Un « cut » est une coupe transversale de la voie : l'opérateur
y place deux rails (gauche, droite) puis valide. Banane observe (mode
Natif), propose (Assisté) ou enchaîne un lot de cuts (Pilote). Son moteur
géométrique (GCV1) propose la position de chaque rail ou s'abstient. Depuis
la 4.7.10, le Pilote applique aussi une « décision sur le lot »
(src/lot-decision.js) : il compare la proposition du moteur à la voie tracée
par les cuts déjà posés du lot (gardes), la reprend depuis cette voie, ou
choisit un minimum du moteur près de la position prédite. Un cut que le
Pilote ne sait pas placer est « différé » : il le quitte sans décision.
Version de référence : 4.7.16 TEST (la release officielle reste la 4.7.0).

DÉPÔTS
- Code : https://github.com/StoryNow30/banane
  Pars du commit 155dbec (branche claude/banane-48-cahier : code 4.7.16).
  Crée ta branche depuis ce commit (nom donné plus bas).
- Données : https://github.com/StoryNow30/banane-data
  branche claude/banane-47-gate-audit-vaktr1, dossier collections/ ; INDEX.md
  décrit chaque collecte. Données RELUES (référence humaine disponible) :
    2026-09-23_v4.7.6_/pilote + corr/           lot Pilote partie 19 + relecture Natif
    2026-09-23_v4.7.6_/session nativ/           Natif partie 20, sessions longue et courte
    2026-09-23_v4.7.6_/natif p22 logique operateur/   Natif partie 22
    2026-09-23_v4.7.7_/session nativ/           Natif partie 24
    2026-09-24_v4.7.7_/session nativ/           Natif partie 30
    2026-09-24_v4.7.8_/ et 2026-09-24_v4.7.9_/  lots Pilote partie 31 + relectures
    2026-09-24_v4.7.11_/                        lot Pilote partie 34 + relecture
    2026-09-24_v4.7.14_/                        lots Pilote partie 2 + relecture CIBLÉE (cuts 110–138)
  Non relues : parties 33 (4.7.10) et 35 (4.7.12).
  Archives 7z ou zip de segments JSON, parfois découpées en morceaux (voir
  NOTES.md et manifest.json de chaque collecte ; noms avec espaces : mets les
  chemins entre guillemets). Fusion des segments : tools/merge-segments.cjs.
  Les grosses sessions demandent node --max-old-space-size=12000.

À LIRE D'ABORD, dans cet ordre
LIRE_EN_PREMIER.md ; PROJECT_STATE.md ; BANANE_4.8_CAHIER.md §3.6, §5.5, §7,
§8, §13, §14 et les amendements n°9 à n°11 ; DECISIONS.md D-038 à D-050 ;
KNOWN_ISSUES.md KI-043 à KI-054. Le cahier est le contrat : s'il contredit
cette consigne, il l'emporte, et tu le signales.

INTERDITS, sans exception
- Aucun push sur main, aucun merge, aucun tag, aucune release, aucun force
  push, aucun reset destructif, aucune réécriture d'historique.
- Aucune modification des fichiers gelés : src/geometry.js,
  vendor/capture-core.js, vendor/lidar.js, src/engine.js ; ni du moteur :
  src/gcv1-shadow.js, src/geometry-candidate-v1.js,
  src/placement-convention.js.
- Écartement de voie : contrat [1405, 1470] mm en ADMISSIBILITÉ seulement.
  Jamais une cible : ni « le plus proche de 1435 », ni « le plus proche de
  l'écartement des voisins ». L'écartement des voisins peut servir de GARDE
  (écarter), jamais de critère de choix (cahier §3.6, §7).
- Aucune application partielle (un seul rail), aucun VALIDATE ni SKIP
  automatique sur un cut non résolu, aucune navigation présentée comme une
  décision.
- Aucune position humaine (correction ou validation de l'opérateur) dans
  l'entrée d'une décision : la référence humaine ne sert qu'à JUGER, après
  coup.
- Cuts 9033 et 9241 exclus de toute mesure, à la demande de l'opérateur.
- Dépôts publics : aucun code source d'ESV dans un commit (noms, identifiants
  et chaînes d'appel seulement).

RÈGLES DE MESURE (D-038)
- Un cut est FAUX si l'erreur latérale OU verticale d'un rail dépasse 10 mm
  par rapport à la pose finale de l'opérateur.
- Couverture = cuts DISTINCTS du lot ; une revisite n'est pas un nouveau
  cut ; les cuts sans entrée, différés ou refusés restent au dénominateur.
- Une visite de relecture sans correction ni validation vaut acceptation
  (D-040) ; une relecture ciblée ne juge que sa zone (D-048).
- Toute exclusion est explicite, comptée et motivée.

MÉTHODE
- Sépare toujours VÉRIFIÉ (commande exécutée + sortie) et SUPPOSÉ. Un
  chiffre sans commande reproductible n'est pas un résultat.
- Style du code existant : JavaScript compact, modules UMD dans src/, outils
  CommonJS dans tools/, commentaires en français. Aucune dépendance nouvelle.
- Tests : node --test. Banc complet : node tools/verify.cjs ; il lance tous
  les fichiers de test en parallèle avec 10 s par fichier : découpe un test
  lourd en plusieurs fichiers plutôt que d'allonger le délai. Ne lance pas le
  banc pendant un calcul lourd sur la même machine (délais dépassés). Sans le
  corpus privé, 2 tests sont ignorés : c'est normal, dis-le.
- N'enregistre qu'après un banc complet en succès.
- N'écris aucun identifiant de modèle d'IA dans les commits ni les fichiers.

LIVRABLE COMMUN
- Ta branche poussée, commits clairs.
- Le rapport audit/chantiers/relecture-4716.md : fait, vérifié (commandes), supposé, questions pour
  la direction.
- En fin de travail, un résumé de 15 lignes au plus, en français.

CHANTIER 6 — RELECTURE INDÉPENDANTE DE LA 4.7.13 À LA 4.7.16

PÉRIMÈTRE : git diff 7a2144c..155dbec, en particulier
- 4.7.13 : interface « La ligne » (panel.html, panel.css, panel.js, fonts/) ;
- 4.7.14 : KI-053 (commandRails : une paire retirée par une garde n'est
  jamais rendue par un repli) et KI-052 (reprise après archivage) ;
- 4.7.15 : chainMm 15 mm (D-047), règles consignées et rejeu
  (tools/acceptance-report.cjs : rulesFor, lotRules) ;
- 4.7.16 : garde d'écartement voisin 20 mm et minTop du choix 5 (D-050),
  src/lot-decision.js (gaugeReference, gaugeSuspect, nearOf, commandRails) ;
- outils de mesure : tools/choice-anchor-study.cjs (--option),
  tools/cursor-sweep.cjs, tools/lot-command-scan.cjs.

QUESTIONS À TRANCHER, chacune avec une commande de reproduction
1. Une paire retirée par une garde (continuité, écartement voisin, paire)
   peut-elle encore être appliquée par un chemin quelconque (repli, erreur,
   reprise, cut revisité, « Observer seulement ») ?
2. La garde d'écartement voisin est-elle une garde et jamais une cible ?
   Les options gaugeChoice et gaugeTargetStudy peuvent-elles s'activer dans
   le Pilote par un chemin quelconque (background.js, réglages, messages) ?
3. Rejeu : pour chaque version de décision (lot-decision-v1 à v4), le rejeu
   applique-t-il les règles du lot et non celles du code courant ? Reproduis
   la parité annoncée sur le lot de la partie 35 (233/233, 4.7.12) et sur
   ceux des parties 34 et 2 avec leurs propres règles.
4. Reproduis au moins une partie du bilan : base 4.7.15 (690 décidés, 507
   justes, 5 faux) contre 4.7.16 (711 décidés, 520 justes, 4 faux), au
   minimum sur les lots Pilote relus et la session Natif longue de la
   partie 20. Le jugement est-il propre (référence stricte, doublons, fuite
   de la pose humaine, ordre des cuts) ?
5. minTop du choix à 5 : examine les 20 choix gagnés (11 jugés justes,
   9 non jugés, tous au banc Natif ; liste dans
   audit/curseurs-lot-2026-09-24-filtres.json). Y a-t-il un signe qu'un
   choix à peu de points de dessus soit fragile ? Quelle mesure terrain
   faudrait-il ?
6. Interface : les exigences du §14 H (politique effective affichée,
   « Différés : N » fidèle, incertitude visible avec son cut), SKIP explicite
   confirmé, aucun identifiant ni comportement retiré par la 4.7.13.
7. Que faut-il établir avant la version candidate 4.8.0-rc ? Liste les
   mesures et leurs seuils, en tenant compte de D-048 (relecture ciblée) et
   de la question ouverte du seuil C4 de sortie (amendement n°10, point 5).

LIVRABLE PROPRE AU CHANTIER : constats classés BLOQUANT / IMPORTANT /
MINEUR, chacun avec fichier:ligne, commande de reproduction et sortie
observée ; puis la liste des conditions de la 4.8.0-rc.
```
