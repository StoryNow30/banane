# Maquette instr-cadran (« Cadran »)

**Logique en une phrase.** Le lot se lit comme un thermostat posé sur le bureau : l'arc allumé est ce qui est fait, le chiffre au centre ce qui reste, et la face ne se remplit d'ambre que quand Ariane a besoin de vous.

## Références et ce qui en est pris
- Scrubbers, `ThermostatFace.swift` : 300° de graduations (90 traits, ouverture en bas), traits allumés jusqu'à la valeur, long trait pour la valeur, face qui ne change de teinte qu'en sortant de la zone calme et en partant du centre (évite la teinte boueuse). Ici : arc = cuts traités, long trait = cut en cours, remplissage ambre = attente de l'opérateur.
- Scrubbers, `Scrubber.swift` (correspondance angulaire, angle déroulé) et `ScrubberScale.swift` (crans) : en PRÊT, on tourne le cadran pour régler le dernier cut ; le doigt glisse sans cran, le relâché se pose au cran de 10 cuts ; flèches du clavier = ±10.
- Scrubbers, `RulerFace.swift` : cloche gaussienne de traits autour de l'aiguille ; ici elle gonfle à l'arrivée de chaque cut puis retombe.
- libraries.dev, voice-glow (`voiceDriver.ts`) : enveloppe attaque immédiate / relâche lente pour ce gonflement.
- libraries.dev, bot-avatars (`engine.ts`) : transitions plus lentes vers le repos que vers le travail.

## Sens des signes
- Trait allumé = cut traité ; long trait = cut en cours ; trotteuse seule sans arc + mots « total inconnu » = total inconnu (rien n'est deviné).
- Cran triangulaire hors de l'anneau = différé ; rond creux = vert à examiner (mêmes formes dans les compteurs et la liste).
- Face graphite = Ariane tourne seule ou rien n'est en jeu ; face ambre + mot dans la fenêtre (« Arrêté », « Alerte ») + triangle dans le bloc = besoin de vous ; traits à demi-éteints + « En pause » = pause.
- Fenêtre centrale en verre sombre constant : la lecture ne change jamais de contraste, quel que soit le régime de la face.
- File : un petit cadran par partie, plein (faite), entamé (en cours), vide (à venir).
- Relecture : l'aiguille repasse lentement sur toute la partie (« un relecteur »).

## Partition de mouvement
| Événement | Ce qui bouge | Durée, courbe | Sens | Mouvement réduit |
|---|---|---|---|---|
| Arrivée d'un cut | arc +1 trait, aiguille, cloche de traits, chiffre central qui roule | ressort réponse 0,34 s amort. 0,82 ; cloche relâche 0,45 s ; roulement 0,28 s | « un de plus, il en reste un de moins » | arc et chiffre posés d'un coup |
| Prêt → en cours | l'arc s'allume depuis zéro jusqu'à la part faite | ressort 0,34 s | mise en route | arc posé |
| En cours → pause | traits à 45 %, face rétrécit de 1,5 % | 0,25 s linéaire / 0,5 s | rien ne bouge, retenu | état final direct |
| → arrêté / alerte | ambre qui s'étend depuis le centre de la face | 0,55 s, courbe à léger dépassement | Ariane vous attend | face ambre directement |
| → fin | arc complet, aiguille au bout | ressort 0,34 s | terminé | posé |
| Relecture | aiguille qui balaie 0 → 1 → 0 | 3,2 s par passage, ease-in-out | relit la partie | aiguille fixe |
| Écho, geste vu | cloche autour de l'aiguille, arc = part d'accord | enveloppe 0,45 s | Ariane a vu un geste | arc posé |
| Alerte / bloc / titre qui apparaissent | translation 6 px + fondu | 0,35–0,4 s, décalés de 50 ms | nouvel état | aucun |
| Ouverture de la liste | lignes entrent l'une après l'autre | 0,3 s, 30 ms de décalage, seulement au changement de vue | la liste se déplie | aucun |
| Geste sur le cadran | lecture en direct, relâché au cran de 10 | ressort 0,34 s | réglage tactile | crans par clavier |
| Bascule Orbite/Écho | curseur qui glisse | 0,34 s, léger dépassement | changement d'activité | direct |
Les animations rejouées à chaque rendu (≈ 0,9 s) sont évitées : le cadran est conservé (`data-garder`) et animé par un ressort JS, les chiffres utilisent `data-valeur`, les entrées se déclenchent sur `data-etat-change="1"`, le message seulement quand son texte change.

## Pourquoi sans filiation
Feuille blanche : je n'ai ouvert ni `src/` ni aucune autre maquette ; la forme vient du thermostat (instrument domestique) et de la règle de Scrubbers.

## Pourquoi ni voie ni nuage
Un cadran rond gradué ne figure ni voie, ni rail, ni relevé ; la seule coupe montrée est le profil fonctionnel de la vue « Examiner ».

## Autocritique
- Le cadran est grand (300 px) : à 360 px, les touches passent sous la ligne de flottaison en EN COURS avec file ; on pourrait le réduire quand la file est allumée.
- La face sombre en thème clair est un objet fort ; peut sembler « gadget » si le reste du panneau n'est pas aussi tenu.
- Les marques de différés hors de l'anneau se chevauchent quand il y en a beaucoup au même endroit.
- Le titre d'état apparaît deux fois (fenêtre et lecture accessible) : le titre visible a été retiré, seul le mot de la fenêtre reste.

## Vérificateur
`instr-cadran : 7416 textes mesurés, contraste minimal 5.63:1, 0 écarts, 0 erreurs de console` (20 scènes × 2 thèmes × 3 largeurs). Jeu complet (lancer, pause, continuer, arrêter en 2 appuis, Écho, reste, examen, relecture) : 0 erreur ; geste de rotation : fin 379 → 439 (cran de 10).
