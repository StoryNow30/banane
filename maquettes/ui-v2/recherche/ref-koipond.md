# Référence : dépôt haplollc/koipond (lecture seule)

Lu le 29/10 : README en entier, **tout le code** (3 753 lignes Swift + Metal) : `KoiPond.swift`, `KoiPondFrame.swift`, `Pond/KoiPondEffect.swift`, `Pond/KoiPondFloor.swift`, `World/KoiPondWorld.swift` (1 045 lignes, lu intégralement), `World/KoiScript.swift`, `World/KoiLook.swift`, `World/Haptics.swift`, `Art/KoiArt.swift`, `Art/PondLayers.swift`, `Art/SurfaceArt.swift`, `Recording/KoiPondTake.swift`, `Shaders/KoiPond.metal` ; démo (`DemoView`, `ModePicker`, `DemoConfig`, `KoiPondDemoApp`) ; tests parcourus (titres et commentaires). Images extraites des animations `assets/switch.webp`, `feed.webp`, `banner.webp` (regardées).

## Comportement (ÉTABLI, lu dans le code)
- **Une horloge** : `advance(to:)` avance le monde par pas fixes de 1/120 s, rattrapage plafonné à 0,25 s ; tout est fonction de cette horloge, ce qui permet de ralentir une prise et d'enregistrer image par image (`KoiPondTake`, `pace`).
- **Carpes** : le cap dérive lentement (`sin(seed + t·0,31)·0,28 + …`) ; les rives repoussent (marge étroite, sinon « penned a school against the bank ») ; elles se gardent de la place, se dispersent après avoir mangé ; la nourriture attire fort et elles ralentissent en approchant pour ne pas tourner autour ; un doigt à moins de 130 pt les fait fuir (vitesse 70 à 130) ; le corps est une corde dont chaque articulation ne plie pas plus de 0,11 rad ; chaque coup de queue laisse un petit tourbillon d'un côté puis de l'autre.
- **Nénuphars** : dérive d'un courant lent, se repoussent, poussés par les anneaux qui passent, soulevés et tournés par les carpes dessous ; un doigt les écarte.
- **Ondes** : anneau à 72 pt/s, bande de 20 pt, vie 3,2 s, atténuation `exp(-âge·0,95)` ; faible à son propre centre (`smoothstep(0, width, r)`) pour ne pas tordre ce qui est dessous ; au plus 96 anneaux, les plus vieux tourbillons partent d'abord.
- **Réfraction** : le fond est lu à travers la pente, décalage saturé en douceur (`30·tanh(-bend·depth/30)`) « a hard clamp… tears whatever is under them into spikes » ; caustiques, teinte par profondeur, rives assombries, reflets du soleil.
- **Bassin ⇄ piscine** : un ressort critique (ω = 5,5) fait passer `poolMix` de 0 à 1 en environ une seconde, sans à-coup au départ ; **ce qui part a disparu avant la moitié, ce qui arrive n'entre qu'après** (`smoothstep(0,12…0,55)` et `smoothstep(0,45…0,88)`) pour ne jamais voir les deux mondes l'un à travers l'autre ; le sol carrelé n'arrive qu'au milieu ; les flotteurs atterrissent 0,45 s après la bascule avec un anneau fort.
- **Le sélecteur de la démo** (`ModePicker`) : son curseur est placé par `poolMix`, l'horloge de l'étang, pas par l'animation système ; le mot change de couleur à mesure que le curseur le recouvre (masque), pas d'un coup à mi-course.
- **Accessibilité** : nénuphars, canard et bouée sont des éléments accessibles nommés là où ils sont ; le décor est caché aux lecteurs d'écran ; haptique légère au toucher.
- **Mouvement réduit : AUCUN traitement dans le code** (ÉTABLI : aucune occurrence de `reduceMotion` ni `accessibilityReduceMotion` hors tests). C'est un manque de la référence ; je ne le reproduis pas.

## Ce que j'en retiens pour Ariane (sans carpes ni nénuphars : une autre maquette de la série les emploie)
1. **Une seule horloge locale qui pilote tout**, conservée d'un rendu à l'autre (élément `data-garder`) : le rendu du moteur toutes les 0,9 s ne doit jamais redémarrer le mouvement.
2. **Bascule par ressort critique** : un état qui change glisse en ~1 s sans à-coup ; **ce qui part disparaît avant la mi-course, ce qui arrive après** : deux états ne sont jamais lisibles en même temps.
3. **Anneau d'événement** : chaque événement (un cut posé, différé) laisse une trace brève qui s'éteint en 1 à 3 s ; la densité des traces dit le rythme. Une onde plafonnée « en douceur » plutôt que tronquée.
4. **Un contrôle placé par l'état réel** (le curseur suit `poolMix`) : le sélecteur Orbite/Écho glisse avec la transition, pas avant.
5. **Le comportement dit l'état** : fuite (un doigt), regroupement (nourriture), dispersion (repos). Une surface vivante peut dire « travaille », « attend », « arrêté » par la façon dont ses éléments se meuvent.

## Ce que j'écarte
- Carpes, nénuphars, eau, réfraction, caustiques : signes déjà pris par une autre proposition, et métaphore de bassin hors du métier.
- Le canard et la bouée : décor ludique.
- L'absence de mouvement réduit : je la corrige dans mes maquettes.
