# Maquette info-allure — « Allure du lot »

Fichier : maquettes/ui-v2/sources/info-allure.html. Police : Libre Franklin.

## Logique en une phrase
Le panneau répond d'abord à « le lot ralentit-il ? » : une phrase avec flèche et signe, une courbe de cadence (cuts par minute par paquet de 10) avec sa médiane, et un axe du temps du lot (début, maintenant, fin estimée) qui porte les événements.

## Références et ce qui en est pris
- beui Sparkline (tuile chiffre + variation signée + courbe finie par un point), Status Bar (événements sous l'axe, ici avec forme), Timeline (début et fin datés), Line Chart.
- swiftpieces ScrubChart / LiveStat : pas d'axe vertical, une seule référence, point « maintenant ».
- Skill dataviz : une série = pas de légende de série ; trait de 2, grille fine pleine ; première et dernière étiquette gardées ; texte en encre ; grand chiffre en chiffres proportionnels ; regarder le rendu (collision d'étiquette corrigée).
- Carbon, indicateur différentiel : flèche ou signe obligatoire, couleur facultative.
- Laws of UX : gradient d'objectif, Doherty.
- Radix olive / blue / amber / red ; Libre Franklin.

## Sens des signes
- Courbe = cadence ; trait fin = médiane du lot (valeur dans la légende) ; point bleu = dernier paquet mesuré ; trait vertical bleu = maintenant.
- Flèche bas + « − » : ralentit (≥ 10 % sous la médiane) ; flèche plate : stable ; flèche haut + « + » : accélère. Pas de couleur : une tendance n'est pas une alarme.
- Rond creux sur l'axe = différé ; carré plein = posé à examiner ; hachures = reste à faire.
- En pause ou arrêté : pas d'heure de fin (« cuts restants, pas d'heure de fin ») ; la phrase devient « Avant l'arrêt : … ».
- Total inconnu : l'axe s'arrête à maintenant, « fin inconnue ».
- Série de démonstration calculée depuis les différés du moteur fictif ; dans le produit, la cadence serait mesurée (dit dans les notes).

## Pourquoi sans filiation
Composition tirée des composants de données consultés (beui, swiftpieces) et des règles dataviz ; aucune interface d'Ariane consultée.

## Pourquoi elle n'illustre ni une voie ni un nuage
Elle montre une courbe de cadence et un axe du temps : des données, pas d'image de voie ni de points relevés.

## Partition de mouvement
| Événement | Ce qui bouge | Durée, courbe | Sens | Mouvement réduit |
|---|---|---|---|---|
| Un paquet de 10 cuts est complet | le dernier segment de courbe se trace, puis le point « maintenant » apparaît | 700 ms linéaire, puis 260 ms | une mesure de plus ; progression = linéaire | la courbe change d'un coup |
| L'allure change | la phrase fond | 260 ms, ease-out | la réponse à la question a changé | sur place |
| Changement d'état | titre et chiffres de tête entrent | 220 ms | la lecture a changé | sur place |
Seuls les paquets complets comptent : la courbe et la phrase changent une fois tous les 10 cuts, jamais à chaque cut (corrigé au tour 3 : un fondu permanent violait « un seul mouvement à la fois »). Mesuré sur 14 s : `trace` 14, `pose` 17, `fondu` 6 ; réduit : aucune.

## Journal des tours
- r0 : marque « différé » mesurée contre son propre remplissage → contour séparé.
- r1 : heure de fin affichée sur un lot arrêté (pire : faux de sens) ; courbe écrasée (échelle depuis 0) ; bouton Écho bloqué qui paraît actif ; légende Écho mal coupée.
- r2 : « vers 10:00 » sur l'axe en pause ; heure de fin en relecture.
- r3 : phrase qui changeait à chaque cut (paquet partiel) ; étiquette « médiane » barrée par la courbe.

## Ce qui pourrait encore faire « vibe codé »
- Le seuil de ± 10 % pour « ralentit » est arbitraire tant qu'il n'est pas calé sur des lots réels.
- Les heures sont fictives (départ à 09:40) ; la courbe en dents de scie peut inquiéter à tort sur des petits paquets.

## Chiffres du vérificateur
info-allure : 7 260 textes mesurés, contraste minimal 4,77:1, **0 écart, 0 erreur de console**.
