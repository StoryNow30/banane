# Relecture indépendante — 4.7.13 à 4.7.16 TEST

**Périmètre :** `git diff 7a2144c..155dbec`, branche `chantier-48/relecture-4716` créée à `155dbec`. Aucun code de production modifié. Les données viennent de `banane-data`, branche `claude/banane-47-gate-audit-vaktr1`. La release officielle reste 4.7.0.

**Préparation reproductible :** depuis `banane-data`, `cat 'collections/2026-09-24_v4.7.12_/pilote p35/'monfichier.zip.part* > /tmp/p35.zip` (SHA-256 `efb63c8d8d00642d01a7df71b6694f72e6c5236797bf6cebce6a643462653d07`) et `unzip -j /tmp/p35.zip 'banane-gcv1-*' 'banane-journal-*' -d /tmp/banane-relecture/p35`. Pour p2, concaténer les deux `LOT_A_QUESTIONNER.7z.part*` (SHA-256 `635f12e9c7f676f4ee06bf40d512f6e07c641195a0203324251ef38ff7e22ca5`) et extraire ses JSON avec `7z x` dans `p2-all` ; extraire les 7z du lot p34 et de sa relecture dans `p34` et `p34-relecture`. Depuis la racine de `banane`, `export D=/tmp/banane-relecture` avant les commandes. Ne pas mélanger les bilans ou diagnostics de plusieurs lots dans le même dossier.

## Verdict

| Niveau | Constat |
|---|---|
| **BLOQUANT pour une candidate 4.8.0-rc** | **B1 — Un cut différé devient appui.** Dans le lot réel de la partie 35, 8951 est différé parce que la position calculée est hors de la vue ; cette position a pourtant été ajoutée aux appuis avant la commande. Les décisions de 8952 et 8953 la réutilisent. Aucun mauvais placement physique démontré sur ces trois cuts ; le contrat « appuis = cuts posés du lot » et la fidélité du rejeu à cette notion sont violés. |
| **IMPORTANT** | **I1 — Version v1 non autonome au rejeu.** Une décision `lot-decision-v1` prend `pairGuard` de la version d'extension *à l'export*. La parité 233/233 de la partie 35 est vraie avec l'export 4.7.12, mais ne démontre pas qu'un export ultérieur du même lot se rejouerait pareil. |
| **IMPORTANT** | **I2 — Preuve terrain de 4.7.16 manquante.** Le gain 690 → 711 décisions, 507 → 520 justes et 5 → 4 faux est un rejeu rétrospectif de collectes anciennes ; aucun lot complet, neuf et relu, produit par 4.7.16 n'est disponible. Les 20 choix gagnés par `minTop=5` viennent tous du banc Natif : 11 jugés justes, 9 non jugés. |
| **MINEUR** | **M1 — Comptage et présentation.** Le compteur `Différés : N` lit les finalisations durables, et l'avertissement de navigation nomme le cut. L'interface n'expose pas en continu la provenance « navigation observée ; confirmation serveur indisponible » dans la zone de statut ; elle l'indique dans « Dépannage ». Vérification visuelle dans Edge encore nécessaire. |

La classification B1 porte sur la qualification de la **candidate**, pas sur une application fausse déjà constatée. Sur le lot observé, les cuts 8951–8953 sont tous différés. Le défaut était évoqué de façon générale en M2 dans la relecture 4.7.12 ; le lot 4.7.12 fournit ici sa première manifestation chiffrable.

## B1 — appui mémorisé avant application et validation

**Fichiers :** `background.js:141-151` (`rememberAnchor` avant `commandLot` aux lignes 89 et 115-129) ; `src/lot-decision.js:65-67` (lecture des appuis) ; `tools/acceptance-report.cjs:254-265` (même ordre dans le rejeu). `rememberAnchor` est idempotent pour les revisites (`src/lot-decision.js:218-221`), mais ne retire pas l'appui quand la commande est refusée. `Observer seulement` ne commande rien par définition et doit être jugé séparément ; son calcul d'appuis n'est pas une preuve de positions réellement posées par le Pilote.

**Reproduction vérifiée, depuis les JSON de la partie 35 décompressés dans `$D/p35` :**

```sh
node - <<'JS'
const A=require('./tools/acceptance-report.cjs');
const lot=A.loadLot(process.env.D+'/p35','p35'),ctx=A.lotCuts(lot.diagnostic,lot.journal);
for(const c of ctx.cuts.filter(c=>[8951,8952,8953].includes(c.cut))){
 const o=c.observations.at(-1),d=o.lotObservation;
 console.log(c.cut,A.pilotOutcome(c,ctx).outcome,d.stage,d.anchor,d.anchorsUsed,d.command);
}
JS
```

Sortie observée, résumée sans perte de champs déterminants : `8951 deferred window true [8949,8948] engine/hors-vue-right (NDC −1,172)` ; `8952 deferred choice false [8951,8949] engine/hors-vue-left` ; `8953 deferred window false [8951] engine/hors-vue-left`. Le statut runtime de chacun est `DEFERRED_UNRESOLVED`. Le cut 8951 n'est donc pas une position du lot effectivement posée.

**Contre essai vérifié :**

```sh
node --max-old-space-size=12000 - <<'JS'
const A=require('./tools/acceptance-report.cjs'),L=require('./src/lot-decision.js');
const lot=A.loadLot(process.env.D+'/p35','p35');
const obs=A.lotCuts(lot.diagnostic,lot.journal).cuts.flatMap(c=>c.observations);
const options={pairGuard:true,chainMm:10,gaugeGuardMm:null,minTop:15};
const a=A.replayLot(obs,lot.corpus,{options});
const b=A.replayLot(obs,lot.corpus,{options,L:{...L,
 rememberAnchor:(arr,e,max)=>e.identity.cut===8951?arr:L.rememberAnchor(arr,e,max)}});
for(let i=0;i<a.length;i++)if(['35|8952','35|8953'].includes(a[i].key))
 console.log(a[i].key,a[i].decision.stage,a[i].decision.anchorsUsed,
 '→',b[i].decision.stage,b[i].decision.anchorsUsed,b[i].decision.reason||'');
JS
```

Sortie : 8952 `choice [8951,8949]` → `choice [8949]` ; 8953 `window [8951]` → `deferred/no-anchor`. Cette intervention n'a été faite **que dans le rejeu local** ; elle n'est ni correction du moteur ni hypothèse sur la vraie position de 8951. L'impact sur des cuts physiquement appliqués dans un autre lot reste **supposé** et doit être mesuré.

La parité 233/233 ne réfute pas B1 : le rejeu mémorise le même appui prématuré que le service worker. Il faut tester le cycle complet décision → commande → résultat final → appui et rejouer avec les seuls cuts posés et confirmés avant de promouvoir le résultat.

## I1 — règles historiques du rejeu

**Fichier :** `tools/acceptance-report.cjs:283-302`. `lotRules` utilise les règles consignées pour v2–v4, mais une v1 sans `pairGuard` consigné retombe sur la version exportée (`source:'export'`). Les valeurs déterminantes sont `pairGuard`, `chainMm`, `gaugeGuardMm`, `minTop`. Le code courant `src/lot-decision.js:125-128` consigne ces règles en v4 ; aucune option `gaugeChoice` ni `gaugeTargetStudy` n'est consignée ou routée depuis `background.js`.

```sh
node - <<'JS'
const A=require('./tools/acceptance-report.cjs');
for(const v of ['lot-decision-v1','lot-decision-v2','lot-decision-v3','lot-decision-v4'])
 console.log(v,A.lotRules([{lotObservation:{version:v}}],'4.7.16'));
console.log('v1 export 4.7.11',A.lotRules([{lotObservation:{version:'lot-decision-v1'}}],'4.7.11'));
JS
```

**Sortie vérifiée :** v1 avec export 4.7.16 → `pairGuard:true, chainMm:10, gaugeGuardMm:null, minTop:15, source:'export'` ; v1 avec export 4.7.11 → `pairGuard:false` ; v2 → `true,10,null,15,source:'lot'` ; v3 → `true,15,null,15,source:'lot'`. La v4 réelle avec champs consignés (`pairGuard:true,chainMm:15,gaugeGuardMm:20,minTop:5`) rend ces quatre valeurs avec `source:'lot'`. L'appel v4 minimal sans champ `gaugeGuardMm` rend `null` : ne pas confondre cet objet artificiel avec un export v4 complet.

**Parité brute vérifiée :**

| Lot et commande | Règles déterminées | Parité | Jugement disponible |
|---|---|---:|---|
| p35, `node --max-old-space-size=12000 tools/acceptance-report.cjs --lot "$D/p35" --rejeu-lot --json "$D/p35-result.json"` | 4.7.12 : `true,10,null,15` (`source:export`) | **233/233** | Aucune relecture enregistrée ; 203/233 physiquement appliqués, 0 jugé, lot arrêté. |
| p34, même commande avec `--relecture "$D/p34-relecture"` | 4.7.11 : `false,10,null,15` (`source:export`) | **96/96** | 73/96 appliqués, 1 faux/71 jugés (1834), lot arrêté. |
| p2, `--lot "$D/p2-all" --rejeu-lot` | 4.7.14 : `true,10,null,15` (`source:lot`) | **42/42** | 25/42 appliqués dans le lot retenu ; relecture **ciblée**, 2 faux/11 jugés dans sa zone ; lot en pause. |

**Intégrité de l'extraction locale p34 :** une première lecture séquentielle par `libarchive` a rendu `banane-native-v4-2026-09-24T12-05-48-seg03.json` à 46 137 344 octets au lieu des 57 376 960 du manifeste. Une seconde lecture par blocs (`archive_read_data_block`) a restauré les 57 376 960 octets ; `sha256sum` du JSON restauré : `5444d7efee7cc7e0b789c156283b2855f4bd72d5c4d414e3856d1ac3cf3a6f5f`, **identique au manifeste**. Nouveau `acceptance-report.cjs` avec les **19 segments** : encore **96/96, 73/96 appliqués, 1 faux/71 jugés**, 0/14 sur les placements par la décision. Les archives Git n'ont jamais été modifiées.

`node -e "const A=require('./tools/acceptance-report.cjs');console.log(['4.7.11','4.7.12','4.7.15','4.7.16'].map(v=>[v,A.rulesFor(v)]))"` vérifie respectivement la garde de paire à partir de 4.7.12, `chainMm=15` à partir de 4.7.15, et `gaugeGuardMm=20,minTop=5` à partir de 4.7.16. Les règles propres aux trois lots ci-dessus sont retenues, jamais remplacées silencieusement par les règles actuelles. Un rejeu v1 après réexport reste ambigu sans provenance immuable du build initial.

## Gardes, absence de cible et chemins de commande

**Vérifié par lecture et essais existants :** `src/lot-decision.js:133-194` écarte le premier passage si la continuité ou l'écartement voisin dépasse le seuil ; `:198-211` vérifie le contrat et réapplique la garde après le choix ; `:251-288` renvoie deux abstentions si une paire retirée ne peut pas être commandée ; la garde de paire ne passe pas dans le repli. `background.js:89-95` diffère également lors d'une exception après retrait par garde. `background.js:298-300` ne permet que `apply` ou `observe` ; `:141-142` appelle `decideCut` **sans options**, donc les deux options d'étude restent fausses (`src/lot-decision.js:36`). Recherche : `rg -n 'gaugeChoice|gaugeTargetStudy' background.js panel.js src tools tests` : aucun appel Pilote qui les active. L'option `gaugeTargetStudy` (`src/lot-decision.js:189`) est réellement une cible si un appelant la passe ; elle demeure un outil de mesure hors Pilote.

**Commande de contrôle :** `node tools/verify.cjs` (banc complet, inclut les essais de garde, de commandes, de panel et de rejeu) : `tests:712, pass:710, fail:0, cancelled:0, skipped:2` ; les deux ignorés dépendent du corpus privé absent. `Syntax: 36 runtime files. Geometry unchanged: true. Engine matches V4.6.0 baseline: true.` Les fichiers `audit/verification.json` et `.txt` régénérés par le banc ont été restaurés à l'état du commit audité. Une paire du moteur retirée par garde n'a pas été retrouvée physiquement appliquée dans p35, p34 et p2 ; la découverte B1 concerne la **mémoire d'appuis**, pas le retour de la paire retirée. `Observer seulement` laisse délibérément le moteur historique commander, ce qui correspond au réglage explicite et ne doit pas être présenté comme une protection active de la garde.

## I2 — bilan, minTop et juge

**Bilan agrégé publié, recalcul des comptes de ses JSON conservés :**

```sh
node - <<'JS'
const x=require('./audit/ecartement-voisin-2026-09-24.json').configs;
for(const k of ['g-base','g20-minTop5'])console.log(k,x[k].all);
const y=require('./audit/curseurs-lot-2026-09-24-filtres.json').configs['c15-minTop5'];
console.log('minTop5',y.gained.length,y.gained.filter(z=>z.verdict==='juste').length,y.gained.filter(z=>z.verdict==='non jugé').length);
JS
```

**Sortie :** `g-base` 690 appliqués, 512 jugés, **507 justes, 5 faux** ; `g20-minTop5` 711 appliqués, 524 jugés, **520 justes, 4 faux**. Le dernier faux terrain est p2:137 (10,23 mm), les trois autres sont dans le Natif long p20 : 398 (159,9 mm), 402 (273 mm), 983 (15 mm). Les 20 gains `minTop5` isolé sont **11 justes, 9 non jugés**, zéro perdu, tous de sessions Natif. Les 11 erreurs jugées vont de 0,6 à 8,1 mm ; 4260 (8,1) et 434 (7,2) sont proches de la limite à 10 mm. Ce décompte relit les **résultats sauvegardés**, pas encore le rejeu de toutes les archives brutes.

**Sous ensemble indépendamment rejoué : p20 longue complète, dossiers séparés et 35 segments longs présents.** Depuis `banane`, les deux commandes suivantes produisent deux JSON distincts ; les résultats imprimés sont dans leur champ `rows` (`judged`, `wrong`, `cut`, `worstMm`) :

```sh
node --max-old-space-size=12000 tools/choice-anchor-study.cjs "$D/p20-base.json" --natif "$D/p20-long=natif-long-p20" --option chainMm=15 --option minTop=15 --option gaugeGuardMm=null
node --max-old-space-size=12000 tools/choice-anchor-study.cjs "$D/p20-4716.json" --natif "$D/p20-long=natif-long-p20" --option chainMm=15 --option minTop=5 --option gaugeGuardMm=20
```

**Sortie vérifiée :** base **166 décidés, 107 jugés, 104 justes, 3 faux** ; 4.7.16 **175 décidés, 113 jugés, 110 justes, 3 faux**. Les trois faux restent 398 (159,9), 402 (273) et 983 (15). Neuf choix gagnés : six justes (151, 226, 434, 496, 528, 962) et trois sans jugement (132, 173, 249). Le parseur `--option` convertit littéralement `null` en `NaN` (`Number('null')`) ; dans cette exécution, la comparaison `> NaN` n'active aucune garde, ce qui reproduit la garde désactivée de la base pour les décisions. Pour une reproduction stricte des options sérialisées, appeler `runNatif` avec `{gaugeGuardMm:null}` directement. Cette vérification ne prétend pas reproduire les 690/711 de **toutes** les collectes.

**Les vingt gains, inspectés individuellement dans `configs['c15-minTop5'].gained` :** jugés justes : p22/1200 (5,4 mm), p20 courte/1118 (0,6), 1139 (3,7), p19 relecture/9243 (4,3), p24/4260 (8,1), p20 longue/151 (2,9), 226 (2,8), 434 (7,2), 496 (1,2), 528 (3,9), 962 (2,0). Non jugés : p19 relecture/9039, 9233, 9305, 9335, 9403 ; p30/3779 ; p20 longue/132, 173, 249. Aucun faux **parmi les onze jugeables** ; neuf verdicts manquent. L'étude enregistrée ne donne pas, pour ces vingt cas, un contrôle humain aveugle répété ni une comparaison de stabilité selon la densité de points. Le voisinage du seuil des deux erreurs les plus hautes justifie une relecture terrain dédiée, pas l'affirmation que cinq points suffisent toujours.

**Juge :** `tools/acceptance-report.cjs:203-243` choisit la dernière visite validée, exige la référence stricte `referenceFor` pour la validation, refuse les retouches non validées et les passages de moins de 500 ms. `:254-265` rejoue dans l'ordre temporel avec corpus et science, sans référence humaine ; `:305-360` ne joint la relecture qu'après le rejeu. `:372-405` déduplique le cut, conserve différés et sans entrée au dénominateur, exclut explicitement 9033/9241, distingue C4 accepté de C2 mesuré sur validations. Les 61 acceptations sans retouche sur 71 jugés de p34 sont des jugements qualitatifs D-040, non des erreurs millimétriques mesurées. Sur p2, les 11 jugés ne justifient **aucune extrapolation** hors des cuts 110–138 (D-048). Un nouveau lot 4.7.16 avec relecture complète et une mesure dédiée des neuf non jugés doit éprouver `minTop=5`, notamment dans les zones de faible densité et d'appareils de voie.

**Séparation des sessions Natif :** `tools/merge-segments.cjs` fusionne tous les JSON d'un dossier ; le dossier brut « session nativ » contient une longue et une courte session p20. Il faut extraire leurs fichiers dans **deux dossiers différents** avant `choice-anchor-study.cjs`. Une exécution locale mêlant les deux a fabriqué le cut 405 faux à 147,6 mm à la place de 402 ; ce résultat a été **écarté**. Une première extraction du segment long `T07-11-06-auto-seg05` était incomplète (30 408 704 au lieu de 34 505 727 octets) ; la lecture par blocs l'a restauré à la taille du manifeste, avec JSON valide. Les calculs antérieurs à cette récupération ne sont pas retenus comme reproduction du bilan de p20.

## Interface et sortie 4.8.0-rc

`node` comparant les attributs `id` de `git show 7a2144c:panel.html` et `panel.html` donne **0 identifiant retiré, 0 doublon**. `panel.js:146-180` affiche les politiques du scope figées ; `:188-202` affiche `Différés : ${b.deferred.length}` et sépare les catégories ; `:214-221` montre l'incertitude avec son cut, sans compter une intention comme différé ; `:588-591` demande confirmation avant SKIP explicite. L'absence de confirmation serveur figure dans `panel.html`, section Dépannage. Les tests DOM ne remplacent pas une inspection Edge des transitions, tailles et contraste.

**Conditions avant candidate, à faire mesurer et décider :**

1. Supprimer l'appui de toute proposition non appliquée et validée ; essai de bout en bout de 8951 → 8953, reprise et revisite, garde de continuité, garde d'écartement voisin et garde de paire ; parité avec les appuis effectivement posés. Le relecteur n'apporte pas la correction.
2. Lot(s) Pilote **complets**, nouveaux et relus sous 4.7.16 ou la candidate : ≥ **80 %** de cuts distincts appliqués, les deux rails et écartement admissible (objectif final **90 %**, sous P0), jugement couvrant ≥ **80 %** des appliqués pour C4 ; relecture ciblée comptée dans sa zone seulement. Rapporter tous les différés et les refus, dont les 10 hors contrat connus toujours interceptés (C3).
3. C2 : médiane **et** queue haute latérale et verticale des seuls cuts validés, face à 4.7, avec plancher P2 de ≥ 30 cuts replacés en aveugle ; vérifier aucune dégradation. Refaire C5 pour chaque curseur retenu et provenance des règles, puis mesure terrain des 20 choix `minTop=5`, en priorité les neuf non jugés.
4. C4 : mauvais placement si un rail dépasse 10 mm latéral **ou** vertical ; établir le dénominateur P5 et l'objectif −90 % du cahier. La direction doit trancher expressément le seuil de sortie laissé ouvert par l'amendement n°10 §10.1.5 : zéro faux strict ou faux isolés expliqués tolérés. Nommer chaque faux, son type, sa base (validé ou accepté), et la part jugée ; aucun ratio de zone ciblée ne vaut pour le lot entier.
5. Vérifier visuellement le §14 H dans Edge, avec navigation incertaine liée au cut, `Différés : N` après finalisation durable, politiques réellement actives, confirmation de SKIP, sans supposer de confirmation serveur. Le banc `node tools/verify.cjs` doit réussir sur le commit candidat ; deux tests ignorés faute de corpus privé sont attendus.
6. Préconditions du cahier §15 : P0 bonne réponse présente dans la grille **≥ 7/10** avant le développement concerné (3–6 impose un objectif 85 %, <3 un objectif 84 % et l'étude 4.9) ; P1 cause de la famine gauche établie ; P3 **≥ 300 rails** en collecte (<150 : classement déterministe seul) ; P4 qualification **≥ 60 %** avant collecte ; P5 dénominateur C4 mesuré au premier lot. P6 **≤ 150 ms/cut** avant code A2 si cette voie est retenue. Ces jalons ne sont pas des résultats démontrés par le présent diff.

**Supposé / limites :** aucun essai Edge ni validation serveur ESV dans cette relecture ; les commandes Node attestent les données et la logique hors navigateur. Le cas 8951 prouve un appui fictif et son effet sur deux décisions, pas un cut faux appliqué. Les chiffres agrégés des JSON d'étude attendent une reproduction complète de toutes les archives brutes ; p35 sans relecture ne contribue jamais à un taux de justesse.

**Questions à la direction :** quel seuil C4 de sortie retenir ; quel protocole terrain pour juger les neuf choix `minTop=5` sans référence ; faut-il considérer la candidate bloquée tant que l'appui prématuré n'est pas corrigé et mesuré sur un lot neuf ?
