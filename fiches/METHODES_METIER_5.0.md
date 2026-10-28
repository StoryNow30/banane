# Méthodes métier à apprendre à Ariane en Orbite (5.0) : notes de départ

Statut : **notes de cadrage**, pas une spécification. Source : règles données par l'opérateur à un opérateur en formation (conversation « Formation opérateur ADV et validations », 12 et 13 octobre 2026, branche de sortie `claude/gracious-gauss-x3zc8s`) et mesures hors ligne des parties 17 (Écho du 14 octobre) et 20 (Écho du 23 septembre). Les captures d'écran de la conversation n'ont pas été relues. Aucune donnée de partie dans ce dépôt.

## 1. Règles métier (opérateur humain)

Principe : **un cut vert n'est pas forcément juste.** Il faut juger la coupe (profil sur le champignon et sur le patin), pas seulement les chiffres. Signaux d'alerte : écartement éloigné de 1435 mm (exemple : 1480 mm en ADV), nuage de points diffus, profil qui ne touche rien.

| Zone cible | Pourquoi | Marge à traiter |
|---|---|---|
| ADV (appareil de voie) | plusieurs rails proches : le profil se cale sur le mauvais rail, faux vert | plusieurs cuts avant la pointe d'aiguille et après la fin de l'appareil (nombre non fixé), puis chaque cut de l'appareil |
| Rouge isolé (invalide) | un invalide est rarement seul : faux verts avant ou après | 1 à 2 verts de chaque côté, élargir si un voisin est douteux |
| Série de rouges | idem | toute la série, puis 2 à 3 verts de chaque côté |
| Passage à niveau (PN) | rail noyé dans le revêtement, le profil décroche | tous les cuts du PN sans trou, plus 2 à 3 cuts avant l'entrée et après la sortie |

Ces marges (±1 à 3 cuts, parfois plus) sont ce que l'opérateur décrit pour Ariane : « ± 5 cuts, parfois 20 » dans les zones cibles.

## 2. Mesures hors ligne (D-098, D-099, D-100)

- Interpolation de la pose entre les deux voisins finalisés les plus proches (cuts espacés d'environ 1 m) : médiane 3 à 5 mm, P90 7 à 10 mm. Le voisin le plus proche seul est faux d'environ 1 m ; la régression sur plusieurs voisins est moins bonne.
- Sur les cuts différés par Ariane (partie 17) : 44 mm de pose de départ contre 4 à 6 mm par interpolation, quand les deux voisins posés sont à ±3 cuts.
- **Limite posée par les règles ci-dessus : les mesures n'ont pas séparé voie courante, ADV, PN et voisinage d'invalide.** Dans ces zones, un voisin posé peut être un faux vert : l'interpolation ne doit pas s'y appuyer sans vérification. Le résultat actuel vaut surtout pour la voie courante.

## 3. Première méthode candidate (à valider)

Hors zone à risque : interpoler un cut différé entre deux voisins posés à ±3 cuts ; ne rien poser au-delà ; ne pas toucher un cut déjà posé. Dans les zones à risque : revérifier et corriger les voisins (marges du § 1) ; méthode à concevoir.

## 4. Reste à faire en 5.0

1. Détecter les zones (écartement hors norme, nuage diffus, listes d'invalides, signature de l'ADV et du PN dans l'export) ; refaire les mesures du § 2 par zone.
2. Faire consigner à B1 en ombre la pose qu'il proposerait (aujourd'hui seulement ses appuis), pour juger sa précision.
3. Préciser avec l'opérateur : nombre de cuts de marge pour un ADV, sens des couleurs de l'outil, comment il reconnaît qu'une correction de voisins est bonne.
4. Rejeu avec les voisins posés par Ariane sur d'autres lots 4.9 ; ensuite seulement un essai en ombre sur le terrain.
