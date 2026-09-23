# Chantier 5 — prompt de l’ingénieur

**Pour :** un ingénieur logiciel, profil tests. **Branche :** `chantier-48/acceptation`. **Rapport :** `audit/chantiers/acceptation.md`.
Aucune intervention de ta part.

Copie tout le bloc ci-dessous, tel quel, comme premier message.

```text
TON RÔLE
Tu es ingénieur logiciel, spécialiste des tests. Tu prouves ce qui est
couvert et tu écris ce qui manque ; tu ne modifies pas le code de production.

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
  Crée ta branche depuis ce commit : chantier-48/acceptation
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
- Le rapport audit/chantiers/acceptation.md : fait, vérifié (commandes),
  supposé, questions pour la direction.
- En fin de travail, un résumé de 15 lignes au plus, en français.

CHANTIER 5 — TESTS D'ACCEPTATION §14 ET INVARIANTS §7

POURQUOI
Le cahier exige que chacun des dix invariants du §7 et chacun des tests A à
I du §14 ait son essai. Plus de 640 tests existent dans tests/, mais personne
ne sait lesquels couvrent quoi.

À FAIRE
1. tests/ACCEPTANCE_MATRIX.md : une ligne par exigence (§7.1 à §7.10, §14 A
   à I, et les règles conservées du §5.4 : politique effective affichée,
   « Différés : N » fidèle, incertitude de navigation visible avec son cut,
   aucun bouton présenté comme réussi sur un simple accusé). Pour chacune :
   le ou les tests (fichier + nom exact), statut COUVERT / PARTIEL /
   MANQUANT, et une phrase qui dit ce que le test prouve réellement.
2. Écris les tests MANQUANTS. Si un test révèle un défaut, ne corrige pas le
   code de production : marque le test « todo » avec la référence d'un
   nouveau KI proposé dans ton rapport.
3. tools/acceptance-matrix-check.cjs : échoue si une ligne de la matrice
   désigne un fichier ou un nom de test qui n'existe pas. Ajoute un test qui
   l'exécute, pour que le banc (tools/verify.cjs) le fasse à chaque fois.
4. Attention au §14 C (curseurs traçables jusqu'à leur bilan) et au §14 I
   (provenance : aucune position humaine dans l'entrée moteur) : ce sont les
   plus faciles à déclarer couverts à tort.

LIVRABLE PROPRE AU CHANTIER : la matrice, les tests ajoutés (banc vert, 10 s
par fichier), l'outil de contrôle, et la liste des exigences qui restent
sans preuve.
```
