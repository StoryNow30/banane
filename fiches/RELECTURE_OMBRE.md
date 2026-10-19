# Relecture après le lot : ombre et correction prudente (5.0, D-170 à D-180)

Branche `claude/50-relecture-ombre`, à jour de `claude/50-base` (d8a7bcd). Demande de Mic : qu'Ariane fasse **elle-même** la relecture qu'il fait en Écho après un lot Orbite (D-170). Accord de Mic pour visiter les verts (D-171). Règle SKIP de Mic (D-172). Condition de la test 7 : des règles métier qui **agissent** (D-173). Seule la correction des verts de PN était proposée (D-174). Revue adverse et ses 11 corrections (D-175). Avis de Mic sur le rythme et le départ (D-176). Maj+Espace valide sur place (D-179). **Mic accepte les chiffres de l'ADV et des abords : ils corrigent comme le PN (D-180).**

**Réglage coupé par défaut.** Mic choisit dans le panneau : « coupée », « ombre » ou « corriger ». Le choix est lu au démarrage du lot et figé pour ce lot.

`src/engine.js` n'est pas touché. `DECISIONS.md` non plus.

## 1. En bref

| | Résultat |
|---|---|
| **Coupée** (défaut) | Rien ne change : le scope du lot ne porte aucun champ nouveau, les commandes envoyées à la page sont celles de la base **octet pour octet** (empreinte de la base, version neutralisée, et empreinte du test 6). Aucune passe. |
| **Ombre** | Après le lot, Ariane visite les cuts que Mic relirait, verts compris, capture, calcule et note. **Ariane n'envoie ni pose, ni validation, ni SKIP, ni écriture.** Mais **ESV écrit lui-même « vu »** (`SeenByOperator`) sur chaque cut affiché pour la première fois, comme quand Mic le visite : la passe annonce au départ le nombre de cuts neufs, puis compte ces « vu » (journal et panneau). Banc : 37 cuts relus, 0 écriture d'Ariane ; 36 cuts neufs annoncés, 36 « vu » reçus par le serveur, 36 comptés par Ariane. |
| **Corriger** | Seuls les **verts prouvés** du PN, de l'ADV, des abords et des écartements hors norme (D-185) (D-180) (statut `valid` sans drapeau opérateur, lu dans la liste d'ESV ; cible permise par le moteur) qui passent la **règle prudente** sont corrigés. Pose : la commande `apply` du lot, clic « tout-recentre », relue à 1 mm. Validation : **Maj+Espace**, le geste de Mic, qui valide **sur place** : ESV reste sur le même cut (Mic, deux fois ; D-179). Preuve : l'écriture « valid » de la ligne **et** le même cut toujours affiché ; puis la passe avance **d'un pas** vers le cut suivant. Banc (maquette qui valide sur place) : 20 corrections, 20 écritures « valid » exactement sur ces cuts, 20 Maj+Espace, chaque cut suivant atteint par un pas. Maquette d'origine (Maj+Espace y charge le cut non validé suivant) : la passe s'arrête net après la première correction, ESV n'étant plus sur le cut corrigé. |
| **Seuils** | Ceux du fichier chiffré par l'étude (`datasets/relecture-reglages-proposes.json`, `fiches/RELECTURE_AUTONOME.md`), appliqués tels quels : **PN, ADV et abords corrigent** (8 mm et plus ; D-180) ; les **verts hors zone** restent en ombre, de même que tout cut posé ou différé par le lot et le SKIP ; 45 mm au plus en travers ; écartement à 15 mm de la médiane ; variante « chaine+h ». **Un interrupteur par zone** (`zones.<zone>.corriger`) : `false` repasse la zone en ombre sans toucher au code. **Fichier absent, d'un autre format, ou avec un champ de sécurité invalide : « corriger » reste en ombre**, pour toutes les zones, et la carte le dit. |
| **Une seule passe** | Elle existe dès sa planification, avant toute attente ; « Lancer », « Démarrer » et le retour à un cut sont refusés pendant sa préparation et pendant la passe. |
| **Départ et rythme** (D-176) | Départ automatique juste après le lot, sans compte à rebours. Aucune pause ajoutée. Seul le bouton « Arrêter la relecture » reste. |
| **SKIP (D-172)** | Consigné seulement (`skipOmbre`). « Aucun point » quand **deux captures complètes de suite** sont vides. Jamais « un seul scanner ». Aucun SKIP n'est envoyé. |
| **Temps** (banc, machine chargée) | **3,1 s par cut relu** en ombre (capture 2,6 s, calcul 0,4 s, navigation 0,09 s), sans plancher d'affichage ; 4,1 s par cut en corriger (20 corrections sur 37). Mic, lui, passe un vert en **0,63 s** (médiane) : la capture fait que la passe est environ 5 fois plus lente que lui sur un vert. |
| **Lectures de nuage** | Maquette : 1,0 par vert relu (elle charge les nœuds d'un cut une fois, à son premier affichage, et ne recharge rien quand la vue bouge). Terrain, d'après les Échos et le lot de la partie 29 : Mic 0,67 à 1,11 par vert passé ; un cut capturé sans pose par le lot, 6,1 (médiane 5). L'écart attendu par vert relu est donc de ×2 à ×9 : à faire trancher par Mic (D-151, § 8). |
| **Fidélité à l'étude** (§ 11) | Rejeu des cas de l'étude (chaîne vide) : décision de l'étude rendue sur 1 323 cuts sur 1 323 ; **PN 36 justes sur 36 actions, 0 erreur, 0 abîmé**, plafond compris ; sans plafond, **ADV 16 actions, 10 justes, 3 erreurs, 1 abîmé ; abords 36, 29, 3, 0**, comme l'étude. Avec les plafonds par zone livrés (ADV 40, abords 70) : ADV 4, 2, 1, 0 ; abords 12, 12, 0, 0. Mauvaise voie : 0 partout. **Mic accepte les chiffres ; 9 % non démontré en ADV et abords** (D-180). |

## 2. La passe, pas à pas

1. **Démarrage du lot.** Le service worker lit le choix gardé (`storage.local`) et le fige dans le scope du lot (`scope.relecture`, consigné par `batch-started` et l'export). Coupée : le champ n'existe pas. Ce champ ne part jamais vers la page (revue, R7).
2. **Fin du lot.** À la fin naturelle du lot (boucle finie, ou arrêt au dernier cut), la passe est créée tout de suite, à l'état « préparation », puis part (D-176 : pas de compte à rebours). Pendant sa préparation, elle lit le fichier de réglages, le journal du lot et la liste d'ESV ; ESV et le lot sont contrôlés **avant et après** ces attentes. Elle ne part que si ESV est propre :
   - aucune intention, réconciliation ni navigation incertaine à clore, aucune action en cours, ni Écho, ni reprise, ni retour à un cut ;
   - aucune correction de relecture interrompue que Mic n'a pas encore contrôlée ;
   - ESV affiche la partie du lot ;
   - aucune pose d'Ariane non validée sur le cut affiché (lot borné : Mic valide le dernier cut, ESV passe à un autre cut, puis « Lancer la relecture ») ;
   - pas une partie sans rouge, ni un lot clos au départ sur un cut vert (revue, R3).

   Sinon, la passe est « non lancée », avec la raison (panneau et `relecture-fin`). Le mode effectif est le plus prudent du mode figé et du choix courant (W10) ; « corriger » est ramené à « ombre » si les réglages ne sont pas sûrs, si l'observateur passif est coupé, ou si le geste de validation est verrouillé (réglage `relecture.validation`).
3. **Sélection** (§ 3), puis, pour chaque cut, dans l'ordre :
   - **aller au cut** : dans une plage, les boutons « cut suivant » d'ESV (`goToCut`, chemin pas à pas) ; entre deux plages, la carte (événement interne), sinon pas à pas. Les cuts du lot sont traversés. **En « corriger », un vert corrigeable n'est jamais atteint par un saut** : la passe saute au cut d'avant (au cut d'après pour le cut 0), puis fait un pas vers lui (revue, correction 3) ;
   - **statut du cut dans la liste d'ESV** (mémoire de la page, aucune requête) : statut, drapeau opérateur, « vu » ;
   - **capture** : la même commande que le lot (`capture`, boutons de rail, lecture des points) ;
   - **calcul**, variante « chaine+h » : moteur (science GCV1), décision du lot avec pour appuis la **chaîne de la passe**, puis la hauteur apprise que la décision consigne. **La chaîne part vide, comme l'étude** ; seules les poses calculées pour des **verts** y entrent, jamais celle d'un cut différé par le lot (revue, correction 8). On obtient la pose calculée, l'écart par rail (latéral et vertical), le pire écart, la confiance, le verdict, la commande que le lot écrirait et son écart, l'écartement de la pose et la médiane de la partie, puis la règle prudente ;
   - **SKIP en ombre** : une capture vide est relue une fois ; deux captures vides de suite font `aucun-point` ;
   - **mode « corriger »**, si la règle passe ET la garde (§ 4) : relecture de l'état, rails inchangés depuis la capture, écartement dans le contrat ; `apply` (la commande du lot, clic « tout-recentre ») relu à 1 mm ; relecture de l'état comme le moteur avant de valider ; **Maj+Espace** (ESV valide sur place, sans changer de cut) ; attente de l'écriture « valid » de la ligne (6 s au plus) ; contrôle que ESV affiche toujours ce même cut (libellé « Cut N of part P », aucune commande). La passe fait ensuite **un pas** (le bouton « cut suivant », le geste de navigation qu'elle emploie déjà) vers le cut suivant à relire, comme Mic ;
   - **événement `relecture-ombre`** : identité, plage, zone et son origine, rôle, statut lu dans ESV, arrivée (`pas`, `maj-espace`, `evenement`) et chemins, pose d'ESV, pose calculée, écarts, confiance, étage, appuis, entrée dans la chaîne, hauteur apprise, verdict, raison, `skipOmbre`, écart écrit, écartement et médiane, règle, garde, action (`visite`, `corrige`, `correction-refusee`, `correction-incertaine`, `navigation-refusee`), durées.
4. **Fin** : la passe attend 2,5 s les « vu » des derniers cuts affichés (ESV les écrit 0,9 à 1,7 s après l'arrivée), puis `relecture-fin` (issue, comptes, « vu », cuts neufs, durée). Le panneau dit par exemple « Relecture finie : 18 cuts relus, rien de modifié ; ESV a marqué 17 cuts « vu » ».

**Pendant la préparation et pendant la passe**, le panneau refuse tout ce qui agirait dans ESV ou sur le lot : seconde passe, nouveau lot, reprise, retour à un cut, Écho, réglages, vidage. « Arrêter » (celui du lot) arrête la relecture (W11). La carte affiche « Relecture 12 sur 85, 3 corrigés · « vu » : 9 sur 60 cuts neufs · cut 456 · grappe 453–471 » et le bouton « Arrêter la relecture ».

## 3. Sélection : la méthode de Mic (`src/relecture-ombre.js`, `selection`)

La sélection est **alignée sur celle de l'étude** (`tools/relecture-autonome.cjs`, `selection` ; bloc `selection` du fichier proposé) : même ensemble de cuts, même type de zone pour chaque cut.

| Motif | Cuts relus | Zone de la règle |
|---|---|---|
| PN reconnu (règles métier en ombre) | sa plage à contrôler : 4 cuts avant, 6 après, chaque cut | `pn` |
| ADV reconnue (`fiches/DETECTION_ADV.md`) | sa plage : 30 cuts de chaque côté | `adv` |
| grappe (3 cuts du lot ou plus, trous de 5 au plus) | toute la plage, 3 cuts de marge | `abords` |
| cut du lot hors grappe (isolé, paire) | chaque cut, avec 1 cut de part et d'autre | `abords` |
| différé (ou dernier cut resté rouge) | 2 cuts de chaque côté, et le différé lui-même | `abords` |
| liste « À contrôler » (`src/verts-a-controler.js`) | ses verts | `vert-hors-zone` |
| en plus de l'étude (H5 de l'audit P-5) : vert de la liste d'ESV à plus de 15 mm de la médiane d'écartement, hors de toute plage | le vert | `ecartement`, **ombre seulement** |

- **Cuts du lot (revue, correction 1).** Sont des cuts du lot, traversés et jamais corrigés : les cuts posés et validés, les SKIP, les cuts repris à la main, toutes les identités interrompues, le dernier cut d'un lot clos (pose appliquée ou non ; s'il reste rouge, il est relu comme un différé), la pose en attente et les cibles bloquées. `relecture-debut` dit d'où vient chaque cut du lot (`sourcesLot`).
- **Zones figées, tirées du lot.** Les zones PN et ADV viennent des seules captures du lot (événements `regles-metier-ombre` de ce lot), lues avant la passe et figées. La passe n'évalue aucune règle métier sur ses propres captures (audit P-5). Chaque visite dit l'origine de sa zone (`zoneSource`).
- **Type de zone de chaque cut**, comme l'étude : le premier qui le couvre, dans l'ordre PN, ADV, abords, liste, écartement.
- **Plages par type de zone.** Les cuts couverts sont groupés en plages de cuts consécutifs **du même type de zone** : un PN dans une ADV est sa propre plage. Aucun cut n'est ajouté pour boucher un trou.
- Bornes : de 0 à M − 1. **Cuts 0 à 3 inclus** (D-172). Ordre : par plages, dans l'ordre des cuts.
- **Plafond (revue, correction 7 ; D-180).** L'étude relit toute la sélection. La passe a un budget de temps, mais **les PN sont hors du budget et toujours gardés entiers** : un PN à moitié contrôlé laisse des erreurs de 30 à 40 mm. Depuis D-180 le budget est **par zone** (`plafondParZone`) : un budget unique de 120 cuts laissait l'ADV manger presque tout et les abords presque rien (sur les parties d'apprentissage : ADV 329 verts jugeables ramenés à 103, abords 223 ramenés à 35), alors que les deux agissent maintenant. Par défaut : **ADV 40, abords 70, verts hors zone 20, écartement 20** (cuts relus), choisis au § 11. Dans chaque zone : plages entières par priorité (grappe, différé, isolé pour les abords), puis ordre des cuts ; la première plage trop grande est coupée à son début ; ce qui ne tient pas est rendu dans `horsPlafond`, d'un seul tenant par plage. `BananeSettings.relecture.plafondParZone` les change (`null` : sans plafond) ; `plafondCuts` reste un budget global facultatif, hors PN, sans valeur par défaut.

## 4. Règle prudente et garde de la correction

### 4.1 Règle prudente (`src/relecture-critere.js`)

Fonction pure, conditions de l'étude (`agit` dans `tools/relecture-autonome.cjs`). « Oui » seulement si **toutes** tiennent ; sinon la première qui manque.

1. Le cut a une pose calculée.
2. Il n'est pas à SKIP en ombre.
3. Son rôle est permis (les **verts**) et n'est pas dans `jamais` (cut différé, cut posé par le lot).
4. L'étage est permis (les quatre étapes qui posent) ; aucun minimum d'appuis (la chaîne tient lieu de voie, comme dans l'étude).
5. La zone permet la correction.
6. Le pire écart (latéral ou vertical, des deux rails) atteint le seuil de la zone.
7. La confiance du moteur (A*) est présente sur les deux rails.
8. **Jamais de changement de voie** : 45 mm au plus en travers pour chaque rail.
9. **Rails cohérents**, et écartement de la pose à 15 mm au plus de la médiane de la partie (sans médiane : refus).

Les conditions 6, 8 et 9 sont jugées sur la pose **qui serait écrite**, en **valeurs brutes** (revue, F4 : 7,95 mm ne passe pas 8 mm ; l'arrondi au dixième ne sert qu'à l'affichage).

**Médiane de la partie** : la référence de la liste « À contrôler » ; sinon la médiane des lignes valides de la table de la liste tenue par la page (20 au moins, aucune requête) ; sinon celle des poses d'ESV des verts déjà relus (5 au moins). Avant, la règle refuse.

**Réglages sûrs (revue, correction 5).** Le fichier proposé est lu au début de chaque passe. Chaque champ de sécurité invalide ou absent (zone, `corriger`, `seuilMm`, `voie.lateralMaxMm` au-delà de 45 mm, `roles` autres que les verts, `jamais` sans les cuts du lot) est listé ; une correction mal écrite (« "corriger":"false" ») reste fermée. « Corriger » n'est permis qu'avec le fichier proposé, lu sans refus ni champ invalide ; sinon la passe reste en ombre et le dit. Le défaut provisoire (`datasets/relecture-reglages-defaut.json`, recopié dans le module) suit D-180 : PN, ADV et abords corrigent, 45 mm au plus ; il ne sert qu'au calcul consigné, jamais à une écriture (la source doit être le fichier proposé). Une zone absente ou mal écrite du fichier est fermée, jamais ouverte par le défaut ; un interrupteur fermé (`corriger:false`) est un choix valide, qui n'invalide pas le fichier. La carte affiche la source des réglages et les zones qui corrigent. Les deux fichiers sont dans la liste des fichiers requis du paquet (`tools/package.py`).

| Zone | Corriger | Seuil | Étude, validation croisée (6 parties) |
|---|---|--:|---|
| PN | **oui** | 8 mm | 36 corrections justes sur 36 actions, 0 erreur, 0 abîmé |
| ADV | **oui** (D-180) | 8 mm | 11 justes sur 17, 18 % d'erreurs, 1 cut abîmé |
| abords | **oui** (D-180) | 8 mm | 30 justes sur 37, 14 % d'erreurs, 0 abîmé |
| vert hors zone | non (ombre) | 8 mm | 2 actions |

**Mic accepte les chiffres, 9 % non démontré en ADV et abords (D-180).** Le seuil de 9 % d'erreurs demande 39 actions sans erreur ; l'ADV et les abords n'en ont que quelques dizaines de jugées, avec 14 à 18 % d'erreurs. Ce n'est pas une porte franchie : c'est un choix de Mic, pour avancer et mesurer sur le terrain. Le défaut du réglage reste « coupée » : l'activation est le geste de Mic dans le panneau. La mesure : l'ombre continue de calculer et de noter toutes les zones ; les Échos qui suivent un lot en « corriger » montrent si Mic a dû reprendre des cuts corrigés par Ariane, zone par zone.

### 4.2 Garde (background.js, `relectureGarde`)

Même quand la règle dit « oui », la passe ne pose que si :

- le rôle est « vert » **et prouvé** : statut `valid` **sans drapeau opérateur** lu dans la liste d'ESV pour ce cut (revue, correction 1). Un SKIP, un cut que Mic vient de corriger, un rouge au-delà de la borne du lot, un cut que la passe a déjà corrigé : refusés. Sans statut lisible, rien. Le statut est lu à l'arrivée **et relu juste avant la pose** : si Mic valide ou SKIP le cut pendant la capture, la passe ne pose ni ne valide rien (contre-revue). La table de la liste n'est crue que si sa première page a été vue et qu'elle n'est ni rompue ni tronquée (sinon les lignes seraient décalées). Un vert hors zone n'est jamais corrigé, quel que soit le fichier de réglages (D-180) ;
- le moteur permet d'écrire sur la cible (`engine.writable`) ;
- le cut a été atteint par les boutons d'ESV (un pas) ; jamais juste après un saut par la carte (correction 3). Le cut qui suit une correction est atteint par un pas, comme les autres ;
- le nombre de cuts de la partie est connu, et le cut n'est pas le dernier (Maj+Espace chargerait la partie suivante, KI-069).

### 4.3 Ce qui est repris de la pose du lot (revue, W7)

La commande `apply` et sa relecture à 1 mm sont celles du lot ; le clic est « tout-recentre », jamais un clic direct (T-5). Les rails sont ceux de la règle prudente : la décision (une première passe est convertie comme une reprise depuis la voie) plus la hauteur apprise, que le lot, lui, n'applique pas. La validation n'est pas celle du lot (bouton « valider et suivant ») mais celle de Mic (Maj+Espace).

**Une correction refusée par la page** est remise (`restore`, relue à 1 mm), le cut est quitté (« correction-refusee ») et la passe continue. Si la remise échoue, la passe s'arrête et dit le cut.

**Une validation non prouvée** (erreur après l'envoi, aucune écriture vue en 6 s, écriture refusée) arrête la passe et dit le cut. ESV qui affiche un autre cut après Maj+Espace arrête aussi la passe, après la validation prouvée, sans rien réécrire ; il en va de même d'une ligne écrite avec un autre statut que « valid » (aucune preuve : la passe s'arrête sur ce cut). L'intention de correction est gardée **par cut** dans `storage.local`, de la pose jusqu'à la preuve ; seule celle du cut prouvé est effacée (W5). Tant qu'il en reste une, la carte demande « J'ai contrôlé le cut N », et la relecture, « Démarrer » et le retour à un cut sont refusés. Un redémarrage du service worker pendant une passe la clôt au réveil (`relecture-fin` « interrompue », R4).

## 5. SKIP, règle de Mic (D-172)

- `skipOmbre:{raison, points, captures, capturesVides}` dans chaque événement, **jamais envoyé** (aucune commande SKIP n'existe dans la passe).
- `aucun-point` : seulement quand deux captures complètes de suite n'ont aucun point près des deux rails. L'étude a retrouvé ainsi 1 SKIP de Mic sur 4 aux cuts 0 à 3, avec 3 fausses alertes sur des visites brèves : une seule capture vide ne suffit pas.
- Une capture qui échoue est notée en erreur, sans raison de SKIP.
- **Jamais `un-seul-scanner`** : tous les scanners arrivent dans un seul nuage d'ESV.

## 6. Sécurité : les essais

Chaque correction de la revue a son essai, écrit d'abord : rouge sur le code d'avant (a50e214), vert après. Un fichier par essai (`tools/verify.cjs` donne 20 s à chaque fichier ; un lot réel en prend 3 à 6).

| Exigence | Essai |
|---|---|
| Coupée : commandes identiques à la base | `relecture-sw-coupee-rien`, `-coupee-gardee` (empreinte `tests/fixtures/relecture-lot-50-base.json`, version neutralisée, R9), `-coupee-trafique` |
| Ombre : rien d'Ariane, « vu » d'ESV compté, chaîne vide, départ immédiat | `relecture-sw-ombre` : après le lot, seulement lectures et navigations ; 6 cuts neufs annoncés, 6 « vu » comptés ; aucun appui tiré des poses du lot ; le différé (étage `first-pass`) n'entre pas dans la chaîne ; départ dans les 3 s ; lot sans marque de la relecture (R7) |
| Corriger : verts prouvés, pose du lot, Maj+Espace prouvé | `relecture-sw-corriger` : 3 corrigés sur 7, `state`, `apply` (« tout-recentre »), `state`, `validerMajEspace` ; ESV reste sur le cut, puis un pas vers le suivant ; premier cut de plage atteint par un pas ; aucune pose après un saut ; aucune marque |
| Rôle « vert » jamais présumé (correction 1) | `-role-lot` : SKIP, reprise à la main, cible bloquée traversés ; cible bloquée en cours de passe refusée par la garde ; `-role-borne` : dernier cut d'un lot borné (corrigé et validé par Mic, en PN) jamais réécrit ; rouge au-delà de la borne relu sans pose |
| Une seule passe (correction 2) | `-une-passe` : clic pendant le délai et pendant la préparation, « Démarrer » pendant la préparation refusés ; deux « Lancer » simultanés : un seul part |
| Maj+Espace (correction 4) | `-maj-espace` : ESV sur un autre cut après la validation → arrêt après la validation ; dernier cut de la partie jamais validé ; cut déjà corrigé jamais réécrit ; `-maj-espace-ligne` : ligne écrite avec un autre statut que « valid » → arrêt, ni pas ni pose ensuite ; `relecture-maj-espace-page` : touches exactes, une seule frappe, validation sur place rendue sans attendre 15 s, refus avant envoi sans émission (correction 6) |
| Réglages sûrs (correction 5) | `-reglages-surs` (absent, format -2) et `-reglages-coquille` : → ombre, dit ; contrôle : le fichier valide corrige ; `relecture-critere` (défaut D-180, champs invalides, valeurs brutes, interrupteur par zone) ; `-reglages-adv-abords` (D-180) : fichier absent (le défaut ouvre pourtant ADV et abords), autre format, correction en texte ou en nombre, zone absente, seuil en texte, latéral au-delà de 45 mm, rôles autres que les verts, cuts du lot non protégés → ni le vert d'abords ni le vert d'ADV ne sont touchés ; le fichier valide corrige les deux |
| Arrêt, panne, intention | `-arret` (« Arrêter » du lot ; annulation neutre, T-6), `-panne`, `-corriger-validation` (intention par cut, « J'ai contrôlé le cut N »), `-redemarrage` |
| La passe ne part que si ESV est propre | `-hors-partie`, `-pose-en-attente` |
| Observateur coupé | `-sans-observateur` |
| Zones figées (audit P-5) | `-zones-figees` |
| Fichier proposé réel | `-fichier-reel` : deux verts de PN et un vert d'abords corrigés (le premier du PN atteint par un pas), un sous 8 mm laissé, le différé jamais touché |
| ADV et abords agissent (D-180) | `-adv-abords` : un vert d'abords et un vert d'ADV (premier cut de sa plage : saut au cut d'avant, puis un pas) corrigés ; un vert traité par un opérateur, un cut rouge dans ESV, le différé et les cuts posés par le lot jamais touchés ; en ombre, même fichier : rien d'écrit par Ariane |
| Un interrupteur par zone (D-180) | `-interrupteur` : ADV fermée puis abords fermés dans le fichier, le fichier reste valide, l'autre zone corrige |
| Plafond par zone (D-180) | `relecture-ombre` : l'ADV ne mange plus le budget des abords, PN jamais coupé, plages entières par priorité dans la zone, restes d'une même plage d'un seul tenant |
| Modules purs | `relecture-ombre` (sélection, plafond par zone, jugement, SKIP), `relecture-critere`, `relecture-panneau` (préparation, réglages, « vu », « J'ai contrôlé ») |

L'ESV simulé des essais tient la liste de la partie (statut, opérateur, « vu »), imite le « vu » d'ESV au premier affichage et valide par Maj+Espace comme le vrai ESV sur un vert (écriture, ESV reste sur le même cut ; l'ancienne supposition « cut + 1 », ou un autre cut, n'existe que là où un essai la demande). Hors du lot, la science et la décision des verts sont remplacées pour l'essai ; le cut 113 est calculé pour de vrai. Le simulateur échoue sur toute option inattendue de la validation.

**`src/adapter-page.js`** : nouvelle action `validerMajEspace` (Maj enfoncée, Espace enfoncée puis relâchée, Maj relâchée, sur le canevas d'ESV ; une seule frappe ; rend le cut atteint, ou « inchangé » après 1,5 s : le cas d'un vert, où ESV valide sur place). `validateInPlace` est revenu au texte de la base. Le lot n'émet toujours ni D ni Maj+Espace (`tests/u3-raccourcis.test.cjs`).

## 7. Banc : extension réelle, maquette ESV

`tools/relecture-banc.cjs` charge l'extension du dépôt dans Chromium et route l'hôte d'ESV vers la maquette de `claude/esv-locale-audit`, extraite hors du dépôt. Tout passe par le vrai chemin : service worker, pont, observateur passif, adaptateur, page, serveur.

**Maquette réglée sur le terrain** (`tools/relecture-maquette.cjs`, qui règle la copie extraite de la maquette, hors du dépôt, au démarrage du banc). Trois options : `majEspace=surplace` (Maj+Espace sur un cut vert valide sur place, ESV reste sur le même cut, D-179 ; sur un cut rouge, le comportement d'origine ; `majEspace=plus1`, l'ancienne supposition « valide puis charge le cut + 1 », reste disponible), `vu=1` (« vu » écrit 1 s après le premier affichage d'un cut jamais vu), `rouges=A-B` (seuls les cuts A à B sont rouges, les autres sont des verts d'ESV jamais traités, comme autour d'un lot). La maquette d'origine prend Maj+Espace pour « valider et suivant non validé » (supposé), n'écrit pas de « vu », et ses cuts autour du lot sont surtout rouges.

| Partie de 40 cuts, lot de 8 à 11, latence 40 ms, machine chargée | Ombre (fichier réel), `rouges=8-11` | Corriger (seuils permissifs), `rouges=8-11` | Corriger, maquette d'origine |
|---|---|---|---|
| Passe | 37 relus, 0 corrigé, **113 s** | 37 relus, **20 corrigés**, 168 s | 1 relu, 1 corrigé, puis **arrêt** |
| Par cut, moyenne | **3,1 s** (capture 2,6 s, calcul 0,4 s, navigation 0,09 s) | 4,5 s (dont 2 s environ par correction : pose, relecture, Maj+Espace) | — |
| Écritures d'Ariane reçues par le serveur | **0** | **20** « valid », exactement les lignes des cuts corrigés | 1 « valid », celle du cut corrigé |
| Cuts neufs annoncés ; « vu » reçus par le serveur ; comptés par Ariane | 36 ; 36 ; 36 | 36 ; 35 ; 35 | — (pas de « vu » dans la maquette d'origine) |
| Maj+Espace vus par la page | 0 | 20, chacun suivi d'un pas vers le cut suivant | 1 |
| Lectures de nuage par vert relu | 1,0 | 1,0 | 2 (le cut 1, approché, et le cut 0) |
| Fin | « finie » | « finie » | « après Maj+Espace, ESV affiche le cut 11 de la partie 23, pas le cut 0 » |

Les seuils permissifs du banc ouvrent toutes les zones à 12 mm (fichier complet et valide, sinon la passe resterait en ombre). La maquette n'a pas de PN ; avec le fichier réel, ses verts (zone ADV) restent en ombre. Les corrections du banc prouvent le chemin (pose, Maj+Espace, écriture, même cut, pas suivant), pas la justesse : les écarts de 40 mm viennent de la fixture.

**Le geste est-il prouvé ?** Sur la maquette qui valide sur place, oui : la page reçoit Maj+Espace, le serveur reçoit l'écriture « valid » de la ligne, ESV reste sur le même cut, la passe fait un pas et continue. Ce que fait le vrai ESV (valider sur place, sans changer de cut, un vert) est confirmé **deux fois par Mic, pas par un export** (D-179) : aucun Écho ne l'a relevé. Ce qui reste supposé : que le vrai ESV réagisse à Maj+Espace relayé comme à celui de Mic (c'est le cas de Maj+Retour arrière, relayé de la même façon par Orbite). S'il ne le fait pas, aucune écriture n'est vue et la passe s'arrête en nommant le cut. Le réglage `relecture.validation` permet de verrouiller « corriger » en ombre.

## 8. Trace dans ESV

- **Commandes** : la passe n'emploie que des commandes qu'Ariane emploie déjà, plus le geste de validation de Mic :
  - `goToCut` du retour à un cut : boutons « cut précédent / suivant » et événement de la carte ;
  - `capture` du lot : boutons de rail ;
  - en correction, `apply` du lot (clic « tout-recentre »), `restore` si besoin, et Maj+Espace (une frappe, comme Mic).

  Aucun champ, aucun en-tête, aucune requête propre à Ariane : le mot « relecture » n'apparaît dans rien de ce qui part vers la page, lot compris ; l'annulation d'un passage porte la raison neutre d'un retour à un cut.
- **Écritures** : elles sont faites par ESV lui-même.
  - En **ombre**, aucune écriture n'est provoquée par Ariane, mais ESV écrit « vu » (`{SeenByOperator:true}`, 204) la première fois qu'un cut est affiché, 0,9 à 1,7 s après l'arrivée. Un vert visité devient violet sur la carte, comme quand Mic le visite. À la prochaine Écho, Mic ne distinguera plus les verts qu'il a vus lui-même de ceux qu'Ariane a affichés. La passe annonce les cuts neufs au départ et compte les « vu » (D-175 : à dire à Mic).
  - En **corriger**, chaque cut corrigé reçoit l'écriture de validation d'ESV, comme une validation de Mic par Maj+Espace.
- **Rythme** (D-176) : aucune pause ajoutée, départ juste après le lot. Mic passe un vert en 0,63 s (médiane ; p90 1,57 s) et fait une pause de plus de 10 s toutes les 21,5 visites ; ses intervalles entre deux arrivées sur un cut ont une médiane de 1,86 s et une moyenne de 3,6 s, toutes visites confondues, surtout des validations. La passe reste 3,1 s par cut relu (capture), sans pause : pour le serveur, des « vu » espacés de 3 s environ, réguliers.
- **Lectures de nuage** : chaque vert relu est une capture du lot (boutons des deux rails, vue recentrée). Sur le terrain, un cut capturé sans pose par le lot coûte 6,1 lectures (médiane 5), un vert passé par Mic 0,67 à 1,11. La maquette ne le montre pas (1,0, voir § 7). Si Mic juge l'écart hors de la plage humaine, une lecture passive de la vue chargée suffirait pour les verts que la règle ne peut pas corriger (à revoir avec l'étude).
- **Parcours** (revue, T-7) : par plages, cut par cut. Pour passer un vert, Mic quitte le cut surtout par la touche D ou par un clic dans le canevas, presque jamais par le bouton « cut suivant » ; il revient en arrière dans 8 à 22 % des verts. La passe, elle, clique « cut suivant » (le bouton se vérifie avant d'agir) et ne recule que pour approcher un vert corrigeable. Invisible du serveur.
- **À vérifier sur le vrai ESV** : Maj+Espace relayé (effet et corps de l'écriture), le saut par la carte et les boutons « cut suivant » (hypothèses du banc ESV local).

## 9. Panneau

La carte occupe l'emplacement réservé (d) « Relecture » (`#groupe-relecture`), entre les résultats du dernier lot et l'export replié. Script séparé (`src/carte-relecture.js`), chargé avant `panel.js`.

- Trois choix : « Coupée », « Ombre (Ariane visite et ne modifie rien ; ESV marque « vu » chaque cut neuf affiché) », « Corriger (verts sûrs du PN, de l’ADV, des abords et des écartements hors norme, validés par Maj+Espace) ». Une note dit que la passe part seule juste après le lot, qu'en « corriger » elle ne pose et ne valide que ces verts sûrs, et que Mic a accepté les chiffres de l'ADV et des abords.
- « Dernier lot » / « Prochain lot », comme les autres choix du lot.
- Réglages de la correction : leur source, les zones qui corrigent (PN, ADV, abords ; les autres restent en ombre), et si « corriger » restera en ombre, avec la raison.
- Pendant la préparation : « Relecture en préparation » ; « Lancer la relecture » est caché, « Arrêter la relecture » visible. Pendant la passe : avancement, corrections, « vu » sur les cuts neufs annoncés, cut et plage.
- Correction interrompue : le cut à contrôler, et le bouton « J'ai contrôlé le cut N ».
- **CONTENU.txt** : une ligne quand la relecture du lot n'est pas coupée (mode, bilan, « vu »).

## 10. Réglages

| Où | Quoi | Défaut |
|---|---|---|
| Panneau (`storage.local`, `banane50Relecture`) | coupée / ombre / corriger | coupée |
| `BananeSettings.relecture` (facultatif) | `departMs` (0, D-176), `attenteEcritureMs` (preuve, 6 000 ms), `attenteVuMs` (« vu » des derniers cuts, 2 500 ms), `pasMax` (40), `plafondParZone` (adv 40, abords 70, vert-hors-zone 20, ecartement 20 ; PN hors budget, D-180), `plafondCuts` (budget global facultatif hors PN, aucun par défaut), `validation` ('maj-espace' ; toute autre valeur verrouille « corriger » en ombre) | |
| `datasets/relecture-reglages-proposes.json` | seuils chiffrés par l'étude | présent ; absent ou non sûr : ombre |

## 11. Fidélité à l'étude, après la correction 8 et D-180 (plafonds par zone)

Rejeu hors ligne de la logique codée (`relectureCalculer` extraite de `background.js`, règle et sélection de la branche, fichier de réglages proposé réel : PN, ADV et abords corrigent) sur les cas de l'étude, parties d'apprentissage 1:12, 1:13, 1:24, 1:29 et 2:1 (1:17 n'existe plus qu'en archive). Outils de la revue (hors dépôt : `revrelo/fidelite`, `fid2`), adaptés : chaîne vide, seules les poses des verts y entrent ; sélection avec un plafond par zone, plusieurs plafonds rejoués (chacun avec sa propre chaîne). Décision de l'étude rendue sur **1 323 cuts sur 1 323**.

Colonnes : cuts relus avec une référence de Mic, actions, justes, erreurs de plus de 10 mm, cuts abîmés, mauvaise voie. La colonne « Étude » compte les 5 parties rejouables ; `RELECTURE_AUTONOME.md` § 5.4 compte 6 parties (1:17 comprise) : ADV 17 actions, 11 justes, 3 erreurs, 1 abîmé ; abords 37, 30, 5, 1.

**Sans plafond** (la règle seule, comme l'étude) :

| Zone | Étude (référence, cas) | Branche, sans plafond |
|---|---|---|
| PN | 36 actions, 36 justes, 0 erreur, 0 abîmé, 0 mauvaise voie | **167 relus : 36, 36, 0, 0, 0** |
| ADV | 16, 10, 3, 1, 0 | **329 relus : 16, 10, 3, 1, 0** |
| abords | 37, 30, 3, 0, 0 | **223 relus : 36, 29, 3, 0, 0** |
| verts hors zone | 2 actions | 7 relus : 0 (ombre) |

**Plafonds par zone** (cuts relus au plus ; PN hors budget). La colonne « 3 parties avec lot » ne compte que 1:24, 1:29 et 2:1, les seules où la passe tournerait : les zones PN et ADV y viennent d'un lot.

| Plafond ADV / abords | ADV : relus, actions, justes, erreurs, abîmés | abords : relus, actions, justes, erreurs, abîmés | dont 3 parties avec lot : ADV ; abords | Cuts relus par partie 1:24 / 1:29 / 2:1 (3,5 s le cut) |
|---|---|---|---|---|
| 30 / 20 | 19, 0, 0, 0, 0 | 14, 8, 8, 0, 0 | 0 ; 8 sur 8 | 76 / 99 / 47 (4 / 6 / 3 min) |
| 50 / 30 | 52, 4, 2, 1, 0 | 22, 8, 8, 0, 0 | 0 ; 8 sur 8 | 106 / 129 / 67 (6 / 8 / 4 min) |
| 50 / 50 | 52, 4, 2, 1, 0 | 33, 7, 7, 0, 0 | 0 ; 7 sur 7 | 125 / 148 / 67 (7 / 9 / 4 min) |
| 80 / 50 | 93, 5, 2, 2, 1 | 33, 7, 7, 0, 0 | 0 ; 7 sur 7 | 155 / 163 / 79 (9 / 10 / 5 min) |
| 120 / 80 | 103, 5, 2, 2, 1 | 48, 12, 12, 0, 0 | 0 ; 12 sur 12 | 192 / 194 / 79 (11 / 11 / 5 min) |
| 200 / 120 | 194, 10, 5, 3, 1 | 77, 24, 23, 0, 0 | 2 sur 2 ; 23 sur 24 | 232 / 361 / 194 (14 / 21 / 11 min) |
| sans plafond | 329, 16, 10, 3, 1 | 223, 36, 29, 3, 0 | 7 sur 8 ; 29 sur 36 (3 erreurs) | 887 / 580 / 637 (52 / 34 / 37 min) |
| **40 / 70 (livré)** | **33, 4, 2, 1, 0** | **44, 12, 12, 0, 0** | **0 ; 12 sur 12** | **136 / 159 / 57 (8 / 9 / 3 min)** |
| 40 / 120 | 33, 4, 2, 1, 0 | 77, 24, 23, 0, 0 | 0 ; 23 sur 24 | 186 / 208 / 57 (11 / 12 / 3 min) |
| 80 / 70 | 93, 5, 2, 2, 1 | 44, 12, 12, 0, 0 | 0 ; 12 sur 12 | 176 / 184 / 79 (10 / 11 / 5 min) |

(Dans ce tableau, les trois dernières lignes sont une seconde série, avec les plafonds de zone, de vert hors zone à 20 et d'écartement à 20 du module ; les autres sont la première série. Le PN est identique dans toutes : 167 relus, 36, 36, 0, 0. Mauvaise voie : 0 partout.)

**Plafonds choisis : ADV 40, abords 70, verts hors zone 20, écartement 20, PN hors budget.** Raisons :

- **Le temps.** À 3,5 s le cut relu, PN compris, la passe d'une partie avec lot tient en 3 à 9 minutes (1:24 : 24 PN + 40 + 70 + 2 = 136 cuts ; 1:29 : 40 PN + 40 + 70 + 9 = 159 cuts ; 2:1 : 13 PN + 40 + 4 = 57 cuts), plus 2 s environ par correction. Sans plafond, la même passe prendrait 34 à 52 minutes.
- **Les abords rendent le plus.** Jusqu'à 120 cuts, les corrections des abords n'ont aucune erreur ni cut abîmé (24 actions, 23 justes). 70 cuts donnent 12 corrections justes sur 12 ; 120 cuts en donnent 24 (+3 minutes). Les erreurs de l'étude (3) viennent de cuts plus loin dans la zone (1:24, 1:29). Si Mic juge la durée acceptable, `plafondParZone.abords` à 120 double les corrections.
- **L'ADV rend le moins.** Les corrections d'ADV des parties avec lot sont loin dans la zone (2 justes sur 2 en 1:29 à partir de 200 cuts, 5 justes sur 6 en 2:1 sur 620) : aucun plafond compatible avec quelques minutes n'en récolte. Les quatre actions du plafond de 40 viennent de 1:13, partie sans lot : 2 justes, 1 erreur de 15,8 mm (1:13 #4651). Au-delà de 50 cuts, le cut abîmé de 1:13 (#4681) entre dans la sélection (plafond 80). **En pratique, l'ADV agira peu avec ce plafond ; l'ombre la visite et la note, et Mic peut relever son plafond.**
- **Pas de priorité dans la zone par proximité du lot** (hors étude) : l'ADV garde ses premiers cuts dans l'ordre des cuts. Une priorité par distance au lot, ou à l'écart, pourrait récolter plus de corrections pour le même temps ; non mesurée.

- **Mauvaise voie : 0** dans toutes les variantes et toutes les zones.
- **Critère de sortie** : PN inchangé (**36 justes sur 36 actions, 0 erreur, 0 abîmé, 0 mauvaise voie**) avec ou sans plafond ; ADV et abords sans plafond à l'étude (ADV 16 / 10 / 3 / 1 ; abords 36 / 29 / 3 / 0). **Avec les plafonds livrés : PN 36, 36, 0, 0, 0 ; ADV 4, 2, 1, 0, 0 ; abords 12, 12, 0, 0, 0 ; mauvaise voie 0.**
- **Mic accepte les chiffres, 9 % non démontré en ADV et abords** (D-180) : ADV 10 justes sur 16 actions (3 erreurs, 1 abîmé), abords 29 sur 36 (3 erreurs), contre 36 sur 36 en PN ; la porte des 39 actions sans erreur n'est franchie ni par l'un ni par l'autre.
- **F4 corrigé** : la 37e action de la revue (1:12 #8383, 7,95 mm arrondi à 8) a disparu.
- **Plafond** : les PN ne sont plus coupés (167 verts de PN jugeables relus, avec ou sans plafond ; en 2:1, les dix cuts du PN 401–414 que l'Écho permet de rejouer sont tous relus, contre 5 à 6 sur 14 avant la correction 7).
- **Chaîne** : vide au départ ; le différé 2:1 #303 (Mic l'a déplacé de 210 mm), qui partait en first-pass avec les poses du lot pour appuis, est maintenant jugé sans elles, n'est jamais corrigé (rôle) et n'entre pas dans la chaîne.
- **Ce qui s'applique à la passe livrée** : 29 des 36 corrections justes de PN viennent de 1:12 et 1:13, deux parties sans lot, donc sans passe. Sur les parties traitées par lot, il reste PN 7 sur 7 (1:29), abords 12 sur 12, ADV aucune, loin de la porte des 39 actions sans erreur.
- **Non rejoué** : la garde (statut lu dans ESV, arrivée par un pas, dernier cut), que les Échos ne permettent pas de reconstituer ; elle ne peut que retirer des actions.

## 12. Doutes et limites

- **Poids du journal.** L'événement `relecture-ombre` seul pèse environ 1,4 Ko par cut relu ; avec les événements de l'adaptateur (captures, navigation), la revue finale a mesuré environ 12 Ko par cut (452 815 octets pour 37 cuts), soit 2 à 3 Mo par lot de 200 cuts. La préparation de la passe relit tout le journal du cache (non vidé) : coût non mesuré.

- **Ce qui diffère encore de l'étude** : la chaîne n'accueille pas les cuts différés (l'étude, si) ; la médiane de la partie vient de la liste d'ESV ; le plafond par zone (PN hors budget) ; H5 en plus, en ombre ; la garde (statut lu dans ESV, arrivée, dernier cut), que l'étude n'avait pas.
- **Zones PN** : tirées des seules captures du lot. Sur les parties traitées par lot, l'étude n'a que 7 PN sur 7 (partie 29) ; 29 des 36 corrections justes viennent de parties sans lot, donc sans passe (revue, F1).
- **La porte des 9 % n'est pas démontrée** : il faut au moins 39 actions sans erreur ; chaque correction est notée pour que la prochaine Écho de Mic la juge. **En ADV et aux abords, Mic accepte les chiffres tels quels (D-180)** : 18 % et 14 % d'erreurs dans l'étude (ADV 10 justes sur 16 actions, 1 cut abîmé ; abords 29 sur 36), pas de démonstration. Si les Échos qui suivent un lot en « corriger » montrent des cuts corrigés par Ariane que Mic a dû reprendre, la zone se referme par son interrupteur (`corriger:false`), sans toucher au code.
- **ADV : peu d'actions avec le plafond livré** (§ 11) : les corrections d'ADV des parties avec lot sont loin dans la zone ; en 3 à 9 minutes, la passe n'en récolte aucune sur 1:24, 1:29 et 2:1. Le plafond est un réglage de temps, pas de sécurité : l'ADV est visitée et notée dans tous les cas.
- **Maj+Espace relayé** : prouvé sur la maquette qui valide sur place ; sur le vrai ESV, « valide sur place » vient de Mic (deux fois), non d'un export ; l'effet du geste relayé reste à vérifier (§ 7).
- **« vu »** : inévitable dès qu'un cut est affiché ; une ombre stricte limitée aux cuts déjà vus ôterait presque tout l'intérêt sur les verts.
- **Lectures de nuage** : excédent probable sur le terrain (§ 8), non mesurable sur la maquette.
- **Rythme** : sans pause, comme le lot (D-176).
- **Banc** : maquette sans Potree réel ni vrai serveur ; temps de capture de la maquette, calcul de cette machine chargée.
- **Lot borné** : la passe attend que Mic valide le dernier cut posé.

## 13. Rejouer

```
node --test tests/relecture-ombre.test.cjs tests/relecture-critere.test.cjs tests/relecture-panneau.test.cjs tests/relecture-maj-espace-page.test.cjs tests/relecture-maquette.test.cjs tests/relecture-sw-*.test.cjs
git archive origin/claude/esv-locale-audit tests/esv-maquette | tar -x -C <DOSSIER>      # le banc la règle seul (tools/relecture-maquette.cjs)
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node tools/relecture-banc.cjs --maquette <DOSSIER>/tests/esv-maquette --mode ombre --debut 0 --cuts 20 --lot 8:11 --terrain 1
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node tools/relecture-banc.cjs --maquette <DOSSIER>/tests/esv-maquette --mode corriger --debut 0 --cuts 40 --lot 8:11 --rouges 8-11 --terrain 1 --reglages SEUILS.json
```
