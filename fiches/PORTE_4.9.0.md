# Porte de version 4.9.0 — bilan critère par critère

Préparé le 15 octobre 2026 pour la version candidate 4.9.0 (branche `claude/49-rc`, code de la 4.9.0.17, `9a329b6`, plus les
corrections D1 et D2 de la relecture finale, D-110).
Texte de la porte : `BANANE_4.9_CAHIER.md` § 7 (cahier v0.2 signé, version de la branche `claude/execute-prompt-00-18ra5a`),
modifié par les décisions D-085 (C4 retiré), D-092 (300 cuts levé), D-094 (audit d'Astra retiré), D-095 (V4 sorti de la 4.9.0)
et D-102 (B3 dans la 4.9). Décisions citées : `DECISIONS.md` de la branche `claude/execute-prompt-00-18ra5a`.

> § 7 : cycle médian −25 % (V3, V4 et le reste ensemble), mesuré selon le § 4 sur une partie neuve ; C1 et C4 non dégradés
> selon le § 5 ; C3 = 0 ; les trois mesures publiées ensemble ; 0 capture perdue ; exports conformes au § 8 (petit fichier :
> zéro différence) ; U1 à U3 livrés ; V5 selon le résultat des longues sessions ; audit d'Astra du diff avant toute version
> stable, décision de la direction en dernier. Objectif −40 % : non bloquant.

Statuts : **tenu** (preuve écrite) ; **tenu avec réserve** (preuve, mais écart de méthode ou couverture partielle) ;
**non tenu** ; **retiré** (par décision de la direction) ; **en attente** (de la séance finale ou de Mic).

## Tableau

| # | Critère | Statut | Preuve | Réserve |
|---|---|---|---|---|
| 1 | Cycle médian −25 % | **tenu avec réserve** | Rapide contre référence, même lot : test 15 (partie 24) 2,65 s / 5,71 s, **−54 %** (D-106) ; test 16 partie 26 1,69 s / 5,91 s, **−71 %** (D-107) ; test 16 partie 25 3,12 s / 6,00 s, **−48 %** (D-108) ; test 17 partie 27 2,51 s / 5,80 s, **−57 %** sur la séance, **−71 %** sur page ESV fraîche (D-109). Avant : 4.9.0.8 −64 % (D-090), 4.9.0.9 −53 à −64 % (D-092), partie 23 −58 % (D-105). | Méthode : tirage cut par cut dans un même lot (D-087), pas les blocs alternés M1 du § 4 décidés le 30/09 ; proposée « à valider par Mic » (D-087), pratiquée ensuite sur ses lots sans signature écrite de la méthode elle-même. Le bras référence n'est qu'un cut sur dix depuis la 4.9.0.9 (D-091) : intervalles plus larges. Le gain dépend d'ESV (D-108, D-109). Même avec la borne basse (−48 %), la porte et l'objectif sont dépassés. |
| 2 | Objectif −40 % (non bloquant) | **tenu** | Plus faible gain mesuré : −48 % (partie 25, D-108). | Fourchette durable −48 à −58 % ; −71 % seulement quand ESV garde son signal de fin de chargement (D-109). |
| 3 | C1 non dégradé | **tenu avec réserve** | Rapide / référence : 79,2 / 79,6 % (D-106), 84,0 / 84,6 % (D-107), 81,0 / 83,0 % (D-108), 75,8 / 74,5 % (D-105), 84,8 / 84,8 % (D-090) ; test 17 : au niveau de la référence (retour du 15/10). Tous les écarts dans la tolérance de 8 points tirée de l'A/A (D-087). | Tolérance de 8 points proposée par l'orchestrateur (D-087), non signée explicitement par Mic. C1 de la partie 27 non chiffré dans D-109. Partie 23 sous le seuil historique de 79 % dans les deux bras (75,8 / 74,5 %) : effet de partie, pas de la version. |
| 4 | C4 non dégradé | **retiré** | D-085 (12/10) : C4 retiré des portes de la 4.9 par Mic, calculé pour information quand une relecture existe ; à retravailler pour la 5.0. | — |
| 5 | C3 = 0 (aucune pose hors contrat d'écartement) | **tenu avec réserve** | Lots du 12/10 : paires appliquées de 1426,2 à 1465,4 mm (D-085) ; 4.9.0.9, parties 13 et 15 : C3 observé à 0, écartements posés 1 424 à 1 465 mm (D-092) ; borne basse 1420 mm dans `src/gauge.js` (D-084, D-085) : une paire hors [1420, 1470] n'est pas posée. | C3 n'est pas chiffré explicitement dans D-105 à D-109 pour les tests 13 à 17 ; il tient par construction de la garde, pas par un recomptage des derniers lots. Rejeu du banc de 633 cuts non relancé (corpus privé absent, D-085). |
| 6 | Trois mesures publiées ensemble (§ 4.3) | **tenu avec réserve** | `tools/perf-v3.cjs` publie cycle médian hors silences (P90, max, silences), durée totale du lot et arrêts pour 100 cuts avec causes séparées (D-095 point 3). Ex. test 16 partie 26 : 16,8 min, 0 arrêt (D-107). | Les interventions manuelles restent « non mesurées » : leur liste d'événements n'est pas établie (D-095). |
| 7 | 0 capture perdue | **tenu** | Test 15 : 514 invalides traités une fois, 0 capture perdue (D-106) ; 4.9.0.9 : 0 capture en erreur (D-092) ; 4.9.0.8 : 0 relecture, 0 erreur (D-090) ; tests 16 et 17 : exports complets (D-107, D-108), 0 capture perdue. Observateur : écritures d'ESV 375 / 375 sans perte (D-082). | Lots de la 4.9 reçus seulement. |
| 8a | Exports : « Sauvegarder tout » en un clic, fiabilité de l'enregistrement (§ 8.1, § 8.5) | **tenu** | « Tout télécharger pour l'analyse » : un zip (D-080), puis volumes zip autonomes ≤ 17 Mo (D-106) ; partie 26 en 4 volumes (D-107), partie 25 en 10 volumes, complet (D-108) ; vidage seulement si tous les volumes sont confirmés (D-106) ; vidage « STALE » corrigé (D-082). | Le fichier unique est remplacé par des volumes autonomes (solution de remplacement du § 8.2, faite pour la taille des messages et du poste). |
| 8b | Exports : petit fichier « Préparer pour analyse » à zéro différence (§ 8.3) | **non tenu : renvoyé à la 4.9.5, décision de Mic du 15 octobre** (D-110) | Aucune action distincte « Préparer pour analyse » dans le panneau. Ce qui existe : l'allègement A des nuages, rejoué sur le lot 4.9.0.8 avec décisions identiques 112 / 112 (D-091). | L'allègement prouve « zéro différence » sur les décisions rejouées, pas sur un petit fichier séparé. |
| 8c | Exports : −40 % sur les données utiles (§ 6 V2) | **non tenu : renvoyé à la 4.9.5, décision de Mic du 15 octobre** (D-110) | Allègement A : corpus −33 % sur le lot 4.9.0.8 (D-091) ; exports allégés sur le poste environ −25 % par cut (D-092). Les pistes à −49 % (arrondi des points) ont été abandonnées pour garder le rejeu exact (D-091). | Choix délibéré : exactitude des points préférée au poids. |
| 8d | Exports : limités au lot (KI-068), anciens exports lisibles (§ 8.6) | **tenu avec réserve** | Lecture des anciens exports gardée (essais du dépôt, dont `tests/version-490.test.cjs` pour les journaux 4.9.0.2 à 4.9.0.17). | KI-068 (visites d'Écho dans le journal d'Orbite) : pas de preuve écrite de sa correction dans les décisions lues ; en pratique, le vidage après export réduit le mélange. À vérifier. |
| 9 | U1 livré (résumé de partie) | **tenu** | Accepté (D-078) ; résumé de partie en lecture seule dans le panneau. | — |
| 10 | U2 livré (essais du vrai panneau) | **tenu avec réserve** | Accepté (D-078) : 24 / 24 et 9 / 9 dans Chromium réel ; panneau refait ensuite (variante « Accueil », D-103, D-105), captures du vrai panneau dans Chromium (test 17). | Chromium seulement ; Edge non mesuré. |
| 11 | U3 livré (raccourcis `D` et `Maj + Espace`) | **tenu avec réserve** | Actions écrites (D-093 : `D` = cut de droite, `Maj + Espace` = valider) ; essais : ni doublé ni détourné (`tests/u3-raccourcis.test.cjs`). | Comportement réel d'ESV sur ces touches : parole de l'opérateur (D-093). |
| 12 | V5 selon les longues sessions | **tenu** | Dérive mesurée +30 et +38 % du 1er au 3e tiers (D-087) ; V5 livré : sauvegarde à taille constante, 4,3 Mo → 4,6 Ko, 104 ms → 0,97 ms par sauvegarde (D-089) ; aucune dérive vue ensuite (D-090, D-092) ; relecture ciblée du moteur V5 faite (D-095), KI-070 corrigé (D-096). | Critère « 300 cuts en un lot » levé par Mic (D-092). Deux défauts mineurs sans perte, notés dans les problèmes connus (D-095 (ii), (iii)). |
| 13 | Audit d'Astra du diff avant toute version stable | **retiré** | D-094 : Astra a quitté le projet ; critère retiré par la direction. Remplacé en partie par la relecture ciblée du moteur V5 (D-095 point 4). | Aucun audit indépendant du diff complet 4.8.6 → 4.9.0. |
| 14 | B3 (entré dans la 4.9 par D-102) : décisions inchangées, reprise, pause, arrêt, F5 | **tenu avec réserve** | Banc du dépôt : 9 essais de transitions, attendus jamais modifiés (D-104) ; terrain : pause / reprise, F5 en plein lot, arrêt en plein cut, fin de partie (D-106, D-109). Mic confirme pause / reprise et F5 avec reprise automatique au bon endroit, y compris après une mise en veille du PC suivie d'un F5 (D-110). | Lignes 15 à 18 : confirmées par Mic, sans export. |
| 15 | B3 : Arrêter puis Reprendre, refus si les rails ont bougé | **tenu (confirmé par Mic, sans export)** | Essai du dépôt (`tests/t16-b3-reprise.test.cjs`, D-106) ; terrain : Mic, 15 octobre, 4.9.0.17 (D-110). | Aucun export de cette séance. |
| 16 | B3 : Reprendre après la fin → « Lot déjà terminé » | **tenu (confirmé par Mic, sans export)** | Essai du dépôt (D-106) ; terrain : Mic, 15 octobre, 4.9.0.17 (D-110). | Aucun export de cette séance. |
| 17 | B3 : lot à plage fixe jusqu'à sa fin | **tenu (confirmé par Mic, sans export)** | Essai du dépôt : lot borné jusqu'à son dernier cut (`tests/b3-transitions.test.cjs`, D-104) ; terrain : Mic, 15 octobre, 4.9.0.17 (D-110). | Aucun export de cette séance. |
| 18 | B3 : erreur dans l'avis | **tenu (confirmé par Mic, sans export)** | Essai du dépôt (transition `erreur`, D-104) ; terrain : Mic, 15 octobre, 4.9.0.17 (D-110). | Aucun export de cette séance. |
| 19 | Décision de la direction en dernier | **en attente (Mic)** | Fusion dans `main`, étiquette `v4.9.0` et publication : réservées à Mic (D-096 point 1, D-102 point 4). | — |

## Hors porte, à savoir

- **V4 sorti de la 4.9.0** (D-095, levier de 0,3 % du cycle) : reporté à la 5.0.
- **B1 en ombre** : calculé et consigné, sans effet sur la pose (D-096, D-102) ; activation après lecture des notes `b1-ombre`.
- **Retour à une coupe** : livré en lecture seule, sans bouton, jamais appelé ; non vérifié sur le vrai ESV (D-098).
- **Banc complet des 633 cuts et 8 jeux** : non relancé ici (corpus natif privé absent, `verify` en mode partiel : 2 essais
  sautés). Moteur conforme à sa baseline épinglée ; géométrie inchangée.
- **Code** : celui de la 4.9.0.17 ; les chaînes de version changent (manifeste, `src/core.js`, repli de `background.js`,
  `src/bridge.js`, `panel.js`, `panel.html`), plus les deux corrections de la relecture finale (D-110). `src/engine.js` non touché.
- **Relecture finale (D-110)** : aucun défaut de pose, aucune fuite, aucune permission nouvelle.
  - **D1, corrigé** : vidage du cache refusé indéfiniment après « Clôturer le résultat incertain », une fin de partie après un
    différé ou un SKIP explicite du dernier cut (mesure V1 jamais close) ; la mesure V1 est désormais close à ces endroits.
  - **D2, corrigé** : la fiche de départ ne peut plus être écrasée par la réponse à la question « y a-t-il des invalides ? »
    d'ESV (0 / 1 / 1) ; ces résumés sont ignorés et les écritures des fiches mises en file.
  - **D3, renvoyé à la 4.9.5** : une écriture refusée par ESV (HTTP 500) est quand même comptée comme acceptée (identique en
    4.8.6, jamais vu sur 924 écritures).

## Ce qu'il reste à faire avant de dire « porte franchie »

1. ~~Séance finale : les quatre essais B3 (lignes 15 à 18)~~ : confirmés par Mic le 15 octobre, sans export (D-110).
2. Mic : accepter les réserves des lignes 1, 3 et 5 (méthode intra-lot, tolérance C1 de 8 points, C3 par construction).
   Exports non tenus (8b, 8c) : renvoyés à la 4.9.5, décision de Mic du 15 octobre (D-110).
3. Mic : fusion, étiquette, publication.
