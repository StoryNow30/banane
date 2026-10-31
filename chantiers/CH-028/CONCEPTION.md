# CH-028 : la correction dans Orbite (note de conception, une page)

## 1. Ce que fait la fonction
À la fin d'un lot, ou d'une file de parties, Ariane propose une **liste de cuts à corriger**. L'opérateur ouvre chaque cut dans ESV, le corrige ou le laisse, et **valide lui-même** dans ESV. Écho enregistre ses visites. Ariane ne pose rien, ne valide rien, et n'écrit rien dans ESV. Elle ne propose aucune pose (frontière de D-270).

## 2. La liste (`src/correction-liste.js`, pur, partagé avec `tools/correction-liste.cjs`)
Elle est lue dans le journal du lot, avec les mêmes définitions que `juger-lot` (cible, posé, différé). Une entrée = un cut et ses signaux, rangés du plus fort au plus faible :

| signal | entre quand | source au journal |
|---|---|---|
| `passe-ecrite` | cut écrit par la deuxième passe | `passe-differes-ecriture` « ecrit » |
| `apres-differe` | posé dont n − 1 ou n − 2 est différé (R1 de CH-015) | issue des cibles |
| `sans-appui` | posé sans appui de chaîne, par une commande du lot, ou avec R1 | `lotObservation.anchorsUsed`, `command` |
| `garde-suivant` | posé voisin d'un cut différé par la garde R3 | `garde-apres-differe-suivant` |
| `relecture` | la relecture dit « je corrigerais » et n'a pas corrigé | `relecture-ombre` |
| `faux-vert` | l'ombre « faux vert » aurait différé | `lotObservation.fauxVertOmbre` |
| `differe` | différé restant (groupe « à poser », à part) | cibles sans pose |

Les « verts à contrôler » restent dans le tiroir « Ce qui reste ». Ce ne sont pas des poses d'Ariane.

## 3. Où elle vit dans Signal
- **Un onglet « Correction »** dans la bascule, à côté d'Orbite, Écho et File. Il n'apparaît que lorsqu'une liste existe. Il ne va pas dans le tiroir : le tiroir montre ce qui reste à examiner, alors que la correction est une séance avec un état.
- **Naissance** : sur l'écran de fin du lot (Terminé ou Arrêté, une fois la passe et la relecture finies), la ligne « À corriger · N cuts » et le bouton « Corriger · N cuts ». Sur l'écran ou l'onglet « File terminée », la même chose, avec une liste par partie.
- **États dessinés** : liste proposée, cut ouvert dans ESV, correction enregistrée, liste terminée.

## 4. Écho : on démarre une vraie séance, marquée
- **Pourquoi la démarrer** : la visite d'Écho (état de départ, intentions, référence humaine corrigée par l'écriture serveur, D-143) n'est construite que par l'observateur (`src/native-session.js` et `native-page.js`). La refaire à côté créerait un second format, alors que `juger-lot` et `jointure-echo-orbite` doivent lire la correction sans changement. « Commencer la correction » démarre donc une séance Écho ordinaire, avec en plus `correction: {id, batchIds, cuts}` dans la session. L'export Écho la porte ; le format est inchangé.
- **« Ouvrir dans ESV » pendant la séance** : l'adaptateur refuse `goToCut` quand Écho est actif (`adapter-page.js`, l. 1152). Pour éviter tout patch, le service worker enchaîne trois étapes : pause d'Écho (la visite en cours se clôt), puis `goto-cut` (lecture seule, inchangé), puis reprise d'Écho (nouvelle période, sans continuité supposée). Cela n'est permis que si la séance est une correction et que le cut est dans la liste et dans la partie chargée.
- **Statut d'une entrée** : il est lu sur la dernière visite du cut. *corrigé* = validation avec un rail déplacé ; *validé tel quel* ; *vu* = visite sans validation ; *à faire*. Après une validation, ESV passe au cut suivant : c'est une visite Écho normale, hors liste.

## 5. Ce qui entre dans l'export Orbite (journal)
- `correction-liste` : une fois par lot. Contient la version, `batchId`, la partie, les entrées (cut, groupe, signaux, détails) et les comptes.
- `correction-debut` : la séance Écho et les listes.
- `correction-ouvrir` : le cut et le résultat.
- `correction-fin` : le bilan par cut (statut, étiquette d'Écho) et les comptes.

Pendant la séance, l'export Orbite reste fermé (règle actuelle : Écho actif). « Terminer la correction » ferme la séance Écho, puis l'export Écho se fait par le chemin habituel.

## 6. Mesure hors ligne (ÉTABLI, `tools/correction-liste.cjs`, exports de `banane-data`)
- **Partie 20** (4.9.5.23, avant la garde R3, Écho du 29/10) : 59 à corriger (8,2 % des 721 posés) et 168 à poser. Sur les 36 cuts à corriger jugés : 13 font plus de 50 mm (précision 36 % [23 ; 52]). La liste rappelle 13 des 21 poses à plus de 50 mm (62 % [41 ; 79]) et 16 des 24 à plus de 20 mm (67 %). Le taux de base parmi les jugés est de 12 %.
- **Sans Écho** :
  - partie 0 (.24) : 27 à corriger sur 232 posés, 17 à poser ;
  - partie 10 (.25) : 23 sur 212, 5 à poser ;
  - partie 4 (.26) : 11 sur 165, 0 à poser ;
  - file de 3 parties (.27) : partie 2 : 7 sur 21, 3 à poser ; partie 3 : 4 sur 14 ; partie 4 : 5 sur 50, 1 à poser.
  - Le signal dominant est `sans-appui`. Depuis la garde R3, `apres-differe` est rare.

## 7. Ce qui reste ouvert
- **Précision mesurée sur une seule partie**, avant la garde, avec un Écho biaisé vers les zones difficiles (CH-015 § 4). Le poids réel de `sans-appui` seul n'est jugé sur aucun lot récent (SUPPOSÉ). La correction elle-même mesurera la liste.
- **Liste d'une file** : seule la partie affichée dans ESV s'ouvre (`goto-cut` vise la partie chargée). Pour les autres parties, Signal dit « ouvre la partie P dans ESV ».
- **Partie 4 de la file de 3** : le lot retenu a 51 cuts décidés, alors que la note de la collection en compte 39. L'écart n'est pas expliqué.
- **Plafond de longueur de la liste** : aucun. Il est à décider s'il dépasse le temps d'une séance.
