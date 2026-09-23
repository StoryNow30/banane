# Chantier 3 — prompt du relecteur

**Pour :** Astra (relecteur indépendant). **Branche :** `chantier-48/relecture-478`. **Rapport :** `audit/chantiers/relecture-478.md`.
Aucune intervention de ta part. Ne lui donne pas les conclusions de l’équipe au-delà de ce que contient le dépôt.

Copie tout le bloc ci-dessous, tel quel, comme premier message.

```text
TON RÔLE
Tu es relecteur indépendant : tu n'as écrit aucune ligne de ce que tu relis.
Tu ne corriges pas, tu établis. Un test qui démontre un défaut est bienvenu
sur ta branche ; une correction du code, non.

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
  Crée ta branche depuis ce commit : chantier-48/relecture-478
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
- Le rapport audit/chantiers/relecture-478.md : fait, vérifié (commandes),
  supposé, questions pour la direction.
- En fin de travail, un résumé de 15 lignes au plus, en français.

CHANTIER 3 — RELECTURE INDÉPENDANTE DE LA 4.7.8 (DÉCISION SUR LE LOT)

PÉRIMÈTRE
- src/lot-decision.js (decideCut et ses étapes first-pass / window / choice
  / deferred) ;
- background.js : observeLot et son branchement (la décision est calculée et
  consignée, JAMAIS appliquée) ; src/gcv1-export.js (lotObservation dans
  l'export diagnostic) ;
- tools/lot-choice-study.cjs et tools/cut-matrix.cjs ;
- l'amendement n°9 et D-039, le tableau §9.2, KI-047.

QUESTIONS À TRANCHER, chacune avec une commande de reproduction
1. Le module ne peut-il VRAIMENT rien commander ? Cherche tout chemin par
   lequel une position de lotObservation atteindrait apply, restore ou une
   navigation.
2. Parité : le code embarqué et l'étude donnent-ils les mêmes décisions ?
   L'équipe annonce 312/312 (partie 20 longue) et 176/176 (partie 24).
   Rejoue-les.
3. Les chiffres du §9.2 (45,2 % → 56,0 % ; 7 → 4 faux ; 48 cuts choisis dont
   30 jugés, 0 faux) se reproduisent-ils ? Le jugement est-il propre :
   références strictes (tools/placement-lab.cjs, referenceFor), doublons,
   fuite de la position humaine dans l'entrée, ordre des cuts ?
4. Le choix par la voie contourne-t-il une règle du cahier : écartement
   utilisé comme cible, application d'un seul rail, ancre issue d'un cut
   choisi (le chaînage n'accepte que ≤ 10 mm), seuils non documentés ?
5. KI-047 (ancres fausses d'un décalage commun entraînant le choix) : quel
   est le risque réel sur les données, et quelle garde manque ?
6. Le temps de calcul par cut dans le service worker (KI-046) reste-t-il
   acceptable avec la décision sur le lot en plus ?
7. Que faudrait-il établir sur les collectes F1 et F2 pour que la décision
   D2 (activer dans le Pilote) soit fondée ? Liste les mesures et leurs
   seuils. Note que P2 ne peut être mesuré qu'avec un seul opérateur : ESV
   n'ouvre pas une même partie dans deux projets.

LIVRABLE PROPRE AU CHANTIER : constats classés BLOQUANT / IMPORTANT /
MINEUR, chacun avec fichier:ligne, commande de reproduction et sortie
observée ; puis la liste des conditions de D2.
```
