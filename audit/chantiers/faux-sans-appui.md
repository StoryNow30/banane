# Faux de premier passage sans appui — étude hors ligne 4.7.16

24 septembre 2026. Base code `155dbec`, données `banane-data` branche
`claude/banane-47-gate-audit-vaktr1` (`6dd04c1`). **Recommandation : observer ;
ne rien activer.** Aucun des six gardes simples mesurés n'arrête les faux sans
perdre de cuts justes sur l'ensemble relu. Le seuil ESV crée même des faux par
ricochet. Aucun fichier `src/` n'a été modifié.

## Fait et vérifié

Les six sessions Natif sont p20 longue, p20 courte, p22, p24, p30 du 24/09
4.7.7, et **relecture Natif p19** ; les cinq lots sont p19, p31 début, p31
fin, p34, p2. Le contrôle Natif p30 du 24/09 4.7.8 est distinct et n'entre
pas dans ces six sessions. Parties 33 et 35 non relues exclues ; cuts 9033 et
9241 exclus à la demande de l'opérateur. La partie 2 n'est jugée que dans la
zone de relecture ciblée 110–138 ; aucune extrapolation au reste du lot.

Les `.7z` sont extraits hors dépôt. Les segments Natif sont fusionnés en
mémoire par `tools/merge-segments.cjs` ; p34 utilise les exports JSON intacts
de la relecture : l'extraction système d'un segment automatique intermédiaire
était tronquée (40 894 464 octets contre 46 986 003 déclarés). L'export final
contient la référence et le rejeu p34 rend 73 décisions, 0 faux / 71 jugées.
Il faut vérifier tailles et SHA-256 contre le `manifest.json` de chaque
collecte, et ne jamais utiliser un JSON tronqué. Le dossier `p34_clean` est
constitué des segments intacts, sans ce segment automatique redondant.

Reproduction de la base, après extraction dans `../extracted/` :

```sh
node --max-old-space-size=12000 tools/choice-anchor-study.cjs ../base-a.json \
  --natif ../extracted/p20long=p20long --natif ../extracted/p20short=p20short \
  --natif ../extracted/p22=p22 --natif ../extracted/p24=p24 \
  --natif ../extracted/p30=p30 \
  --lot '../extracted/2026-09-23_v4.7.6_/pilote + corr=p19' \
  --lot '../extracted/2026-09-24_v4.7.8_/pilote p31=p31a@../extracted/2026-09-24_v4.7.8_/relecture p31' \
  --lot '../extracted/2026-09-24_v4.7.9_/pilote p31 fin=p31b@../extracted/2026-09-24_v4.7.9_/relecture p31 fin' \
  --lot '../extracted/2026-09-24_v4.7.11_/pilote p34=p34@../extracted/p34_clean' \
  --lot '../extracted/p2/LOT A QUESTIONNER=p2'
node --max-old-space-size=12000 tools/choice-anchor-study.cjs ../base-b.json \
  --natif ../extracted/p19review=p19review
node -e "const a=require('../base-a.json').rows,b=require('../base-b.json').rows,r=[...a,...b]; console.log(r.length,r.filter(x=>x.judged).length,r.filter(x=>x.wrong).map(x=>[x.source,x.cut,x.worstMm]))"
```

**Sortie exécutée** : `711 524 [[p20long,398,159.9],
[p20long,402,273], [p20long,983,15], [p2,137,10.23]]` ; ces quatre faux
sont des premiers passages. Une visite répétée ne compte pas comme nouveau
cut. Tous les cuts non décidés restent au dénominateur de la couverture du
lot ; les 711 désignent les **décisions**, pas la couverture. D-040 est appliquée
aux lots et la relecture ciblée D-048 n'évalue que sa zone.

## Signaux de premier passage

`tools/first-pass-signal-study.cjs` prélève pour chaque côté `next.status` et
son motif, S1 (`next.changed`), rapport de pertes d'A_STAR, points de dessus
et de flanc publiés, motif du calage, écart latéral/vertical à la pose ESV ;
pour la paire : écartement prédit et nombre d'appuis. Le rang du minimum
publié n'est **pas exposé** par `next` en premier passage : il reste `null`,
sans rang inventé. Les quatre faux ont `next.status=candidate`, motif
`candidate`, S1 inactif, dessus 113–170 points et flanc 8–37 points ; le
calage est hors domaine seulement sur le rail gauche du 137. L'écartement
prédit est 1 423,77 ; 1 446,26 ; 1 435,13 ; 1 464,49 mm respectivement :
tous admissibles, jamais utilisés comme cible.

| Cut | Appuis | Max. écart latéral ESV | Pire rapport de pertes A_STAR | Min. dessus / flanc | Calage hors domaine |
|---|---:|---:|---:|---:|---|
| p20 398 | 0 | 79,36 mm | 6,53 | 164 / 15 | Non |
| p20 402 | 0 | 122,68 mm | 2,10 | 113 / 9 | Non |
| p20 983 | 2 | 38,26 mm | 1,51 | 113 / 8 | Non ; 3,9 mm de la voie |
| p2 137 | 0 | 98,97 mm | 2,49 | 132 / 12 | Gauche |

La valeur « pire rapport » est le minimum des deux rapports A_STAR :
13,93/6,53 ; 2,10/2,90 ; 5,37/1,51 ; 2,49/17,74. Ce signal ne sépare
pas les quatre faux. Les références humaines n'entrent que dans le jugement
après décision.

## Règles mesurées, un seul passage

Chaque garde vise seulement `stage=first-pass` et retire **la paire entière**.
L'outil rejoue ensuite les cuts du même lot avec les appuis recalculés ; un
cut retiré ne devient plus appui. `esv-100`/`esv-50` : au moins un rail se
déplace latéralement de plus de 100/50 mm par rapport à ESV ;
`sans-appui-esv-100` y ajoute zéro appui ; `dessus-20` ou `flanc-6` : au
moins un rail sous 20 points de dessus ou 6 de flanc ;
`calage-hors-domaine` : au moins un rail porte ce motif. Tous les seuils
ESV sont exploratoires, choisis après observation des faux.

| Règle | Faux directement arrêtés | Justes directement perdus | Justes perdus par ricochet | Nouveaux faux | Décisions, base 711 |
|---|---|---:|---:|---|---:|
| ESV > 100 mm | 402 | 53 | 23 | 405, 114 | 619 |
| ESV > 50 mm | 398, 402, 137 | 79 | 31 | 405, 114 | 577 |
| Dessus < 20 | Aucun | 2 | 0 | Aucun | 709 |
| Flanc < 6 | Aucun | 74 | 10 | Aucun | 606 |
| Calage hors domaine | 137 | 9 | 3 | Aucun | 697 |
| Sans appui et ESV > 100 mm | 402 | 46 | 22 | 405, 114 | 628 |

Les cuts non jugés retirés directement sont respectivement 15, 21, 0, 20,
1 et 14 ; ils ne sont ni classés justes ni classés faux. Le 114 et le 405
apparaissent dans le rejeu **après retrait d'appuis** : les compter seulement
comme « faux arrêtés » serait incorrect. La garde de calage ne perd aucun
juste sur p2 mais en perd neuf dans les autres sessions.

Lecture des tableaux suivants : `F` = faux directement arrêtés ; `J` =
justes directement retirés ; `R` = justes perdus indirectement ; `N` =
nouveaux faux ; `G` = cuts justes gagnés par ricochet ; `Δ` = variation des
décisions. Zéro est écrit `0`. Les changements de position ou d'étape qui
restent appliqués sont détaillés dans le JSON joint, champ `ricochet`.

#### ESV > 100 mm

| Session | F | J | R | N | G | Δ |
|---|---:|---:|---:|---|---:|---:|
| p20long | 1 | 5 | 5 | 405 | 0 | -13 |
| p20short | 0 | 29 | 2 | 0 | 0 | -32 |
| p22 | 0 | 0 | 0 | 0 | 0 | 0 |
| p24 | 0 | 4 | 1 | 0 | 0 | -6 |
| p30 | 0 | 0 | 0 | 0 | 0 | 0 |
| p19review | 0 | 0 | 0 | 0 | 0 | 0 |
| p19 | 0 | 0 | 0 | 0 | 0 | 0 |
| p31a | 0 | 0 | 0 | 0 | 0 | 0 |
| p31b | 0 | 9 | 5 | 0 | 0 | -14 |
| p34 | 0 | 0 | 0 | 0 | 0 | 0 |
| p2 | 0 | 6 | 10 | 114 | 0 | -27 |

#### ESV > 50 mm

| Session | F | J | R | N | G | Δ |
|---|---:|---:|---:|---|---:|---:|
| p20long | 2 | 7 | 5 | 405 | 0 | -16 |
| p20short | 0 | 29 | 2 | 0 | 0 | -32 |
| p22 | 0 | 0 | 0 | 0 | 0 | 0 |
| p24 | 0 | 5 | 1 | 0 | 0 | -7 |
| p30 | 0 | 1 | 0 | 0 | 0 | -1 |
| p19review | 0 | 0 | 0 | 0 | 0 | 0 |
| p19 | 0 | 0 | 0 | 0 | 0 | 0 |
| p31a | 0 | 4 | 0 | 0 | 0 | -5 |
| p31b | 0 | 18 | 12 | 0 | 0 | -33 |
| p34 | 0 | 9 | 1 | 0 | 0 | -10 |
| p2 | 1 | 6 | 10 | 114 | 0 | -30 |

#### Dessus < 20

| Session | F | J | R | N | G | Δ |
|---|---:|---:|---:|---|---:|---:|
| p20long | 0 | 0 | 0 | 0 | 0 | 0 |
| p20short | 0 | 0 | 0 | 0 | 0 | 0 |
| p22 | 0 | 0 | 0 | 0 | 0 | 0 |
| p24 | 0 | 2 | 0 | 0 | 0 | -2 |
| p30 | 0 | 0 | 0 | 0 | 0 | 0 |
| p19review | 0 | 0 | 0 | 0 | 0 | 0 |
| p19 | 0 | 0 | 0 | 0 | 0 | 0 |
| p31a | 0 | 0 | 0 | 0 | 0 | 0 |
| p31b | 0 | 0 | 0 | 0 | 0 | 0 |
| p34 | 0 | 0 | 0 | 0 | 0 | 0 |
| p2 | 0 | 0 | 0 | 0 | 0 | 0 |

#### Flanc < 6

| Session | F | J | R | N | G | Δ |
|---|---:|---:|---:|---|---:|---:|
| p20long | 0 | 3 | 4 | 0 | 0 | -14 |
| p20short | 0 | 0 | 0 | 0 | 0 | 0 |
| p22 | 0 | 0 | 0 | 0 | 0 | 0 |
| p24 | 0 | 17 | 2 | 0 | 0 | -22 |
| p30 | 0 | 7 | 1 | 0 | 0 | -10 |
| p19review | 0 | 0 | 0 | 0 | 0 | -8 |
| p19 | 0 | 0 | 0 | 0 | 0 | 0 |
| p31a | 0 | 6 | 0 | 0 | 0 | -6 |
| p31b | 0 | 5 | 0 | 0 | 0 | -5 |
| p34 | 0 | 36 | 3 | 0 | 0 | -40 |
| p2 | 0 | 0 | 0 | 0 | 0 | 0 |

#### Calage hors domaine

| Session | F | J | R | N | G | Δ |
|---|---:|---:|---:|---|---:|---:|
| p20long | 0 | 2 | 0 | 0 | 0 | -3 |
| p20short | 0 | 0 | 0 | 0 | 0 | 0 |
| p22 | 0 | 0 | 0 | 0 | 0 | 0 |
| p24 | 0 | 3 | 2 | 0 | 0 | -5 |
| p30 | 0 | 1 | 0 | 0 | 0 | -1 |
| p19review | 0 | 0 | 0 | 0 | 0 | 0 |
| p19 | 0 | 0 | 0 | 0 | 0 | 0 |
| p31a | 0 | 0 | 0 | 0 | 0 | 0 |
| p31b | 0 | 2 | 1 | 0 | 0 | -3 |
| p34 | 0 | 1 | 0 | 0 | 0 | -1 |
| p2 | 1 | 0 | 0 | 0 | 0 | -1 |

#### Sans appui et ESV > 100 mm

| Session | F | J | R | N | G | Δ |
|---|---:|---:|---:|---|---:|---:|
| p20long | 1 | 4 | 5 | 405 | 0 | -12 |
| p20short | 0 | 28 | 2 | 0 | 0 | -31 |
| p22 | 0 | 0 | 0 | 0 | 0 | 0 |
| p24 | 0 | 0 | 0 | 0 | 0 | 0 |
| p30 | 0 | 0 | 0 | 0 | 0 | 0 |
| p19review | 0 | 0 | 0 | 0 | 0 | 0 |
| p19 | 0 | 0 | 0 | 0 | 0 | 0 |
| p31a | 0 | 0 | 0 | 0 | 0 | 0 |
| p31b | 0 | 9 | 5 | 0 | 0 | -14 |
| p34 | 0 | 0 | 0 | 0 | 0 | 0 |
| p2 | 0 | 5 | 10 | 114 | 0 | -26 |

### Marges et fragilité

- **ESV > 100** : le faux 402 atteint 122,68 mm, mais le premier juste
  retiré est déjà à 100,74 mm (p20/421) ; la plage de 21,94 mm entre les
  deux est occupée par des justes. Le faux 398 à 79,36 mm et le 983 à
  38,26 mm restent.
- **ESV > 50** : premier juste à 51,40 mm (p31 fin/8365), contre 79,36 mm
  pour le moins déplacé des faux arrêtés (398). Le chevauchement est de
  27,96 mm ; le seuil n'a pas de marge sans perte. 983 reste.
- **Sans appui + ESV > 100** : même premier juste à 100,74 mm ; le filtre
  d'appui perd encore 46 justes et ne détecte ni 398 ni 983 ni 137.
- **Calage hors domaine** : signal catégoriel sans marge numérique ; il est
  aussi présent sur neuf premiers passages jugés justes, notamment p20/154
  et p20/465. Le combiner avec un seuil lu sur 137 surajusterait quatre faux.
- **Dessus < 20 / flanc < 6** : aucun faux directement arrêté ; les premiers
  justes perdus ont 15 points de dessus (p24/2557) et 3 de flanc
  (p20/155). Les quatre faux ont un support supérieur aux deux seuils.

### Reproduire chaque chiffre

Après les mêmes extractions, lancer une seule commande. Le JSON produit
contient `sessions[].base`, `sessions[].variants[REGLE]` et chaque retrait
direct, changement induit ou cut gagné. Le fichier de sortie consolidé est
`audit/chantiers/faux-sans-appui-results.json` ; son calcul a été fait en
deux processus pour limiter l'occupation mémoire, avec exactement les onze
entrées ci-dessous et concaténation des tableaux `sessions`.

```sh
node --max-old-space-size=12000 tools/first-pass-signal-study.cjs sortie.json \
  --natif ../extracted/p20long=p20long --natif ../extracted/p20short=p20short \
  --natif ../extracted/p22=p22 --natif ../extracted/p24=p24 \
  --natif ../extracted/p30=p30 --natif ../extracted/p19review=p19review \
  --lot '../extracted/2026-09-23_v4.7.6_/pilote + corr=p19' \
  --lot '../extracted/2026-09-24_v4.7.8_/pilote p31=p31a@../extracted/2026-09-24_v4.7.8_/relecture p31' \
  --lot '../extracted/2026-09-24_v4.7.9_/pilote p31 fin=p31b@../extracted/2026-09-24_v4.7.9_/relecture p31 fin' \
  --lot '../extracted/2026-09-24_v4.7.11_/pilote p34=p34@../extracted/p34_clean' \
  --lot '../extracted/p2/LOT A QUESTIONNER=p2'
```

Commande de vérification des totaux et des variations par session :

```sh
node - <<'JS'
const s=require('./audit/chantiers/faux-sans-appui-results.json').sessions;
console.log(s.reduce((n,x)=>n+x.base.applied,0),s.flatMap(x=>x.base.wrong.map(c=>x.label+':'+c)));
for(const x of s)for(const [name,v] of Object.entries(x.variants))
 console.log(x.label,name,v.stoppedWrong,v.lostRight.length,
  v.ricochet.filter(r=>r.before.applied&&!r.after.applied&&r.before.wrong===false).length,
  v.newWrong,v.applied-x.base.applied);
JS
```

## Supposé et questions pour la direction

Les quatre faux observés ne suffisent pas à apprendre une garde combinant
appuis, déplacement et calage. La valeur de 10 mm est le contrat D-038,
pas une précision physique certifiée : le plancher humain P2 reste non
mesuré. La relecture de lots part de la proposition du Pilote, et la partie 2
est ciblée ; ce banc ne démontre pas la généralisation sur un lot neuf.

**Décision proposée : observer les mêmes signaux sur les prochains lots
complets relus, ne pas activer ces six règles.** Questions : quel coût de
couverture serait acceptable pour un garde de premier passage ? Le seuil C4
de sortie reste-t-il zéro faux strict ou admet-il des faux isolés expliqués
(D-042) ? Une nouvelle partie relue peut-elle tester une règle choisie
*avant* son examen, ainsi que P2 ? La navigation de retour aux différés et
les appuis de cuts voisins validés relèvent de 4.9, pas de ce chantier.
