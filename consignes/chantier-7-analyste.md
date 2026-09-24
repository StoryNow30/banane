# Chantier 7 — prompt de l’analyste (faux de premier passage sans appui)

**Pour :** un analyste de données. **Branche :** `chantier-48/faux-sans-appui`. **Rapport :** `audit/chantiers/faux-sans-appui.md`.
Aucune intervention de ta part. Même méthode que le chantier 2 (`audit/chantiers/faux-isoles.md`), qui a donné la garde de paire.

Copie tout le bloc ci-dessous, tel quel, comme premier message.

```text
TON RÔLE
Tu es analyste de données. Tu cherches dans les signaux internes du moteur
une règle qui arrête des faux sans perdre de cuts justes, et tu la mesures
honnêtement. Tu ne modifies pas le code de production.

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
- Le rapport audit/chantiers/faux-sans-appui.md : fait, vérifié (commandes), supposé, questions pour
  la direction.
- En fin de travail, un résumé de 15 lignes au plus, en français.

CHANTIER 7 — FAUX DE PREMIER PASSAGE SANS APPUI

POURQUOI
Avec les règles de la 4.7.16, les faux qui restent sur tout ce qui a été
relu sont des PREMIERS PASSAGES du moteur que la décision sur le lot ne peut
pas juger, faute de cuts voisins posés (début de lot, après une série de
différés) ou parce que la voie elle-même les confirme :
  partie 20 longue : 398 (159,9 mm), 402 (273 mm), 983 (15 mm, à 3,9 mm de
  la voie de ses deux voisins) ; selon les réglages, 400 (250 mm) et
  405 (147,6 mm) ;
  partie 2 (4.7.14) : 137 (10,2 mm) ; 114 (207,6 mm) sous les règles de la
  4.7.14.
Les gardes actuelles (continuité, paire, écartement voisin) ne les voient
pas. Le chantier 2 avait trouvé, dans les signaux du moteur, la garde de
paire (S1 a repêché un rail ET le calage de convention est hors domaine).

À FAIRE
1. Reproduis la base : node tools/choice-anchor-study.cjs SORTIE.json
   --natif … --lot … (règles 4.7.16 par défaut ; lis l'en-tête de l'outil)
   sur les 6 sessions Natif et les 5 lots Pilote relus. Tu dois retrouver
   711 décidés et 4 faux (398, 402, 983, 137). Sinon, arrête-toi et explique.
2. Pour chaque premier passage (faux et justes), relève les signaux du
   moteur disponibles dans la science GCV1 (rails[side].next, motifs, perte
   relative, rang, points de dessus et de flanc, calage de convention, S1,
   écartement, écart à la pose de départ d'ESV, présence d'appuis). Rien qui
   vienne de la pose humaine.
3. Cherche une règle simple qui sépare les faux des justes. Mesure-la EN UN
   SEUL PASSAGE, appuis recalculés (un cut différé n'est plus appui et change
   les décisions suivantes) : faux arrêtés, justes perdus, cuts gagnés ou
   perdus par ricochet, par session. Écris l'outil de mesure dans tools/
   (option de tools/choice-anchor-study.cjs ou outil à part, avec son test) ;
   ne touche pas src/.
4. Méfie-toi du sur-ajustement : 4 à 6 faux ne suffisent pas à fonder une
   règle à plusieurs seuils. Donne pour chaque règle candidate sa marge
   (distance du premier juste perdu) et ce qui la rendrait fragile.
5. Si aucune règle ne tient, dis-le : c'est un résultat.

LIVRABLE PROPRE AU CHANTIER : les règles candidates avec, par session, faux
arrêtés / justes perdus / ricochets, la commande de reproduction de chaque
chiffre, et ta recommandation (activer, observer, abandonner).
```
