# Décisions techniques

## D-054 - §14 I amendé : voisins validés comme appuis, sous garde de cohérence

**25 septembre 2026, direction.** Question ouverte par l'amendement n°13
(§13.3) : dans un reliquat, les cuts isolés n'ont d'appui que dans des cuts
validés à la main. Réponse de la direction : **validé**.

- Des cuts **voisins** validés par l'opérateur peuvent servir d'appuis à la
  voie de la décision sur le lot. Jamais de pose du cut décidé, jamais
  d'écartement cible : le contrat [1405, 1470] mm reste une admissibilité.
- **Garde de cohérence** obligatoire : un voisin n'est gardé que s'il s'aligne,
  sur les deux rails, avec au moins deux autres voisins de la fenêtre (±5 cuts),
  à 8 mm (latéral et vertical, repère du rail du cut décidé) ; moins de trois
  voisins cohérents : aucun appui validé. Mesuré sur la partie 19 : 57 % →
  79 %, 0 faux sur 7 jugés ; le voisin faux (9219, SKIP à 40–55 mm) est écarté
  (`audit/appuis-valides-2026-09-24.md`).
- **4.7.20** : la garde et l'entrée « voisins validés » sont dans
  `src/lot-decision.js` (`consistentValidated`, `decideCut({validated})`),
  partagées par le banc et le Pilote ; décision consignée (`validatedAnchors`).
  **Pas encore de source sur le terrain** : le Pilote ne voit que le cut
  affiché, et ESV ne navigue que vers le « cut non validé suivant ». Lire un
  voisin validé demande une navigation vers un cut donné, ou des poses validées
  enregistrées par Banane dans la même page. À instruire avec l'opérateur
  (cahier, amendement n°14).

Parties 6 et 9 (25/09) : dans un reliquat, c'est le seul levier notable ; la
reprise dans la même page n'ajoute que 3 cuts en partie 6.

## D-053 - Passage à niveau en dernier recours, voie encadrée, reprise des différés, arrêt au dernier cut (4.7.19)

**25 septembre 2026.** Demande de l'opérateur après les deux lots 4.7.18
(parties 2 et 3) : un lecteur « passage à niveau » et la reprise encadrée des
différés, à mettre en test sur le terrain. Mesure :
`audit/passage-niveau-lecteur-2026-09-25.md`.

- **`crossing` en dernier recours.** Au passage à niveau, le rail est lu par
  son ornière (`src/level-crossing.js`), seulement sur un cut que la chaîne
  diffère : paire posée si l'écartement est dans le contrat (admissibilité),
  si elle passe la garde d'écartement voisin et, avec des appuis, si elle tombe
  à la voie à `crossingVoieMm` 10 près. Jamais sur un cut décidé, jamais après
  la garde de paire. Banc relu : +45 cuts décidés, 36 jugés, 1 faux (partie 34,
  4551, 10,5 mm), aucun juste perdu ; lots 4.7.18 : +18, 17 jugés, 0 faux ; le
  passage à niveau 5377–5384 est décidé en entier. **Écarté** : le lecteur
  comme arbitre (premier passage gardé seulement si le moteur s'accorde avec
  l'ornière, ni reprise ni choix au passage à niveau), qui retirait 43 cuts
  justes sans arrêter aucun faux.
- **`framed` actif** (`frameGap` 8, `frameAnchors` 3) : un cut qui a des
  appuis posés des deux côtés est prédit par une courbe passant par eux. Sans
  effet en avancée normale.
- **Lot « Reprise des différés »** : il part des cuts posés et validés par le
  lot précédent autour de ses différés, figés dans son périmètre et consignés
  pour le rejeu. Aucun cut validé à la main n'entre (§14 I). Pas encore mesuré.
- **Arrêt au dernier cut du lot** (retour terrain) : paire posée sans
  validation, ou cut non résolu laissé sans commande ni navigation, pour
  qu'ESV ne passe pas à la partie suivante. Par l'état du lot ;
  `src/engine.js` reste épinglé.
- **KI-059** : capture, réponses et exports sous la limite de 64 Mio.
- Règles consignées (`lot-decision-v6` : `crossing`, `framed`) ; les lots
  antérieurs sont rejoués sans lecteur ni voie encadrée.
- **Non retenu, à décider par la direction** : des appuis validés à la main
  pour les cuts isolés d'un reliquat (amendement au §14 I nécessaire).

## D-052 - Un appui est un cut posé ; suites de la relecture 4.7.16 et du chantier 5 (4.7.18)

**24 septembre 2026.** Relecture indépendante de la 4.7.13 à la 4.7.16
(`audit/chantiers/relecture-4716.md`) et chantier 5 (`audit/chantiers/acceptation.md`),
intégrés.

- **Un appui est un cut posé** (constat B1, KI-057 ; question 2 du chantier 5).
  La décision propose un appui ; il n'entre dans la mémoire du lot qu'une fois
  ses positions commandées, appliquées et le cut validé. C'est la règle écrite
  au n°10 (« les cuts déjà placés du même lot »). Mesure
  (`audit/appui-pose-2026-09-24.md`) : Natif inchangé ; sur les lots Pilote,
  434 décisions commandables au lieu de 436, 207 justes au lieu de 209, faux
  inchangés (1). Les deux cuts perdus (partie 2 : 115, 116) n'avaient d'appuis
  que grâce au défaut : 113 et 114, hors de la vue. Règle consignée
  (`anchorRule:'placed'`, `lot-decision-v5`) ; le rejeu d'un lot antérieur garde
  l'ancienne règle, et la parité de la partie 35 reste de 233/233.
  **À confirmer par la direction** : c'est la lecture du cahier, et son seul coût
  mesuré est de deux cuts justes.
- **« Réessayer ce cut » refusé si les rails ont bougé pendant la pause**
  (KI-055) : la pose de l'opérateur n'entre jamais dans le moteur (§10, §14 I).
  Le correctif est dans le service worker ; `src/engine.js` est épinglé.
- **Version de création du lot consignée** (`scope.extensionVersion`, constat
  I1) : le rejeu la préfère à celle de l'export. Les lots déjà exportés restent
  soumis à la limite décrite par le relecteur.
- **C5 dans le rapport d'acceptation** (KI-056) : une ligne par section.
- **Constat I2** (preuve terrain de la 4.7.16 manquante) : il est toujours
  ouvert, et seul un lot neuf, complet et relu le lèvera.
- **Constat M1** (provenance de la navigation dans le statut) : il est traité
  par la 4.7.17 (commande en trois étapes, serveur toujours « non disponible »).
  Le contrôle visuel dans Edge reste à faire.
- **Terrain** (25/09) : l'opérateur est resté en 4.7.14 ; les 4.7.15 à 4.7.17
  n'ont jamais tourné sur ESV. Le premier lot 4.7.18 relu confirme ou non, en
  une fois, les règles de D-047, D-050 et D-052 ; le rejeu isole l'effet de
  chacune. Retour arrière de terrain : 4.7.14.
- Temps du banc (chantier 5, question 6) : les deux essais les plus longs
  (`lot-decision-navigateur*`, 7,2 et 7,6 s sur 10) sont chacun un scénario
  unique. Ils ne sont pas découpés.

## D-051 - Faux de premier passage sans appui : observer, aucune garde

**24 septembre 2026**, sur l'étude du chantier 7 (`audit/chantiers/faux-sans-appui.md`,
branche `chantier-48/faux-sans-appui`, intégrée). Base reproduite : 711 cuts
décidés, 4 faux (398, 402, 983 de la partie 20 ; 137 de la partie 2), tous des
premiers passages. Six gardes simples mesurées en un seul passage, appuis
recalculés : aucune n'arrête ces faux sans perdre de cuts justes. La plus large
(écart à la pose ESV > 50 mm) en arrête trois, mais perd 110 justes et crée
deux faux par ricochet (405, 114) ; celle du calage hors domaine arrête 137 et
perd 12 justes ailleurs. Les seuils ESV ont été choisis après observation des
faux : aucun n'est validé.

- **Retenu : observer, ne rien activer.** Aucun code ne change.
- Ces faux restent nommés dans chaque bilan ; le signal qui les séparerait
  n'existe pas encore dans ce que le moteur publie en premier passage.

## D-050 - 4.7.16 : garde d'écartement voisin à 20 mm, choix à 5 points de dessus

**24 septembre 2026, direction** (« ok pour les deux, je valide »), sur la
recommandation du bilan (`audit/ecartement-voisin-2026-09-24.md`,
`audit/curseurs-lot-2026-09-24.md`).

- **Garde d'écartement voisin, 20 mm** : paire écartée si son écartement
  s'éloigne de plus de 20 mm de la médiane des 3 appuis les plus proches ;
  garde seulement, jamais cible (cahier §3.6, §7 invariant n°1). 15 mm
  écarterait un cut juste où l'écartement change réellement (9047).
- **`minTop` du choix : 5** (était 15). Filtre du choix seulement ; un choix
  n'est jamais appui. 3 et 1 n'ajoutent que 2 justes, dont un au seuil.
- Ensemble, 6 sessions Natif et 5 lots Pilote relus : 711 décidés au lieu de
  690, +13 justes, −1 faux (7026), aucun juste perdu. Réserve : les gains du
  choix viennent du banc Natif ; le premier lot 4.7.16 relu les confirme ou non.
- Écartés : aide au choix par l'écartement et « cible » (aucun cut changé).

## D-049 - 4.9 : décentrer la caméra d'ESV pour atteindre le champignon

**24 septembre 2026, direction.** « Quand l'écartement est trop important et
que la correction à effectuer est hors de la caméra ESV, il faudrait un outil
permettant de décentrer la caméra afin que le super cerveau aille chercher la
portion où placer le champignon sur le nuage de points. » Chantier inscrit au
cahier 4.9 (`BANANE_4.9_CAHIER.md`, §1), ouvert à cette date en brouillon avec
les autres chantiers déjà renvoyés à la 4.9. Rien ne change en 4.8 (D-043).

## D-048 - Relecture ciblée des lots

**24 septembre 2026, direction.** Le prochain lot Pilote (4.7.14) est relu sur
une zone ciblée, pas en entier : la direction juge la fiabilité suffisante pour
ne plus tout relire. Conséquence : C4 et la précision portent sur les seuls
cuts de la zone ; chaque rapport donne la zone, le nombre de cuts jugés et la
part du lot qu'ils représentent, et n'extrapole pas au reste du lot. Le lot
4.7.12 de la partie 35 (233 cuts, 203 placés) ne sera pas relu : relecture non
enregistrée.

## D-047 - Bilan des curseurs de la décision sur le lot ; reprise appui jusqu'à 15 mm (4.7.15)

**24 septembre 2026.** Critère C5, `audit/curseurs-lot-2026-09-24.md`. Chaque
curseur de `src/lot-decision.js` déplacé seul, décision rejouée en un seul
passage (appuis recalculés), garde de paire active, sur 6 sessions Natif et
4 lots Pilote relus. Base (4.7.14) : 652 cuts décidés, 489 jugés, 4 faux
(398, 402, 983, 7026).

- **`chainMm` 10 → 15 mm, desserré en 4.7.15** (autorisé par la direction le
  24/09) : une reprise depuis la voie devient appui si elle tombe à 15 mm au
  plus de la prédiction. +4 justes, 0 faux, 0 juste perdu. La décision consigne
  ses règles (`lot-decision-v3`, `chainMm`) ; le rejeu d'un lot antérieur garde
  10 mm.
- **Conservés** : `guardMm` 30 (20 : −4 justes ; 40 : +1), `chooseMm` 15
  (10 : retire le faux isolé 7026 pour 5 justes, D-042 ; 20 : −2), `gap` 3
  (2 : −14 justes ; 4 : +1 faux, 1835), `anchors` 2 (3 : −1), garde de paire
  (D-044).
- Les quatre faux restants ne dépendent d'aucun de ces curseurs dans les
  plages essayées : 398 et 402 sont des premiers passages sans aucun appui,
  983 est à 3,9 mm de la voie de ses voisins, 7026 est isolé (D-042).
- Filtres du choix (base 4.7.15) : `minFace` 3 et `maxDzMm` 20 conservés
  (2 : +2 justes dont un à 9 mm ; 5 : −6 ; `maxDzMm` 10 : −10, 30 : 0).
  `minTop` du choix : 5 donne +11 justes, 0 faux, 0 perdu, au banc Natif
  seulement (3 et 1 : +13, dont un cut au seuil de 10 mm) — **proposé à 5,
  à trancher par la direction**. `chainMm` 30 ajoute un faux (1205) : 15 est
  confirmé.

## D-046 - Relecture indépendante de la 4.7.12 : corrections et questions ouvertes

**24 septembre 2026.** Livraison du chantier 3 (branche
`claude/banane-relecture-478-vnvl2u`, rapport `audit/chantiers/relecture-478.md`),
intégrée. Corrigé en 4.7.14 :

- **B1, bloquant (KI-053)** : une paire du moteur retirée par la garde de
  continuité n'est plus jamais rendue par un repli (position de la voie hors de
  la vue, caméra inconnue, repère ou écartement non relus, erreur) : le cut est
  différé. C'est l'intention même de la garde ; aucun seuil ne change.
- **I3 (KI-052)** : « Reprendre » sur le cut archivé est refusé avant tout
  changement d'état ; le lot reste arrêté et reprend au cut suivant.
- **Règles du rejeu** : la décision consigne ses règles (`lot-decision-v2`,
  `pairGuard`) ; l'outil d'acceptation les lit dans le lot.
- **C4** : l'outil rapporte aussi les faux sur les seuls cuts validés.

Questions ouvertes à la direction : engager C4 sur les seuls cuts validés
(les acceptations D-040 comptées à part) ; maintenir D-044 (recommandé :
la partie 34, jamais vue, lui donne un faux arrêté et aucun juste perdu) ; les
appuis validés (4.9) feraient entrer des poses humaines dans l'entrée de la
décision : un amendement au test I du §14 serait nécessaire avant tout code.

## D-045 - Interface de la 4.8 : « La ligne »

**24 septembre 2026, direction.** Pour le chantier B (Banane UI Next), la
direction retient la proposition « La ligne » (`design/ui-next-claude/`), de
préférence aux maquettes de Luna. Son intégration au panneau est un chantier
de la phase 3 (version candidate) ; les invariants du test H restent la
condition : politique effective affichée, « Différés : N » fidèle, incertitude
visible avec son cut, aucun bouton présenté comme réussi sur un simple accusé.

## D-044 - Garde de paire active dans le Pilote (4.7.12)

**24 septembre 2026, direction** (« ok »), sur la livraison du chantier 2
(branche `chantier-48/faux-isoles`, commit `c434a9a`, intégrée). Un premier
passage dont un rail est repêché par S1 **et** dont le calage de convention est
hors domaine sur l'un des deux rails est **différé**, et ne devient pas appui
(`src/lot-decision.js`, `pairGuard`). **Rectifié (relecture 4.7.12)** : la garde
ne fait pas que différer — en retirant un appui, elle change les décisions des
cuts suivants (partie 34 : 1835 et 1837 deviennent des choix à un seul appui,
le cas de KI-050 ; justes tous deux à la relecture).

- Mesure (`audit/garde-paire-verification-2026-09-24.md`) : dans le Pilote
  actuel, 241 et 409 arrêtés (faux), aucun juste perdu, 243 gagné ; ne se
  déclenche sur aucun des trois lots Pilote relus ni sur la partie 30.
- Premier déclenchement sur un vrai lot : partie 34 (lot 4.7.11, rejoué avec
  les règles de la 4.7.12), cut 1834. **Relu : faux de 26,5 mm**, seul faux du
  lot ; avec la garde, 0 faux sur 71 jugés.
- Le rejeu de l'outil d'acceptation suit les règles de la version de chaque
  lot ; `--regles-actuelles` impose celles de la version courante.

## D-043 - Cibles hors de la vue d'ESV : pas de chantier 4.8

**24 septembre 2026, direction.** Sur la partie 33, les poses de départ d'ESV
sont à 13–21 cm des rails ; la décision sur le lot les retrouve, mais hors de
la vue de ±20 cm où le Pilote clique (KI-051). « Quand ça m'arrive, je déplace
la caméra en dézoomant et en déplaçant la vue au clic droit. Je ne pense pas
qu'on soit obligé de l'inclure dans les chantiers de la 4.8. »

- La 4.7.11 diffère ces cuts au lieu d'arrêter le lot ; l'opérateur les pose.
- Aucun déplacement automatique de la caméra ni clic en deux temps en 4.8.
- Conséquence déclarée : sur une partie où ESV part loin des rails, la
  couverture du Pilote est bornée par la vue (partie 33, second lot : 78 %).

## D-042 - 4.7.10 sous la forme prévue : un faux toléré, correctif s'il se répète

**24 septembre 2026, direction.** « Franchement, un seul faux, on peut être
tolérant : on peut sortir la 4.7.10 sous la forme initialement prévue, et si
une anomalie identique se répète deux ou trois fois, on apportera un
correctif. »

- La 4.7.10 applique la décision sur le lot telle qu'observée en 4.7.8 et
  4.7.9 — premier passage gardé, reprise depuis la voie, choix par la voie, y
  compris à un seul appui. La condition de D-041 (0 faux) est levée par la
  direction pour ce seul faux (7026, KI-050).
- **Correctif** : dès que l'anomalie de KI-050 (choix à un seul appui, minimum
  loin d'une prédiction juste) se reproduit sur des lots relus, deux ou trois
  fois, je le propose, mesuré sur toutes les données relues
  (`audit/choix-un-appui-2026-09-24.md` §4 donne les candidats). Tout faux d'une
  autre nature est analysé et remonté aussitôt.
- Les faux des cuts placés par la décision sur le lot sont comptés à part
  (`tools/acceptance-report.cjs`, `c4.byLotCommand`).
- Le réglage « Observer seulement » rend la 4.7.9 sans réinstaller.

## D-041 - 4.7.10 : le Pilote applique la décision sur le lot, après la relecture du lot 2

**24 septembre 2026, direction.** Accord pour une grosse mise à jour du Pilote
reprenant les avancées retenues : en 4.7.10, la décision sur le lot
(`src/lot-decision.js`, D-039) **commande** au lieu d'être seulement consignée.
Condition : la relecture du lot 2 de la partie 31 (4.7.9) juge **0 faux** sur
les cuts que la décision sur le lot applique et que le Pilote laissait. Aucun
développement avant cette relecture.

La pause automatique quand ESV ne charge pas le nuage (KI-049) n'est pas
retenue pour l'instant : le cas ne s'est pas reproduit depuis.

**Relecture du lot 2 (24/09) : condition non remplie.** Décision sur le lot :
1 faux sur 69 jugés, le cut 7026, un CHOIX à un seul appui (KI-050). La
4.7.10 ne sort pas sous la forme prévue ; formes possibles et mesures :
`audit/choix-un-appui-2026-09-24.md` §5, en attente de la direction.

**Appuis validés (24/09, direction).** La voie retenue pour les lire est que
le Pilote se déplace seul sur les cuts voisins pour y lire leur pose ;
chantier ultérieur. L'inspection 3 bis (carte d'ESV) sera faite par
l'opérateur.

## D-040 - Relecture : une visite sans correction ni validation vaut acceptation

**24 septembre 2026, direction.** « Pour moi et tous les opérateurs, si on
visite un cut sans le corriger ni le valider, c'est que le cut est bon et bien
placé. » La relecture d'un lot Pilote suit donc la convention des opérateurs :

- visite **sans validation et sans changement de pose**, d'au moins 0,5 s :
  la pose vue est **acceptée** ; le cut est jugé, erreur nulle par
  construction, compté « accepté sans retouche » à part des cuts validés ;
- visite **retouchée sans validation** : pose finale incertaine, non jugeable ;
- passage de moins de 0,5 s (touche Z en rafale) : non jugeable.

C4 (faux) porte sur les cuts validés et acceptés ; **C2 (précision) reste
mesuré sur les seuls cuts validés** : une acceptation dit « pas faux », pas « à
combien de millimètres ». Mise en œuvre : `tools/acceptance-report.cjs`.
Premier lot 4.7.8 de la partie 31 : 34 cuts appliqués jugés sur 35 (9 validés,
25 acceptés), 0 faux.

## D-039 - D1 : choix par la voie autorisé ; 4.7.8 en observation dans le Pilote

Date : 23 septembre 2026. Décision de la direction sur le résultat de la
phase 0 (`audit/lot-choice-2026-09-23.json`). Amendement n°9 du cahier.

- La règle « la prédiction ne fait que déplacer la fenêtre » est levée pour le
  choix par la voie, aux conditions du n°9 §9.1.
- Variante visée : deux passages (reprise des différés en fin de lot), rails
  éligibles élargis aux abstentions de qualité (variante B), chaînage gardé à
  10 mm ; le seul passage est mesuré en parallèle.
- Mise en œuvre : 4.7.8 en observation dans le Pilote, jamais appliquée ;
  activation soumise à D2.

## D-038 - Comparaison des deux audits à mi-parcours ; définitions de mesure

Date : 23 septembre 2026. Sources : `audit/mi-parcours/AUDIT_CLAUDE.md` et
`audit/mi-parcours/AUDIT_ASTRA.md` (indépendant). Les deux convergent sur
l'objectif intermédiaire de 80 % et sur la décision au niveau du lot.

Retenu de l'audit indépendant, sans changer le plan D-037 :

- **Dénominateur de C1** : tous les cuts DISTINCTS d'un lot Pilote complet
  déclaré ; un cut sans entrée, différé, refusé par la garde ou de résultat
  inconnu reste au dénominateur ; une revisite n'est pas un nouveau cut. Le
  taux sur cuts avec entrée est un diagnostic, jamais le dénominateur.
- **Critère « faux » bidimensionnel** : erreur latérale OU verticale au-delà
  de 10 mm, mesurée sur valeurs brutes. Vérifié : sur les 233 cuts jugés
  justes des deux audits du moteur, aucun ne dépasse 10 mm verticalement ;
  les chiffres passés ne changent pas, la définition si.
- **Périmètre explicite** : les cuts 9033 et 9241, exclus à la demande de
  l'opérateur, le sont dans chaque bilan qui les concerne, et le bilan le dit.
- **Minima proches ≠ paires récupérables** : le plafond « ~88 % » de l'audit
  interne n'est pas une mesure ; seule une paire complète, admissible et jugée
  compte (chantier 1, `tools/lot-choice-study.cjs`).
- **Journaliser les candidats** : minima et paires de chaque rail consignés
  dans l'observation, pour séparer absence d'observation, bon rail non choisi
  et paire refusée (prochaine version d'observation).
- **Qualification par côté instrumentée** (chantier 3) : raison, présence,
  visibilité, capture avant geste, doublons.
- **Holdout par partie** et P2 avant toute conclusion de généralisation.

## D-037 - Plan de mi-parcours du cahier 4.8

Date : 23 septembre 2026. Décision de la direction sur l'audit interne à
mi-parcours (l'audit indépendant est en cours ; les deux seront versés
ensemble).

Constat retenu : dans la majorité des cuts différés, le moteur a calculé la
bonne position et ne la choisit pas — ambiguïté entre le rail et un champignon
voisin, ou paire refusée par l'écartement parce qu'un rail est sur ce voisin.
Sur le terrain (Pilote 4.7.6, partie 19), 11 différés sur 13 relèvent du choix.

- **Objectif intermédiaire : 80 % des cuts de lots Pilote**, deux rails dans le
  contrat, 0 cut faux au-delà de 10 mm, rapporté par partie. Les 90 % du §2
  restent le cap.
- **Chantier 1 — décider sur le lot** : utiliser la position prédite par la
  voie pour choisir entre les minima que le moteur calcule déjà ; étude hors
  ligne d'abord (`tools/lot-choice-study.cjs`), amendement ensuite si elle le
  justifie.
- **Chantier 2 — lots Pilote terrain** sur des parties à appareils de voie,
  relus en Natif ; C1 compté sur les cuts du lot.
- **Chantier 3 — aligner le banc sur le Pilote** : le filtre de qualification
  centré sur la pose ESV ne doit plus retirer du banc les cuts que le Pilote
  sait lire.
- **Chantier 4 — P2** : 30 cuts replacés en aveugle.

## D-036 - Observation « continuité » dans le Natif (4.7.7)

Date : 23 septembre 2026. Décision de la direction, sur la base de l'amendement
n°7 du cahier 4.8 et de sa relecture indépendante.

À la fin de chaque première visite Natif, Banane calcule la proposition que le
moteur GCV1 aurait faite en partant de la droite des cuts voisins déjà validés
par l'opérateur, et la consigne dans la visite (`continuityObservation`). Elle
n'est **ni appliquée, ni affichée, ni commandée** : l'opérateur ne doit pas
être influencé, sinon sa pose cesse d'être un juge indépendant.

Règles (`src/continuity-observer.js`), fixées après la relecture :

- ancres : validations fiables et ANTÉRIEURES de la session, aux règles de
  référence du banc (une seule intention VALIDATE, état associé, fraîcheur de
  0 à 1 500 ms), même partie et même repère de scène, à 3 numéros de cut au
  plus ; les 2 plus proches. Jamais une proposition du moteur ;
- sans ancre : aucun calcul (pas de retour à la pose ESV) ;
- points : une capture par côté, prise à la pose ESV exacte avant le premier
  changement de rail, visibilité prouvée, doublons retirés ;
- moteur, calage et garde d'écartement appelés tels quels ; aucune cible
  d'écartement ; l'écart à la prédiction est consigné pour juger toute garde
  de continuité hors ligne ;
- calcul hors de la file des événements, une visite à la fois, au plus 4 en
  attente ; la fin de session attend les calculs en cours (15 s au plus).

Coupure : `BananeSettings.continuity.observe`. Retour : 4.7.6
(`RETOUR_ARRIERE.md`). Critère d'arrêt : si, sur la collecte, le départ par
continuité fait plus de cuts faux que le départ ESV rejoué sur la même entrée.

## D-035 - Bilan des curseurs du cahier 4.8, §8 (critère C5)

Date : 23 septembre 2026. Source : `audit/brain-audit-2026-09-22.json` (moteur
4.7.6, 385 cuts, parties 13, 18, 19, 20), rails abstenus jugés contre la
validation humaine ; « juste au premier rang » signifie que le meilleur minimum
de la grille était à 10 mm ou moins de la pose humaine.

| Curseur | Valeur retenue | Coût mesuré | Décision |
|---|---|---|---|
| `minFace` | 6, avec flanc partiel 3–5 points si le dessus est bien vu | Voir D-031 | **Desserré** en 4.7.5 (D-031). Reste : 60 rails abstenus pour flanc, 27 sur 41 jugés justes au premier rang, avec moins de 3 points de flanc. Pas de nouveau desserrage sans une autre preuve (continuité de voie, D-033). |
| `minTop` | 15 | 15 rails abstenus ; sur 13 jugés, 7 justes au premier rang, 3 à un rang suivant, 3 absents | **Conservé.** Desserrer publierait au mieux 7 justes pour 6 douteux ; aucun bilan de desserrage n'est encore mesuré. Bilan incomplet, à instruire. |
| Competitive set `loss/lmin` (ambiguïté) | 1,5 | 13 rails abstenus ; sur 12 jugés, 7 justes au premier rang, 5 faux au premier rang | **Conservé.** Desserrer publierait 5 rails faux sur 12. Le classement doit venir d'une autre information (continuité de voie), pas d'un seuil plus lâche. |
| Pente hors domaine | inchangée | 10 rails abstenus ; sur 7 jugés, 6 justes au premier rang | **Conservé**, hors liste du §8. Coût réel, gain de desserrage non mesuré. |
| Garde d'ambiguïté S1 | active | KI-031 : une abstention de plus, une erreur > 50 mm de moins | **Conservé.** |
| Seuil de confiance | neutralisé en Pilote GCV1 | 0 cut mis en pause sur 74 (KI-033) | **Conservé.** |
| Fenêtre de fraîcheur de la référence | 1 500 ms | 9 rails sans référence sur 477 qualifiés, contre 145 faute de validation | **Conservée.** Ce n'est pas elle qui prive le banc de références, c'est l'absence de validation (KI-039). |

Le contrat d'écartement n'est pas un curseur (cahier §8) : inchangé.

## D-034 - A1 redéfini deux fois ; A2 écarté de la 4.8

Date : 22 septembre 2026 (cahier 4.8, amendements n°1 et n°4). Le score de
justesse pour classer des hypothèses (A1 d'origine) est sans objet : le
classement déterministe retrouve le meilleur couple admissible 17 fois sur 17.
Le modèle d'abstention qui l'a remplacé est lui aussi sans objet : aucun cut
appliqué n'est faux sur 76 jugés. A1 devient le calage de convention (D-032).
L'inférence embarquée (A2) est écartée de la 4.8 : entrée alors affamée, service
worker MV3 détruit après une trentaine de secondes d'inactivité ; réouverture
par amendement seulement.

## D-033 - Continuité de voie : étudiée, pas activée

Date : 22 septembre 2026 (cahier 4.8, amendement n°3). Dans les appareils de
voie, recentrer la recherche du moteur gelé sur la position prédite par les cuts
voisins appliqués donne 12 cuts justes, 0 faux et 6 différés sur 19 avec des
voisins des deux côtés (7 justes, 0 faux en passage unique). Une seule partie,
un seul jour : outil `tools/continuity-study.cjs`, rien dans l'extension.
Préalables à toute activation : mesure sur au moins deux autres parties avec
appareils de voie, puis observation dans le Pilote sans application.
L'écartement des cuts voisins ne peut servir que de garde, jamais de cible.

## D-032 - Calage de convention des rails publiés (4.7.6)

Date : 22 septembre 2026 (cahier 4.8, amendement n°4). Le moteur pose le gabarit
au milieu de la bande de points LiDAR, l'opérateur en enveloppe : rail 2,8 mm
trop bas, écartement 4,5 mm trop large en médiane. `src/placement-convention.js`
cale chaque rail publié : dessus au 90e centile des points + 1,0 mm, flanc à la
médiane des points − 2,6 mm, pas de correction latérale sous 6 points de flanc,
pas de calage sous 15 points de dessus ni au-delà de 8 mm. Appliqué après S1 et
avant la garde d'écartement ; A_STAR, S1 et seuils inchangés. Hors ligne, chaque
session retenue à tour de rôle : latéral médian 2,39 → 1,60 mm, vertical
2,83 → 1,13 mm, écartement 4,67 → 2,34 mm ; aucune décision de cut changée.

**Validation.** La relecture Natif d'un lot Pilote est ancrée : l'opérateur part
du placement proposé et ne retouche qu'au-delà de sa tolérance (KI-034, KI-035).
La mesure qui fait foi est une collecte Natif indépendante — l'opérateur pose
depuis l'état ESV, sans proposition — sur une partie non utilisée pour
l'ajustement, rejouée hors ligne calage actif puis coupé
(`tools/brain-audit.cjs --convention on|off`). Retour 4.7.5 si le calage y est
plus loin de l'humain que le placement brut, en médiane latérale ou verticale,
ou s'il rend faux au-delà de 10 mm un cut que le placement brut n'aurait pas
rendu faux.

## D-031 - Flanc partiel dans le Pilote (4.7.5)

Date : 22 septembre 2026, décision de la direction (cahier 4.8, amendement n°3).
Un rail dont le dessus a au moins 15 points et le flanc 3 à 5 points peut être
publié, sans pente hors domaine, rapport de perte ≥ 1,5, deux rails exigés,
écartement dans le contrat. Option de laboratoire existante `partialFaceKeep`,
fichier gelé intact. Bilan, moteur réel sur cinq collectes : cuts appliqués
56 → 113, 72 jugés, 0 faux au-delà de 10 mm, pire rail 6,5 mm. Dérogation au
§1.5 (P2) pour cette seule règle. Retour 4.7.4 au premier cut appliqué en flanc
partiel trouvé faux au-delà de 10 mm.

## D-030 - Le Pilote ne lit pas « comme le Natif »

Date : 22 septembre 2026 (cahier 4.8, amendement n°2). Le Pilote lit déjà tous
les points chargés dans la zone après stabilisation du niveau de détail. Le gain
de résolution mesuré venait de l'entrée du banc, pas de la lecture ; le chantier
envisagé est annulé.

## D-029 - Entrée du banc : lecture complète de la pose de départ

Date : 22 septembre 2026 (cahier 4.8, amendement n°2). Le banc donne au moteur
l'instantané qualifié plus la suite de la même lecture — même capture, même
côté, même pose — acquise avant la première action humaine. La frontière
anti-fuite (D-026) est inchangée. `first-snapshot` reste disponible pour
comparer ; l'évaluateur historique 4.4 n'est pas modifié.

## D-028 - Collecte Natif au rythme réel (4.7.2 à 4.7.4)

Date : 22 septembre 2026. La lecture Natif n'est plus interrompue par un
mouvement de caméra ; elle lit par tranches de temps avec accès direct aux
buffers ; la garde se réduit à l'identité du cut et à la pose des rails ; une
relecture n'est relancée que pour de nouveaux nœuds chargés tant que la pose
n'est pas qualifiée (4.7.2). La fin de session reste sous la limite de message
de 64 MiB et une modification de la découpe ESV relance la lecture (4.7.3). Plus
aucune lecture après un déplacement de rail par l'opérateur, qui ne nourrirait
jamais le moteur (4.7.4, `collector.captureAfterOperatorRailChange`). Le
placement et le Pilote ne sont pas touchés par ces trois versions.

## D-4.7c - Autorisation d'opération, finalisation déterministe, export par opération

Date : 21 septembre 2026, correctif post red-team Astra.

**Autorisation portée par l'opération (D1).** Une navigation sans décision n'est dispatchée que si son autorisation est encore valide au moment de l'appel, et le contrôle est relu sans qu'aucun `await` ne le sépare de l'appel — le moteur étant mono-tâche, rien ne peut s'intercaler. `stop()` et `pause()` posent l'état du lot et la révocation SYNCHRONEMENT, avant tout `await`. La révocation ne vaut que tant que `dispatchedAt` est absent ; une fois la commande transmise, elle est enregistrée comme demandée après coup et n'autorise à affirmer aucune non-émission. Dans la page, `cancelledOperations` et `invokedOperations` sont corrélés à l'identifiant d'opération et ne sont jamais vidés par une autre requête, contrairement au drapeau global `cancelled` que chaque entrée de l'adaptateur remet à faux. Le résultat ne dépend donc pas de l'ordre d'arrivée du `cancel` et de la requête. Une opération déjà invoquée ne peut pas l'être une seconde fois, et le second appel rend `commandInvoked: 'unknown'` : il n'a pas cliqué, mais l'opération a pu agir.

**Finalisation réparable (D3).** L'événement `defer-finalized` porte un `eventId` déterministe dérivé de l'`operationId` et un `timestamp` figé sur l'instant de finalisation déjà persisté. Réémis après une interruption, il est identique et reste un seul événement logique — le stockage le déduplique par sa clé, le journal en mémoire aussi. Une finalisation durable retrouvée sans son événement est réparée à partir de l'intention durable et de l'entrée deferred de la MÊME opération : aucune commande ESV, aucun second deferred, et aucun champ relu depuis `s.proposal` ou `s.lidarId`, qui décrivent déjà un autre cut au moment d'une reprise.

**Un `deferral` vient d'une seule opération (D4).** L'export regroupe les événements différés par `operationId`, choisit explicitement une opération — finalisation durable unique, sinon intention encore persistée, sinon opération unique — et n'agrège que les siens. L'ordre du tableau et l'ordre lexical des UUID n'entrent jamais dans ce choix : `store.all('events')` rend les événements par clé aléatoire, pas par chronologie. À timestamp égal dans une même opération et pour un même type, l'identifiant sert de départage reproductible entre événements équivalents, jamais de chronologie. Une ambiguïté réelle est publiée telle quelle (`DEFER_AMBIGUOUS`, motif, identifiants en présence) plutôt que résolue arbitrairement, et un événement historique sans `operationId` n'en reçoit jamais un après coup.

**Priorité de la décision opérateur (D2).** La clôture automatique de borne ne s'applique qu'à un lot encore en marche. Un STOP ou une PAUSE demandés pendant la navigation conservent le résultat deferred acquis et l'état opérateur ; la borne atteinte est consignée et sera constatée à la reprise explicite.

## D-4.7 - Différer un unresolved GCV1 par navigation sans décision

Date : 20 septembre 2026. En Pilote TEST, un cut dont GCV1 n'a pas résolu au moins un rail peut être quitté sans décision : aucune application de rail, aucun VALIDATE, aucun SKIP. La politique `unresolvedPolicy` est figée dans le scope du lot à sa création — `defer` par défaut pour un nouveau lot Pilote GCV1, `pause` si l'opérateur le choisit, `pause` pour un lot antérieur qui n'a pas le champ. Ni un redémarrage ni un changement du réglage d'interface ne convertit un lot en cours.

La branche `defer` exige une proposition GCV1 attribuée sans ambiguïté au cut courant, une capture LiDAR référencée, et au moins un rail portant `status: unresolved` avec `source: geometry-candidate-v1-abstention`. Une proposition absente, d'une autre identité, un repli hors GCV1, un delta manquant sans abstention ou une erreur technique gardent leur diagnostic et leur pause : `missing === true` ne suffit jamais à lui seul. Les politiques de faible confiance et l'admissibilité des candidates S1 à confiance non calibrée ne changent pas.

Un différé est une issue du **pilote**, pas une résolution scientifique. `batch.deferred` est une collection distincte de `processed`, `skipped`, `paused`, `interrupted` et `manuallyCompleted` ; elle n'est jamais comptée comme une validation, et un lot qui en contient ne peut pas finir sur « Terminé confirmé ». L'enregistrement `banane-deferred-unresolved-v1` porte `decision: DEFERRED_UNRESOLVED`, `usableForTraining: false`, `trainingExclusionReason: gcv1-unresolved-deferred`, et conserve les statuts GCV1 des deux rails tels quels. Les champs `bananeValidated`, `validationCommandSent`, `skipCommandSent` et `applyCommandSent` décrivent les commandes Banane de cette opération — `commandScope: banane-operation-only` — et non un audit rétroactif de tout ce qu'ESV a connu de ce cut.

## D-4.7b - La commande de navigation utilisée, et l'équivalence Maj+Z observée

Date : 20 septembre 2026. `nextWithoutDecision` clique `O2N3DCutNextInvalid3DRail`, relevé dans les sources V2–V2.4.2 et câblé depuis la V3 ; le chemin SKIP ne passe pas par lui (D-4.4 ci-dessous). L'inspection directe du JavaScript ESV chargé dans Edge, le 20 septembre 2026, établit que ce bouton et le raccourci Maj+Z atteignent **la même fonction native** : le gestionnaire clavier contient `e.shiftKey && 90 == e.which ? t.buttonNextInvalidCut()` et le bouton est câblé par `$("#O2N3DCutNextInvalid3DRail").click(function(){ t.buttonNextInvalidCut() })`, `buttonNextInvalidCut()` appelant `loadNextInvalidCut("positive")`. Les chemins décisionnels sont séparés dans le même code : `buttonValidateRail()` et `buttonValidateRailAndNext()` passent par `railPairUpdated(…, "valid", …)`, `buttonSkipRail()` par `railPairUpdated(…, "skipped", …)`. Le contrat « navigation sans décision » est donc observé, pas supposé, et la preuve retournée porte `shortcutEquivalence.established: true` avec les deux chemins, la source et la date.

Cette preuve vient de l'observation du code chargé, **pas d'une documentation du fournisseur**. `buttonNextInvalidCut`, `loadNextInvalidCut` et l'identifiant DOM restent des symboles internes non publiés, susceptibles de changer à une mise à jour d'ESV : la preuve le dit par `source` et `stability`, et KI-026 tient la limite de maintenance. Aucun `KeyboardEvent` « Z » n'est synthétisé pour autant, bien qu'un gestionnaire clavier soit maintenant observé : le défaut 6 d'`AUDIT_PILOTE.md` rappelle qu'un événement dispatché ne prouve pas sa prise en compte, alors que le bouton expose sa présence et son état `disabled` avant l'action.

La corrélation disponible est celle du bridge — une requête, une réponse, un `operationId` que Banane transporte et qu'ESV ne renvoie pas — plus un contrôle d'identité complète, de page et de part effectué **dans la page**, juste avant l'action. Une navigation manuelle concurrente pendant cette fenêtre reste hors de portée, et le champ `correlation` le dit plutôt que de l'omettre. `commandInvoked` vaut `true` seulement après le retour de l'appel, `false` seulement sur un refus antérieur au clic, et `unknown` partout ailleurs : une incertitude n'est jamais rendue comme un `false` rassurant.

## D-4.4.3 - Fenêtres réellement vivantes plutôt que filtre URL

Date : 13 septembre 2026. Le retour ESV contredit la validation simulée V4.4.2. La présence de Banane est désormais définie par les fenêtres créées et les connexions vivantes de ses cinq pages, sans se fier au filtrage d'onglets par URL d'extension. Ces connexions se rétablissent après arrêt/reprise du service worker. Pour écarter également une règle CSS ESV et les réponses asynchrones obsolètes, le bouton flottant est retiré physiquement du DOM puis réinséré, et les mises à jour plus anciennes sont ignorées. La notification provenant de Banane n'observe ni ne modifie les commandes de Mic dans ESV.

## D-4.4.2 - Preuves acquittées avant les intentions et interface discrète

Date : 13 septembre 2026. Chaque instantané de rail issu des seuls points visibles conserve son identité, sa fenêtre d'acquisition, la pose initiale et les preuves de source/repère. La sauvegarde du bloc est acquittée avant l'événement de checkpoint. La qualification temporelle s'appuie sur l'acquisition plutôt que sur l'arrivée tardive du message de fin ; une contradiction ultérieure révoque explicitement l'instantané. Les exports V4.4.1 ne sont jamais requalifiés rétroactivement. L'ouverture du panneau Banane masque le bouton flottant dans ESV jusqu'à fermeture de la dernière fenêtre, sans action ESV. Aucune modification du moteur de placement.

## D-001 - Préserver la référence originale

Date : 10 septembre 2026.  
La V4.0 d'origine est conservée dans `archive/` et exclue des modifications et du paquet installable.

## D-002 - Placement par gabarit U50 soutenu par les surfaces

Date : 10 septembre 2026.  
La translation proposée utilise le minimum affiné du recalage du contour complet du champignon. Les ajustements du plan de roulement et du flanc interne restent obligatoires comme preuves de support et sont conservés comme diagnostics. Motif : sur les 47 corrections, l'intersection seule était moins proche des pointages humains et pouvait sélectionner des surfaces parasites de passage à niveau.

## D-003 - Refuser l'ambiguïté plutôt que gonfler la confiance

Date : 10 septembre 2026.  
Un second bassin de recalage distant d'au moins 20 mm rend la proposition non applicable lorsque son coût est inférieur à 1,5 fois le meilleur coût. Un déplacement latéral supérieur à 60 mm est également refusé si l'autre rail ne fournit pas au moins 40 mm de soutien latéral. Ces seuils sont des barrières de sécurité expérimentales, évaluées sur les 47 cuts et le corpus historique; ils ne sont pas une règle métier ESV.

## D-004 - Ne pas activer de correction propre à la part 11

Date : 10 septembre 2026.  
Une correction médiane apprise sur les 47 cuts réduit encore l'erreur, mais elle n'est pas intégrée au moteur. Le projet ESV n'étant pas observable, une part numérotée 11 pourrait appartenir à un autre projet. Une calibration ne pourra être appliquée qu'avec une identité de dataset vérifiable et une évaluation sur des portions indépendantes.

## D-005 - Ne pas reconstruire l'écartement ESV par hypothèse

Date : 10 septembre 2026.  
La distance entre origines de profils ou un calcul LiDAR ne remplace pas la valeur ESV sans preuve d'équivalence. `src/gauge.js` fournit uniquement un parseur et une classification pure testables; aucun sélecteur DOM, aucune lecture ESV et aucune action SKIP ne sont inventés.

## D-006 - Séparer sécurité et couverture

Date : 10 septembre 2026.  
Les métriques publient simultanément l'erreur des propositions acceptées et leur couverture. Une baisse d'erreur obtenue par davantage de refus ne doit jamais être présentée seule.

## D-007 - Représenter la décision opérateur explicitement

Date : 10 septembre 2026.  
Les exports de Mes corrections distinguent `operatorDecision: VALIDATE` de `operatorDecision: SKIP`. Un SKIP conserve la paire avant/finale et le LiDAR disponible, mais il est exclu de l'entraînement par `usableForTraining: false` et `trainingExclusionReason: operator-skip`. Aucun motif d'écartement n'est déduit du raccourci.

## D-008 - Relayer le SKIP natif sans le remplacer par une navigation

Date : 10 septembre 2026.  
Après sauvegarde acquittée, `Shift + Backspace` est relayé une fois au gestionnaire clavier ESV. Le chemin manuel SKIP n'appelle pas `O2N3DCutNextInvalid3DRail`. Banane observe ensuite le changement d'identité du cut. Sans navigation dans le délai, la session passe en erreur avec résultat incertain et ne réémet pas la commande.

## D-009 - Ne pas automatiser la règle d'écartement en 4.2

Date : 10 septembre 2026.  
Le seuil inférieur est fixé à 1 410 mm : en dessous, SKIP ; de 1 410 à moins de 1 430 mm, validation avec tolérance. La valeur ESV n'étant pas encore observable de manière fiable, la 4.2 enregistre uniquement la décision humaine. Le pilote automatique et son interface ne reçoivent aucune logique SKIP liée à l'écartement.

**Révisé en 4.7 — voir D-027.** La borne basse passe à 1 405 mm et l'issue « SKIP » disparaît : le mot « définitivement » de la rédaction d'origine ne tient plus.

## D-027 - Contrat d'écartement 1 405 / 1 430 / 1 470, sans SKIP automatique

Date : 21 septembre 2026.  
Contrat opérateur en vigueur : sous 1 405 mm `LOW_INVALID`, de 1 405 à moins de 1 430 mm `TOLERANCE` (admissible), de 1 430 à 1 470 mm inclus `NOMINAL` (admissible), au-delà `HIGH_INVALID`. Les trois bornes n'existent qu'à un endroit, `src/gauge.js`.

Deux changements par rapport à D-009. La borne basse passe de 1 410 à **1 405 mm**. Et un hors-contrat n'est **jamais** un SKIP : c'est une **abstention**. Le module d'écartement ne rend plus aucune issue décisionnelle, et aucune voie automatique ne peut dériver un SKIP d'une mesure — le SKIP reste une décision de l'opérateur seul. Ce que D-009 refusait d'automatiser était la *décision* ; ce que 4.7 automatise est le *refus d'agir*, qui n'est pas la même chose.

Contrairement à D-009, la règle est désormais **appliquée** au runtime, sur l'écartement **prévu** après application des deltas — jamais sur l'état avant, qui est précisément ce que Banane corrige. Deux étages : la composition GCV1 rend les deux rails abstenus, et `Engine.apply()` refuse de commander. Ce dernier étage est global à tous les modes, parce que le contrat est une contrainte physique de la voie et non une règle propre à GCV1.

## D-010 - Différer le correctif de couverture du pilote automatique

Date : 10 septembre 2026.  
Mic rapporte que le pilote 4.1 s'interrompt beaucoup plus souvent que le 4.0 lorsqu'un des deux rails ne reçoit aucune proposition. Aucun seuil géométrique ni comportement du pilote n'est modifié avant l'analyse des corrections récentes par Terra. Ce retour est conservé comme régression d'usage à mesurer, pas comme preuve suffisante pour desserrer immédiatement les garde-fous.

## D-011 - Quatre preuves indépendantes après commande

Date : 10 septembre 2026.  
`commandSent`, `afterObserved`, `serverConfirmed` et `navigationObserved` ne sont jamais déduits les uns des autres. Une navigation ne confirme ni l'état final ni l'enregistrement serveur. Une cible changée avant relecture met le lot en pause avec une anomalie explicite.

## D-012 - Pause par défaut sur proposition incomplète

Date : 10 septembre 2026.  
Un rail non résolu conserve l'identité, l'avant, le LiDAR, la proposition partielle, les motifs et confiances. Le pilote se met en pause sur le même cut et n'envoie aucune validation partielle. Le SKIP n'est possible que par action explicite de l'opérateur.

## D-013 - Les validations sans mouvement sont positives

Date : 10 septembre 2026.  
Une décision `VALIDATE` avec deux positions inchangées devient `VALIDATE_NO_MOVEMENT`. Les quatre catégories humaines sont mutuellement exclusives et les deux rails avant/après restent exportés.

## D-014 - Banc hors ligne sans apprentissage

Date : 10 septembre 2026.  
Le banc appelle la géométrie pure sur les nuages et états initiaux, puis compare au résultat humain. Il n'accède pas à ESV, n'envoie aucune commande et ne modifie ni modèle ni seuil. Le build du moteur et ses paramètres sont empreintés dans chaque résultat.

## D-015 - Ne pas intégrer le voisinage au moteur principal

Date : 10 septembre 2026.  
L'ordre réel, les voisins verts, la geominfo et le contexte de voie manquent. `previousCutId`, `nextCutId`, `sequenceIndex` et la structure geominfo sont préparés, mais la continuité ne peut devenir qu'un futur signal secondaire de baisse de confiance ou de pause.

## D-016 - Isoler un Mode Natif strictement passif

Date : 11 septembre 2026.  
Le Mode Natif possède sa propre page, sa machine de session et sa provenance. Son adaptateur n'expose à l'observateur que des lectures et la sauvegarde. Les chemins `apply`, sélection gauche/droite, `next`, `VALIDATE` et `SKIP` ne lui sont pas fournis. Les autres modes sont bloqués tant que sa session est ouverte.

## D-017 - Observer l'entrée dès le chargement sans la capturer

Date : 11 septembre 2026.  
Le script `document_start` relève les événements fiables et les décrit dans un message interne. Il n'appelle jamais `preventDefault`, `stopPropagation` ou `stopImmediatePropagation` pour Natif et ne fabrique aucun événement clavier ou souris. Cette position précoce permet de conserver l'intention même si un gestionnaire ESV ultérieur interrompt sa propre propagation.

## D-018 - Séparer visites et périodes d'observation

Date : 11 septembre 2026.  
Une nouvelle identité affichée ferme la visite active et en ouvre une autre. Un retour sur le même cut crée également un nouveau `visitId`. Pause ferme la période ; Reprendre crée un nouvel `observationPeriodId`. `visitIndex` décrit seulement l'ordre d'observation et ne renseigne jamais `sequenceIndex`, `previousCutId` ou `nextCutId` ESV sans preuve dédiée.

## D-019 - Borner et dégrader la collecte

Date : 11 septembre 2026.  
La file réelle est limitée à 128 événements. La lecture de la vue courante cède la main tous les 512 points et se limite à 512 nœuds, 60 000 points conservés, 1 200 000 inspectés et 300 ms. Une surcharge réduit d'abord la collecte puis passe en métadonnées seules ; les compteurs et motifs sont exportés. Une panne durable produit un signal visible unique.

## D-020 - Ne pas mélanger une observation Natif avec un label explicite

Date : 11 septembre 2026.  
`native-passive-observation` reste séparé de `explicit-manual-session`. Un geste clavier est une intention observée, pas une confirmation serveur. Même lorsqu'une visite respecte les critères de cohérence et reçoit `usableAsNativeReference:true`, elle conserve `usableForTraining:false` jusqu'à une revue et une promotion explicites hors session ESV.

## D-021 - Geler le placement et le pilote en V4.4

Date : 11 septembre 2026.  
Le chantier V4.4 porte uniquement sur la collecte native. `src/geometry.js`, `vendor/capture-core.js` et `src/engine.js` sont inchangés octet pour octet par rapport à la V4.3. Les résultats du banc hors ligne V4.3 restent donc la référence du moteur.

## D-022 - Corriger la perte de points sans toucher au moteur

Date : 13 septembre 2026.  
L'audit des trois exports V4.4 a démontré que la lecture séquentielle des nœuds Potree épuisait presque toujours ses 300 ms avant la zone utile, malgré des sondes dans la ROI. Le lecteur historique `vendor/lidar.js` reste inchangé. Un lecteur réservé au Natif classe les nœuds déjà chargés par sondes et distance, puis lit par portions avec des limites explicites. Aucun clic de sélection, déplacement de caméra, commande native ni navigation ne lui est accessible.

## D-023 - Sauvegarder des observations par rail sans associer des cibles différentes

Date : 13 septembre 2026.  
La gauche et la droite possèdent leurs propres portions LiDAR durables, matrices, poses, identité, vue et horodatage. Un rail qualifié est analysable seul. Une paire peut unir des observations non simultanées si leur identité, repère et poses initiales sont compatibles. Tout changement pendant lecture est rapporté ; aucun état du nouveau cut n'est incorporé à l'ancien.

## D-024 - Séparer candidature géométrique et promotion d'entraînement

Date : 13 septembre 2026.  
Un nuage non vide ne suffit pas : couverture utile, transformation numérique, pose initiale, chunks sauvegardés, intention unique et référence humaine compatible sont vérifiés. `VALIDATE_NO_MOVEMENT` reste distinct de SKIP et du simple passage ; plusieurs intentions restent ambiguës. `usableForOfflineEvaluationByRail` et `usableAsNativeReference` désignent uniquement des candidats ; `usableForTraining:false` reste invariable.

## D-025 - Chronologie et récupération sans fiction

Date : 13 septembre 2026.  
`eventSeq` est monotone par session et distinct de la séquence spatiale ESV. Une période interrompue récupérée indique une fin d'heure inconnue et n'invente pas de dernier état. Les événements et portions sont sauvegardés avant l'export final ; les pertes et plafonds sont tracés.

## D-026 - Rejeu hors ligne à frontière anti-fuite

Date : 13 septembre 2026.  
Le banc Natif reconstruit l'entrée du moteur depuis les portions géométriques et l'état initial, génère les propositions puis seulement compare à la position humaine finale. Les anciens exports V4.4 restent des preuves de panne, pas un nouveau jeu comparable. Aucune amélioration de précision n'est annoncée sans essai ESV 4.4.1 et comparaison sur les mêmes cuts.
