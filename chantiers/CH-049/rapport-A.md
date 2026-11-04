# CH-049-A — visites partielles et état initial (Écho, 04/11, version 5)

Données : collection `2026-11-04_v5_echo-manuel-parties-10-13-14-15` (parties 13-14-15 : 280 visites, 527 captures ; partie 10 : 22 visites). Outil : `chantiers/CH-049/analyse-fins-capture.cjs`.

## Mesuré (ÉTABLI)
- **Les 61 % de visites partielles ne sont pas des pertes de capture.** 165 des 172 partielles ont pour seule raison `operator-decision-not-observed` : l'opérateur est passé sans valider (visites de 0,5 à 2 s, cuts survolés ou marqués vus). Sur les 115 visites avec référence humaine finale : 108 complètes, 7 partielles. Partie 10 : 18 complètes sur 19 avec référence.
- **Cuts validés (parties 13-14-15) :** rail gauche qualifié 97/115 (84 %), droit 85/115 (74 %), paire 70/115 (61 %). Les « 55 % d'état initial qualifié » comptent aussi les visites sans validation, qui n'ont pas à être apprenables. Partie 10 : paire 12/19.
- **Pertes des 48 rails validés non qualifiés :** 32 ont une 1re capture en CLIP_CHANGED ; 15 ont une couverture trop faible malgré des points sauvegardés (ROI ou flanc interne trop peu fourni) ; 5 sont acquis après le geste de l'opérateur ; 2 ont plusieurs intentions.
- **CLIP_CHANGED (95) :** tous sont la 1re capture d'une visite (début à +1 ms). ESV déplace sa découpe juste après le changement de cut. 42 finissent en moins de 50 ms, 53 après 300 à 950 ms de lecture jetée (2 200 à 3 200 points retenus puis perdus, aucun point sauvegardé), car la découpe n'était comparée qu'à un checkpoint de 2 048 points. La capture suivante démarre 2 ms après.
- **RAIL_STATE_CHANGED (70) :** 56 sur 70 suivent un clic de l'opérateur de moins de 70 ms (médiane) ; 42 des 95 secondes captures (après CLIP_CHANGED) sont coupées ainsi, l'opérateur atteignant le rail 0,6 à 1,2 s après l'arrivée. L'arrêt sur geste est voulu (4.7.4) : pas touché.
- **TARGET_CHANGED (80) :** toutes finissent après la fin de visite (visite médiane 0,9 s). Cuts survolés, rien à gagner.
- **RESOURCE_LIMIT (37) :** 36 par le budget de 500 000 points, 1 par le temps ; 34 sur 37 ont des points sauvegardés. Pas un levier de visites complètes.
- Cadence : la décision tombe en médiane à 2,2 s de l'arrivée, le 1er checkpoint qualifié en 3 à 6 ms (nœuds déjà chargés) ou 333 à 536 ms (autres).

## Livré
- `src/native-lidar.js` : la découpe est comparée à chaque pause de lecture, plus seulement à un checkpoint (même code CLIP_CHANGED, rien de révoqué). Essai `tests/native-lidar-clip-precoce.test.cjs` (rouge : 12 pauses de retard ; vert). Les 10 fichiers d'essais native-lidar*, native-page*, native-capture-camera passent. Aucun fichier interdit touché ; pas de patch nécessaire.

## Non mesuré
- Le gain en visites complètes : l'export ne dit pas quand la découpe bouge. **SUPPOSÉ** : au plus 32 rails sur 48 concernés. À mesurer sur la prochaine séance Écho (temps de lecture jetée, part de 1res captures en CLIP_CHANGED).
- La cause des 15 couvertures trop faibles (nuage clairsemé ou nœuds pas encore chargés) : **PROBABLE** nœuds non chargés, non établi.
- Piste non essayée : garder les points lus sous l'ancienne découpe en les reclassant (visibilité recalculable), au lieu de relire. Plus risquée (la découpe fait partie de ce qui est chargé, 4.7.3) ; décision de l'intégrateur.
