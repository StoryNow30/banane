# Interruptions du Pilote 4.7.21 (26/09) : trois causes, corrigées en 4.8.0

**Données** : banane-data, `collections/2026-09-26_v4.7.21_/interruptions p13-p14/`
(bilans de 15:47 et 19:36, diagnostic, corpus ; pas de journal) et
`collections/2026-09-26_v4.7.20_/pilote p11/` (lot 4.7.20 de la partie 11,
complet). Événements lus en ordre, lot par lot.

## Les lots

| Lot | Cuts | Posés | Fin du lot |
|---|---|---|---|
| p13 dès 0, 07:39–07:50 | 46 | 33 (71,7 %) | erreur « Vue ESV non recentrée sur le rail right » (326) |
| p13 dès 101, 15:08–15:29 | 85 | 69 (81,2 %) | erreur « Vue ESV non recentrée sur le rail right » (536, pose) |
| p13 reprise des différés, 15:30–15:42 | 75 | 40 (53,3 %) | **clos à tort** : silence d'ESV après 6629 |
| p14 dès 1, 15:43:11–15:43:22 | 1 | 1 | erreur « Export interrompu. » (410) |
| p14 dès 410, 15:48–15:58 | 63 | 57 (90,5 %) | erreur « Vue ESV non recentrée sur le rail left » (6098, pose) |
| p11 (4.7.20) dès 556, 05:49–06:04 | 96 | 82 (85,4 %) | pauses et « Arrêter » **de l'opérateur** |

Aucun de ces arrêts n'a posé de rail ni de paire hors contrat.

## 1. « Vue ESV non recentrée » : ESV lent (3 lots sur 5)

Avant de lire ou de poser un rail, le Pilote clique sur la sélection du rail
et attend qu'ESV recentre sa vue (12 s au plus). Sur ces trois cuts, ESV était
lent : 17 à 19 s pour lire le nuage (4 s d'ordinaire), avec très peu de points
chargés (7 et 16 sur un rail). L'attente échouait et le lot passait en erreur.

**4.8.0** : le clic de sélection est répété (3 fois au plus, `recentrages`),
ce qui ne déplace aucun rail. En lecture, un échec persistant met le lot en
**pause reprenable** (« Lecture LiDAR instable ») au lieu de l'erreur. Le
délai du bridge pour la pose passe de 45 à 90 s, pour laisser place aux
nouveaux clics.

## 2. Un silence d'ESV pris pour une fin de partie (partie 13, 15:42)

Lot « jusqu'à la fin de la partie » : après la validation de 6629, ESV annonce
6758 (même partie), puis ne répond plus pendant environ 30 s ; il revient à
15:43:03 sur la partie 14, cut 1. La 4.7.21 concluait après environ 18 s : lot
clos comme une fin de partie, et **6629 retenu comme fin de la partie 13**,
alors qu'ESV venait d'annoncer 6758.

**4.8.0** :
- un silence après une navigation dans la partie n'est plus une fin de
  partie : le Pilote relit l'état jusqu'à 10 fois (environ 70 s), le panneau
  dit « ESV ne répond pas encore… », et le lot reprend seul si ESV répond ;
- si ESV revient sur **une autre partie**, le lot est clos
  (« navigation-other-part »), rien n'y est traité ;
- une fin de partie n'est retenue que si ESV montre ou annonce une autre
  partie ; c'est alors le plus loin des cuts vus dans la partie (6758 ici) ;
- un silence qui dure (plus de 70 s) arrête le lot en erreur, sans fin
  retenue.

## 3. Une annulation tardive coupe le lot suivant (partie 14, 15:43:22)

Pendant le silence de 15:42, « Arrêter » a envoyé une annulation à la page
ESV, restée sans réponse. 45 s plus tard, le délai du bridge a renvoyé une
annulation **globale** à la page ; elle est tombée pendant la lecture du cut
410 du lot suivant, lancé entre-temps : « Export interrompu. », lot en erreur
11 s après son démarrage.

**4.8.0** :
- le bridge ne renvoie plus d'annulation quand c'est une annulation qui
  expire ; celle d'une autre requête expirée ne vise qu'elle
  (`requestId`) ;
- la page ignore une annulation qui vise une requête terminée, ou qui a été
  émise avant la requête en cours (`sentAt`) ; une annulation portée par une
  opération reste retenue ;
- le message devient « Lecture LiDAR annulée (arrêt demandé ou délai
  dépassé). ».

## 4. « Continue vers la partie suivante »

Sans fin connue pour la partie, le Pilote ne peut pas savoir qu'un cut est le
dernier : il le valide et ESV charge la partie suivante (KI-061). Le lot se
clôt alors, et la fin constatée est retenue : le lot suivant sur cette partie
s'arrête sur son dernier cut sans valider (D-053). La 4.7.21 retenait parfois
une fin fausse (§2) ; la 4.8.0 ne retient plus qu'une sortie de partie
observée.

## 5. Partie 11 (4.7.20)

Le journal montre deux pauses **de l'opérateur** (581 à 05:53, 703 à 06:04),
suivies de retours en arrière dans ESV, puis « Arrêter ». Aucun arrêt de
Banane. 82 posés sur 96 (85,4 %), 5 refus d'écartement, 0 hors contrat. C'est
après ce lot que « Nouveau lot » restait bloqué (KI-062, corrigé en 4.7.21).

Essais : `tests/ki063-arrets-4800.test.cjs` (7 cas), `tests/lot-bornes-4721.test.cjs`.
