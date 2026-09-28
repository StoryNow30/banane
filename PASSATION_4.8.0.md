# Passation — Ariane au 28/09/2026 (4.8.0 validée, audit qualité intégré)

À lire en premier par la conversation qui reprend. Remplace `PASSATION_4.7.21.md`
(gardé pour l'historique, ses règles restent valables). Banane s'appelle
désormais **Ariane** ; Natif → **Écho**, Pilote → **Orbite** (D-058).

## Contexte

- Extension Chrome/Edge MV3 qui place les rails sur le LiDAR d'ESV. Utilisateur :
  SIG, parle français, opérateur terrain et direction du projet.
- Dépôts : `StoryNow30/banane` (branche `claude/banane-48-cahier`),
  `StoryNow30/banane-data` (branche `claude/banane-47-gate-audit-vaktr1`).
- **4.8.0 validée par la direction le 28/09** (D-058) ; **audit qualité
  d'Astra** le même jour (`audit/chantiers/audit-qualite-480.md`) : un P1
  (KI-064) et des P2 corrigés **dans la 4.8.0**, avant sa sortie ; la
  version reste 4.8.0 (direction ; D-059 ; réponse :
  `audit/chantiers/qualite-480/reponse.md`). Retour arrière : 4.7.21
  (`RETOUR_ARRIERE.md`).
- Reste, **sur autorisation explicite** : merge dans `main`, étiquette `v4.8.0`.

## Paquet

`ariane-v4.8.0.zip` corrigé : empreinte et commit de construction dans la
section « Paquet final » ci-dessous. Le premier paquet 4.8.0 du matin
(`d3874290…e1b1fe58f`, depuis `a68201a`) est **remplacé** : il garde KI-064.

## Règles non négociables

Celles de `PASSATION_4.7.21.md`, sans changement : pas de reset destructif,
force push, merge, tag ni release sans autorisation explicite ; contrat
d'écartement [1405, 1470] mm en admissibilité seulement ; les deux rails ou
rien ; pas de VALIDATE/SKIP automatique d'un cut non résolu ; `src/engine.js`
épinglé ; parties de validation jamais utilisées pour régler (rotation,
D-057) ; essais < 10 s par fichier ; `node tools/verify.cjs` à 0 avant chaque
commit ; commits avec `Co-Authored-By` et `Claude-Session`, aucun identifiant
de modèle dans les fichiers.

## Corrections de l'audit qualité (D-059)

- Téléchargements par `chrome.downloads` (permission `downloads`) : chaque
  fichier est confirmé écrit ou signalé ; Écho ne purge que les segments
  confirmés (`panel.js` saveBlob/writeSegments, `src/native-session.js`
  ackExported).
- « Tout télécharger pour l'analyse » en action principale de fin de lot,
  bilan fichier par fichier ; couverture du panneau = C1 ; Écho indisponible
  pendant une reprise manuelle ; contrastes WCAG ; vue du panneau allégée
  avant copie (`vuePanneau` dans `background.js`).
- Outils : `tools/perf-lot.cjs` (intervalles GCV1 / décision / complète),
  `tools/navigateur-telechargements.cjs` (Chromium réel, hors banc).
- Reportés : C02 en 4.8.x ; C01, P01 stockage, P03, U04, provenance D04 en
  4.9 (`BANANE_4.9_CAHIER.md` §2).

## Ce que la 4.8.0 a livré

- **Noms** Ariane / Écho / Orbite (interface, messages, exports `ariane-…` ;
  identifiants internes et formats inchangés).
- **ESV lent : F5 puis « Reprendre »** (option 1, D-058) :
  `retablirApresRechargement`, `rebaserLot`, `reprendreLot` dans
  `background.js`. Retour au cut du lot par « cut non validé suivant »
  (400 pas au plus), sans rien valider ; appuis translatés dans le nouveau
  repère (vérifiés sur les deux rails à 1 mm), sinon écartés.
- **Page rechargée ou fermée pendant une commande** : erreur Chrome traduite
  en « adaptateur sans réponse » dans `callSur` (code `ESV_PAGE_ABSENTE`).
  Pose interrompue : réconciliation, « Archiver le résultat interrompu »,
  puis « Reprendre ».
- **ESV muet** (KI-063) : attente longue une fois le lot en route, Pause et
  Arrêter respectés ; cut de fin muet sans pose : `stoppedAtEnd.issue`
  `fin-sans-pose` ; annulations ciblées (`requestId`, `sentAt`).
- **Interface** : bouton blanc discret dans ESV, « Tout télécharger pour
  l'analyse », détails repliables, « Arrêter » toujours cliquable.
- **Rapport de sortie** : C1 tenu (objectif 79 %), C2 publié sans plancher,
  C3, C4 (faux isolés typés), C5 tenus (`audit/rapport-sortie-4.8.md`).

## Validation (28/09)

- Rejeu du code final sur tous les lots reçus : parties 12, 11, 9 (4.7.18 et
  4.7.19), 633 cuts, décisions identiques ligne à ligne ; moteur et décision
  sur le lot inchangés depuis la 4.7.21.
- Sept revues de code sur la reprise ; chaque constat a son essai rouge sans
  le correctif. Après l’audit : 865 essais, 863 passés, 2 sautés (corpus natif absent).
- **Simulé seulement** : le rechargement d'ESV et les textes d'erreur de
  Chrome. À surveiller au premier lot terrain (bilan et journal via « Tout
  télécharger pour l'analyse »).

## 4.8.5 (prévu)

- Lire la fin de partie dans ESV (« N on M treated », photo du 27/09 : 6593
  on 6732, partie 14).
- D-054 (voisins validés), choix à un appui (7738, 7026), garde de premier
  passage à 20 mm de la voie (7743, 1834) : au banc, puis sur une partie neuve.
- Biais vertical (partie 9) : hypothèse à chercher au banc (D-057).
- P2 : 4.9 (D-057).

## Skills

Les skills installés sur l'ordinateur de l'utilisateur ne sont pas visibles
d'une session cloud. Pour les partager : pousser leurs dossiers (`SKILL.md`
et fichiers) dans `banane/.claude/skills/<nom>/`, ou les envoyer en pièce
jointe.

## Consommation

Réponses courtes, sorties filtrées, un banc ciblé à la fois.
