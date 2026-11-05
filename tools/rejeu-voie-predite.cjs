#!/usr/bin/env node
'use strict';
/*
 * rejeu-voie-predite.cjs — chercher AUTOUR DE LA VOIE PRÉDITE, et déplacer la vue
 * (mesure hors ligne, 5.0 ; rien n'est activé dans l'extension).
 *
 * Question : quand la pose de départ d'ESV est loin du rail (voie décalée), le
 * moteur cherche autour de cette pose et s'abstient. Que se passe-t-il s'il
 * cherche autour de la voie PRÉDITE, avec une fenêtre raisonnable, en gardant
 * les mêmes règles de décision (contrat d'écartement, garde de paire, garde de
 * continuité, garde d'écartement voisin) ? Combien de différés seraient posés
 * justes, posés faux, posés sur la mauvaise voie ? Combien exigent, en plus, de
 * déplacer la vue (glisser latéral au clic gauche, ou dézoom) pour que le clic
 * tombe dans l'écran ?
 *
 * Méthode. Le rejeu appelle les VRAIS modules, en lecture seule :
 *   - `Shadow.scientificProposeBoth` (gcv1-shadow.js), qui appelle
 *     `Candidate.propose` (geometry-candidate-v1.js), le calage de convention et
 *     la garde d'écartement de la paire ;
 *   - `LotDecision.decideCut` (lot-decision.js), qui sait déjà relancer le moteur
 *     depuis une position prédite (`seededRails` : la pose ESV est translatée sur
 *     la voie, donc la fenêtre d'analyse de ±180 mm et la grille de ±80 mm se
 *     recentrent sur elle), puis choisir le minimum local près de la prédiction ;
 *   - `LotDecision.commandRails` (la commande, avec le contrôle « la cible est dans
 *     la vue du rail », KI-051).
 * Ce qui change d'une variante à l'autre n'est donc que la SOURCE de la prédiction
 * (appuis du lot, prolongement sur plus de cuts, voisins validés de la liste d'ESV
 * B1 avec T calibrée sur la pose de départ), la MÉMOIRE des appuis (les appuis
 * réels du lot, ou « en série » : chaque pose acceptée devient l'ancre du cut
 * suivant), la largeur de la fenêtre d'acceptation autour de la prédiction et la
 * vue (telle quelle, ou déplacée).
 *
 * Seconde chance, jamais première : la décision du lot est prise d'abord, telle quelle ; les sources
 * nouvelles (B1, prolongement, fenêtre) ne jouent que pour un cut que le lot diffère. Les cuts déjà
 * posés ne peuvent donc pas être défaits par le recentrage, sauf par la chaîne d'appuis (mesurée).
 *
 * Aucune pose de l'opérateur n'entre dans la décision d'un cut : elle ne sert qu'à juger.
 * Seule exception, la variante « plafond » (`plafond`), dont les appuis sont les
 * poses de l'opérateur des cuts voisins ; elle mesure ce que des appuis parfaits
 * permettraient et n'est jamais une règle.
 *
 * Usage :
 *   node tools/rejeu-voie-predite.cjs --corpus SEG.json [--corpus SEG2.json ...]
 *        --journal JOURNAL.json --jointure JOINTURE.json [--lignes LISTE.jsonl]
 *        [--zones JEU.jsonl] [--cache MEMOIRE.json] [--variantes id,id,...]
 *        [--sortie SORTIE.json] [--detail DETAIL.json] [--csv MODELE-{id}.csv] [--ombre OMBRE.jsonl]
 *        [--partie PROJET:PARTIE [--juger-partie-reservee]]
 *   node tools/rejeu-voie-predite.cjs --rapport SORTIE1.json [SORTIE2.json ...]
 *   node tools/rejeu-voie-predite.cjs --liste      (variantes connues)
 *   node tools/rejeu-voie-predite.cjs --essai      (fixture synthétique, sans donnée)
 *
 * Entrées : le corpus GCV1 du lot (nuages et poses de départ), le journal Orbite (ordre du lot, ombre B1),
 * la jointure Écho-Orbite (pose finale de l'opérateur, classe de chaque cut), la liste d'ESV (B1 seulement : pose de
 * départ de chaque cut en coordonnées monde, une ligne JSON par cut), le jeu d'apprentissage (zones d'ADV).
 *
 * `--ombre` : l'ombre d'Orbite (`voie-predite-ombre`, module src/voie-recentree.js) rejouée sur le lot, un événement par cut
 * différé du témoin, tel que l'extension le consignerait ; son résumé (posables, jugement, poids en octets) entre dans la sortie.
 *
 * CH-053-M (05/11, en ombre, hors ligne) : deux SOURCES DE VOIE qui ne viennent d'aucun appui, pour les voies décalées hors de la
 * grille de ±80 mm du moteur (D-265) :
 *   - « ecart » (complément par l'écartement) : quand le moteur a trouvé UN rail (candidat publié, ou publié avant la garde
 *     d'écartement, ou A* brut) et pas l'autre, l'autre rail est cherché là où la paire aurait l'écartement de référence (lignes
 *     valides non touchées de la liste d'ESV, `src/gcv2-l1e.js`, sinon les appuis, sinon 1 435 mm), de chaque côté du rail trouvé ;
 *     le moteur est RELANCÉ depuis cette paire (même reprise que la voie prédite : `LotDecision.decideCut`, appuis fictifs
 *     `appuisDepuisDecalage`), et sa propre qualification décide (minimum à `choix` mm, points de dessus et de flanc, contrat
 *     d'écartement, garde d'écartement voisin). Deux rails trouvés ⇒ deux compléments ; s'ils ne tombent pas sur la même paire
 *     (à 20 mm), abstention (« ecart:plusieurs »).
 *   - « balayage » : sans aucun rail trouvé, la paire de départ est glissée en travers par pas de `pas` mm jusqu'à ±`portee` mm,
 *     à l'écartement de référence, et le moteur relancé à chaque pas ; les poses qualifiées sont groupées (à 25 mm) ; une seule
 *     voie ⇒ posée, plusieurs ⇒ abstention (« plusieurs-voies »), aucune ⇒ différé.
 *   Les deux sources viennent APRÈS les appuis du lot et la liste d'ESV (B1), sur les seuls cuts encore différés ; rien n'est
 *   activé dans l'extension. `--partie P:N` filtre aussi le corpus et le journal (lot de plusieurs parties) ; `--echo SESSION.json`
 *   complète les captures du lot vides (série de captures sans point, D-283) par le nuage de la PREMIÈRE visite de l'Écho, comme
 *   CH-049-F ; `--liste-esv INSTANTANE.json` lit les lignes de B1 et la référence d'écartement dans l'instantané compact de la liste.
 *
 * Sorties : agrégats seulement (comptes, millimètres d'écart, facteurs de
 * dézoom), jamais de coordonnée absolue ni d'identifiant de projet. Les fichiers
 * d'entrée restent hors du dépôt.
 */
const fs=require('node:fs');
const C=require('../vendor/capture-core.js');
const K=require('../src/core.js');
const L=require('../src/lot-decision.js');
const O=require('../src/continuity-observer.js');
const Shadow=require('../src/gcv1-shadow.js');
const B=require('../src/appuis-liste.js');
/* Module commun « recentrer sur la voie » (audit 5.0, I8) : vue, trace du moteur, règle, mesures et ombre d'Orbite sont celles
 * de l'extension, pour que le rejeu et l'ombre de terrain ne puissent pas diverger. */
const V=require('../src/voie-recentree.js');
const zlib=require('node:zlib');
const Manifeste=require('./manifeste-parties.cjs');
const L1e=require('../src/gcv2-l1e.js');
const ListeMemoire=require('../src/liste-memoire.js');
const Native=require('./native-offline-evaluate.cjs');
const GA=require('../src/garde-apres-differe.js');

const SIDES=['left','right'];
const FR={left:'gauche',right:'droite'};
const FAUX_MM=10,MAUVAISE_VOIE_MM=100,JUSTE_MM=[5,10];
const MARGE_VUE=L.VIEW_MARGIN;

/* ------------------------------------------------------------------ lecture */
const lireJson=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const lireLignes=p=>fs.readFileSync(p,'utf8').split('\n').filter(Boolean).map(l=>JSON.parse(l));
const med=a=>{if(!a.length)return null;const b=a.slice().sort((x,y)=>x-y),i=b.length>>1;return b.length%2?b[i]:(b[i-1]+b[i])/2;};
const quantile=(a,q)=>{if(!a.length)return null;const b=a.slice().sort((x,y)=>x-y),at=(b.length-1)*q,lo=Math.floor(at),hi=Math.ceil(at);return b[lo]+(b[hi]-b[lo])*(at-lo);};
const r1=v=>Number.isFinite(v)?Math.round(v*10)/10:null;
const r2=v=>Number.isFinite(v)?Math.round(v*100)/100:null;

/* Capture réduite à ce que la décision et la vue lisent. */
function allegerCapture(c){
  return {cut:c.cut,captureId:c.captureId,identity:c.identity,rails:c.rails,pointsSceneRelative:c.pointsSceneRelative,
    visibleByClipBoxes:c.visibleByClipBoxes,camera:c.camera,viewCaptures:(c.viewCaptures||[]).map(v=>({camera:v&&v.camera}))};
}
/* `partie` (CH-053-M) : un corpus de plusieurs parties ne garde que celle-là (le lot du 04/11 en porte dix) ; sans partie, comme avant. */
const dePartie=(identity,partie)=>partie==null||(identity&&identity.part===partie);
function chargerCaptures(fichiers,partie=null){
  const captures=new Map();
  for(const f of fichiers){
    const seg=lireJson(f);
    for(const c of seg.clouds||[]){if(Number.isInteger(c.cut)&&c.rails?.left&&c.rails?.right&&dePartie(c.identity,partie))captures.set(c.cut,allegerCapture(c));}
  }
  return captures;
}
/* Ordre du lot : les « proposed » du journal, par date. Repli : ordre croissant. */
function lireJournal(chemin,partie=null){
  const j=lireJson(chemin),ev=(j.events||[]).filter(e=>dePartie(e.identity,partie)),vus=new Set(),ordre=[],b1={};
  for(const e of ev.filter(e=>e.type==='proposed').sort((a,b)=>String(a.timestamp)<String(b.timestamp)?-1:1)){
    const c=e.identity?.cut;if(Number.isInteger(c)&&!vus.has(c)){vus.add(c);ordre.push(c);}
  }
  for(const e of ev)if(e.type==='b1-ombre'&&Number.isInteger(e.identity?.cut))
    b1[e.identity.cut]={reel:e.reel?.stage??null,hypothese:e.hypothese?.stage??null,gardes:(e.gardes||[]).length};
  /* CH-056 : cuts différés par la garde « après un différé » dans le lot réel, et zone PN / ADV de chaque cut (ombre des règles métier). */
  const gardeReel=new Set(),zonesJournal={};
  for(const e of ev){const c=e.identity?.cut;if(!Number.isInteger(c))continue;
    if(e.type==='garde-apres-differe'&&e.etat!=='erreur')gardeReel.add(c);
    if(e.type==='regles-metier-ombre'&&e.portee==='cut'&&e.zone&&!zonesJournal[c])zonesJournal[c]={pn:!!e.zone.pn,adv:!!e.zone.adv};}
  return {ordre,b1,gardeReel,zonesJournal};
}
/* CH-053-M — lignes de B1 depuis l'instantané compact de la liste d'ESV (`ariane-liste-partieN-*.json`, dixième de mm monde) :
 * { cut, statut, left, right } en mètres, lignes aux six bords seulement. Rend aussi la table décompactée (référence d'écartement L1-e). */
const STATUTS_LISTE=['valid','invalid','skipped','autre'];
function lignesDepuisInstantane(snap){
  const t=ListeMemoire.decompacter(snap);if(!t)throw Error('instantané de liste illisible (format ariane-liste-instantane-1 attendu)');
  const out=[];
  for(let i=0;i<t.n;i++){
    const e=t.ed.slice(6*i,6*i+6);if(!e.every(Number.isFinite))continue;
    out.push({cut:i,statut:STATUTS_LISTE[t.st[i]]||'autre',left:e.slice(0,3).map(v=>v/1e4),right:e.slice(3).map(v=>v/1e4)});
  }
  out.table=t;
  return out;
}
/* CH-053-M — captures manquantes ou vides du lot complétées par le nuage de l'Écho (série de captures sans point, D-283) : pose de départ de la
 * PREMIÈRE visite du cut, et les blocs de points de toutes ses visites pris autour de cette même pose (même construction que l'entrée sans fuite
 * de tools/relecture-autonome.cjs et de tools/gcv2-jeu.cjs : points visibles ; si aucun ne l'est, tous). Le nuage ne reçoit jamais la pose humaine.
 * L'identité garde le repère de scène de l'Écho : les appuis du lot (autre repère) ne s'y appliquent pas ; sans caméra, la vue est tenue pour
 * déplaçable (`sourceEcho`). */
function completerParEcho(captures,fichiers,partie,journal=()=>{}){
  let ajoutees=0;
  const memePose=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&a.length===3&&b.length===3&&a.every((v,i)=>Math.abs(v-b[i])<1e-6);
  /* Les fichiers sont une session fusionnée ou ses segments (instantanés : visites complètes, nuages incrémentaux) : visites et blocs sont
   * réunis sur tous les fichiers avant de construire les captures (union par identifiant). */
  const visites=new Map(),chunks=new Map();
  for(const f of fichiers){
    const s=lireJson(f);
    for(const r of (s.records||[]))if(dePartie(r.identity,partie)&&Number.isInteger(r.identity?.cut)&&r.visitId&&!visites.has(r.visitId))visites.set(r.visitId,r);
    for(const c of s.clouds||[]){
      if(c?.format!=='banane-native-lidar-chunk-v1'||!SIDES.includes(c.side)||!Array.isArray(c.pointsSceneRelative))continue;
      const k=c.chunkId||(c.captureId+'|'+c.side+'|'+chunks.size);if(chunks.has(k))continue;
      chunks.set(k,{visitId:c.visitId,side:c.side,rail:c.rail,pointsSceneRelative:c.pointsSceneRelative,visibleByClipBoxes:c.visibleByClipBoxes});
    }
  }
  const parCut=new Map();
  for(const r of [...visites.values()].sort((a,b)=>String(a.startedAt).localeCompare(String(b.startedAt)))){if(!parCut.has(r.identity.cut))parCut.set(r.identity.cut,[]);parCut.get(r.identity.cut).push(r);}
  const chunksParCut=new Map();
  for(const c of chunks.values()){const r=visites.get(c.visitId);if(!r)continue;const cut=r.identity.cut;if(!chunksParCut.has(cut))chunksParCut.set(cut,[]);chunksParCut.get(cut).push(c);}
  for(const [cut,rs] of parCut){
    const deja=captures.get(cut);if(deja&&deja.pointsSceneRelative?.length>0)continue;
    const r0=rs[0],before=r0.beforeEstablished?.rails;
    if(!before||!SIDES.every(sd=>before[sd]&&Array.isArray(before[sd].positionSceneRelative)))continue;
    const ch=(chunksParCut.get(cut)||[]).filter(c=>c.rail&&memePose(c.rail.positionSceneRelative,before[c.side].positionSceneRelative));
    if(!ch.length)continue;
    const rails={};
    for(const sd of SIDES){const k=ch.find(c=>c.side===sd);rails[sd]={...(k?k.rail:{}),...before[sd],profileContours:(before[sd].profileContours?.length?before[sd]:(k?k.rail:{})).profileContours||[]};}
    if(!SIDES.every(sd=>rails[sd].sceneRelativeToProfileLocal&&rails[sd].profileContours.length))continue;
    const pts=[],vis=[];let visibles=0;
    for(const c of ch)for(let i=0;i<c.pointsSceneRelative.length;i++){pts.push(c.pointsSceneRelative[i]);const v=c.visibleByClipBoxes?.[i]===true;vis.push(v);if(v)visibles++;}
    if(!visibles)vis.fill(true);
    captures.set(cut,{cut,captureId:r0.recordId||null,identity:{...r0.identity,frameId:r0.identity?.frameId??null},rails,pointsSceneRelative:pts,visibleByClipBoxes:vis,
      camera:null,viewCaptures:[],sourceEcho:true,visibiliteForcee:!visibles});
    ajoutees++;
  }
  journal(`captures complétées par l'Écho : ${ajoutees}`);
  return ajoutees;
}
/* Référence : pose de l'opérateur depuis la pose de départ (repère profil, mm), par cut. */
function lireReference(chemin){
  const J=lireJson(chemin),ref=new Map();
  for(const r of J.table||[]){
    const mic={},ariane={};let ok=true,okA=true;
    for(const s of SIDES){
      const d0=r.arianeDeplacement?.[FR[s]];
      if(d0&&d0.repere==='profil')ariane[s]=[d0.longitudinalMm,d0.lateralMm,d0.verticalMm];else okA=false;
      const e=r.ecartHumain?.[FR[s]];
      if(!e||e.repere!=='profil'){ok=false;break;}
      let lg=e.longitudinalMm,la=e.lateralMm,ve=e.verticalMm;
      if(r.base==='ariane'){const d=r.arianeDeplacement?.[FR[s]];if(!d){ok=false;break;}lg+=d.longitudinalMm;la+=d.lateralMm;ve+=d.verticalMm;}
      mic[s]=[lg,la,ve];
    }
    ref.set(r.cut,{classe:r.classe,mic:ok?mic:null,ariane:ok&&okA?ariane:null});
  }
  return ref;
}
/* Zones d'ADV (jeu d'apprentissage), seulement pour la règle prudente. */
function lireZones(chemin){
  const z=new Map();
  for(const l of lireLignes(chemin))if(l.type==='cut'&&l.zone)z.set(l.cut,{adv:l.zone.adv?{zone:l.zone.adv.zone??null,role:l.zone.adv.role??null,dist:l.zone.adv.distSigneeCuts??null}:null});
  return z;
}

/* ------------------------------------------------------------------ géométrie */
/* Position scène d'un rail déplacé de `delta` (mm) dans le repère profil de sa pose de départ. */
const positionMic=(rail,deltaMm)=>L.positionOf(rail,deltaMm.map(v=>v/1000));
/* Écart (mm) d'une position scène à la pose de départ, dans le repère profil du rail : [long, lat, vert] (module commun). */
const localMm=V.localMm;
/* Écart au repère de l'opérateur, par rail et le pire des deux. */
function ecartAMic(cap,positions,mic){
  const out={};
  for(const s of SIDES){
    const l=localMm(cap.rails[s],positions[s]);
    out[s]=Math.hypot(l[0]-mic[s][0],l[1]-mic[s][1],l[2]-mic[s][2]);
  }
  out.pire=Math.max(out.left,out.right);
  return out;
}
/* Vue nécessaire (dézoom, glissement) et caméras élargies (« la vue est déplacée ») : celles du module commun. */
const vueNecessaire=V.vueNecessaire,camerasLarges=V.camerasLarges;

/* ------------------------------------------------------------------ repère de la liste d'ESV (B1) */
/* T : monde − scène, estimée par cadre de scène (un rechargement d'ESV en change) sur les cuts du lot qui figurent dans la liste (pose de
 * départ). Les deux rails doivent donner la même translation. Rend {parCadre:{frameId:{T,paires,...}}, paires, ecartMaxMm, rigideMaxMm}. */
function estimerT(lignes,captures){
  const groupes=new Map(),rigides=[];
  for(const l of lignes){
    const cap=captures.get(l.cut);if(!cap||!l.left||!l.right)continue;
    const dl=l.left.map((v,i)=>v-cap.rails.left.positionSceneRelative[i]),dr=l.right.map((v,i)=>v-cap.rails.right.positionSceneRelative[i]);
    const rigide=Math.hypot(dl[0]-dr[0],dl[1]-dr[1],dl[2]-dr[2])*1000;
    /* Comme B1 : une mesure dont les deux rails ne donnent pas la même translation (cut dont Ariane a déjà déplacé un rail) est refusée. */
    if(rigide>B.DEFAULTS.rigideMm)continue;
    rigides.push(rigide);
    const f=cap.identity?.frameId??'';if(!groupes.has(f))groupes.set(f,[]);
    groupes.get(f).push([0,1,2].map(i=>(dl[i]+dr[i])/2));
  }
  if(!groupes.size)return null;
  const parCadre={};let ecartMax=0,paires=0;
  for(const [f,ts] of groupes){
    const T=[0,1,2].map(i=>med(ts.map(t=>t[i])));
    const ecart=ts.map(t=>Math.hypot(t[0]-T[0],t[1]-T[1],t[2]-T[2])*1000);
    parCadre[f]={T,paires:ts.length,ecartMaxMm:Math.max(...ecart),ecartP90Mm:quantile(ecart,.9)};
    ecartMax=Math.max(ecartMax,Math.max(...ecart));paires+=ts.length;
  }
  const premier=Object.values(parCadre)[0];
  return {parCadre,cadres:groupes.size,T:premier.T,paires,rigideMaxMm:Math.max(...rigides),ecartMaxMm:ecartMax};
}
/* Lignes valides de la liste (le lot rejoue les cuts invalides ; les autres sont lues comme « valid » à l'ouverture). */
function fenetreListe(lignesParCut,cut,fenetre=B.DEFAULTS.fenetre){
  const rows=[];
  for(let i=cut-fenetre;i<=cut+fenetre;i++){
    const l=lignesParCut.get(i);if(!l)continue;
    rows.push({i,statut:l.statut,operateur:false,vu:false,fraiche:false,bords:{left:l.left,right:l.right}});
  }
  return rows;
}

/* ------------------------------------------------------------------ variantes */
/* Une variante = une source de prédiction, une mémoire des appuis, une fenêtre, une vue.
 *   source  : 'lot'        appuis du lot seuls (gap 3, 2 appuis) — le témoin ;
 *             'prolonge'   les derniers cuts posés sur `gap` cuts au plus, `appuis` appuis ;
 *             'b1'         + voisins validés de la liste d'ESV, en dernier recours ;
 *             'plafond'    + poses de l'opérateur des cuts voisins du lot (appuis parfaits, jamais une règle).
 *   memoire : 'reelle'     les appuis sont ceux du lot réel (aucun chaînage de nos propres poses) ;
 *             'propre'     « en série » : chaque pose acceptée devient l'ancre du cut suivant.
 *   fenetre : demi-largeur (mm) de la fenêtre d'acceptation autour de la prédiction (`guardMm`) ;
 *   choix   : demi-largeur (mm) du choix du minimum local près de la prédiction (`chooseMm`) ;
 *   vue     : 'seule' (la cible doit déjà tomber dans la vue, comme l'adaptateur) ou 'deplacee'. */
const BASE={source:'lot',gap:3,appuis:2,b1:false,plafond:false,memoire:'propre',fenetre:30,choix:15,vue:'seule',ecart:false,balayage:false};
/* CH-053-M : réglages des deux sources hors appui (voir l'en-tête). `ecart` : 'les-deux' | 'gauche' | 'droite' (rail trouvé pris comme sûr). */
const ECART=Object.freeze({accordMm:20,gRefDefautMm:1435,solutionPasMm:1,solutionPorteeMm:320,solutionTolMm:0.5});
const BALAYAGE=Object.freeze({pasMm:50,porteeMm:250,groupeMm:25});
function variante(id,o){return {id,...BASE,...o};}
function gardeVariantes(){
  const out=[variante('garde-livree',{garde:{regle:'R3',coupures:2,appuisMin:2,zone:'tout'}})];
  for(const zone of ['tout','pn-adv','hors-pn-adv'])for(const coupures of [1,2,3]){
    for(const appuisMin of [1,2,3])if(!(zone==='tout'&&coupures===2&&appuisMin===2))
      out.push(variante(`garde-r3-c${coupures}-a${appuisMin}-${zone}`,{garde:{regle:'R3',coupures,appuisMin,zone}}));
    out.push(variante(`garde-r1-c${coupures}-${zone}`,{garde:{regle:'R1',coupures,zone}}));}
  return out;
}
const VARIANTES=[
  variante('temoin',{}),
  /* CH-056 : la garde « après un différé » rejouée (livrée : R3, 2 cuts, 2 appuis, toutes zones) et ses variantes, sur le témoin. */
  ...gardeVariantes(),
  variante('vue-reelle',{memoire:'reelle',vue:'deplacee'}),
  variante('vue-serie',{memoire:'propre',vue:'deplacee'}),
  variante('prol6-reelle',{source:'prolonge',gap:6,memoire:'reelle',vue:'deplacee'}),
  variante('prol6-serie',{source:'prolonge',gap:6,memoire:'propre',vue:'deplacee'}),
  variante('prol10-reelle',{source:'prolonge',gap:10,memoire:'reelle',vue:'deplacee'}),
  variante('prol10-serie',{source:'prolonge',gap:10,memoire:'propre',vue:'deplacee'}),
  variante('prol10a1-serie',{source:'prolonge',gap:10,appuis:1,memoire:'propre',vue:'deplacee'}),
  variante('prol20-serie',{source:'prolonge',gap:20,memoire:'propre',vue:'deplacee'}),
  variante('prol20a1-serie',{source:'prolonge',gap:20,appuis:1,memoire:'propre',vue:'deplacee'}),
  variante('b1-reelle',{b1:true,memoire:'reelle',vue:'deplacee'}),
  variante('b1-serie',{b1:true,memoire:'propre',vue:'deplacee'}),
  variante('b1-prol10-serie',{b1:true,source:'prolonge',gap:10,memoire:'propre',vue:'deplacee'}),
  variante('plafond-reelle',{plafond:true,memoire:'reelle',vue:'deplacee'}),
  variante('plafond-serie',{plafond:true,memoire:'propre',vue:'deplacee'}),
  variante('b1-seule',{b1:true,memoire:'propre',vue:'seule'}),
  variante('prol10-seule',{source:'prolonge',gap:10,memoire:'propre',vue:'seule'}),
  /* Règle prudente (voir `regleAccepte`) : elle ne juge que les poses nouvelles. */
  variante('regle-w',{memoire:'propre',vue:'deplacee',regle:{etages:['window']}}),
  variante('regle-w-p10',{memoire:'propre',vue:'deplacee',regle:{etages:['window'],profMax:10}}),
  variante('regle-w-e10',{memoire:'propre',vue:'deplacee',regle:{etages:['window'],ecartVoisinMm:10}}),
  variante('regle-w-e10-p10',{memoire:'propre',vue:'deplacee',regle:{etages:['window'],ecartVoisinMm:10,profMax:10}}),
  variante('regle-w-e15',{memoire:'propre',vue:'deplacee',regle:{etages:['window'],ecartVoisinMm:15}}),
  variante('regle-wc-p10',{memoire:'propre',vue:'deplacee',regle:{etages:['window'],confMin:55,profMax:10}}),
  variante('regle-wc-e10-p10',{memoire:'propre',vue:'deplacee',regle:{etages:['window'],confMin:55,ecartVoisinMm:10,profMax:10}}),
  variante('regle-wc-e10-p10-seule',{memoire:'propre',vue:'seule',regle:{etages:['window'],confMin:55,ecartVoisinMm:10,profMax:10}}),
  ...[10,15,20].map(w=>variante('regle-w-p10-f'+w,{memoire:'propre',vue:'deplacee',regle:{etages:['window'],profMax:10,fenetreMm:w}})),
  ...[50,80].map(w=>variante('vue-serie-f'+w,{memoire:'propre',vue:'deplacee',fenetre:w})),
  variante('regle-w-p5',{memoire:'propre',vue:'deplacee',regle:{etages:['window'],profMax:5}}),
  variante('regle-w-p8',{memoire:'propre',vue:'deplacee',regle:{etages:['window'],profMax:8}}),
  variante('regle-w-p15',{memoire:'propre',vue:'deplacee',regle:{etages:['window'],profMax:15}}),
  variante('regle-w-p10-reelle',{memoire:'reelle',vue:'deplacee',regle:{etages:['window'],profMax:10}}),
  variante('regle-w-p10-seule',{memoire:'propre',vue:'seule',regle:{etages:['window'],profMax:10}}),
  variante('regle-b-w-p10',{b1:true,memoire:'propre',vue:'deplacee',regle:{etages:['window'],profMax:10}}),
  variante('regle-c-w-p10',{b1:true,source:'prolonge',gap:10,memoire:'propre',vue:'deplacee',regle:{etages:['window'],profMax:10}}),
  variante('regle-wc',{memoire:'propre',vue:'deplacee',regle:{etages:['window'],confMin:55}}),
  variante('regle-w-e10-reelle',{memoire:'reelle',vue:'deplacee',regle:{etages:['window'],ecartVoisinMm:10}}),
  variante('regle-b-w',{b1:true,memoire:'propre',vue:'deplacee',regle:{etages:['window']}}),
  variante('regle-b-w-e10',{b1:true,memoire:'propre',vue:'deplacee',regle:{etages:['window'],ecartVoisinMm:10}}),
  variante('regle-b-w-e10-p10',{b1:true,memoire:'propre',vue:'deplacee',regle:{etages:['window'],ecartVoisinMm:10,profMax:10}}),
  variante('regle-c-w-e10',{b1:true,source:'prolonge',gap:10,memoire:'propre',vue:'deplacee',regle:{etages:['window'],ecartVoisinMm:10}}),
  variante('regle-c-w-e10-p10',{b1:true,source:'prolonge',gap:10,memoire:'propre',vue:'deplacee',regle:{etages:['window'],ecartVoisinMm:10,profMax:10}}),
  ...[10,15,20,50,80].map(w=>variante('b1-prol10-serie-f'+w,{b1:true,source:'prolonge',gap:10,memoire:'propre',vue:'deplacee',fenetre:w,choix:Math.min(w,15)})),
  variante('b1-prol10-serie-c30',{b1:true,source:'prolonge',gap:10,memoire:'propre',vue:'deplacee',fenetre:30,choix:30}),
  variante('prol10-serie-c30',{source:'prolonge',gap:10,memoire:'propre',vue:'deplacee',fenetre:30,choix:30}),
  /* CH-053-M : sources hors appui (ombre). */
  variante('ecart-serie',{ecart:'les-deux',memoire:'propre',vue:'deplacee'}),
  variante('ecart-g-serie',{ecart:'gauche',memoire:'propre',vue:'deplacee'}),
  variante('ecart-d-serie',{ecart:'droite',memoire:'propre',vue:'deplacee'}),
  variante('balayage-serie',{balayage:true,memoire:'propre',vue:'deplacee'}),
  variante('ecart-balayage-serie',{ecart:'les-deux',balayage:true,memoire:'propre',vue:'deplacee'}),
  variante('b1-ecart-serie',{b1:true,ecart:'les-deux',memoire:'propre',vue:'deplacee'}),
  variante('b1-ecart-balayage-serie',{b1:true,ecart:'les-deux',balayage:true,memoire:'propre',vue:'deplacee'}),
  variante('b1-prol10-ecart-balayage-serie',{b1:true,source:'prolonge',gap:10,ecart:'les-deux',balayage:true,memoire:'propre',vue:'deplacee'}),
  variante('ecart-balayage-reelle',{ecart:'les-deux',balayage:true,memoire:'reelle',vue:'deplacee'}),
  variante('ecart-balayage-c30-serie',{ecart:'les-deux',balayage:true,memoire:'propre',vue:'deplacee',choix:30}),
];

/* ------------------------------------------------------------------ moteur mémoïsé */
/* `decideCut` relance le moteur depuis la voie par `Shadow.scientificProposeBoth(seeded)` : ce même appel, pour la même
 * position de départ, revient d'une variante à l'autre. La mémoire évite de le refaire (le résultat ne dépend que de la capture). */
function moteurMemoise(cache){
  const cle=cap=>cap.identity?.cut+'|'+SIDES.map(s=>cap.rails[s].positionSceneRelative.map(v=>Math.round(v*1e5)).join(',')).join('|');
  const m={...Shadow,dernier:null,scientificProposeBoth(cap){
    const k=cle(cap);
    if(!cache.has(k))cache.set(k,Shadow.scientificProposeBoth(cap));
    m.dernier=cache.get(k);
    return m.dernier;
  }};
  return m;
}
/* Mémoire sur disque : un résultat du moteur pèse 5 Ko ; elle évite de refaire 6 minutes de calcul par essai. */
function lireCache(chemin,cache){
  if(!chemin||!fs.existsSync(chemin))return;
  const o=lireJson(chemin);for(const k of Object.keys(o))cache.set(k,o[k]);
}
function ecrireCache(chemin,cache){if(chemin)fs.writeFileSync(chemin,JSON.stringify(Object.fromEntries(cache)));}
/* Ce que le moteur relancé depuis la voie a vu, par rail (module commun). */
const traceMoteur=V.traceMoteur;

/* ------------------------------------------------------------------ CH-053-M : sources de voie hors appui */
/* Écartement de référence (mm) au cut : lignes valides non touchées de la liste d'ESV (L1-e), sinon la médiane des appuis réels, sinon le défaut. */
function ecartementReference(ctx,cut,ancres){
  if(ctx.tableListe){const r=L1e.referenceEcartement(ctx.tableListe,cut);if(r&&Number.isFinite(r.mm))return {mm:r.mm,source:'liste'};}
  const g=(ancres||[]).filter(a=>a.positions?.left&&a.positions?.right).map(a=>C.distance(a.positions.left,a.positions.right)*1000);
  if(g.length)return {mm:med(g),source:'appuis'};
  return {mm:ECART.gRefDefautMm,source:'defaut'};
}
/* Rail trouvé par le moteur (décalage [long, lat, vert] en m, repère profil du rail de départ) : candidat publié, publié avant la garde
 * d'écartement de la paire, sinon A* brut. Rien d'autre : jamais la pose de l'opérateur. */
function railTrouve(rail){
  if(!rail||rail.ok!==true)return null;
  if(rail.next?.status==='candidate'&&Array.isArray(rail.next.delta))return {delta:rail.next.delta,origine:'publie'};
  const g=rail.pairGauge?.publishedBeforeGate?.delta;if(Array.isArray(g))return {delta:g,origine:'avant-garde'};
  if(rail.astar?.status==='candidate'&&Array.isArray(rail.astar.delta))return {delta:rail.astar.delta,origine:'astar'};
  return null;
}
/* Décalages latéraux (mm) de `autre` qui donnent à la paire l'écartement `gRef`, le rail `sur` étant à `deltaSur` (m) : les minima locaux de
 * |écartement − gRef| sur ±portée, de chaque côté du rail sûr (deux solutions au plus). La hauteur de l'autre rail est celle du rail sûr. */
function solutionsEcartement(cap,sur,deltaSur,gRef,o=ECART){
  const autre=sur==='left'?'right':'left',posSur=L.positionOf(cap.rails[sur],deltaSur),vert=deltaSur[2];
  const g=a=>C.distance(L.positionOf(cap.rails[autre],[0,a/1000,vert]),posSur)*1000;
  const sols=[];let prev=null,prev2=null;
  for(let a=-o.solutionPorteeMm;a<=o.solutionPorteeMm;a+=o.solutionPasMm){
    const e=Math.abs(g(a)-gRef);
    if(prev!==null&&prev2!==null&&prev.e<=prev2.e&&prev.e<=e&&prev.e<=5)sols.push(prev.a);
    prev2=prev;prev={a,e};
  }
  /* affinage : bissection locale autour de chaque solution */
  return sols.map(a0=>{let lo=a0-o.solutionPasMm,hi=a0+o.solutionPasMm;for(let k=0;k<20;k++){const m=(lo+hi)/2;const ml=g(lo)-gRef,mm=g(m)-gRef;if(Math.sign(ml)===Math.sign(mm))lo=m;else hi=m;}
    const a=(lo+hi)/2;return Math.abs(g(a)-gRef)<=o.solutionTolMm?{lat:a,vert:vert*1000}:null;}).filter(Boolean);
}
/* Relance du moteur depuis une paire donnée en décalages (mm, [lat, vert] par rail) : appuis fictifs sur la droite parallèle à la pose de
 * départ (`appuisDepuisDecalage`), même reprise que la voie prédite. Rend { decision, relance } ; la décision porte `positions` si elle pose. */
function relancerDepuis(decider,args,cap,decalage,opts){
  const anchors=V.appuisDepuisDecalage(cap,decalage);
  return decider({...args,anchors,options:opts});
}
const poseMmDe=(cap,decision)=>decision?.positions?Object.fromEntries(SIDES.map(s=>{const l=localMm(cap.rails[s],decision.positions[s]);return [s,[l[1],l[2]]];})):null;
const ecartPoses=(a,b)=>Math.max(...SIDES.map(s=>Math.hypot(a[s][0]-b[s][0],a[s][1]-b[s][1])));
/* Source « ecart » : complément du rail manquant par l'écartement de référence, depuis chaque rail trouvé (`quels` : 'les-deux' | 'gauche' |
 * 'droite'). Rend { decision, relance, raison, essais }. */
function sourceEcart(decider,args,cap,science,gRef,opts,quels='les-deux'){
  const trouves=SIDES.filter(s=>(quels==='les-deux'||FR[s]===quels)&&railTrouve(science.rails[s]));
  if(!trouves.length)return {decision:null,raison:'ecart:aucun-rail-trouve',essais:0};
  const poses=[];let essais=0;
  for(const sur of trouves){
    const t=railTrouve(science.rails[sur]),autre=sur==='left'?'right':'left';
    for(const sol of solutionsEcartement(cap,sur,t.delta,gRef)){
      essais++;
      const decalage={[sur]:[t.delta[1]*1000,t.delta[2]*1000],[autre]:[sol.lat,sol.vert]};
      const e=relancerDepuis(decider,args,cap,decalage,opts);
      if(e.decision.stage!=='deferred'&&e.decision.positions)poses.push({...e,sur,origine:t.origine,pose:poseMmDe(cap,e.decision)});
    }
  }
  if(!poses.length)return {decision:null,raison:'ecart:aucune-pose-qualifiee',essais};
  const groupes=[];for(const p of poses)if(!groupes.some(g=>ecartPoses(g.pose,p.pose)<=ECART.accordMm))groupes.push(p);
  if(groupes.length>1)return {decision:null,raison:'ecart:plusieurs',essais};
  return {...groupes[0],raison:null,essais,accord:poses.length};
}
/* Source « balayage » : la paire de départ glissée en travers à l'écartement de référence, le moteur relancé à chaque pas ; une seule voie
 * qualifiée ⇒ posée. Rend { decision, relance, raison, essais, voies }. */
function sourceBalayage(decider,args,cap,gRef,opts,o=BALAYAGE){
  const poses=[];let essais=0;
  for(let d=-o.porteeMm;d<=o.porteeMm+1e-9;d+=o.pasMm){
    for(const sol of solutionsEcartement(cap,'left',[0,d/1000,0],gRef)){
      essais++;
      const e=relancerDepuis(decider,args,cap,{left:[d,0],right:[sol.lat,sol.vert]},opts);
      if(e.decision.stage!=='deferred'&&e.decision.positions)poses.push({...e,pose:poseMmDe(cap,e.decision),depuisMm:d});
    }
  }
  const groupes=[];for(const p of poses)if(!groupes.some(g=>ecartPoses(g.pose,p.pose)<=o.groupeMm))groupes.push(p);
  if(!groupes.length)return {decision:null,raison:'balayage:aucune-voie',essais,voies:0};
  if(groupes.length>1)return {decision:null,raison:'plusieurs-voies:'+groupes.length,essais,voies:groupes.length};
  return {...groupes[0],raison:null,essais,voies:1};
}

/* ------------------------------------------------------------------ rejeu d'un lot */
function optionsDe(v){return {gap:v.gap,anchors:v.appuis,guardMm:v.fenetre,chooseMm:v.choix};}
function rejouerLot(ctx,v,{temoin=null,temoinAnchors=null,progression=null}={}){
  const {captures,ordre,ref,cache,lignesParCut,repere,zones}=ctx;
  temoinAnchors=temoinAnchors||temoin?.ancresParCut||null;
  const moteur=moteurMemoise(cache);
  const memoire={anchors:[],pending:[]};
  const resultats=new Map(),ancresParCut=new Map(),decisions=new Map(),commandes=new Map();
  const opts=optionsDe(v);
  let n=0;
  for(const cut of ordre){
    const cap=captures.get(cut);if(!cap)continue;
    n++;if(progression&&n%25===0)progression(v.id,n,ordre.length);
    /* Les cuts validés depuis la décision précédente deviennent appuis (le lot valide tous ses cuts posés). */
    for(const p of memoire.pending)L.rememberAnchor(memoire.anchors,p,40);
    memoire.pending=[];
    const ancres=v.memoire==='reelle'&&temoinAnchors?(temoinAnchors.get(cut)||[]):memoire.anchors;
    ancresParCut.set(cut,ancres.slice());
    const science=moteur.scientificProposeBoth(cap);
    const identity=K.completeIdentity(cap.identity);
    const args={capture:{identity,rails:cap.rails,pointsSceneRelative:cap.pointsSceneRelative,visibleByClipBoxes:cap.visibleByClipBoxes},
      science:{rails:science.rails,summary:science.summary},anchors:ancres,Shadow:moteur};
    /* Chaque décision garde le dernier résultat du moteur relancé depuis la voie (il lui appartient). */
    const decider=a=>{moteur.dernier=null;const d=L.decideCut(a);return {decision:d,relance:moteur.dernier};};
    /* 1. La décision du lot, telle qu'elle est (aucune option : gap 3, 2 appuis, garde de 30 mm). Les règles de premier passage ne changent donc pas. */
    let {decision,relance}=decider(args),source='lot',valides=[];
    /* 2. Seconde chance, pour les seuls cuts que le lot diffère (« dernier recours », comme B1) : voisins validés de la liste d'ESV, prolongement
     * sur plus de cuts, fenêtre d'acceptation et de choix de la variante. */
    if(decision.stage==='deferred'){
      const argsV={...args,options:opts};
      const Tc=repere?.parCadre?.[cap.identity?.frameId??'']?.T;
      if(v.b1&&lignesParCut&&Tc){
        const validated=B.appuis(fenetreListe(lignesParCut,cut),Tc,identity);
        if(validated.length){const e=decider({...argsV,validated});if(e.decision.stage!=='deferred'){decision=e.decision;relance=e.relance;source='b1';valides=validated;}}
      }
      if(decision.stage==='deferred'&&(v.source==='prolonge'||v.fenetre!==BASE.fenetre||v.choix!==BASE.choix)){
        const e=decider(argsV);if(e.decision.stage!=='deferred'){decision=e.decision;relance=e.relance;source=v.source==='prolonge'?'prolonge':'fenetre';}
      }
      /* CH-053-M : sources hors appui, sur les seuls cuts encore différés ; le motif du refus est gardé pour le détail. */
      let refusSource=null;
      if(decision.stage==='deferred'&&(v.ecart||v.balayage)){
        const gRef=ecartementReference(ctx,cut,ancres);
        if(v.ecart){const e=sourceEcart(decider,argsV,cap,science,gRef.mm,opts,v.ecart);
          if(e.decision){decision=e.decision;relance=e.relance;source='ecart';}else refusSource=e.raison;}
        if(decision.stage==='deferred'&&v.balayage){const b=sourceBalayage(decider,argsV,cap,gRef.mm,opts);
          if(b.decision){decision=b.decision;relance=b.relance;source='balayage';}else refusSource=b.raison;}
        if(decision.stage==='deferred'&&refusSource)decision={...decision,reason:refusSource+(decision.reason?' | '+decision.reason:''),gRef:gRef};
      }
      if(v.plafond&&decision.stage==='deferred'){
        const miens=[];
        for(let i=cut-5;i<=cut+5;i++){
          if(i===cut)continue;const c2=captures.get(i),rf=ref.get(i);
          if(!c2||!rf||!rf.mic||rf.classe!=='differee')continue;
          miens.push({identity:{part:identity.part,cut:i,frameId:identity.frameId??null},stage:'plafond',
            positions:Object.fromEntries(SIDES.map(s=>[s,positionMic(c2.rails[s],rf.mic[s])]))});
        }
        if(miens.length){const e2=decider({...argsV,validated:miens});if(e2.decision.stage!=='deferred'){decision=e2.decision;relance=e2.relance;source='plafond';valides=miens;}}
      }
    }
    /* Commande : la cible doit tomber dans la vue du rail, sauf si la vue est déplacée. */
    let runtime=null;try{runtime=Shadow.toRuntimeRails(science);}catch{runtime=null;}
    const cameras=v.vue==='deplacee'?camerasLarges(cap):L.viewCameras(cap);
    const command=runtime?L.commandRails({decision,runtimeRails:runtime,before:cap.rails,expectedPoses:K.expectedPoses,cameras})
      :{action:'defer',reason:'moteur'};
    let positions=null;
    if(command.action==='lot')positions=decision.positions;
    else if(command.action==='engine'&&runtime&&SIDES.every(s=>runtime[s].status==='candidate')){
      try{const e=K.expectedPoses({rails:cap.rails},runtime);positions=Object.fromEntries(SIDES.map(s=>[s,e[s].positionSceneRelative]));}catch{positions=null;}
    }
    /* CH-053-M : capture venue de l'Écho (sans caméra) : la commande refuse toute pose de la voie (« vue inconnue ») ; la vue est tenue pour
     * déplaçable (variantes à vue déplacée seulement) et la pose de la décision est prise telle quelle, comme CH-049-F. */
    if(!positions&&cap.sourceEcho&&v.vue==='deplacee'&&decision.positions&&['window','choice','crossing'].includes(decision.stage)&&/^vue-inconnue/.test(command.reason||''))positions=decision.positions;
    /* Tout rail posé doit être cliquable : un moteur dont la cible est hors de la vue arrête le lot (KI-051). */
    let bloqueHorsVue=false;
    if(positions&&v.vue==='seule'){const vv=vueNecessaire(cap,positions);if(!vv.dans){bloqueHorsVue=true;positions=null;}}
    /* Profondeur de chaîne : 0 pour une pose du moteur seul (premier passage), sinon 1 + la plus grande profondeur des appuis de la prédiction. */
    const profondeur=V.profondeur(decision,c=>ancres.find(a=>a.identity.cut===c)?.profondeur??0);
    const r={cut,stage:decision.stage,reason:decision.reason??null,action:command.action,commandReason:command.reason??null,source,profondeur,
      posee:!!positions,bloqueHorsVue,refuseVue:/^hors-vue/.test(command.reason||''),anchorsUsed:(decision.anchorsUsed||[]).slice(),fromPredictionMm:decision.fromPredictionMm??null,
      guardMm:decision.guardMm??null,validatedAnchors:decision.validatedAnchors||null,framed:!!decision.framedAnchors,
      moteur:decision.stage==='window'||decision.stage==='choice'?traceMoteur(relance):null,gRef:decision.gRef||null,
      choisi:decision.chosen?Object.fromEntries(Object.entries(decision.chosen).map(([k,c])=>[k,{deMm:c.fromPredictionMm??null,haut:c.top??null,flanc:c.face??null,rapport:c.lossRatio??null}])):null};
    if(positions){
      /* Déplacement depuis le départ et, pour une reprise ou un choix, écarts à la prédiction, dévers et écartement comparés à ceux
       * des appuis employés (module commun). */
      const m=V.mesures(cap,decision,positions,[...ancres,...valides]);
      r.deplacementMm=m.deplacementMm;
      r.vue=vueNecessaire(cap,positions);
      const mic=ref.get(cut)?.mic;
      if(mic)r.ecart=ecartAMic(cap,positions,mic);
      for(const k of ['devLatMm','devVertMm','deversEcartMm','ecartementMm','ecartVoisinMm'])if(m[k]!==undefined)r[k]=m[k];
      if(m.prediction&&mic)r.predictionEcartMm=Math.max(...SIDES.map(s=>Math.hypot(m.prediction[s][0]-mic[s][1],m.prediction[s][1]-mic[s][2])));
    }
    /* CH-056 — garde « après un différé » dans la boucle (src/garde-apres-differe.js, comme background.js `gardeApresDiffereCommande`) :
     * absente du témoin (le lot sans la garde) ; `v.garde` la rejoue avec ses réglages et ses variantes. */
    if(v.garde)garderApresDiffere(v.garde,ctx,cut,decision,command,positions,r,resultats)&&(positions=null);
    /* Règle prudente : elle ne juge que les poses NOUVELLES (un cut que le lot réel avait différé) ; les autres restent ce qu'elles sont. */
    if(positions&&v.regle&&temoin?.resultats.get(cut)?.posee===false){
      const motif=regleAccepte(v.regle,r,zones?.get(cut)||null,temoin.resultats.get(cut));
      if(motif){positions=null;r.posee=false;r.refuseRegle=motif;}
    }
    resultats.set(cut,r);decisions.set(cut,decision);commandes.set(cut,{action:command.action,reason:command.reason??null});
    /* L'appui proposé attend la validation du cut ; le lot valide ce qu'il pose. */
    if(positions&&decision.anchor&&L.commandsPositions(decision,command)&&decision.positions)
      memoire.pending.push({identity:{part:identity.part,cut,frameId:identity.frameId??null},positions:decision.positions,stage:decision.stage,profondeur});
  }
  return {resultats,ancresParCut,decisions,commandes};
}


/* ------------------------------------------------------------------ garde « après un différé » (CH-056) */
/* Rejoue la garde de background.js sur un cut que le lot allait VALIDER (commande `lot`, ou `engine` aux deux rails candidats, ici : une pose).
 * Différés du lot = cuts déjà rejoués non posés, hors cuts différés par la garde (pas de cascade) ; appuis comptés SANS la garde (borne haute
 * `appuisSansGardeMax` de background.js : + les cuts de la garde dans la fenêtre d'appuis du lot, au plus `anchors`). Variantes (CH-056,
 * rien de livré) : `zone` = 'tout' (livré) | 'pn-adv' (la garde ne joue qu'en PN ou ADV) | 'hors-pn-adv' ; `etages` = liste d'étages du lot
 * où elle joue (défaut : tous). La pose évitée reste jugée (`r.ecartSansGarde`) : c'est ce que la garde coûte ou évite. Rend vrai si différé. */
function garderApresDiffere(g,ctx,cut,decision,command,positions,r,resultats){
  if(!positions)return false;
  const R=GA.reglage({actif:true,regle:g.regle??'R3',coupures:g.coupures??2,appuisMin:g.appuisMin??2});
  const differesLot=[...resultats.values()].filter(x=>!x.posee&&!x.garde).map(x=>x.cut);
  const gap=L.DEFAULTS?.gap??3,max=L.DEFAULTS?.anchors??2,appuis=(decision.anchorsUsed||[]).length;
  let gardes=0;for(let c=cut-gap;c<cut;c++)if(resultats.get(c)?.garde)gardes++;
  const j=GA.juger({cut,differesLot,appuis:gardes?Math.min(max,appuis+gardes):appuis},R);
  if(!j.differer)return false;
  const z=ctx.journal?.zonesJournal?.[cut]||null,pnAdv=!!(z&&(z.pn||z.adv));
  if(g.zone==='pn-adv'&&!pnAdv||g.zone==='hors-pn-adv'&&pnAdv)return false;
  if(Array.isArray(g.etages)&&!g.etages.includes(decision.stage))return false;
  r.garde=true;r.gardeAppuis=j.appuis;r.gardeVoisins=j.voisinsDifferes;r.pnAdv=z?pnAdv:null;r.ecartSansGarde=r.ecart||null;
  r.posee=false;delete r.ecart;r.commandReason='garde-apres-differe';
  return true;
}

/* ------------------------------------------------------------------ règle prudente */
/* Règle de recentrage prudente, évaluée seulement sur les poses nouvelles : celle du module commun (`V.regle`, clés et motifs
 * décrits là-bas). Chaque seuil nul est inactif. */
const regleAccepte=V.regle;

/* ------------------------------------------------------------------ jugement et agrégats */
function jugement(r){
  if(!r.posee)return 'abstenu';
  if(!r.ecart)return 'non-juge';
  const e=r.ecart.pire;
  if(e>=MAUVAISE_VOIE_MM)return 'mauvaise-voie';
  if(e>FAUX_MM)return 'faux';
  return e<=JUSTE_MM[0]?'juste5':'juste10';
}
function compter(rows){
  const c={abstenu:0,juste5:0,juste10:0,faux:0,'mauvaise-voie':0,'non-juge':0};
  for(const r of rows)c[jugement(r)]++;
  return {abstenus:c.abstenu,poses:rows.length-c.abstenu,juste5:c.juste5,juste10:c.juste5+c.juste10,faux:c.faux+c['mauvaise-voie'],
    plus50:rows.filter(r=>r.posee&&r.ecart&&r.ecart.pire>=50).length,mauvaiseVoie:c['mauvaise-voie'],nonJuges:c['non-juge']};
}
function statsVue(rows){
  const poses=rows.filter(r=>r.posee&&r.vue);
  const hors=poses.filter(r=>!r.vue.dans);
  return {poses:poses.length,dansLaVue:poses.length-hors.length,exigentDeplacement:hors.length,
    dezoomMed:r2(med(hors.map(r=>r.vue.dezoom))),dezoomP90:r2(quantile(hors.map(r=>r.vue.dezoom),.9)),dezoomMax:r2(Math.max(0,...hors.map(r=>r.vue.dezoom))),
    panPxMed:r1(med(hors.map(r=>r.vue.panPx))),panPxP90:r1(quantile(hors.map(r=>r.vue.panPx),.9)),panPxMax:r1(Math.max(0,...hors.map(r=>r.vue.panPx))),
    panMmMed:r1(med(hors.map(r=>r.vue.panMm))),panMmMax:r1(Math.max(0,...hors.map(r=>r.vue.panMm))),
    dezoomJusqua:Object.fromEntries([1.1,1.25,1.5,2].map(k=>[k,hors.filter(r=>r.vue.dezoom<=k).length]))};
}
/* Dérive en chaîne : l'écart à l'opérateur des différés posés, par profondeur de chaîne. */
const TRANCHES=[[1,1],[2,2],[3,5],[6,10],[11,20],[21,Infinity]];
function statsProfondeur(rows){
  return TRANCHES.map(([a,b])=>{
    const rs=rows.filter(r=>r.posee&&r.profondeur>=a&&r.profondeur<=b),ec=rs.filter(r=>r.ecart).map(r=>r.ecart.pire);
    return {de:a,a:b===Infinity?null:b,n:rs.length,jugees:ec.length,medianeMm:r1(med(ec)),p90Mm:r1(quantile(ec,.9)),maxMm:r1(Math.max(0,...ec)),
      faux:ec.filter(e=>e>FAUX_MM).length};
  }).filter(t=>t.n>0);
}
/* Synthèse d'une variante contre le témoin : différés d'origine, posés d'origine. */
function synthese(v,run,temoin,ctx){
  const {ref}=ctx;
  const classe=c=>ref.get(c)?.classe||null;
  const diffCuts=[...run.resultats.keys()].filter(c=>classe(c)==='differee');
  const poseeCuts=[...run.resultats.keys()].filter(c=>classe(c)==='posee');
  const rowsD=diffCuts.map(c=>run.resultats.get(c)),rowsP=poseeCuts.map(c=>run.resultats.get(c));
  const out={id:v.id,variante:{...v},differes:{n:rowsD.length,...compter(rowsD),vue:statsVue(rowsD)}};
  out.differes.refusesParLaVue=rowsD.filter(r=>r.refuseVue).length;
  out.differes.refusesParLaRegle=rowsD.filter(r=>r.refuseRegle).length;
  out.differes.parEtage={};
  for(const r of rowsD.filter(r=>r.posee)){const k=r.stage+(r.source!=='lot'?'/'+r.source:'');out.differes.parEtage[k]=(out.differes.parEtage[k]||0)+1;}
  /* Effet sur les posés d'origine, contre le témoin. */
  const eff={n:rowsP.length,inchanges:0,deplaces:0,retires:0,juste10Perdu:0,fauxCorriges:0,fauxAjoutes:0,
    nouveauxDifferes:0};
  if(temoin)for(const c of poseeCuts){
    const a=temoin.resultats.get(c),b=run.resultats.get(c);if(!a||!b)continue;
    const ja=jugement(a),jb=jugement(b);
    if(a.posee&&!b.posee){eff.retires++;if(ja==='juste5'||ja==='juste10')eff.juste10Perdu++;if(ja==='faux'||ja==='mauvaise-voie')eff.fauxCorriges++;}
    else if(a.posee&&b.posee){
      const d=Math.max(...SIDES.map(s=>Math.hypot(a.deplacementMm[s][0]-b.deplacementMm[s][0],a.deplacementMm[s][1]-b.deplacementMm[s][1])));
      if(d>1){eff.deplaces++;
        const bon=x=>x==='juste5'||x==='juste10',mal=x=>x==='faux'||x==='mauvaise-voie';
        if(bon(ja)&&mal(jb))eff.fauxAjoutes++;if(mal(ja)&&bon(jb))eff.fauxCorriges++;if(bon(ja)&&!bon(jb)&&!mal(jb)){}}
      else eff.inchanges++;
    }
  }
  out.poses_origine={...eff,...compter(rowsP),vue:statsVue(rowsP)};
  out.profondeur=statsProfondeur(rowsD);
  if(v.b1)out.b1Journal=validerB1(run,ctx);
  return out;
}

/* Le témoin doit refaire le lot réel : mêmes cuts posés, mêmes étages, mêmes poses (à 0,5 mm). */
function validerTemoin(run,ctx){
  const out={cuts:0,poseeReelle:0,differeReel:0,memePose:0,poseeReelleDifferee:0,differeReelPosee:0,horsVue:0,etagesJournal:0,etagesComparables:0,poseAriane:{comparees:0,max:0}};
  for(const [cut,r] of run.resultats){
    const rf=ctx.ref.get(cut);if(!rf||(rf.classe!=='posee'&&rf.classe!=='differee'))continue;
    out.cuts++;
    if(rf.classe==='posee'){out.poseeReelle++;if(r.posee)out.memePose++;else out.poseeReelleDifferee++;}
    else{out.differeReel++;if(!r.posee)out.memePose++;else out.differeReelPosee++;}
    if(r.bloqueHorsVue)out.horsVue++;
    const jr=ctx.journal.b1[cut]?.reel;
    if(jr){out.etagesComparables++;if(jr===r.stage)out.etagesJournal++;}
    if(rf.classe==='posee'&&r.posee&&rf.ariane){
      const d=Math.max(...SIDES.map(s=>Math.hypot(r.deplacementMm[s][0]-rf.ariane[s][1],r.deplacementMm[s][1]-rf.ariane[s][2])));
      out.poseAriane.comparees++;out.poseAriane.max=Math.max(out.poseAriane.max,r2(d));
    }
  }
  return out;
}
/* B1 rejoué contre le journal : l'étage que la liste d'ESV aurait donné (événement `b1-ombre`, ombre de la 4.9.5.3) pour chaque différé.
 * Le journal le calcule avec les appuis réels du lot, sans le contrôle de la vue : la variante de comparaison est donc `b1-reelle`. */
function validerB1(run,ctx){
  const t={};
  for(const [cut,r] of run.resultats){
    if(ctx.ref.get(cut)?.classe!=='differee')continue;
    const j=ctx.journal.b1[cut];if(!j)continue;
    const mien=r.source==='b1'?r.stage:(r.stage==='deferred'?'deferred':'inchange');
    const leur=j.hypothese||'inchange';
    const k=leur+' -> '+mien;t[k]=(t[k]||0)+1;
  }
  return t;
}
/* Lignes de détail, sans coordonnée absolue : décalages en mm, comptes, numéros de cut. */
function detail(run,ctx){
  return [...run.resultats.values()].map(r=>({cut:r.cut,classe:ctx.ref.get(r.cut)?.classe||null,stage:r.stage,reason:r.reason,source:r.source,posee:r.posee,action:r.action,commandReason:r.commandReason,profondeur:r.profondeur,refuseVue:r.refuseVue,refuseRegle:r.refuseRegle||null,
    bloqueHorsVue:r.bloqueHorsVue,pire:r.ecart?r1(r.ecart.pire):null,jug:jugement(r),anchorsUsed:r.anchorsUsed,validatedAnchors:r.validatedAnchors,
    fromPredictionMm:r.fromPredictionMm,predictionEcartMm:r1(r.predictionEcartMm),devLatMm:r1(r.devLatMm),devVertMm:r1(r.devVertMm),deversEcartMm:r1(r.deversEcartMm),ecartVoisinMm:r1(r.ecartVoisinMm),ecartementMm:r1(r.ecartementMm),deplacementMm:r.deplacementMm?Object.fromEntries(SIDES.map(s=>[s,r.deplacementMm[s].map(r1)])):null,
    garde:r.garde||false,gardeAppuis:r.gardeAppuis??null,gardeVoisins:r.gardeVoisins||null,pnAdv:r.pnAdv??null,pireSansGarde:r.ecartSansGarde?r1(r.ecartSansGarde.pire):null,
    vue:r.vue?{dans:r.vue.dans,dezoom:r2(r.vue.dezoom),panPx:r1(r.vue.panPx),panMm:r1(r.vue.panMm)}:null,moteur:r.moteur,choisi:r.choisi,gRef:r.gRef||null}));
}

/* ------------------------------------------------------------------ exécution */
function preparer(opt,log=()=>{}){
  const partie=opt.partie?.length===1?opt.partie[0].partie:null;
  const captures=chargerCaptures(opt.corpus,partie);
  if(opt.echo?.length)completerParEcho(captures,opt.echo,partie,log);
  const journal=lireJournal(opt.journal,partie),ref=lireReference(opt.jointure);
  const ordre=journal.ordre.filter(c=>captures.has(c));
  for(const c of [...captures.keys()].sort((a,b)=>a-b))if(!ordre.includes(c))ordre.push(c);
  let lignesParCut=null,T=null,repere=null,tableListe=null;
  if(opt.lignes||opt.listeEsv){
    const lignes=opt.listeEsv?lignesDepuisInstantane(lireJson(opt.listeEsv)):lireLignes(opt.lignes);
    tableListe=lignes.table||null;
    repere=estimerT(lignes,captures);T=repere?repere.T:null;
    lignesParCut=new Map(lignes.map(l=>[l.cut,l]));
  }
  const zones=opt.zones?lireZones(opt.zones):null;
  const cache=new Map();lireCache(opt.cache,cache);
  return {captures,journal,ref,ordre,lignesParCut,T,repere,tableListe,zones,cache,cheminCache:opt.cache||null};
}
function executer(ctx,ids,log=()=>{}){
  const choisies=VARIANTES.filter(v=>!ids||ids.includes(v.id));
  const temoinRun=rejouerLot(ctx,VARIANTES.find(v=>v.id==='temoin'));
  const sorties=[];
  for(const v of choisies){
    const t0=Date.now();
    const run=v.id==='temoin'?temoinRun:rejouerLot(ctx,v,{temoin:temoinRun});
    const s=synthese(v,run,temoinRun,ctx);s.dureeS=Math.round((Date.now()-t0)/100)/10;
    sorties.push({synthese:s,run,detail:detail(run,ctx)});
    log(`${v.id} : ${s.dureeS} s — différés posés ${s.differes.poses}/${s.differes.n}, justes ≤10 mm ${s.differes.juste10}, faux ${s.differes.faux} (mauvaise voie ${s.differes.mauvaiseVoie})`);
  }
  return {temoin:temoinRun,sorties};
}


/* ------------------------------------------------------------------ ombre d'Orbite rejouée */
/* L'ombre `voie-predite-ombre` de l'extension (`V.evaluerDiffere`, le code même du service worker), rejouée le long d'un lot :
 * pour chaque cut que le lot réel (le témoin) a différé, ce qu'aurait donné la règle prudente, vue déplacée, avec les appuis
 * réels du lot et les poses de l'ombre comme appuis de l'ombre. Sert à deux choses : (1) vérifier que l'extension pose ce que
 * pose la règle du rejeu (concordance), (2) mesurer le poids des événements ajoutés aux exports (l'enveloppe est celle du
 * journal : identifiants, horodatage, type, lot, séance). Rend { evenements, resume }. */
function ombreLot(ctx,temoin,{seuils=V.REGLE_PRUDENTE,jugement=V.JUGEMENT}={}){
  const {captures,ordre,cache,ref}=ctx;
  const moteur=moteurMemoise(cache),mem=V.creerMemoire('rejeu'),evenements=[];
  for(const cut of ordre){
    const cap=captures.get(cut),t=temoin.resultats.get(cut),decision=temoin.decisions?.get(cut);if(!cap||!t||!decision)continue;
    const identity=K.completeIdentity(cap.identity);
    V.noterDecisionReelle(mem,identity,decision);
    if(t.posee)continue;
    const science=moteur.scientificProposeBoth(cap);
    let runtime=null;try{runtime=Shadow.toRuntimeRails(science);}catch{runtime=null;}
    const capture={identity,rails:cap.rails,pointsSceneRelative:cap.pointsSceneRelative,visibleByClipBoxes:cap.visibleByClipBoxes,camera:cap.camera,viewCaptures:cap.viewCaptures};
    const {evenement}=V.evaluerDiffere({mem,capture,science:{rails:science.rails,summary:science.summary},ancresReelles:temoin.ancresParCut.get(cut)||[],decisionReelle:decision,
      commandeReelle:temoin.commandes?.get(cut)||null,Shadow:moteur,runtimeRails:runtime,before:cap.rails,expectedPoses:K.expectedPoses,seuils});
    evenements.push(evenement);
  }
  /* Enveloppe d'un événement du journal (identifiants de même longueur que ceux de l'extension) ; seuils sur le premier seulement. */
  const enveloppe=(e,i)=>({eventId:'00000000-0000-4000-8000-000000000000',timestamp:'2026-01-01T00:00:00.000Z',type:'voie-predite-ombre',schema:1,
    batchId:'00000000-0000-4000-8000-000000000000',sessionId:'00000000-0000-4000-8000-000000000000',...e,...(i===0?{seuils:{...seuils,etages:[...seuils.etages]}}:{})});
  const lignes=evenements.map((e,i)=>JSON.stringify(enveloppe(e,i)));
  const octets=lignes.reduce((n,l)=>n+Buffer.byteLength(l)+1,0),gz=lignes.length?zlib.gzipSync(lignes.join('\n')+'\n').length:0;
  const juges={juste5:0,juste10:0,fausse:0,'mauvaise-voie':0,'non-jugee':0};
  for(const e of evenements.filter(x=>x.verdict.posable)){const m=ref?.get(e.identity.cut)?.mic;juges[V.juger(m?V.ecartPose(e.poseMm,m):null,jugement)]++;}
  const raisons={};for(const e of evenements.filter(x=>!x.verdict.posable)){const k=String(e.verdict.raison).split(':')[0];raisons[k]=(raisons[k]||0)+1;}
  const gestes={};for(const e of evenements.filter(x=>x.verdict.posable)){const k=e.vue?.geste||'aucun';gestes[k]=(gestes[k]||0)+1;}
  return {evenements,lignes,resume:{differes:evenements.length,posables:evenements.filter(e=>e.verdict.posable).length,recalcules:evenements.filter(e=>e.recalcule).length,
    jugement:{juste5:juges.juste5,juste10:juges.juste5+juges.juste10,fausse:juges.fausse,mauvaiseVoie:juges['mauvaise-voie'],nonJugees:juges['non-jugee'],seuils:{...jugement}},
    gestes,refus:raisons,octetsJson:octets,octetsParEvenement:evenements.length?Math.round(octets/evenements.length):0,octetsGzip:gz}};
}

/* ------------------------------------------------------------------ fixture synthétique */
/* Une voie droite le long de x, deux rails à 1 430 mm, un champignon de 64 mm (dessus à plat, flanc intérieur vertical), des points
 * de dessus et de flanc, des points de ballast, une caméra orthographique de ±200 mm par rail (comme ESV). Les `premiers` cuts ont
 * leur pose de départ à `erreurDepartMm` de la vérité (le moteur les trouve seul, ils deviennent des appuis) ; les suivants ont toute
 * la voie décalée de `decalageMm` (plus loin que la fenêtre d'analyse de ±180 mm et que la vue de ±200 mm) : le moteur s'abstient,
 * la voie prédite par les appuis le retrouve, et le clic tombe hors de la vue. La pose de l'opérateur est la vérité. Aucune donnée réelle. */
function aleatoire(graine){let a=graine>>>0;return()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
/* CH-053-M : `decalageMm` peut être donné par rail ({left, right}) ; `voiesMm` ajoute des voies entières (mêmes rails, mêmes points) décalées
 * en travers de la vraie voie, pour mesurer l'abstention du balayage devant plusieurs voies. */
function fixtureSynthetique({coupes=7,premiers=3,decalageMm=230,erreurDepartMm=6,bruitMm=.5,graine=7,origine=[300,400,-5],voiesMm=[]}={}){
  const rnd=aleatoire(graine),gauss=()=>{let u=0;for(let i=0;i<6;i++)u+=rnd();return(u-3)*Math.SQRT2;};
  const LARGEUR=.064,vue={left:0,top:0,width:1042,height:944};
  const captures=new Map(),ref=new Map(),ordre=[];
  const decalDe=s=>typeof decalageMm==='object'&&decalageMm?decalageMm[s]:decalageMm;
  for(let cut=1;cut<=coupes;cut++){
    const x=origine[0]+cut,sceneFrame='f-synth';
    const rails={},points=[],visible=[];
    const lat0={left:origine[1]+.715,right:origine[1]-.715};
    const decals={};
    for(const s of SIDES){
      const decal=(cut<=premiers?erreurDepartMm:decalDe(s))/1000;decals[s]=decal;
      const sens=s==='left'?1:-1,vrai=[x,lat0[s],origine[2]],depart=[x,lat0[s]+decal,origine[2]];
      const P=C.translation(depart),M=C.inverse(P);
      /* contour du champignon dans le repère de scène, sommets tous les 2 mm (dessus, flanc intérieur, dessous) */
      const verts=[];
      for(let u=0;u<=LARGEUR+1e-9;u+=.002)verts.push([x,depart[1]+sens*u,depart[2]]);
      for(let z=-.002;z>=-.05;z-=.002)verts.push([x,depart[1],depart[2]+z]);
      for(let u=.002;u<=LARGEUR+1e-9;u+=.002)verts.push([x,depart[1]+sens*u,depart[2]-.05]);
      rails[s]={positionSceneRelative:depart,profileOriginSceneRelative:depart.slice(),profileAxisLengthsSceneUnits:[1,1,1],
        railLocalToSceneRelative:P.slice(),profileLocalToSceneRelative:P.slice(),sceneRelativeToProfileLocal:M,rotation:[0,0,0,1],profileRotation:[0,0,0,1],
        profileContours:[{type:'Line',verticesSceneRelative:verts}]};
      for(const off of [0,...voiesMm]){const y=vrai[1]+off/1000;
        for(let i=0;i<220;i++){const u=rnd()*LARGEUR;points.push([x+(rnd()-.5)*.3,y+sens*u+gauss()*bruitMm/1000,vrai[2]+gauss()*bruitMm/1000]);visible.push(true);}
        for(let i=0;i<90;i++){const z=-.004-rnd()*.032;points.push([x+(rnd()-.5)*.3,y+gauss()*bruitMm/1000,vrai[2]+z+gauss()*bruitMm/1000]);visible.push(true);}
        for(let i=0;i<30;i++){points.push([x+(rnd()-.5)*.3,y-sens*(.03+rnd()*.1),vrai[2]-.06-rnd()*.03]);visible.push(true);}
      }
    }
    const camera=p=>({type:'OrthographicCamera',
      sceneRelativeToCamera:[0,0,1,0, 1,0,0,0, 0,1,0,0, -p[1],-p[2],-p[0],1],
      projection:[5,0,0,0, 0,5.519,0,0, 0,0,-7.5e-5,0, 0,0,0,1],viewport:{...vue}});
    captures.set(cut,{cut,captureId:'synth-'+cut,identity:{pageId:'synth',part:1,cut,shape:'U50',frameId:sceneFrame,projectId:null},rails,
      pointsSceneRelative:points,visibleByClipBoxes:visible,camera:camera(rails.left.positionSceneRelative),
      viewCaptures:SIDES.map(s=>({camera:camera(rails[s].positionSceneRelative)}))});
    const mic=Object.fromEntries(SIDES.map(s=>[s,[0,-decals[s]*1000,0]]));
    ref.set(cut,{classe:cut<=premiers?'posee':'differee',mic,ariane:null});
    ordre.push(cut);
  }
  return {captures,ref,ordre,cache:new Map(),lignesParCut:null,T:null,journal:{ordre,b1:{}}};
}


/* Une ligne par cut : étage, source, jugement, écart à l'opérateur, décalage depuis la pose de départ et besoin de vue (séparateur « ; »). */
function csvVariante(rows){
  const e=['cut','classe_lot','etage','source','posee','jugement','ecart_Mic_mm','profondeur','ecart_voie_mm','dans_la_vue','dezoom','glissement_px','glissement_mm','refuse_vue','refuse_regle'];
  const f=v=>v==null?'':typeof v==='number'?String(v).replace('.',','):String(v);
  return [e.join(';'),...rows.map(r=>[r.cut,r.classe,r.stage,r.source,r.posee?'oui':'non',r.jug,r.pire,r.profondeur,r.fromPredictionMm,r.vue?(r.vue.dans?'oui':'non'):'',r.vue?.dezoom,r.vue?.panPx,r.vue?.panMm,
    r.refuseVue?'oui':'',r.refuseRegle||''].map(f).join(';'))].join('\n')+'\n';
}

/* ------------------------------------------------------------------ rapport */
function rapportTexte(sorties){
  const vs=sorties.flatMap(o=>o.variantes);
  const L1=['| variante | posés | juste ≤5 mm | juste ≤10 mm | faux (>10) | dont ≥50 mm | mauvaise voie (≥100) | abstenus | dans la vue | exigent la vue | dézoom P90 / max | glissement P90 / max (px) |','|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---|'];
  for(const v of vs){const d=v.differes,w=d.vue;
    L1.push(`| ${v.id} | ${d.poses} | ${d.juste5} | ${d.juste10} | ${d.faux} | ${d.plus50} | ${d.mauvaiseVoie} | ${d.abstenus} | ${w.dansLaVue} | ${w.exigentDeplacement} | ${w.dezoomP90??'–'} / ${w.dezoomMax||'–'} | ${w.panPxP90??'–'} / ${w.panPxMax||'–'} |`);}
  const L2=['| variante | posés d\'origine | inchangés | déplacés | retirés | justes perdus | faux ajoutés | faux corrigés |','|---|---:|---:|---:|---:|---:|---:|---:|'];
  for(const v of vs){const e=v.poses_origine;L2.push(`| ${v.id} | ${e.n} | ${e.inchanges} | ${e.deplaces} | ${e.retires} | ${e.juste10Perdu} | ${e.fauxAjoutes} | ${e.fauxCorriges} |`);}
  const L3=['| variante | profondeur | posés | jugés | médiane (mm) | P90 (mm) | max (mm) | faux |','|---|---|---:|---:|---:|---:|---:|---:|'];
  for(const v of vs)for(const t of v.profondeur||[])L3.push(`| ${v.id} | ${t.de}${t.a===t.de?'':t.a?'–'+t.a:'+'} | ${t.n} | ${t.jugees} | ${t.medianeMm??'–'} | ${t.p90Mm??'–'} | ${t.maxMm??'–'} | ${t.faux} |`);
  return ['## Différés','',...L1,'','## Cuts posés d\'origine','',...L2,'','## Dérive en chaîne (différés posés)','',...L3,''].join('\n');
}

/* ------------------------------------------------------------------ CLI */
function lireArgs(argv){
  const o={corpus:[],variantes:null};
  for(let i=0;i<argv.length;i++){
    const a=argv[i],val=()=>argv[++i];
    if(a==='--corpus')o.corpus.push(val());else if(a==='--journal')o.journal=val();else if(a==='--jointure')o.jointure=val();
    else if(a==='--lignes')o.lignes=val();else if(a==='--cache')o.cache=val();else if(a==='--detail')o.detail=val();else if(a==='--csv')o.csv=val();else if(a==='--zones')o.zones=val();else if(a==='--sortie')o.sortie=val();
    else if(a==='--ombre')o.ombre=val();
    else if(a==='--echo')(o.echo=o.echo||[]).push(val());else if(a==='--liste-esv')o.listeEsv=val();
    else if(a==='--partie')o.partie=Manifeste.lireDesignations(val());else if(a==='--juger-partie-reservee')o.jugerReservee=true;
    else if(a==='--variantes')o.variantes=val().split(',');else if(a==='--essai')o.essai=true;else if(a==='--liste')o.liste=true;
    else if(a==='--rapport'){o.rapport=[];while(i+1<argv.length&&!argv[i+1].startsWith('--'))o.rapport.push(argv[++i]);}
    else throw Error('Option inconnue : '+a);
  }
  return o;
}
function main(argv=process.argv.slice(2)){
  const o=lireArgs(argv);
  /* Manifeste des parties (B1) : une partie réservée n'est pas rejouée par un outil de réglage, sauf pour la juger sans rien régler. */
  if(o.partie){const {avis}=Manifeste.controler(Manifeste.lire(),o.partie,{outil:'rejeu-voie-predite',jugerReservee:!!o.jugerReservee});if(avis)console.error(avis);}
  if(o.liste){for(const v of VARIANTES)console.log(v.id);return;}
  if(o.rapport){console.log(rapportTexte(o.rapport.map(lireJson)));return;}
  if(o.essai){const ctx=fixtureSynthetique(),res=executer(ctx,['temoin','vue-reelle','vue-serie'],m=>console.error(m));
    console.log(rapportTexte(res.sorties.map(x=>({variantes:[x.synthese]}))));return;}
  if(!o.corpus.length||!o.journal||!o.jointure)throw Error('Usage : --corpus SEG [--corpus SEG...] --journal J --jointure JT [--lignes L | --liste-esv I.json] [--echo S.json] [--partie P:N] [--zones Z] [--variantes ids] [--sortie S] [--ombre O.jsonl]');
  const ctx=preparer(o,m=>console.error(m));
  console.error(`captures ${ctx.captures.size}, cuts rejoués ${ctx.ordre.length}${ctx.repere?`, T sur ${ctx.repere.paires} paires, ${ctx.repere.cadres} cadre(s) de scène (écart max ${r2(ctx.repere.ecartMaxMm)} mm)`:''}`);
  const res=executer(ctx,o.variantes,m=>console.error(m));
  ecrireCache(ctx.cheminCache,ctx.cache);
  const sortie={format:'ariane-rejeu-voie-predite-v1',cutsRejoues:ctx.ordre.length,repere:ctx.repere?{paires:ctx.repere.paires,cadres:ctx.repere.cadres,ecartMaxMm:r2(ctx.repere.ecartMaxMm),rigideMaxMm:r2(ctx.repere.rigideMaxMm)}:null,
    temoin:validerTemoin(res.temoin,ctx),variantes:res.sorties.map(x=>x.synthese)};
  if(o.detail)fs.writeFileSync(o.detail,JSON.stringify(Object.fromEntries(res.sorties.map(x=>[x.synthese.id,x.detail]))));
  /* Un CSV par variante (hors dépôt) : pour chaque cut, la pose du rejeu, son jugement et ce que la vue exige. */
  if(o.csv)for(const x of res.sorties)fs.writeFileSync(o.csv.replace('{id}',x.synthese.id),csvVariante(x.detail));
  /* `--ombre FICHIER.jsonl` : l'ombre d'Orbite rejouée sur le lot (événements tels que l'extension les consignerait). */
  if(o.ombre){const om=ombreLot(ctx,res.temoin);fs.writeFileSync(o.ombre,om.lignes.join('\n')+(om.lignes.length?'\n':''));sortie.ombre=om.resume;
    console.error(`ombre voie-predite : ${om.resume.differes} différés, ${om.resume.posables} posables (${om.resume.jugement.juste10} justes à 10 mm, ${om.resume.jugement.fausse} fausses, ${om.resume.jugement.mauvaiseVoie} mauvaise voie), ${om.resume.octetsJson} octets (${om.resume.octetsGzip} compressés)`);}
  if(o.sortie)fs.writeFileSync(o.sortie,JSON.stringify(sortie,null,1)+'\n');else console.log(JSON.stringify(sortie,null,1));
}
if(require.main===module){try{main();}catch(e){console.error(e.stack||e);process.exitCode=1;}}
module.exports={VARIANTES,variante,garderApresDiffere,gardeVariantes,chargerCaptures,lireJournal,lireReference,lireZones,estimerT,fenetreListe,lignesDepuisInstantane,completerParEcho,ecartementReference,railTrouve,solutionsEcartement,sourceEcart,sourceBalayage,ECART,BALAYAGE,vueNecessaire,camerasLarges,localMm,ecartAMic,
  fixtureSynthetique,regleAccepte,ombreLot,csvVariante,rapportTexte,rejouerLot,executer,synthese,validerTemoin,validerB1,detail,lireCache,ecrireCache,jugement,compter,statsVue,preparer,positionMic,main,FAUX_MM,MAUVAISE_VOIE_MM};
