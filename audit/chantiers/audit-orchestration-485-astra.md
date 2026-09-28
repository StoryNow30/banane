# Contre-regard d'Astra sur l'orchestration de la suite (28/09/2026)

Prompt : version courte de `consignes/chantier-9-auditeur.md` (3 lectures :
`PLAN_SUITE.md`, D-060 et D-061, `audit/chantiers/audit-orchestration-485.md`).
Réponse transmise par la direction, reproduite telle quelle ci-dessous ; suites
données par l'orchestrateur à la fin. Consommation déclarée : 7 % du budget
d'Astra.

## Réponse d'Astra

> VÉRIFIÉ signifie vérifié dans les documents, sans validation du code ni recalcul.
>
> **1. Synthèse — cinq lignes**
>
> [VÉRIFIÉ] Le plan contient D1 à D7 ; aucun D8 n'est défini.
> [VÉRIFIÉ] J0 exige une mesure que D-060 déclare non enregistrée.
> [VÉRIFIÉ] L'auto-audit conserve des actions dépassées, notamment la création des étiquettes.
> [SUPPOSÉ] Le risque principal est d'obtenir des portes vertes sans preuve suffisante du comportement réel.
> [SUPPOSÉ] Je corrigerais les P1 ci-dessous avant le paquet 4.8.5.
>
> **2. Constats**
>
> 1. [VÉRIFIÉ] J0 bloqué par une attente périmée → PLAN_SUITE.md §0 ; DECISIONS.md D-060 : C4 de la partie 15 reste non mesuré, les étiquettes sont déjà créées → reformuler J0 en clôture documentaire assumant cette absence ; réserver la mesure enregistrée à la partie neuve → P1.
> 2. [VÉRIFIÉ] KI-066 sans rattachement explicite → D-060 le prescrit ; Plan §2 ne l'identifie dans aucun chantier et s'arrête à D7 → nommer son chantier, son essai et sa porte ; clarifier si le « D8 » demandé correspond à cet oubli → P1.
> 3. [VÉRIFIÉ] D3 ne demande pas de preuve du dernier cut → Plan §2, D3 prévoit une clôture après départ de la page suivant un différé, dans un lot non borné → exiger un indice fiable de fin de partie ; conserver la pause lorsque cette preuve manque → P1.
> 4. [VÉRIFIÉ] Une attente devient une porte éliminatoire → D-061 annonce « 0 à 2 attendus » ; Plan J2 en fait une condition ; auto-audit §1, garde s'appuie sur deux cas d'une seule partie → contester ce plafond brut, sans taille de lot ni justification ; juger les refus et leurs conséquences avant de conclure que la garde se trompe → P1.
> 5. [VÉRIFIÉ] C4 laisse la sélection des jugés indéfinie → D-061 ; auto-audit §3 fixent ≥80 % jugés et ≤2 faux/100, sans effectif absolu minimal ni méthode de sélection → fixer ces éléments avant le terrain et rendre visibles les posés non jugés. Ces seuils seuls ne démontrent pas la qualité générale → P2.
> 6. [SUPPOSÉ] D4 peut donner une assurance excessive sur B1 → Plan D4/B1 : compter des voisins portant des rails ne démontre pas que leurs références sont utilisables → vérifier identité des cuts, statut validé, coordonnées accessibles et fraîcheur avant de déclarer B1 faisable → P2.
>
> **3. Ordre proposé — cinq lignes**
>
> [SUPPOSÉ] Réviser J0/D6, puis avancer D5 pour fixer les portes avant les développements.
> [SUPPOSÉ] Faire D1 → D2 ; préciser KI-066 avant d'attribuer un éventuel D8.
> [SUPPOSÉ] Faire D4 avant de finaliser D3 ; terminer par D6 puis D7.
> [SUPPOSÉ] En 4.9, garder V1 → V2/V4 → V3 ; conditionner U1–U3 au budget opérateur.
> [SUPPOSÉ] Réconcilier la cible cycle −25 % de l'auto-audit avec capture −30 % du plan ; placer P2 avant les conclusions de qualité, puis B1/B2 et B3 seulement si nécessaire.
>
> **4. Trois questions à la direction — arbitrages proposés [SUPPOSÉ]**
>
> * Acceptez-vous une clôture J0 avec C4 de la partie 15 explicitement non mesuré ?
> * Où rattachez-vous KI-066, et que désigne précisément D8 ?
> * Quel effectif de jugés et quel contrôle des refus exigez-vous avant la stable ?

## Suites données par l'orchestrateur

| Constat | Suite | Où |
|---|---|---|
| 1 · J0 périmé | **Accepté.** J0 = clôture faite, documentaire : étiquettes vérifiées, C4 de la partie 15 non mesuré (qualité validée par l'expertise de la direction, D-060) ; la mesure enregistrée reprend en J2. | `PLAN_SUITE.md` §0 |
| 2 · KI-066 et D8 | **Accepté.** KI-066 est déjà corrigé dans le code (`bea32f0`, essais `budget-liberation` et `echo-vidage-audit-480`) et part dans le paquet par D7 : ligne ajoutée. D8 n'était pas KI-066 : c'est le bouton « Relire ce lot dans Écho », proposé à la direction le 28/09, **à décider**. | §2 |
| 3 · D3 sans preuve | **Accepté.** Clôture seulement avec une preuve (compteur « N on M » de D4, ou autre partie affichée à la reconnexion) ; sinon la pause reste, avec un message clair. D4 passe avant D3. | §2, D3 et ordre |
| 4 · plafond de refus | **Accepté.** Le plafond « 0 à 2 » est retiré des portes : chaque refus de la garde est examiné à la relecture ; la porte est « aucun refus d'une pose qui aurait été juste, sauf décision nommée ». | §0, J2 |
| 5 · C4 sans effectif | **Accepté, proposé à la direction** : au moins 100 posés jugés, pris dans l'ordre du lot sans choix, ≥ 80 % des posés, posés non jugés listés. Réserve reconnue : ces seuils ne prouvent pas la qualité générale (2 faux sur 100 laissent une borne haute d'environ 7 % à 95 %). | §0, J2 |
| 6 · D4 et B1 | **Accepté.** D4 n'est qu'un premier signal ; B1 exigera l'identité des cuts, leur statut validé, des coordonnées lisibles et leur fraîcheur. | §2, D4 |
| Ordre | **Accepté** : D5 d'abord, D1 → D2 → D4 → D3, D8 si décidé, D7 ; en 4.9, P2 au premier cycle, U1 à U3 selon le budget de l'opérateur. | §2, §3 |
| −25 % / −30 % | **Réconcilié** : la porte de la 4.9.0 est le cycle (−25 %) ; la capture (−30 %) n'en retire qu'environ 14 %, d'autres chantiers doivent compléter. | §3 |
| Auto-audit dépassé | **Accepté** : note de mise à jour en tête de l'auto-audit. | `audit-orchestration-485.md` |

## Deuxième passe d'Astra (avant le code de la 4.8.5)

Réponse transmise par la direction, résumée fidèlement ; Astra a exécuté les
calculs de C4 en JavaScript, sans essai logiciel.

**Scénarios de panne.**
- [VÉRIFIÉ] `equiperOnglet` injecte les fichiers avant de vérifier la version ;
  la garde de `adapter-page.js` empêche seulement la réinstallation, et son
  écouteur accepte plusieurs canaux sans propriétaire unique.
- [VÉRIFIÉ] `cutLabel` lit un identifiant de cut, pas un rang : la signification
  de « N on M treated » n'est pas établie ; la preuve prévue par D3 est à qualifier.
- Table de scénarios (SUPPOSÉ) : TEST après 4.8.0 → refus avant toute
  injection ; 4.8.0 après TEST → le seul refus côté test ne suffit pas,
  l'adaptateur doit ignorer un canal étranger ; F5 → pause reprenable
  (non-régression) ; sortie d'ESV en milieu de partie → erreur reprenable (hors
  ESV, `callSur` renvoie une erreur distincte) ; autre partie ouverte à la main
  → protection, sans affirmer une fin ; dernier différé avec compteur → clôture
  seulement si la preuve est qualifiée ; sans compteur → pause ; compteur
  absent, autre format ou périmé → champ absent, jamais de réemploi.
- P1 : la protection dans l'ordre TEST → stable ; la distinction entre sortie
  de partie et preuve de fin.

**Porte C4** (Clopper–Pearson bilatéral à 95 %, borne haute ≤ 2 %) : 183 jugés
sans faux, 277 avec un, 359 avec deux ; à 100 jugés, 2 faux → 7,038 %, 0 faux →
3,622 %. Effectif et sélection fixés avant le terrain, sans arrêt
opportuniste ; cuts voisins corrélés : une seule partie limite la portée.

**Fiche de l'opérateur, étape 6** : vérifier la bonne partie et une référence
exploitable (pas seulement le compteur de visites) ; donner l'ordre et
l'effectif à relire ; traiter à part les refus de la garde ; contrôler Écho
après F5 et les fichiers avant de revenir à la stable ; mesurer séparément lot,
relecture, export.

## Suites de la deuxième passe

| Point | Suite | Où |
|---|---|---|
| Vérifier avant d'injecter ; propriétaire unique de l'adaptateur | **Accepté (P1).** Vérifié dans le code. D1 : vérification avant injection ; l'adaptateur de test n'obéit qu'à l'extension qui l'a installé et garde ses modules dès l'installation ; essais dans les deux ordres. | `PLAN_SUITE.md` D1 |
| Compteur « N on M » non qualifié | **Accepté (P1).** Le compteur n'est plus une preuve. La fin est prouvée par une autre partie affichée à la reprise, après la navigation depuis le dernier cut ; sinon, pause et message. D4 sert à qualifier le compteur. | D3, D4 |
| Onglet hors ESV | **Accepté.** Vérifié dans `callSur` : erreur reprenable à prévoir, avec son essai. | D3 |
| Porte C4 statistique | **Calcul refait, identique** (183 / 277 / 359 ; 7,0 % à 100 jugés). La direction garde 100 jugés en ordre et chaque refus examiné ; la borne haute est publiée à chaque mesure ; « sous 2 % » devient un objectif cumulé sur plusieurs parties (la 4.8 elle-même : 4 sur 161, borne 6,2 %). | D-061, §0 |
| Fiche de l'opérateur | **Accepté** : même partie vérifiée, ordre et effectif (≥ 100 validés par Orbite), refus « écartement bas » posés par l'opérateur, contrôle après F5, fichiers vérifiés avant retour à la stable, trois temps notés. | `consignes/operateur-suite.md` |
