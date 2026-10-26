# Plan : mettre la relecture en pause et la reprendre, même après un F5 (21 octobre 2026)

Demande de l'opérateur : pouvoir **mettre en pause** la relecture d'après le lot et la **relancer, même après un F5**. Ce plan dit ce qu'il faut changer, ce qu'on ne touche pas, ce que ça coûte et ce qui reste à décider. **Rien n'est construit.** Maquette : `maquettes/ui-5.0/N-ariane-v2.html` (scènes « Relecture », parcours « pause et F5 »).

## 1. Ce qui existe (lu dans `background.js` et `src/carte-relecture.js`)

- **Arrêter** : « Arrêter la relecture » termine la passe à la fin de l'étape en cours (jamais entre la pose et la validation d'une correction).
- **Relancer** : le bouton existe (visible quand le lot est clos et la relecture pas finie), mais il **repart de zéro** : nouvelle sélection, aucun souvenir des cuts déjà relus.
- **F5, ou redémarrage du service worker** : la passe vit en mémoire ; elle est perdue. Un F5 pendant la passe la ferme en erreur (« ESV sans réponse ») ; au redémarrage, seul un marqueur « interrompue » est écrit au journal.
- **Correction interrompue** (pose faite, validation non prouvée) : mémorisée par cut ; tout est bloqué (relecture, lot, retour à un cut) jusqu'à « J'ai contrôlé le cut N ».

## 2. Ce qu'il faut garder au-delà d'un F5

Une seule clé de stockage nouvelle (`banane51RelectureReprise`), écrite après **chaque cut relu** :
- le lot, la partie, la page (`pageId`), le mode choisi et le mode effectif ;
- la **sélection déjà calculée** (liste des cuts et des plages) et la **position** : le prochain cut à relire ;
- les compteurs (relus, corrigés, refusés, « vus », cuts neufs) ;
- l'état que la passe tient en mémoire : **chaîne d'appuis** (les poses données aux verts relus), écartements des verts, plages sautées.
Taille attendue : quelques dizaines de Ko pour 85 cuts (**à mesurer** ; la chaîne d'appuis est la partie la plus lourde).

## 3. Ce qui change

| Élément | Aujourd'hui | Demain |
|---|---|---|
| États de la passe | préparation, en cours, finie, arrêtée, erreur | + **pause demandée**, **en pause**, **en pause : ESV ne répond plus** |
| Actions du service worker | `relecture-arreter`, `relecture-lancer` | + `relecture-pause`, `relecture-reprendre` |
| Arrêter | termine la passe | inchangé : **final**, efface la reprise |
| Pause | n'existe pas | s'arrête au prochain point sûr, garde la position, la reprise reste possible |
| F5 / ESV muet pendant la passe | erreur, passe perdue | **pause automatique**, position gardée, reprise grisée tant qu'ESV ne répond pas |
| Redémarrage du service worker | marqueur « interrompue » | passe restaurée **en pause** (jamais relancée toute seule) |
| Reprise | repart de zéro | repart au **cut gardé** ; le cut en cours à la pause est refait en entier |

## 4. Règles de sûreté (non négociables)

1. Jamais de pause entre la pose et la validation d'une correction : la pause attend la fin du cut (comme « Arrêter » aujourd'hui).
2. Une correction interrompue (F5 au mauvais moment) **bloque la reprise** jusqu'à « J'ai contrôlé le cut N », comme elle bloque déjà le reste.
3. La reprise **ne se fait jamais seule** : toujours par un clic ou la palette.
4. Avant de reprendre : mêmes contrôles qu'au départ (ESV répond, même partie, lot clos et le même, pas d'Écho, pas de pose non validée), plus : la liste d'ESV est relue (elle est perdue au F5) et la sélection gardée correspond toujours au lot.
5. Mode « ombre » : rien n'est écrit dans ESV, ni à la pause, ni à la reprise.
6. Une seule passe à la fois ; changer de lot ou de partie **efface** la reprise.

## 5. Fichiers

- **Touchés** : `background.js` (section relecture, environ 150 lignes concernées), `panel.html` (deux boutons : Pause, Reprendre), `src/ui5.js` et `src/ui5-rendu.js` (états et boutons de la nouvelle interface), nouveaux essais.
- **Gelés, à ne pas modifier** (empreintes contrôlées par `tests/pose-lot-inchanges-*.test.cjs`) : `src/relecture-ombre.js` (sélection), `src/relecture-critere.js`, `src/adapter-page.js`, `src/engine.js`, `src/geometry*.js`, `src/lot-decision.js`, **`src/carte-relecture.js`**. Les nouveaux boutons ont donc leur propre petit module (`src/relecture-pause.js`) au lieu de modifier `carte-relecture.js`, qui garde ses boutons actuels.
- La pose et le lot ne changent pas ; la partie « lot » de `background.js` n'est pas touchée, mais **`background.js` est aussi modifié par la branche L1** : il faudra se coordonner avec la session qui la porte.

## 6. Essais à écrire (environ 15)

Pause à chaque étape (navigation, capture, calcul, juste après une correction) ; pause refusée entre pose et validation ; reprise au bon cut sans repasser sur les relus ; compteurs conservés ; chaîne d'appuis conservée (mêmes résultats qu'une passe sans pause) ; F5 simulé (page absente) → pause automatique ; reprise grisée tant qu'ESV ne répond pas ; redémarrage du service worker → en pause, pas relancée ; correction interrompue → reprise bloquée ; changement de lot → reprise effacée ; « Arrêter » efface la reprise ; mode « ombre » : aucune écriture ; stockage plein ou illisible → pas de reprise, message clair ; deux clics rapides ; panneau fermé puis rouvert.
**À adapter** : les essais qui attendent « erreur » sur ESV muet (`relecture-sw-panne`) et « interrompue » au redémarrage (`relecture-sw-redemarrage`, `relecture-panneau`, `relecture-sw-corriger-validation`).

## 7. Estimation (à titre indicatif, pas un engagement)

- **A. Service worker + essais** : le plus gros, environ deux séances de travail.
- **B. Panneau et nouvelle interface** : une séance.
- **C. Essai terrain** : une séance de l'opérateur, avec un vrai F5 pendant une relecture.
- **Risque principal, non vérifiable hors d'ESV** : après un F5, la liste de cuts d'ESV (mémoire de la page) et l'observateur passif se réinstallent avec un délai. Si la reprise démarre trop tôt, le statut « vert » d'un cut peut manquer et la correction serait écartée (sans danger, mais la relecture ne ferait rien). À mesurer sur ESV réel.

## 8. Décisions de l'opérateur (21 octobre)

1. **Durée de garde** : oui, jusqu'au prochain lot ou à « Arrêter », au plus une journée.
2. **F5 pendant la relecture** : « les deux » : un **réglage** (Réglages, « Si ESV est rechargé pendant la relecture ») entre **Mettre en pause** (par défaut, la reprise reste possible) et **Arrêter** (comme aujourd'hui). Interprétation à confirmer : si l'opérateur voulait autre chose (par exemple pause d'abord, puis arrêt au bout d'un délai), le dire.
3. **Version et branche** : la session principale s'en charge (numéro, coordination avec la branche L1 pour `background.js`).
4. **Maquette** : la palette a été refaite (trop fouillie : voir D-233) ; le reste de la maquette n'a pas reçu d'objection. Validation d'ensemble à reconfirmer avant de construire.
