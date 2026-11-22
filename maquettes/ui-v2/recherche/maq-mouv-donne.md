# Maquette mouv-donne (« La donne »)

**Logique (une phrase).** Le lot se joue comme une donne : la pioche est ce qui n'est pas encore traité, chaque cut est une carte retournée qui rejoint la pile des posés, ce qui demande un regard reste en main, et quand Ariane a besoin de l'opérateur une carte lui est tendue.

**Références et ce qui en est pris.** beui.dev Card Dealer (code lu : identité conservée des cartes, vol en arc `visualDuration 0.55 / bounce 0.18`, retournement en vol, « saut » quand une carte change de place dans la main, durée 0 en mouvement réduit) ; 60fps.design CRED Autopay Bills Stack (pile qui se déplie en liste → « Ce qui reste »), Microsoft Teams Catch-up (pile qui se vide jusqu'à l'état final), Cancel Button Expand to Confirm (le bouton d'arrêt s'étire au second appui) ; guide beui (moins de 300 ms pour l'interface, sortie plus rapide que l'entrée).

**Sens des signes.** Pioche face cachée = à traiter ; pile face visible = posés (numéro du dernier cut) ; main : carte face cachée = différé (pas posé), carte face visible cochée = posé à examiner ; bande rouge « arrêté » en travers de la pioche = arrêt ; carte ocre « À vous » au centre = Ariane attend l'opérateur ; pioche en pointillé = vide (fin) ; dernière carte de pioche en pointillé = total inconnu (écrit aussi) ; en Écho, la pioche disparaît et les cartes arrivent du bord de l'opérateur. Ocre réservé à « à vous », rouge à l'arrêt ; jamais sans mot.

**Partition de mouvement.**
| Événement | Ce qui bouge | Durée, courbe | Sens | Mouvement réduit |
|---|---|---|---|---|
| un cut posé | une carte quitte la pioche, monte en arc, se retourne, se pose sur la pile ; le numéro de la pile change | 560 ms, cubic-bezier(.16,1,.3,1) | le lot tourne, au rythme d'un cut | le numéro change sans vol |
| un cut différé / à examiner | la carte vole vers la main (face cachée si différé), l'éventail se resserre (chaque carte glisse) | 560 ms ; reflux 450 ms même courbe | il reste quelque chose à regarder | l'éventail est à jour sans glissement |
| mise en pause | la carte du dessus de la pioche se soulève et s'incline, puis ne bouge plus | 420 ms, même courbe | la prochaine attend | carte posée levée |
| arrêt | une bande rouge « arrêté » se déroule en travers de la pioche | 300 ms | arrêté, rien ne part | bande posée |
| incident / alerte / reprise | une carte ocre part de la pioche, vient au centre, puis se balance lentement ; le bloc d'explication arrive « distribué » | 550 ms puis 2,8 s en boucle (± 1,5°) | à vous de jouer | carte posée, sans balancement |
| relecture | les deux cartes du dessus de la pile se feuillettent | 1,8 s en boucle, ease-in-out | Ariane relit, ne pose rien | pile immobile, mot « relecture » |
| fin | la pioche s'efface en pointillé, la pile se rassemble | 300–500 ms | tout est donné | état final |
| Écho : une pose vue | une carte monte du bord bas vers la pile | 560 ms | l'opérateur joue, Ariane regarde | numéro à jour |
| ouverture de « Ce qui reste » | les lignes tombent et s'étalent en cascade (40 ms) | 450 ms | la main s'étale en liste | liste posée |
| second appui sur « Arrêter » | le bouton s'élargit sur toute la ligne, devient rouge plein | 280 ms | confirmation | bouton rouge posé |
Les vols ne se jouent que si exactement un cut vient d'être traité dans le même lot (jamais au changement de scène) ; la table est conservée (`data-garder`), le rendu du moteur toutes les 0,9 s ne la redessine pas.

**Pourquoi sans filiation.** Partie d'une feuille blanche : aucun fichier d'Ariane ni d'une autre maquette ouvert ; la métaphore vient du bloc Card Dealer et de piles de cartes de 60fps.
**Ni voie ni nuage.** Des cartes à jouer sur une table : aucun rail, aucune voie, aucun nuage de points (la coupe n'apparaît que dans « Examiner », comme un relevé fonctionnel).

**Autocritique (ce qui peut encore faire « vibe codé »).** Le dos de carte hachuré est un motif décoratif reconnaissable ; les numéros des petites cartes de l'éventail sont en partie couverts (on lit le cut dans la liste) ; la métaphore « jeu » peut sembler ludique pour un outil de production ; à 360 px la table est serrée.

**Vérificateur.** 4 518 textes mesurés, contraste minimal 5,87:1, 0 écart, 0 erreur de console (20 scènes × 2 thèmes × 3 largeurs). Deux tours de raffinement (formes mesurables, éventail adaptatif à la largeur, étiquettes raccourcies, pile en Écho).
