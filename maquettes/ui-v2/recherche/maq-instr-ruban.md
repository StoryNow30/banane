# Maquette instr-ruban (« Ruban »)

**Logique en une phrase.** Le lot est un ruban gradué qui défile sous une aiguille fixe, comme l'échelle d'une balance : à gauche ce qui est fait, à droite ce qui reste jusqu'au crochet de fin, et une onde qui roule sur la partie faite tant qu'Ariane pose.

## Références et ce qui en est pris
- Scrubbers, `TapeFace.swift` : on tire l'échelle, pas un bouton ; aiguille fixe ; grands traits au plus petit multiple (1, 2, 5, 10…) qui laisse ≥ 54 px ; traits moyens ; lecture en gros au-dessus de l'aiguille. Ici : l'échelle porte les vrais numéros de cuts.
- Scrubbers, `Scrubber.swift` / `ScrubberMotion.swift` : relâche « qui coule » puis se pose (ressort 0,62 s à peine rebondissant) ; le ruban avance ainsi d'un cut à l'autre.
- Scrubbers, `SquiggleFace.swift` : onde qui roule vers la poignée, amincie avant elle, couchée à plat en pause (0,6 s). Ici : onde = Ariane pose, onde à plat = rien ne bouge.
- Scrubbers, `SwingFace.swift` : étiquette portée par le curseur ; ici « cut 252 » accroché à la tête d'aiguille.

## Sens des signes
- Aiguille fixe = cut en cours (étiquetée) ; aucune aiguille en PRÊT = rien ne tourne.
- Crochets = premier et dernier cut ; sans dernier cut connu, les traits s'effacent et « total inconnu → » s'écrit au bout.
- Triangle sous le ruban = différé ; rond creux = à examiner.
- Tête d'aiguille carrée ambre + « Arrêté · à vous » / « Alerte » = Ariane attend votre geste ; triangle = en cours, carré = arrêt (forme + mot, jamais la couleur seule).
- Relecture : le ruban, vu en entier, repasse d'un crochet à l'autre sous l'aiguille.
- File : un tronçon de ruban par partie (plein, entamé, vierge).

## Partition de mouvement
| Événement | Ce qui bouge | Durée, courbe | Sens | Mouvement réduit |
|---|---|---|---|---|
| Arrivée d'un cut | le ruban avance d'un pas sous l'aiguille ; grand chiffre qui roule | ressort 0,62 s, amort. 0,9 ; roulement 0,26 s | un cut de plus | ruban posé au cut |
| Prêt → en cours | le ruban part de 6 cuts avant le premier et coule jusqu'au cut en cours ; l'aiguille apparaît | 0,62 s | mise en route | posé |
| En cours → pause / arrêt | l'onde se couche | 0,6 s (constante 0,2 s) | rien ne bouge | onde dessinée immobile |
| → arrêté / alerte | tête d'aiguille devient carrée ambre | immédiat avec le mot | à vous | idem |
| → fin | le ruban coule jusqu'au crochet de fin | 0,62 s | terminé | posé |
| Relecture | le ruban dézoome sur toute la partie puis va-et-vient | 6 s l'aller-retour, cosinus | relit | ruban fixe |
| Prêt : tirer un crochet | crochet sous le doigt, lecture en direct, cran de 10 au relâché, le ruban se recadre | ressort 0,5 s sur l'échelle | régler les bornes | flèches clavier |
| Liste | lignes glissent de 8 px depuis la gauche | 0,28 s, 25 ms de décalage, au changement de vue | relevé qui sort | aucun |
| Onglets Orbite/Écho | index souligné qui glisse | 0,32 s | activité | direct |
Ruban conservé (`data-garder`) et redessiné par une boucle JS ; rien ne redémarre au rendu périodique.

## Pourquoi sans filiation
Feuille blanche, aucune interface ni maquette existante ouverte ; le ruban est une balance / un mètre, pas un écran d'Ariane.

## Pourquoi ni voie ni nuage
C'est une règle graduée à une seule ligne de traits verticaux portant des numéros, avec une aiguille : ni deux files parallèles, ni traverses, ni points de relevé.

## Autocritique
- Une règle horizontale à traits réguliers pourrait encore évoquer une voie vue de dessus pour un œil prévenu ; les numéros, l'aiguille et l'absence de seconde ligne l'en éloignent, à surveiller avec l'opérateur.
- À 360 px, on ne voit qu'une vingtaine de cuts autour de l'aiguille : la position globale dans le lot passe par le chiffre « restent », pas par le ruban.
- Beaucoup de petits traits : peut paraître dense en sombre.

## Vérificateur
`instr-ruban : 7698 textes mesurés, contraste minimal 5.39:1, 0 écarts, 0 erreurs de console`. Jeu complet : 0 erreur ; geste sur le crochet de fin : 379 → 409.
