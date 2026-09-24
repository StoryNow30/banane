# Chantier 1 — prompt de l’ingénieur

**Pour :** un ingénieur logiciel rigoureux. **Branche :** `chantier-48/navigation`. **Rapport :** `audit/chantiers/navigation.md`.
Il travaille avec toi : ta fiche est `chantier-1-operateur.md`. Remets-lui tes quatre fichiers d’inspection en privé.

Copie tout le bloc ci-dessous, tel quel, comme premier message.

```text
TON RÔLE
Tu es ingénieur logiciel. Tu livres du code testé et une conception, sur ta
branche ; rien n'est branché dans le Pilote sans décision de la direction.

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
  Crée ta branche depuis ce commit : chantier-48/navigation
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
- Le rapport audit/chantiers/navigation.md : fait, vérifié (commandes),
  supposé, questions pour la direction.
- En fin de travail, un résumé de 15 lignes au plus, en français.

CHANTIER 1 — REVENIR À UN CUT : REPRISE DES DIFFÉRÉS ET NAVIGATION

POURQUOI
Le Pilote n'avance que vers l'avant : « valider et suivant » et « suivant
sans décision » (src/adapter-page.js, nextWithoutDecision, bouton
#O2N3DCutNextInvalid3DRail, équivalent de Maj+Z qui appelle
loadNextInvalidCut("positive") d'après une inspection du JavaScript ESV du
20/09). La décision sur le lot (amendement n°9, src/lot-decision.js) place un
cut différé depuis la droite de ses voisins déjà posés. Hors ligne, elle fait
mieux avec les voisins des DEUX côtés (56,0 % de cuts appliqués contre 53,3 %
en un seul passage, 722 cuts) : il faut pouvoir REVENIR sur un cut différé en
fin de lot (« lot de reprise », PLAN_4.8.md phase 2), voire consulter un cut
voisin.

CE QUE L'ON SAIT
Observé dans 12 sessions Natif des 22 et 23/09 (1 146 gestes de l'opérateur
suivis du cut ouvert juste après, sans autre geste entre les deux) — relevé :
audit/navigation-esv-2026-09-23.json. Corrélation, pas causalité prouvée :
  geste (code physique)       gestes   cut ouvert ensuite
  Z  (KeyW, clavier AZERTY)     173    +1 : 172
  S  (KeyS)                      38    −1 : 36
  D  (KeyD)                     165    +1 : 161   (D sélectionne le rail droit, dit par
                                                l'opérateur le 24/09 : corrélation)
  Maj+Espace (valider)          591    +1 : 582, sauts avant : 8
  clic dans la vue 3D/carte     125    +1 : 98, sauts lointains : 25
Dit par l'opérateur : Z et S correspondent à de vrais BOUTONS de l'interface
ESV ; dézoomer puis sélectionner un rail sur la carte est une fonction de
l'interface qui mène à un cut précis ; un cut déjà validé ne peut PAS être
remis dans sa pose d'origine ; ESV n'ouvre pas une même partie dans deux
projets.
À établir : le bouton DOM derrière Z et S et la fonction qu'il appelle ;
l'existence de loadNextInvalidCut("negative") (différé précédent) ; la
fonction « aller au cut N » appelée par la carte et son argument ; un champ
de saisie du numéro de cut ; un paramètre d'adresse ; tout autre moyen de
revenir à un cut précis.

L'OPÉRATEUR INSPECTE ESV EN PARALLÈLE
Tu n'as pas accès à ESV (authentification). L'opérateur suit sa propre fiche
(consignes/chantier-1-operateur.md, sur la
branche claude/banane-48-cahier) et te remettra quatre
éléments : l'inventaire des contrôles et fonctions de la page, le journal de
ses gestes (Z, S, D, carte, boutons à la souris), les requêtes réseau vues
pendant ces gestes, et des extraits du code d'ESV. Ce code appartient à
l'éditeur d'ESV : les dépôts sont publics, n'y verse JAMAIS de code d'ESV ;
consigne seulement des noms, identifiants et chaînes d'appel, comme le fait
déjà nextWithoutDecision.
Commence par ce qui n'en dépend pas (étapes 2 à 4), puis intègre ses
résultats (étape 1).

RÈGLE DU CAHIER (§5.5)
On passe par les BOUTONS DOM, vérifiés avant d'agir (présence, disabled) ; un
KeyboardEvent synthétique ne prouve pas sa prise en compte. Une touche n'est
acceptable que s'il n'existe aucun bouton, et après décision de la direction.
Appeler directement une fonction interne d'ESV (celle de la carte, par
exemple) est un chemin nouveau : décris-le, mesure ses risques (symboles non
documentés, KI-026) et laisse la direction trancher avant tout code qui
l'emploie.

À FAIRE
1. Inventaire des chemins de navigation ESV, chacun classé vérifié/supposé :
   suivant, précédent, suivant différé, précédent différé, aller au cut N.
   Pour chacun : bouton DOM, fonction appelée, ce qui change dans la page
   (libellé #O2N3DCutDescription, identité part/cut/frameId), et comment
   savoir si le cut atteint est déjà validé. Termine par ta recommandation.
2. Primitives d'adaptateur dans src/adapter-page.js, sur le modèle exact de
   nextWithoutDecision (preuve, refus rendus et non levés, aucun repli) :
   previousWithoutDecision, et goToCut(identité) si un chemin DOM existe.
   Chacune : contrôle d'identité et de cible AVANT la commande (invariant 6),
   une seule émission physique (invariant 5), puis identité observée après ;
   identité inattendue ou absente => incertitude (reconcileRequired), jamais
   une confirmation (invariant 7). Jamais de VALIDATE, jamais de SKIP. Tant
   que le bouton réel n'est pas établi, son sélecteur reste un paramètre
   marqué « supposé ».
3. Garde de reprise : Banane ne propose et n'applique JAMAIS sur un cut qui
   n'est pas dans sa propre liste de différés du lot, ni sur un cut que la
   page montre comme déjà validé. La revisite d'un voisin validé est en
   LECTURE seule.
4. Tests avec le simulateur (tests/fixtures.cjs, SimulatedESV, à étendre) :
   précédent nominal, bouton absent, bouton désactivé, cut atteint différent
   de la cible, cut déjà validé, double appel (une seule émission),
   annulation.
5. Conception du « lot de reprise » (document, aucun branchement dans le
   Pilote) : retour sur chaque différé, ordre de passage, ancres des deux
   côtés, compteur « Différés : N » toujours fidèle, arrêt propre, reprise
   après incertitude. Chiffre le nombre de navigations et le temps attendus
   pour un lot de 100 cuts avec 40 % de différés.

HORS PÉRIMÈTRE : brancher la reprise dans le Pilote (4.7.9, après décision
D2) ; les raccourcis clavier comme chemin de commande (4.9).

LIVRABLE PROPRE AU CHANTIER : primitives et tests verts ; inventaire des
chemins de navigation ; conception du lot de reprise ; ta recommandation.
```
