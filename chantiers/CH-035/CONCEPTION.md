# CH-035 : l'Aurore parcourt toutes les parties d'une Constellation (note de conception, une page)

## 1. Ce qui change, et ce qui ne change pas
Aujourd'hui (4.9.5.29), la liste de l'Aurore réunit déjà les lots de toutes les parties d'une Constellation (`lotsACorriger` lit le bilan de la file). Mais « Ouvrir » (`correctionOuvrir` → `allerAuCut` → `goToCut` de l'adaptateur) ne va qu'à un cut de la partie chargée : l'adaptateur refuse `WRONG_PART`, et Signal grise le bouton (« Ouvre la partie P dans ESV »).
Avec le réglage `correctionEntreParties.actif` (**éteint** par défaut, `src/settings.js`), « Ouvrir » sur un cut d'une autre partie **change d'abord de partie par les boutons d'ESV**, puis va au cut. Éteint : le code suit exactement le chemin de la 4.9.5.29 (essai de non-régression). Le reste ne change pas : Ariane ne pose rien, ne valide rien et n'envoie aucun SKIP. Elle ne synthétise aucune touche. Les seules commandes envoyées à ESV sont `changerPartie` (déjà intégrée, CH-017 et CH-026) et `goToCut`.

## 2. Parcours d'une liste de plusieurs parties
- **Ordre.** Les parties sont prises dans l'ordre de la Constellation (l'ordre de `C.listes`, celui du bilan). Dans une partie, les cuts sont pris par numéro croissant, groupes « à corriger » et « à poser » mêlés. L'affichage garde l'ordre de CH-028 (par force) ; seul « Ouvrir le suivant » suit le parcours.
- **Suivant.** C'est le premier cut « à faire » de la partie affichée dans ESV, après le cut courant. Quand la partie affichée n'a plus rien à faire, c'est le premier cut à faire de la partie suivante dans l'ordre, puis on reprend au début de la liste. On finit donc une partie avant d'en changer, ce qui fait au plus un changement de partie par partie.
- **Reprise après un arrêt.** Le statut d'un cut se lit sur les visites d'Écho (`bilan`, inchangé), et non sur un curseur gardé. Une correction rouverte, un panneau rechargé ou un ESV laissé sur une autre partie reprennent donc au bon endroit sans état nouveau.
- **État par partie.** Une fonction pure, `parcours()` dans `src/correction-liste.js`, donne à chaque partie un état : *à faire* (aucun cut vu), *en cours* (la partie du cut ouvert, ou une partie entamée) ou *faite* (plus aucun cut « à faire » ni « en cours »). Signal l'affiche sur une ligne par partie, en version minimale. L'habillage revient à CH-036.

## 3. Une seule séance Écho pour toute l'Aurore
On garde **une seule séance**, celle que démarre « Commencer la correction », marquée `correction` (CH-028). À chaque changement de partie, Écho est mis en pause (la visite en cours se clôt), la partie change, on va au cut, puis Écho reprend. La reprise ouvre une nouvelle période, sans continuité supposée, exactement comme « Ouvrir » sur la même partie. Chaque visite porte déjà son identité `{part, cut}`, et `juger-lot` comme `jointure-echo-orbite` filtrent les visites par partie. Une séance par partie multiplierait les exports, et le bilan de `correction-fin` ne tiendrait plus en un seul événement, sans rien apporter. La lecture sans changement de ces outils sera vérifiée sur un export de `banane-data` (§ 6).

## 4. Comment la partie change : on réutilise, on n'invente rien
Le cœur de `fileChangerPartie` (`background.js`) est extrait dans une fonction commune, `changerPartieEsv(vers, {modes, attendu})`. Elle garde tout le comportement actuel : `ping` et ses `capacites`, les trois modes de l'adaptateur, la preuve (partie lue dans la page, « Cut N of part P » et rails présents, onglet ré-équipé après un rechargement), la borne de 60 s pour le lien et de 15 s pour un geste, les journaux `file-parties-changement` et `-echec`, l'arrêt prudent si ESV ouvre une autre partie. La file l'appelle sans aucun changement de comportement (ses essais doivent rester verts). L'Aurore l'appelle avec :
- `invalide-suivant`, puis `suivant-dernier`, puis `lien` **seulement si la partie visée est la suivante** (vers = partie affichée + 1). Ces deux gestes d'ESV ne savent aller qu'à la partie suivante.
- `lien` seul pour un retour en arrière ou un saut.
- Un `attendu()` propre à l'Aurore : la correction est encore ouverte et c'est la même.
La machine d'états de `src/file-parties.js` n'est pas utilisée : elle pilote des lots, et l'Aurore ne démarre aucun lot. Le parcours de l'Aurore n'a pas d'état gardé hors des visites. L'état de l'opération en vol (`C.changement`) n'est gardé que pour l'affichage.

## 5. États et pannes (chacun journalisé, aucun muet)
| cas | ce qui se passe |
|---|---|
| partie déjà chargée | chemin de CH-028, aucun `changerPartie` |
| partie introuvable (pas d'entrée `p=N`, aucun geste possible) | refus, `correction-partie` `resultat:'echec'` motif `selecteur-illisible`, Écho repris sur la partie affichée |
| changement refusé par ESV, sans effet dans la borne, ou autre partie ouverte | même chose (motif `changement-impossible` ou `esv-muet`) ; si ESV a ouvert une autre partie, arrêt prudent, rien d'autre n'est tenté |
| cache de la partie vide (compteur pas encore lu, borne inconnue hors du lot) | `goToCut` rejoué tant que le refus est transitoire (`OUT_OF_BOUNDS` sans compteur, `IDENTITY_UNAVAILABLE_BEFORE`, `ADAPTER_BUSY`, `NAVIGATION_PATH_UNAVAILABLE`), 15 s au plus, puis refus dit |
| Écho en pause par l'opérateur | il n'est pas remis en pause ; après l'ouverture, Écho reprend, selon la règle actuelle de `correctionOuvrir` (CH-028 : reprise si Écho est en pause à la fin de l'ouverture) |
| onglet fermé | la preuve s'arrête (`onglet-ferme`), refus ; la séance Écho n'est plus active, et `correctionVerifierFin` la clôt (`echo-ferme`), comme aujourd'hui |
| service worker redémarré pendant le changement | la mémoire de l'opération est perdue ; `correctionVerifierFin` clôt la correction (`sw-redemarre`, règle de CH-028), et le bilan est inscrit |

## 6. Journal, export, mesure
- **Nouvel événement `correction-partie`** (`schema:1`, version de parcours `correction-parcours-1`) : `correctionId`, `de`, `vers`, `cible {part, cut}`, `resultat` (`ok`, `deja` ou `echec`), `motif`, `mode` retenu, `tentatives` (mode et issue), `dureeMs`. Il entre dans l'export Orbite par le journal, comme les autres événements `correction-*`.
- **Mesure** sur `banane-data` (file de 3 parties du 30/10, file de 4 parties du 31/10) : nombre de cuts et de parties couverts par la liste ; preuve que le parcours de la maquette, sur le même nombre de parties, atteint chaque cut.
- **Non vérifié** : le changement de partie pendant une séance Écho n'a jamais été vu sur un vrai ESV (SUPPOSÉ). Le réglage reste éteint jusqu'à l'essai de l'opérateur.
