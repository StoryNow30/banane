# CH-124 : réglage figé de N+ (reprise sur le pool restreint à l'ancre)

Écrit et poussé **avant tout rejeu de N+**. Réglage séparé de N (`reglage-fige.md`, inchangé ; `ancre.patch` inchangé, empreinte `214e55aa…`).
N+ est un incrément : `ancre-reprise.patch`, appliqué après `ancre.patch`. Levier coupé par défaut (`ancre.reprise` faux) ; au banc : `BANC_LEVIERS={"ancre":{"reprise":true}}`.

## 1. Ce que fait N+
Quand N refuse la pose d'un cut (milieu à plus de θ de l'axe prédit), la GCV2 redécide ce cut, une fois :
- **Pool restreint à l'ancre.** Pour chaque rail, une hypothèse dont le décalage en travers sort de la fenêtre de l'ancre reçoit une probabilité nulle. Fenêtre d'un rail = positions où ce rail peut être si le milieu de la paire est à θ au plus de l'axe et l'écartement dans le contrat de la GCV2 (1 420 à 1 470 mm) : axe ± demi-écartement admissible ± θ. C'est la projection par rail de la condition « paire dont le milieu est à moins de θ de l'axe ».
- **Lot nettoyé pour cette décision seulement.** Appuis, voisins et poses transportées du lot à cet instant, sans ce cut et sans ceux dont l'ancre refuse la pose (un voisin pour lequel l'ancre se tait est gardé).
- **Mêmes gardes que le livré au même endroit.** La pose n'est faite que si la GCV2 la **valide** (jamais « poser sans valider »), qu'elle est commandable, et qu'elle passe : au premier passage, la confrontation à la recherche large (différée → différé ; remplacée → la pose de remplacement, comme le livré) ; à la deuxième passe, la garde A (appuis normaux sans ceux que l'ancre refuse) puis la recherche large en mode « différer ».
- **Contrôle final.** Le milieu de la pose retenue doit être à θ au plus de l'axe. Sinon, et dans tous les cas d'échec ci-dessus, le cut reste différé (source `ancre`), comme sous N.

## 2. Ce qui est figé
Aucun nombre nouveau, rien à choisir : θ = 75 mm, a = 4 m, w = 14 m et les règles de silence sont ceux de N ; le contrat d'écartement et les seuils sont ceux de la GCV2 livrée. Là où l'ancre se tait, il n'y a ni refus ni reprise.

## 3. Ce que N+ ne change pas (sans ricochet)
Rien de ce que le lot retient n'est changé par la reprise : la pose refusée reste appui, voisine, transport, mémoire de grappe et compte de la deuxième passe, comme sous N. La pose reprise n'entre dans aucun de ces états. Tous les autres cuts gardent donc la décision du livré. La deuxième passe n'écrit pas un cut de plus que le livré (la reprise prend la place de l'écriture refusée ; plafond de 10 inchangé). Ariane n'envoie jamais SKIP ; un cut non repris reste différé, non validé.

## 4. Jugement (même ordre et même critère R6 que N)
1. **Garde d'octobre d'abord (R1, R6).** Chaque reprise posée est jugée contre la vérité d'octobre (pire rail, 3D). Garde verte si : aucun cut changé hors des cuts refusés par N ; les cuts refusés sont les mêmes que sous N ; **aucune reprise posée à plus de 50 mm de la vérité**.
2. **Corpus ensuite**, mêmes conditions, tableau par lot ; chaîne et ricochets comptés à part (R3 : attendu 0 ricochet).
3. **Décision, écrite avant de voir un résultat.** N+ n'est proposé que si, garde et corpus réunis : 0 reprise posée à plus de 50 mm de la vérité, et au plus une reprise jugée sur dix à plus de 10 mm de la vérité. Sinon N reste seul. Le gain compté de N+ est le nombre de refus reposés justes (à 10 mm au plus), c'est-à-dire de cuts rendus à l'opérateur en moins.
4. Parité banc / service worker seulement si N+ est retenu (l'incrément du service worker n'est écrit qu'alors).

## 5. Empreintes
Patchs régénérés le 14/11 sur le tronc fusionné (4d9a77d), avant tout rejeu de N+ : mêmes lignes ajoutées et retirées, seul le contexte change.
- `ancre.patch` (N) : sha256 `55c63f314ac2c379dff3c9eeed9aae60a4a9f65bf6d6517198d5895bc868467c` (ancien arbre : `214e55aa…`).
- `ancre-reprise.patch` (N+, incrément) : sha256 `a54ffbf696d4c8bd7b04dd6f927ac3ddea1c25e4e1eeb5ed46c79865b1e7e77e` (ancien arbre : `dfbec7d7…`).
- Jugements : `BANC_ZONES=journal`, passe livrée avec `BANC_PASSE_PLAFOND=10`, référence « livré » rejouée de même. Une reprise faite à la deuxième passe est une pose de la passe comme une autre : elle compte dans les 10 écritures et n'est pas écrite si la vue devait bouger.
Essais : `tests/ch124-ancre.test.cjs`, 13 sur 13 (4 nouveaux pour N+, rouges sur l'état N, verts ensuite). Contrôle géométrique sans décision ni vérité, sur 104 cuts réels de trois lots : la paire au milieu des deux fenêtres tombe sur l'axe prédit (0,07 mm au plus) à 1 445 mm (0,15 mm au plus).
