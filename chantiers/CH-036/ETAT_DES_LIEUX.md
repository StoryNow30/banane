# CH-036 : état des lieux et principes (Constellation et Aurore)

Lu dans le code du tronc (`src/signal-rendu.js`, `src/ui5.js`, `panel.js` partie CH-017, `src/file-parties.js`), le 01/11. Classement : **E** essentielle (visible d'emblée), **U** utile (un geste), **D** diagnostic (tiroir). Rien de E ne disparaît.

## 1. Ce qui est affiché aujourd'hui

### Onglet « File » (CH-026) et bandeau d'Orbite (CH-025)
| Information | Où aujourd'hui | Classe | Dans le dessin |
|---|---|---|---|
| État de la file (prête, préparée, partie k sur n, arrêtée, terminée) | mot d'état + `file-etat` en mono | E | mot d'état + la constellation (une étoile par partie) |
| Partie en cours, phase (lot, deuxième passe, relecture, changement) | phrase « Partie 13 · lot en cours » | E | étoile allumée + quatre temps sous la constellation : Pose, Rattrapage, Relecture, Passage |
| Nombre de parties (1, 2, 3, 4, 5, 8) | segment « Nombre de parties » | E avant lancement | segment, seul réglage, au-dessus de l'action |
| Partie de départ = partie affichée dans ESV | note sous le segment | E | la première étoile porte le numéro de la partie affichée |
| Lancer / Relancer / Nouvelle file | bouton plein | E | une seule action pleine par état |
| Reprendre au rang interrompu (`reprise` : partie, rang, restantes) | bouton plein + note « ESV doit l'afficher » | E | « Reprendre à la partie 14 », la note devient la phrase |
| Arrêter la file, confirmation à deux temps (6 s, 600 ms) | bouton danger | E pendant la file | bouton discret à droite, confirmation inchangée |
| Alerte d'arrêt (texte + détail) | bloc incident | E | bloc incident, sous l'état |
| Motif de fin (`motifFin.texte` : 15 motifs de `file-parties.js`) | dans la phrase | E | phrase, en mots de l'opérateur |
| « Attend la fin de la relecture » (CH-026-c) | mot d'état | E | mot d'état + temps courant animé |
| Bilan par partie : posés, différés, écrits par la passe, relecture (issue, corrigés), motifs (codes bruts : `fin-normale`…), alertes | liste `<ol>` d'une ligne de texte | E (posés, à poser, corrigés), D (codes, issue brute) | une ligne par étoile : glyphe, partie, posés, à poser, corrigés ; codes au tiroir |
| Départs des parties : validés, invalides, skippés, total, heure | tableau toujours ouvert | U | tiroir « Départs des parties » (un geste) |
| Note « relecture et correction après chaque partie, pas d'export automatique, seul Arrêter l'arrête » | répétée sous chaque bandeau | U | une ligne, seulement avant le lancement |
| Export (« Exporter le dossier ») | bouton secondaire | U | secondaire en fin de Constellation |
| Boîte « File de parties » (Préparer puis Lancer) dans Orbite | voile + boîte | U | remplacée par l'onglet : Orbite garde une entrée « Constellation » |

### Onglet « Correction » (CH-028) et fin de lot
| Information | Où aujourd'hui | Classe | Dans le dessin |
|---|---|---|---|
| Nombre traité sur total | gros chiffre « 0 traités sur 10 » | E | gros chiffre + l'horizon (barre fine qui s'éclaire de gauche à droite) |
| Comptes : à corriger, à poser, corrigés, validés tels quels, vus | phrase + droite | E | sous le chiffre, trois mots |
| Groupes par partie, puis « À corriger » / « À poser » | titres de section | E | une section par partie (petite étoile + numéro + « 3 sur 6 »), deux sous-groupes |
| Cut, signal en clair, détail (« déplacement 23 mm ») | ligne | E (cut, signal), U (détail) | cut + raison en clair ; détail au survol ou au focus de la ligne |
| Statut (à faire, ouvert, corrigé 1 ou 2 rails, validé tel quel, vu) | mot à droite | E | glyphe + mot, couleur par l'encre seulement |
| « Ouvrir » par ligne | bouton outil | E pendant l'Aurore | inchangé |
| Cut courant (ouvert dans ESV, corrigé…) | phrase | E | carte « en cours » en tête de liste |
| Suivant à ouvrir | bouton plein | E | « Suivant · cut 9124 » |
| Autre partie (non ouvrable sans CH-035) | infobulle « Ouvre la partie P dans ESV » | E | section grisée + « Partie 14 · à ouvrir après » ; avec CH-035 : « Passer à la partie 14 » |
| Refus d'ouvrir (`correction-etat` en refus) | ligne de raison | E | raison sous l'action |
| Séance Écho marquée, « Ariane n'écrit rien » | note longue | U | une ligne en bas, une fois |
| Correction interrompue (séance Écho perdue) | état | E | état « Aurore interrompue » |
| Bilan final dans l'export, Télécharger la séance Écho | phrase + bouton | E / U | bilan par partie + export plein |
| Ligne « À corriger » et bouton « Corriger · N cuts » en fin de lot | bilan de fin d'Orbite | E | ligne « Aurore · N cuts à revoir » + bouton « Ouvrir l'Aurore » |

### Éveil (CH-027)
| Garder le système éveillé pendant la file | réglage `eveil` | U | une mention dans la phrase « en cours » (« l'ordinateur reste éveillé ») si actif ; aucune commande nouvelle |

## 2. Principes (les miens, dans l'esprit d'Orbite et d'Écho)
1. **Un objet par écran.** Orbite a son rail, Écho ses marques ; la Constellation a ses étoiles (une par partie, reliées par le fil), l'Aurore a son horizon. L'état se lit sur l'objet avant de lire un mot.
2. **Une action pleine, toujours la suivante.** Les autres sont secondaires ou dans le tiroir. Arrêter n'est jamais l'action pleine.
3. **La hiérarchie par la taille et l'espace.** Couleur réservée à ce qu'elle dit déjà dans Signal (vivant, attention, alerte), jamais décorative, pas de vert criard : les étoiles faites sont à l'encre, l'étoile en cours seule est vivante.
4. **L'état lisible d'un coup d'œil** : mot d'état, phrase d'une ligne, objet. Le reste s'ouvre d'un geste.
5. **Les mots de l'opérateur.** « Partie », « posés », « à poser », « corrigé », « validé tel quel ». Sans jargon : « deuxième passe » devient « rattrapage », « différé » devient « à poser », « changement de partie » devient « passage », les motifs codés deviennent des phrases ; les termes techniques restent dans le tiroir « Diagnostic ».
6. **Rien d'essentiel ne disparaît, rien n'est inventé** : chaque chiffre vient d'un champ existant de la vue.
7. **Signal tel qu'il est (D-271)** : mêmes variables, glyphes, icônes, polices IBM Plex, bascule, puce, boutons.

## 3. Vocabulaire proposé (à valider par l'opérateur)
| Code / aujourd'hui | Visible proposé | Tiroir diagnostic |
|---|---|---|
| File de parties, onglet « File » | **Constellation** | `fileParties` |
| Correction, onglet « Correction » | **Aurore** | `correction` |
| lot en cours | Pose | lot |
| deuxième passe | Rattrapage | deuxième passe (ombre / écriture) |
| relecture et correction | Relecture | relecture, issue |
| changement de partie | Passage à la partie N | `changement`, mode du geste |
| différés | à poser | différés |
| skippés | sautés | skipped |
| motifs `fin-normale`… | phrase (« fin normale ») | code |

## 4. Coordination avec CH-035 (convention proposée)
L'Aurore lit dans `snap.correction` (src/ui5.js) deux champs que CH-035 exposerait : `entreParties` (booléen, le réglage `correctionEntreParties`) et `passage` (`{ etat: 'en-cours'|'refuse'|null, vers, texte }`, d'après l'événement `correction-partie`). Réglage éteint : l'état « autre partie » montre « ouvre la partie 14 dans ESV » (comportement de la 4.9.5.29). À confirmer avec CH-035 par la mère.

## 5. Figma (jalon, 01/11)
Fichier Signal, page « CH-036 · Constellation et Aurore » (aucune page existante touchée) : clé `ZrK16dO2MGOQp9lufe7lwF`, nœud de page `143:2`.
- Planche « Lire d'abord » (principes, ce qui change) et « Composants » : Étoile (5 états), Bascule · Constellation et Aurore (4 onglets × normale/compacte), Ligne d'Aurore (6 statuts), Temps de la partie (4), Ligne de partie, Poignée de tiroir, icônes Constellation et Aurore.
- 13 états × (600 × 760, 360 × 640) × (sombre, clair) = 52 fenêtres. Constellation : prête, en cours, arrêtée, terminée, terminée tiroir ouvert. Aurore : liste proposée, un cut ouvert, cut corrigé, autre partie (traversée CH-035 allumée), autre partie (traversée éteinte), passage, terminée. Orbite : fin de lot avec l'Aurore annoncée.
- Audit : 5 712 calques, 0 image, IBM Plex Sans et Mono seulement. Données d'exemple fictives.
- Écarts connus : l'icône « Lancer » de la bibliothèque ne s'affiche pas dans le bouton plein (écart antérieur, CH-025) ; aucun prototype de mouvement.

## 6. Décisions de l'opérateur sur le jalon (01/11, relayées par la mère)
1. Vocabulaire **validé** : Rattrapage, à poser, Passage, sautés.
2. **Validé** : « Ouvrir l'Aurore · N cuts » en action pleine en fin de Constellation ; en fin de lot d'Orbite, « Ouvrir l'Aurore » devant « Voir ce qui reste ».
3. **Refusé** : les départs des parties et les motifs restent visibles d'emblée. Dessin repris : section « Bilan par partie » (chaque partie suivie de sa ligne de motifs en clair), puis section « Départs des parties » (tableau, en 360 l'heure sous le numéro de partie) ; la fenêtre défile. Planche « tiroir ouvert » retirée.
4. **Refusé** : en 360 px les quatre onglets gardent leur libellé ; ils passent sur un second rang sous la barre, pleine largeur.
5. Convention CH-035 retenue : `snap.correction.entreParties` (booléen), `snap.correction.passage = { etat: 'en-cours'|'refuse'|null, vers, texte }` ; éteint = écran de la 4.9.5.29.
Figma après reprise : 12 états × 2 tailles × 2 thèmes = 48 fenêtres, 0 image.
