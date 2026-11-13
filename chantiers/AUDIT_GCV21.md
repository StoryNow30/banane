# Audit du programme GCV2.1 par l'intégrateur (D-352)

Tenu au fil de l'eau. Une entrée par audit : ce qui a été constaté, ce qui change.

## Audit 1 — 13/11, fin de matinée

### Constats (ÉTABLIS sauf mention)
1. **Aucun gain allumable après la vague 2.** Quatre réglages ont réussi la validation croisée et échoué ensuite à la garde d'octobre : C1 (CH-117), aj3 et aj4 (CH-121), D (CH-119).
2. **Le même mécanisme d'échec quatre fois** : le réglage déplace ou remplace une pose de la chaîne, directement ou par ricochet. Ce sont les voisins ajustés qui changent la décision de la GCV2. En ADV, deux voies continues ne se distinguent pas par la continuité, et le lot n'a aucune ancre indépendante (CH-119 : départ d'ESV sur la voie fausse dans les 29 cas ; la liste exportée est celle de fin de lot).
3. **Erreur d'ordre de l'intégrateur** : la garde d'octobre était lancée en dernier, après la validation croisée et parfois après l'examen vierge. Les échecs sont donc arrivés tard. J'ai aussi annoncé aj3 comme candidat à l'opérateur avant sa garde, puis je l'ai retiré.
4. **Les examens vierges ont peu de puissance pour la voie** : 1211v et 1312v n'ont que deux mauvaises voies, toutes deux classées `abords` au banc. Un levier limité à l'ADV ne peut pas y montrer de gain (D : aucun cut changé).
5. **Les zones du banc et celles du lot ne concordent pas.** 4/6916 est dans la plage ADV 6885–6953 des « verts à contrôler » du lot, mais en `abords` au banc (`tools/banc-differes.cjs`, l. 181 : plages évaluées au rejeu). Tout levier borné à `adv` est concerné.
6. **Fidélité de la passe au banc** : le banc n'a ni le plafond de 10 écritures ni l'arrêt au premier refus (CH-116 § 3). Les jugements « passe livrée » en sont moins sûrs.

### Ce qui change (règles du programme)
- **R1, la garde d'abord.** Tout réglage figé passe la garde d'octobre AVANT sa validation croisée complète. Une garde rouge l'écarte sans autre rejeu.
- **R2, rien n'est annoncé trop tôt.** Rien n'est présenté à l'opérateur comme candidat avant que la garde, la validation croisée ET l'examen vierge soient verts ensemble.
- **R3, compter la chaîne à part.** Chaque jugement compte à part les poses de la chaîne déplacées ou remplacées, et les décisions changées par ricochet (hors cuts touchés).
- **R4, la puissance de l'examen.** Chaque examen dit combien de mauvaises voies il contient, et dans quelles zones. Un levier de voie jugé sur un examen sans mauvaise voie dans sa zone n'est pas « jugé ». Il faut demander à l'opérateur un Écho sur un lot à aiguillages.
- **R5, une seule définition des zones.** Elle sera la même au lot, au banc et dans les leviers (tâche confiée à CH-116).

### Ce qui est lancé
- **CH-124** : chercher une ancre indépendante en ADV (constat 2), la pièce qui manque à tous les leviers de voie.
- **CH-116 (outillage)** : la garde d'octobre au banc comme premier filtre rapide, la concordance des zones banc / lot, et la fidélité de la passe (plafond, arrêt au premier refus).
- **Demande à l'opérateur** : une séance Écho sur un lot neuf riche en aiguillages.

## Audit 2 — 13/11, midi

### Constats
7. **La garde d'octobre est aveugle à un changement fait à la source** (lu par CH-125 dans `tools/juger.cjs`, ÉTABLI) : un « vert changé » compare le profil L1-se au profil `base` du même rejeu. Une mesure changée à la source déplace les deux ensemble : la garde ne voit alors pas les poses de la chaîne déplacées. Une garde verte ne prouve donc rien pour un levier de mesure.
8. **Cinquième réglage écarté par la garde** : B v1 de CH-122 (nouvelles mauvaises voies en octobre : la puce pose en ADV des cuts que le livré diffère, sans voie de voisins). La règle R1 (garde d'abord) lui aurait épargné son jugement complet.
9. **Premier réglage sans ricochet** : aj5 de CH-121 (poses de la chaîne seulement, voisins = pose de la décision) : 0 décision changée sur tous les lots, 11 gagnés / 0 perdu en validation croisée. Sa structure vient de la garde d'octobre (déclaré) : son juge indépendant est l'examen vierge, puis l'Écho.
10. **Conteneurs** : deux sessions ont redémarré (CH-120, CH-122) et une parité a été tuée par manque de mémoire (CH-121, code 137). Sans perte de données, mais des files de rejeux coupées.

### Ce qui change
- **R6, un levier de mesure se juge aussi en octobre contre la vérité.** Tout levier qui change la mesure à la source donne, sur les lots d'octobre, les poses de la chaîne déplacées et leur écart à la vérité d'octobre (appliqué à CH-125).
- **R7, pas plus de deux rejeux lourds à la fois par session**, et les parités seules sur la machine (constat 10).

### Ce qui est lancé
- CH-124 et CH-125 relancés au modèle le plus fort, effort maximal, orchestration multi-agents permise (ordres de l'opérateur).
- Examen vierge d'aj5 chez CH-116, avant l'outillage.
