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

## Audit 3 — 13/11, 17 h 40 UTC

### Constats
11. **Tout le programme s'est arrêté pendant environ 5 h 30** (de 12 h 03-12 h 36 à 17 h 34 UTC) : la limite d'usage de 5 heures du compte a été atteinte (ÉTABLI : `usage_limit_reached`, « resets 4pm (UTC) » dans l'état des sessions). Huit sessions tournaient ensemble, dont deux au modèle le plus fort à l'effort maximal. Les tâches de fond en cours (gardes, parités, examens) sont mortes.
12. **Erreur de l'intégrateur** : j'ai lancé toujours plus de sessions sans compter la limite commune, et je n'ai pas vu l'arrêt (aucun réveil ne m'est parvenu pendant la coupure ; mon contrôle programmé n'a pas tourné non plus).
13. **L'ancre de CH-124 change l'ordre des priorités** : tous les leviers de voie (CH-119, 120, 122, 123) en dépendent. Les faire tourner avant sa contre-vérification gaspille l'usage.

### Ce qui change
- **R8, un budget d'usage tenu.** Quatre sessions actives au plus, dont deux au modèle le plus fort ; les autres attendent leur tour. Ordre : (1) ancre de CH-124 et sa contre-vérification ; (2) fin d'aj5 (examen vierge, parité) ; (3) calcul de pose de CH-125 ; (4) leviers de voie recentrés sur l'ancre, relancés deux par deux une fois l'ancre vérifiée.
- **R9, détecter une coupure.** À chaque contrôle, lire l'état des sessions (`status_detail`) : une session « failed » pour limite d'usage se relance à la levée de la limite, sans attendre l'opérateur.
- Les relances au modèle le plus fort demandées par l'opérateur pour CH-119, 120, 122 et 123 se font à partir de leur note de passation, dans l'ordre de R8.

## Audit 4 — 14/11, 8 h UTC

### Constats
14. **Seconde coupure par la limite d'usage** (ÉTABLI) : le 13/11 à 18 h 03-18 h 18 UTC, trente minutes après la reprise, « resets 10:30pm (UTC) ». Cinq sessions tournaient, dont trois au modèle le plus fort à l'effort maximal. Le programme est resté arrêté jusqu'au 14/11 à 7 h 53 UTC, soit près de quatorze heures : la limite s'était levée à 22 h 30, mais personne n'a relancé.
15. **R8 était trop large et R9 n'a pas joué** : mon contrôle programmé n'a pas tourné pendant la coupure, ni après. Une session au modèle le plus fort à l'effort maximal coûte plusieurs fois une session ordinaire ; quatre sessions ne tiennent pas dans la fenêtre.
16. **Perdu deux fois de suite** : l'examen vierge d'aj5 (lancé à 17 h 36, tué à 18 h) et la parité d'aj5 sur 12/11 p23. Ce sont les deux pièces qui manquent au seul gain de précision prêt.

### Ce qui change
- **R8 révisée : deux sessions lourdes au plus à la fois** (une au modèle le plus fort), plus une session légère sans rejeu si besoin (interface). Ordre : (1) levier d'ancre de CH-124 ; (2) examen vierge d'aj5 chez CH-116 ; puis, une par une : parité d'aj5 (CH-121), croisé de v4 (CH-123), calcul de pose (CH-125) ; puis les relances recentrées sur l'ancre (CH-119, 120, 122).
- **Pousser après chaque étape** : toute session pousse son travail avant de lancer un rejeu long.
- **Relance après coupure** : l'intégrateur programme un rappel à l'heure de levée de la limite (`send_later`), au lieu de compter sur un contrôle périodique.

### Suite de l'audit 4 (14/11) : outillage rendu par CH-116
- **R5 tranchée** : la zone d'un cut est celle que le service worker voit à la décision (« lot »). Le banc la lit au journal avec `BANC_ZONES=journal`. Le banc et le lot différaient sur environ 7 % des cuts (presque toujours `abords` au banc, ADV au lot) ; les 30 mauvaises voies du corpus sont ADV dans toutes les définitions, donc les validations croisées rendues tiennent. Tout nouveau jugement se fait avec `BANC_ZONES=journal`.
- **Passe fidèle** : `BANC_PASSE_PLAFOND=10` (ordre de décision, 10 écritures, arrêt au premier refus) ; fidélité des décisions 99,2 % sur 5 475 cuts. Tout jugement « passe livrée » s'en sert.

## Audit 5 — 14/11, 8 h 40 UTC

### Constats
17. **Le levier d'ancre N passe octobre, jugé contre la vérité** (CH-124, ÉTABLI) : 2 362 cuts, 13 refus, 13 vraies corrections (pose refusée à 117-289 mm de la vérité), 0 vraie faute, 0 ricochet. Octobre n'avait jamais été regardé pour l'ancre et θ était fixé d'avance : c'est un essai hors échantillon.
18. **La garde d'octobre a donné deux fausses alertes, et je les ai suivies** : les 7 « verts changés » qui ont fait écarter C1 (CH-117) et D (CH-119) sont des mauvaises voies de la CHAÎNE (pose de base à 125-247 mm de la vérité d'octobre). La garde ne rejuge pas un cut posé par le profil de base : elle a compté comme recul le fait de toucher à une pose fausse. J'ai écrit « probables mauvaises voies nouvelles » pour D sans le mesurer contre la vérité : c'était faux sur ces 7 cuts. Où C1 et D reposaient ces cuts n'est pas mesuré.
19. **Conséquence** : la « leçon commune » de l'audit 1 (tout levier qui touche une pose de la chaîne échoue) reposait en partie sur ce défaut de la garde. Les échecs réels restent : fautes de aj3 (latéral), ricochet d'aj4, mauvaises voies nouvelles de gTE et de la puce B / B' / v3, mesurés contre la vérité ou sur des cuts jugés.

### Ce qui change
- **R6 étendue à tous les leviers** : un « vert changé » n'est ni un recul ni un gain tant qu'il n'est pas jugé contre la vérité d'octobre. Tout verdict de garde donne, pour chaque cut changé : pose de base, pose nouvelle, vérité.
- **D et E de CH-119 à rejuger** contre la vérité d'octobre à sa relance (ses 7 « verts changés » : la chaîne y est fausse ; où D repose-t-il ?). C1 de même, si le budget le permet.
- **L'ancre devient la référence** : tout levier de voie est jugé aussi par la distance à l'axe de ses poses nouvelles.

## Audit 6 — 14/11, 10 h 25 UTC

### Constats
20. **Troisième coupure par la limite d'usage** (ÉTABLI) : 14/11 à 10 h 23 UTC, « resets 11:30am (UTC) », deux heures et demie après la reprise. Tournaient : CH-124 et CH-125 au modèle le plus fort à l'effort maximal, CH-116 (examens), CH-121 (parité), CH-123 (croisé, fini à 9 h 39), CH-115 (page d'interface).
21. **R8 n'a pas été tenue** : j'ai relancé CH-125 dès qu'une place s'est libérée, soit deux sessions au modèle le plus fort ensemble, plus le banc. Les sessions les plus anciennes relisent à chaque tour un contexte de 300 000 à 600 000 jetons : c'est ce qui vide la fenêtre.
22. **Rien de décisif n'est perdu** : les verdicts de N (octobre, corpus en première passe, examen vierge) et d'aj5 (examen vierge) sont poussés. Restent en vol : parité de N, parité d'aj5 à l'éteint, examen vierge de v4BS-sd, garde du niveau 1 de CH-125.

### Ce qui change
- **R8 durcie : une seule session au modèle le plus fort à la fois**, plus le banc (CH-116) et au plus une session légère. Ordre : parité de N (CH-124) d'abord ; CH-125 ensuite seulement.
- **Sessions trop lourdes** : au-delà de 500 000 jetons de contexte, une session finit sa tâche en cours, pousse une passation, et est remplacée par une session neuve (CH-121 après sa parité ; CH-116 après les examens en cours).
- **Relance programmée** à l'heure de levée (`send_later` à 11 h 32 UTC), faite.

## Audit 7 (14/11, après la livraison de la Vision 18)
**Ce qui a changé.** Le levier N est dans le tronc : sur le corpus les poses à plus de 50 mm de la vérité passent de 29 à 0. L'objectif « moins de mauvaises voies » des chantiers CH-117, CH-119 et de la première moitié de CH-120 est atteint par un autre chemin. Ce qui reste à gagner : les différés (603 sur 4 016 avec N) et la précision (503 justes sur 539 posés jugés).

**Ce que j'ai mal fait aujourd'hui, et la règle qui en sort.**
- J'ai relayé à l'opérateur « conforme à la page validée » sur la parole d'une session, sans mesurer ; l'opérateur a vu l'écart sur les photos. **R10 : une conformité visuelle se mesure (positions, couleurs) contre la référence validée, à taille égale et à 2 ×, par l'intégrateur lui-même, avant d'être annoncée.**
- J'ai écrit « le banc sous-estime PROBABLEMENT le livré » à partir d'une parité montée avec une liste fausse ; la mesure sur le corpus l'a démenti (4 016 cuts identiques). Le constat était bien qualifié PROBABLE, mais il venait d'un montage non contrôlé. **R11 : un montage de mesure (liste reconstituée, zones, référence) se contrôle contre une donnée du terrain (fiche de départ, journal) avant d'en tirer un constat.**
- Une parité prouve « même décision à entrées égales », pas « les bonnes entrées sont lues sur le terrain » : le défaut de la course au départ du lot (CH-124) n'était visible ni au banc ni en parité. **R12 : tout levier qui lit une donnée de la page (liste, vue, stockage) a un essai du service worker sur le MOMENT de cette lecture, et une mesure sur les journaux de l'ordre réel des événements.**
- Quatre coupures d'usage dans la journée, dont une a retardé de deux heures un verdict déjà rendu. R8 a été tenue l'après-midi (une session de conception à la fois) ; à garder.

**Ce qui a bien marché, à garder.** Réglage et règle de décision figés avant tout rejeu (CH-126 : N+ refusé à un cut près, sans discussion possible) ; contrôle croisé entre sessions (CH-116 a rejugé N, CH-124 a relu l'intégration d'aj5 et trouvé deux désalignements) ; l'arbre d'intégration sur une branche à part jusqu'aux preuves.

**Conséquence pour la file.** Les réglages « poser plus » rejetés pour mauvaises voies nouvelles (gTE de CH-120 : 17 différés reposés justes mais 3 mauvaises voies nouvelles en octobre ; puce de CH-122 à chaîne intacte) sont à rejuger SOUS N, tels que figés : N refuse précisément ce qui les avait fait rejeter. C'est le chantier CH-127 (assemblage). CH-119 (choix de voie global) n'a plus d'objet tant que N tient sur le terrain.

