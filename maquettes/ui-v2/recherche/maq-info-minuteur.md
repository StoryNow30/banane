# Maquette info-minuteur — « Minuteur à secteur »

Fichier : maquettes/ui-v2/sources/info-minuteur.html. Police : B612 + B612 Mono.

## Logique en une phrase
Le temps qui reste se lit comme sur un minuteur à secteur : un cadran de 60 minutes dont le secteur plein vaut les minutes restantes et rétrécit vers midi ; trois sous-lectures (traités, différés, à examiner) dessous.

## Références et ce qui en est pris
- Horlogerie, minuteurs (article « Egg timer ») : compte à rebours sur cadran de 60 minutes ; une surface qui diminue se juge de loin sans lire de chiffre.
- Écran de vol principal : un instrument central lu d'un seul regard, lectures secondaires autour.
- B612 (README du dépôt public) : police testée pour les écrans de cockpit.
- beui Motion Guides : progression linéaire ; réduit = garder le changement, retirer la course.
- WCAG 1.4.11 (secteur et graduations ≥ 3:1), 1.4.1 (minutes aussi écrites au centre).
- Radix sage / indigo / amber / red.

## Sens des signes
- Secteur indigo plein = minutes restantes, lot en marche. Secteur hachuré = temps qui ne s'écoule pas (pause, arrêt, ou durée estimée avant lancement).
- Cadran vide avec cercle pointillé = temps inconnu (rien de deviné). Cadran vide = terminé ou relecture.
- L'indigo est réservé au temps ; il ne dit ni « bien » ni « mal ». Incidents : encadré avec étiquette écrite (« À FAIRE », « À REGARDER », « ARRÊT »).
- Sous-lectures : ▲ + fond ambre quand différés ou posés à examiner attendent (après le lot).
- Le disque porte un sens écrit (des minutes) : ce n'est pas un anneau décoratif.

## Pourquoi sans filiation
Instrument issu de l'horlogerie et du cockpit ; aucune interface d'Ariane ni autre maquette consultée. À signaler : le dépôt contient une maquette d'une autre série nommée « instr-cadran », que je n'ai pas ouverte (contrat) ; l'intégrateur jugera d'un éventuel recoupement.

## Pourquoi elle n'illustre ni une voie ni un nuage
Elle dessine un cadran de minutes, objet d'horlogerie : aucune voie, aucun point.

## Partition de mouvement
| Événement | Ce qui bouge | Durée, courbe | Sens | Mouvement réduit |
|---|---|---|---|---|
| Chaque lecture (≈ 0,9 s) | le secteur (cadran conservé `data-garder`) rétrécit | 900 ms, linéaire | le temps s'écoule à vitesse constante | le secteur saute d'une lecture à l'autre |
| La minute affichée change | le chiffre central descend de 30 % en apparaissant | 300 ms, (0.16, 1, 0.3, 1) | une minute de moins | chiffre changé sur place |
| Pause / arrêt | le secteur passe en hachures, le centre fond | 220 ms | le temps est figé | sur place |
| Changement d'état | centre du cadran et titre fondent | 220 ms | la lecture a changé | sur place |
Mesuré sur 9,5 s : `stroke-dasharray` 179 échantillons (rétrécissement continu), `minute` 6, `fondu` 20 ; réduit : aucune.

## Journal des tours
- r0 : 54 écarts (graduations SVG mesurées sur leur remplissage noir par défaut) → `fill:none`.
- r1 : phrase sous le cadran qui répétait les minutes ; liste « Ce qui reste » qui répétait « Différé ».

## Ce qui pourrait encore faire « vibe codé »
- Un cadran rond est un motif fréquent ; il n'est justifié ici que par la lecture du temps à distance.
- Au-delà de 60 minutes, le secteur reste plein : il faudrait une marque « + 1 h » pour les très longs lots.

## Chiffres du vérificateur
info-minuteur : 6 144 textes mesurés, contraste minimal 5,24:1, **0 écart, 0 erreur de console**.
