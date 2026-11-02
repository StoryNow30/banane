# CH-040 : note (l'Aurore ne couvre que la dernière file)

## 1. La règle actuelle (ÉTABLI, `background.js` `lotsACorriger`, collection du 02/11)
- `lotsACorriger` rend : les lots demandés (`batchIds`), sinon les lots du **bilan de la file courante** si elle est « fin » ou « arrêt », sinon le **lot courant**.
- Le 02/11, la file B (partie 1 seule, lot `901a1a0e`) a remplacé la file A (parties 0 puis 1, arrêtée sur une erreur au lot `6768c769`). La liste n'a porté que `901a1a0e` : 15 cuts. Les lots `67467121` (partie 0) et `6768c769` (partie 1) ont disparu.
- Rejoué avec `src/correction-liste.js` sur le journal exporté : **45 + 3 + 15 = 63 entrées**. Les 3 lots n'ont **aucun cut cible en commun** : le premier lot de la partie 1 couvre les cuts 1 à 534, le second les cuts 535 à 3080. Après fusion, il reste donc **63 entrées**.
- Une fois l'Aurore du 02/11 retirée (lot `901a1a0e` repris, fin « operateur »), il reste **48 cuts** : 45 sur la partie 0, 3 sur la partie 1.

## 2. La règle voulue (proposée, mise en œuvre sauf objection)
- **Population** : tous les lots du **journal** (`batch-started`), c'est-à-dire la session depuis le dernier vidage. C'est ce que l'export Orbite porte.
  - Le lot courant n'entre que s'il est clos. Un lot remplacé par un autre est clos par construction.
  - On garde les **16 lots les plus récents**, plafond déjà en place pour `batchIds`.
- **Exclusion d'un lot déjà repris** : est exclu un lot couvert par une Aurore terminée, c'est-à-dire un `correction-debut` dont les `batchIds` le contiennent, suivi d'un `correction-fin` de la même correction, avec une raison volontaire :
  - `operateur` (« Terminer ») ;
  - `liste-finie`.
- **Fin accidentelle** (`sw-redemarre`, `echo-ferme`, erreur) : le lot reste. Seuls ses cuts déjà **corrigés ou validés**, d'après les lignes de ce `correction-fin`, sont retirés. Le reste est reproposé.
- **Regroupement** : une liste par partie, dans l'**ordre du premier départ de lot** de chaque partie. Pour une file seule, c'est l'ordre de la Constellation : le parcours de CH-035 et CH-037 reste donc inchangé. Je ne trie pas par numéro de partie.
- **Fusion par cut** : pour chaque cut d'une partie, c'est le **dernier lot qui l'a eu pour cible** (posé ou différé) qui décide. Il y a trois cas :
  - ce lot le signale : son entrée est gardée, avec le signal le plus récent ;
  - ce lot l'a eu pour cible **sans le signaler** (il a été posé proprement depuis) : le cut n'est plus proposé ;
  - un cut qu'aucun lot plus récent n'a eu pour cible garde l'entrée de son lot.
  Chaque entrée porte son `batchId`, et la liste de la partie porte `batchIds`.
- **« Déjà validé depuis »** : retiré seulement quand c'est établi, c'est-à-dire par une ligne corrigée ou validée d'un `correction-fin` (voir l'exclusion ci-dessus).
  - Une écriture observée hors Aurore ne permet pas de distinguer l'opérateur d'Ariane (deuxième passe, relecture) : le cut **reste**, et la note de la partie dit « lots : … ».
  - Une séance Écho séparée antérieure n'est pas dans le journal d'Orbite : elle n'est pas lue (SUPPOSÉ sans effet : les visites de l'Aurore la remplacent).
- **Journal** : `correction-liste` reste inscrit une fois par lot, au même format. `correction-debut` porte tous les `batchIds`. Un nouvel événement `correction-couverture` donne :
  - les parties et les lots retenus ;
  - les lots exclus et pourquoi ;
  - les entrées avant et après la fusion.
- **Signal** (lecture de la vue ; l'habillage reste celui de CH-036) : la phrase de la liste proposée dit les parties et le nombre de lots, par exemple « Parties 0, 1 · 3 lots ». La ligne d'une partie dit « 2 lots » quand elle en porte plusieurs.
- **Décocher une partie** : non livré. Il faudrait un état de plus dans la correction, un geste et un essai de maquette, et le Cadran de CH-036 n'a pas de place prévue. L'opérateur peut passer une partie (« Suivant » ne fait qu'ouvrir). À trancher s'il le veut.

## 3. Cas limites
| cas | comportement |
|---|---|
| plusieurs lots sur une partie | fusion par cut, le dernier lot qui l'a eu pour cible décide |
| lot arrêté sur erreur (ERROR) | entre dès qu'un autre lot l'a remplacé ; s'il est le lot courant en ERROR, le refus actuel (« lot encore ouvert ») reste : c'est CH-039 |
| relance d'une file | la nouvelle file ne masque plus l'ancienne : tout se lit au journal, plus au bilan de la file |
| session de plusieurs heures | tout le journal depuis le dernier vidage, 16 lots au plus (les plus récents) |
| lots déjà passés à l'Aurore | exclus si l'Aurore a fini volontairement ; sinon seuls les cuts traités sont retirés |
| redémarrage du service worker | rien en mémoire : le journal suffit (`fileP.etat` n'est plus nécessaire) |
| journal vidé | plus de lot, donc pas de liste ; c'est le refus actuel, « aucune décision » |
| `batchIds` demandés | inchangé : ces lots-là, sans exclusion (essais de CH-035) |

## 4. À trancher par l'opérateur (non évident)
1. Exclure un lot dont l'Aurore a été **terminée à la main avant la fin** (« Terminer » à 5 sur 45) : je l'exclus, comme le propose le ticket. L'autre choix serait de ne retirer que les cuts traités.
2. Ordre des parties : ordre du premier départ (proposé) ou numéro croissant.
3. Décocher une partie dans le Cadran : à faire ou non.
