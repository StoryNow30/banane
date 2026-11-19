# Plan de développement d'Ariane 6 (**validé le 19/11/2026 — D-378** ; proposition du 18/11, D-373)

Demandé par l'opérateur avec la passation à OpenCode : « prépare aussi la passation complète vers opencode » ; « le plan de dev d'ariane 6 ». Ce plan était une **proposition** ; il a été **validé tel quel le 19/11/2026** (D-378) : ordre A → B → C → D, tronc `ariane6`, but chiffré du § 3. Les quatre points de la dernière liste du § 4 restent, eux, en attente d'une décision écrite. Il réunit ce que les décisions ont déjà renvoyé à Ariane 6 (D-272, D-273, D-320, D-357, D-360, D-368) et le donne à faire en chantiers bornés, au rythme du passage de la main à OpenCode (`fiches/PASSATION_OPENCODE.md`).

## 1. Ce qui ne bouge pas
- Les interdits de `CLAUDE.md` : aucune donnée de terrain ni nom dans `banane` ; jamais SKIP ; jamais un cut non résolu validé ; la deuxième passe écrit, plafonnée à 10 ; pas de réécriture d'historique ; aucun nom de modèle d'IA dans les fichiers ; l'adresse du relais hors dépôt.
- La méthode : essai rouge, code, essai vert ; la garde de pose et les parités pour tout module de décision ; un verify complet par version ; les examens vierges jamais lus en conception ; seulement du mesuré, qualifié.
- **À ne pas refaire** (D-357) : le panneau (au-delà de CH-137) et les petits leviers appris sur des lots déjà vus.

## 2. Avant Ariane 6 : finir la 5.0.x
- **Vision 21** (intégrateur actuel) : CH-137 (interface alternative « Mix », D-372) et CH-138 (compteur des cuts appris, D-371). Puis la 5.0 est gelée : seuls des correctifs du terrain y entrent.
- Décisions de l'opérateur en attente, à prendre avant ou pendant le lot A : réglages d'un poste à l'autre (`chrome.storage.sync`, ou export et import) ; redéploiement du relais ; tronc d'Ariane 6 (proposition : une branche neuve `ariane6` partie de la Vision 21, `claude/50-test17` gardé pour les correctifs de la 5.0).

## 3. Le but d'Ariane 6 (à valider)
Moins de cuts laissés à l'opérateur, sans une faute de plus. Cible déjà retenue (`fiches/RESEAU_IA.md` § 6) : les différés **sous 5 % des cibles d'un lot, puis sous 3 %**, mesurés sur des lots non vus, avec 0 mauvaise voie de plus et 0 pose juste perdue. Point de départ ÉTABLI : 603 différés sur 4 016 cuts du corpus avec le levier N (D-357, 15,0 %).

## 4. Les lots, dans l'ordre proposé
Chaque ligne est un chantier à ticket (`chantiers/CH-NNN.md`, écrit par l'intégrateur). « Qui » suit l'étape du passage de la main.

### Lot A : mesurer d'abord (semaine 1 à 2) — OpenCode exécutant
| Chantier | Quoi | Mesure de fin |
|---|---|---|
| A1 | **Règle « branche » de la deuxième passe** (D-368). Terrain des 16 et 17/11 : 6 poses de la passe au motif « branche » jugées, **4 fausses** (26 à 50 mm) ; « recherche-adv » : 7 sur 7 justes (`banane-data`, `collections/2026-11-17_v191_lot-et-echo/NOTES.md`). Mesurer sur tout le corpus, au banc fidèle, ce que donnerait « la passe ne pose plus sur branche ». | Tableau : poses de la passe par motif, justes et fausses, avant et après ; proposition chiffrée à l'opérateur. Aucun code livré dans A1. |
| A2 | **L'ancre muette sur le terrain** (D-357 : décide de l'ordre de B). Sur les exports des Visions 18 à 21 : part des lots et des cuts où N n'a pas de liste d'ESV, donc se tait. | Pourcentage par lot, par script dans `banane-data/outils/analyse-lots/`. |
| A3 | **Trois inconnues de la 5.0** : la page d'ESV muette 3 min après le Maj+Espace du cut 2475 (17/11) ; la cause des essais fragiles (CH-028, CH-110, ch104, molette du Cadran) ; Glacier, la vue fil et Mix jamais tournés dans Chrome à côté d'ESV (relevé de l'opérateur). | Cause établie ou « non trouvée » écrit, pour chacune. |
| A4 | **Ce qui pèse le plus à l'opérateur** (D-357) : temps de relecture par cut et par lot (jamais mesuré), cuts posés à la main, durée des lots. | Trois chiffres mesurés sur ses exports. |

### Lot B : un seul code de décision (semaine 3 à 4) — intégrateur, relecture froide
Direction (b) de D-357. Aujourd'hui le banc (Node) et l'extension (service worker) décident chacun avec leur copie du calcul ; chaque levier coûte une parité, et un défaut peut être invisible au banc. Faire charger les **mêmes** modules de décision par le banc et par le service worker, **sans changer une seule décision** : sorties du corpus entier identiques, cut par cut, avant et après (garde et parité longue vides). Touche des fichiers protégés : c'est un travail d'intégrateur, relu par le modèle le plus fort, jamais confié à un exécutant. Il passe avant le lot C parce qu'il rend chaque levier de C moins cher à prouver.

### Lot C : l'axe de la voie au cœur du calcul (semaine 5 et suivantes) — un levier à la fois
Direction (a) de D-357, dans l'ordre que A2 dira. Chaque levier : banc, garde des poses justes, corpus, examen vierge, parité (devenue gratuite après B), puis proposition à l'opérateur ; un seul levier en conception à la fois.
- C1 Génération du pool autour de l'axe (« gA ») ; elle englobe la méthode de v4BS-sd (D-360 : rails cherchés sur le côté, paire à l'écartement de référence, seulement sur les différés). Rappel du pool aujourd'hui : 619 sur 747 en ADV (82,9 %).
- C2 Choix de la voie par l'axe en aiguillage.
- C3 Travers départagé par l'axe (piste de CH-125 : 51 cuts touchés).
- C4 N+ (rechoisir après un refus d'ancre), en réglage neuf, jugé sur des données non vues.
- C5 L'ancre moins muette (selon A2).
- Toujours : une garde des poses justes pour tout levier qui pose davantage.

### Lot D : relecture ciblée — selon A4
Direction (c) de D-357 : relire d'abord les cuts les plus douteux. Ne s'ouvre que si A4 montre que la relecture est ce qui pèse le plus.

### En attente d'une décision écrite de l'opérateur (aucun chantier sans elle)
- **SKIP comme règle à part** (D-319, D-320 : « bien plus tard… sous Ariane 6.0 ») : tant qu'aucune décision ne l'écrit, Ariane n'envoie jamais SKIP.
- Lever ou changer le plafond de 10 de la deuxième passe.
- Sortir de la fenêtre popup (panneau latéral) pour fondre la barre de fenêtre (D-272).
- Banc de rejeu complet (D-273).

## 5. Le calendrier, avec le passage de la main
| Semaine | OpenCode | Intégrateur (Claude, puis OpenCode à l'étape 3) |
|---|---|---|
| 1 (dès le VPS prêt) | CH-131 : refabriquer la Vision 20 à l'identique | Vision 21 ; tickets A1 à A4 |
| 2 | A1, A2 (scripts, aucun code d'Ariane) | Relit, juge, présente A1 à l'opérateur |
| 3 à 4 | A3, A4 ; intégration de la Vision 22 sous relecture (étape 3) | Lot B (relu par le modèle le plus fort) |
| 5 et suite | Lot C, un levier à la fois ; la main entière à l'étape 4 (décision de l'opérateur) | Relecture à la demande |

## 6. Ce que l'opérateur a décidé pour lancer (19/11, D-378)
1. Plan et ordre **validés tels quels** (A → B → C → D).
2. Tronc d'Ariane 6 : **`ariane6`**, branche neuve partie de la Vision 21 ; `claude/50-test17` garde les correctifs de la 5.0.
3. But chiffré : différés **sous 5 % puis sous 3 %** des cibles d'un lot, sur des lots non vus, **0 mauvaise voie de plus**, **0 pose juste perdue** (§ 3).
4. Conception d'un lot confiée à un modèle plus fort, en sous-agent sur brief écrit ; l'intégrateur garde tickets, relecture, fusion, verify et paquets (D-375, D-378).
Premier chantier ouvert : **CH-139** (lot A1).
