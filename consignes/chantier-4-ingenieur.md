# Chantier 4 — prompt de l’ingénieur

**Pour :** un ingénieur logiciel. **Branche :** `chantier-48/rapport-acceptation`. **Rapport :** `audit/chantiers/rapport-acceptation.md`.
Aucune intervention de ta part. L’outil servira ensuite à chaque collecte F1 à F4.

Copie tout le bloc ci-dessous, tel quel, comme premier message.

```text
TON RÔLE
Tu es ingénieur logiciel. Tu livres un outil testé, réutilisable à chaque
collecte, sans script jetable.

CONTEXTE
Banane est une extension Chrome/Edge (Manifest V3) qui aide un opérateur à
poser les rails sur ESV LiDAR, outil web de validation de coupes LiDAR
ferroviaires. Un « cut » est une coupe transversale de la voie : l'opérateur
y place deux rails (gauche, droite) puis valide. Banane observe (mode
Natif), propose (Assisté) ou enchaîne un lot de cuts (Pilote). Son moteur
géométrique (GCV1) propose la position de chaque rail ou s'abstient ; un cut
que le Pilote ne sait pas placer est « différé » : il le quitte sans décision.

DÉPÔTS
- Code : https://github.com/StoryNow30/banane
  Pars du commit a74c225 (branche claude/banane-48-cahier : code 4.7.8).
  Crée ta branche depuis ce commit : chantier-48/rapport-acceptation
- Données : https://github.com/StoryNow30/banane-data
  branche claude/banane-47-gate-audit-vaktr1, dossier collections/ :
    2026-09-23_v4.7.6_/pilote + corr/          lot Pilote partie 19 + sa relecture Natif
    2026-09-23_v4.7.6_/session nativ/          Natif partie 20 : session longue
                                               (exports 07-05 à 07-23) et courte (07-46 à 07-48)
    2026-09-23_v4.7.6_/natif p22 logique operateur/   Natif partie 22
    2026-09-23_v4.7.7_/session nativ/          Natif partie 24
  Archives 7z de segments JSON (noms avec espaces : mets les chemins entre
  guillemets). NOTES.md et manifest.json décrivent chaque collecte. Fusion
  des segments : tools/merge-segments.cjs, qui accepte un dossier. La
  session longue est lourde : node --max-old-space-size=12000.

À LIRE D'ABORD, dans cet ordre
LIRE_EN_PREMIER.md ; PLAN_4.8.md ; BANANE_4.8_CAHIER.md §5.5, §6, §7, §14 et
amendements n°6 à n°9 ; DECISIONS.md D-036 à D-039 ; KNOWN_ISSUES.md KI-043
à KI-047. Le cahier est le contrat : s'il contredit cette consigne, il
l'emporte, et tu le signales.

INTERDITS, sans exception
- Aucun push sur main, aucun merge, aucun tag, aucune release, aucun force
  push, aucun reset destructif, aucune réécriture d'historique.
- Aucune modification des fichiers gelés : src/geometry.js,
  vendor/capture-core.js, vendor/lidar.js (empreintes 4.4.0), src/engine.js
  (baseline déclarée) ; ni du moteur : src/gcv1-shadow.js,
  src/geometry-candidate-v1.js, src/placement-convention.js.
- Écartement de voie : contrat [1405, 1470] mm en ADMISSIBILITÉ seulement.
  Jamais une cible : « le candidat le plus proche de 1435 » ne sera jamais
  implémenté, et l'écartement des cuts voisins n'est jamais une cible.
- Aucune application partielle (un seul rail), aucun VALIDATE ni SKIP
  automatique, aucune navigation présentée comme une décision.
- Aucune position humaine (correction de l'opérateur) dans l'entrée du
  moteur : la référence humaine ne sert qu'à JUGER, après coup.
- Cuts 9033 et 9241 exclus de toute mesure, à la demande de l'opérateur.

RÈGLES DE MESURE (D-038)
- Un cut est FAUX si l'erreur latérale OU verticale d'un rail dépasse 10 mm
  par rapport à la pose finale de l'opérateur.
- Couverture = cuts DISTINCTS du lot ; une revisite n'est pas un nouveau
  cut ; les cuts sans entrée, différés ou refusés restent au dénominateur.
- Toute exclusion est explicite, comptée et motivée.

MÉTHODE
- Sépare toujours VÉRIFIÉ (commande exécutée + sortie) et SUPPOSÉ. Un
  chiffre sans commande reproductible n'est pas un résultat.
- Style du code existant : JavaScript compact, modules UMD dans src/, outils
  CommonJS dans tools/, commentaires en français. Aucune dépendance nouvelle.
- Tests : node --test. Banc complet : node tools/verify.cjs ; il lance tous
  les fichiers de test en parallèle avec 10 s par fichier : découpe un test
  lourd en plusieurs fichiers plutôt que d'allonger le délai. Sans le corpus
  privé, 2 tests sont ignorés : c'est normal, dis-le.
- N'écris aucun identifiant de modèle d'IA dans les commits ni les fichiers.

LIVRABLE COMMUN
- Ta branche poussée, commits clairs.
- Le rapport audit/chantiers/rapport-acceptation.md : fait, vérifié (commandes),
  supposé, questions pour la direction.
- En fin de travail, un résumé de 15 lignes au plus, en français.

CHANTIER 4 — RAPPORT D'ACCEPTATION AUTOMATIQUE

POURQUOI
Chaque collecte terrain (F1 à F4, PLAN_4.8.md) doit donner les critères C1 à
C5 (cahier §6, D-038) de la même façon. Aujourd'hui ils sont calculés à la
main, avec des scripts ponctuels.

ENTRÉES
- Lot Pilote : export diagnostic GCV1 (observations par cut, dont
  lotObservation depuis la 4.7.8), export corpus GCV1 + LiDAR, et le journal
  du lot (décision par cut : appliqué, DEFERRED_UNRESOLVED…).
- Relecture Natif du même lot : l'opérateur repasse chaque cut et valide. La
  pose AVANT d'une visite est celle laissée par le Pilote ; la pose finale
  validée est la référence humaine (règles strictes de
  tools/placement-lab.cjs, referenceFor). Jointure par identité (partie, cut,
  frameId) ; plusieurs visites d'un même cut : la dernière validée fait foi,
  et le rapport le dit.
- Facultatif : un fichier de configuration listant les parties ayant servi à
  régler quoi que ce soit (les autres sont « tenues à l'écart ») et un relevé
  P2. P2 est le plancher de reproductibilité d'UN opérateur : ESV n'ouvre pas
  une même partie dans deux projets, l'écart entre opérateurs n'est pas
  mesurable ; le rapport l'écrit « P2 (un opérateur) ».
Exemple réel : collections/2026-09-23_v4.7.6_/pilote + corr/ (lot Pilote
4.7.6 de la partie 19, 29 cuts, et sa relecture ; voir NOTES.md).

SORTIES (JSON + Markdown), PARTIE PAR PARTIE puis total
- C1 : cuts distincts du lot ; appliqués / différés / refusés par
  l'écartement / sans entrée ; couverture en % des cuts distincts.
- C4 : cuts faux (latéral OU vertical > 10 mm) parmi les cuts jugés ; liste.
- C2 : médiane et p90 de l'erreur latérale et verticale des cuts appliqués,
  avec à côté le plancher P2 ou « P2 non mesuré » (§14 G).
- C3 : paires hors contrat refusées pendant le lot.
- Ce qu'aurait donné la décision sur le lot (lotObservation) : couverture et
  faux, jugés de la même façon.
- Cuts non jugeables (pas de relecture, référence non stricte) : comptés,
  avec leur raison. Cuts 9033 et 9241 exclus et comptés à part.
- C1 ne sort jamais seul (§14 G) : C1 à C4 sortent ensemble.

À FAIRE
tools/acceptance-report.cjs (réutilise tools/merge-segments.cjs,
tools/placement-lab.cjs, src/gauge.js ; ne duplique pas leur logique) ;
tests sur des données synthétiques construites dans le test (aucune donnée
privée) ; un essai sur la collecte 4.7.6 de la partie 19, dont tu rapportes
la sortie et que tu compares aux chiffres de l'amendement n°6 §6.2.

LIVRABLE PROPRE AU CHANTIER : l'outil, ses tests verts, le rapport produit
sur la partie 19 et l'écart éventuel avec l'amendement n°6.
```
