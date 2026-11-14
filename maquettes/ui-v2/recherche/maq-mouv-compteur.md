# Maquette mouv-compteur (« Le compteur »)

**Logique.** Un compteur mécanique est la seule signalétique : ses tambours roulent d'un cran à chaque cut, un cliquet tombe en pause, une barre les bloque à l'arrêt, un seul tambour hésite quand Ariane attend l'opérateur, et tous font un tour complet à la fin.

**Références.** 60fps.design Number Flip with Reflection, Circle Wallet Claim Balance, Revolut Number of Transactions (le chiffre neuf roule, les autres restent), Tactile Button (le bouton qui s'enfonce sur sa tranche) ; beui.dev Number Animation (code lu : colonne 0–9 par chiffre, repérée par son rang depuis la droite, `clip-path` qui garde la ligne de base, pas de décalage entre chiffres sur les mises à jour) ; guide beui (ressort court pour un objet qui se pose).

**Sens des signes.** Tambours = valeurs ; « traités / cut / restent » ; cadre pointillé « total inconnu » ; cliquet noir contre le tambour des unités + mot « en pause » ; barre rouge à travers les tambours + mot « arrêté » ; mot ocre « à vous » ; police à chasse fixe, monochrome, couleur seulement pour « à vous » et « arrêté ».

**Partition de mouvement.**
| Événement | Ce qui bouge | Durée, courbe | Sens | Mouvement réduit |
|---|---|---|---|---|
| un cut traité | le tambour des unités de « traités », de « cut » et de « restent » roule d'un cran (9→0 roule vers l'avant, 0→9 vers l'arrière) | 500 ms, cubic-bezier(.34,1.35,.55,1) (léger dépassement) | le lot tourne | chiffres posés |
| pause | le cliquet descend et se cale incliné contre le tambour | 450 ms, ressort (.34,1.45,.5,1) | la prochaine avance attend | cliquet posé |
| arrêt | une barre rouge se trace en travers des grands tambours | 350 ms, (.16,1,.3,1) | bloqué | barre posée |
| incident / alerte | seul le tambour du cut oscille de quelques pixels, sans avancer | 1,9 s en boucle, (.77,0,.175,1) | hésite : à vous | immobile, mot « à vous » |
| relecture | le tambour du cut défile en continu | 3,6 s par tour, linéaire | relit sans compter | immobile, mot « relecture » |
| fin | chaque tambour fait un tour complet, en cascade de 70 ms, puis se pose | 1,1 s | terminé | valeurs finales |
| Prêt : bornes changées | les tambours « premier / dernier / cuts » roulent vers la nouvelle valeur | 500 ms | le lot préparé change | posés |
| Écho | « poses vues / d'accord / dernière » roulent à chaque pose vue | 500 ms | Ariane observe | posés |
| appui sur un bouton | la face s'enfonce de 3 px sur sa tranche | 100 ms | appui reçu | sans déplacement |
Les tambours sont un élément conservé ; leurs transitions CSS ne sont jamais coupées par le rendu périodique.

**Pourquoi sans filiation.** Aucun fichier d'Ariane ni d'une autre maquette ouvert ; compteur construit à partir des colonnes de chiffres de beui.dev et des compteurs de 60fps.
**Ni voie ni nuage.** Un instrument à tambours chiffrés : aucune voie, aucun rail, aucun point de relevé.

**Autocritique.** La chasse fixe sur des phrases longues élargit le texte et fait passer à la ligne à 360 px ; le cliquet est une forme inventée que l'opérateur doit apprendre (le mot la confirme) ; l'écran ressemble un peu à un tableau de bord rétro.

**Vérificateur.** 4 392 textes, contraste minimal 6,20:1, 0 écart, 0 erreur. Raffinement : bascule mesurable (cadre au lieu d'un fond plein), cliquet déplacé contre les unités, barre d'arrêt amincie pour laisser lire les chiffres, lien sans tranche.
