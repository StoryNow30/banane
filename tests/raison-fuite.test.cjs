'use strict';
/* RM-11 (test 9, fiches/RM11_RAISON_CORRECTION.md § 5.3, essai 4) — RÈGLE ANTI-FUITE : la raison est une information humaine, posée parce que l'opérateur a
 * vu et corrigé. Elle appartient à l'ÉTIQUETTE (la sortie qu'on veut deviner), jamais aux TRAITS (l'entrée dont Ariane dispose quand elle décide). Même une
 * collante posée au cut N et reportée au cut N+1. Trois essais, comme pour la référence humaine :
 *  (a) changer ou retirer la raison d'une visite ne change aucun trait du jeu (octet pour octet) ;
 *  (b) la liste des traits de l'apprentissage ne contient aucun nom de raison, et aucun trait n'en cite la valeur ;
 *  (c) une recherche de texte : la raison n'apparaît que dans les fichiers prévus.
 * (Le jeu de la GCV2 — gcv2-jeu.cjs, gcv2-apprendre.cjs — n'est pas dans cette branche : l'essai (a) est fait sur le jeu d'apprentissage v1, qui est le seul
 * jeu qu'elle contient ; la fiche de la GCV2 reprendra les mêmes trois essais sur le sien.) */
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const J=require('../tools/jointure-echo-orbite.cjs'),G=require('../tools/jeu-apprentissage.cjs'),A=require('../tools/apprentissage-g0.cjs');
const racine=path.resolve(__dirname,'..'),lire=f=>fs.readFileSync(path.join(racine,f),'utf8');
const DOSSIER=path.join(__dirname,'fixtures','jointure'),JOURNAL=path.join(DOSSIER,'ariane-journal-v4-synthetique.json');

const raison=(code,source='touche',serie=null)=>({format:'ariane-raison-v1',code,source,serie,poseeA:'2031-05-01T08:00:00.000Z',eventSeq:3,apresValidationMs:null,historique:[]});
/* Le jeu de la jointure synthétique (partie 99, cuts joints à un journal), avec la raison donnée à chaque visite par `quelle(visite, rang)`. */
function jeu(quelle){
 const echo=J.lireEcho([DOSSIER]),records=echo.records.map((r,i)=>{const c=JSON.parse(JSON.stringify(r)),x=quelle(c,i);if(x)c.raisonCorrection=x;return c;});
 const {table,resume}=J.joindre(records,J.lireJournal(JOURNAL),{sessions:echo.sessions});
 return {table,jeu:G.construire({format:'ariane-jointure-echo-orbite-v1',options:{base:'auto'},resume,table},{horsJournal:true})};
}
const TOUTES=['rail-voisin','adv','pn','nuage-pauvre','hauteur','autre'];

test('(a) changer ou retirer la raison d\'une visite ne change aucun trait du jeu, octet pour octet ; seule l\'étiquette porte la raison',()=>{
 const sans=jeu(()=>null),a=jeu((r,i)=>raison(TOUTES[i%6])),b=jeu((r,i)=>raison(TOUTES[(i+3)%6],'collante',2)),c=jeu(()=>raison(null));
 const traits=j=>JSON.stringify(j.jeu.cuts.map(x=>[x.partie,x.cut,x.classe,x.joint,x.traits,x.qualite]));
 assert.ok(sans.jeu.cuts.length>=5&&sans.jeu.cuts.some(x=>x.traits),'le jeu a des cuts joints à un journal, donc des traits');
 assert.equal(traits(a),traits(sans));assert.equal(traits(b),traits(sans));assert.equal(traits(c),traits(sans));
 /* la raison arrive côté étiquette, et là seulement */
 assert.ok(a.jeu.cuts.some(x=>x.etiquette.raisonHumaine));assert.ok(a.jeu.cuts.every(x=>!/raisonHumaine|raisonCorrection/.test(JSON.stringify([x.traits,x.qualite]))));
 const sansRaison=e=>{const {raisonHumaine,...reste}=e;return reste;};
 assert.equal(JSON.stringify(a.jeu.cuts.map(x=>sansRaison(x.etiquette))),JSON.stringify(sans.jeu.cuts.map(x=>sansRaison(x.etiquette))),'le reste de l\'étiquette est inchangé');
 assert.equal(sans.jeu.cuts.some(x=>'raisonHumaine' in x.etiquette),false,'sans raison : inconnue, le champ n\'existe pas');
 assert.equal(c.jeu.cuts.some(x=>'raisonHumaine' in x.etiquette),false,'raison effacée (code nul) : inconnue');
 /* les lignes de la jointure : la raison n'entre dans aucune grandeur de la ligne, hors son propre champ et les mesures de la visite */
 const nue=t=>JSON.stringify(t.table.map(({raisonHumaine,...l})=>l));assert.equal(nue(a),nue(sans));assert.equal(nue(b),nue(sans));
 /* l'en-tête du jeu et ses lignes de trait sont ceux d'avant */
 assert.equal(JSON.stringify(a.jeu.entete.absents.includes('raison de la correction (E3)')),'false');assert.equal(sans.jeu.entete.absents.includes('raison de la correction (E3)'),true);
});
test('(a) une collante posée au cut N et reportée au cut N+1 n\'entre pas non plus dans les traits du cut N+1',()=>{
 const sans=jeu(()=>null),collante=jeu((r,i)=>raison('adv','collante',1));
 const traits=j=>JSON.stringify(j.jeu.cuts.map(x=>x.traits));assert.equal(traits(collante),traits(sans));
 assert.ok(collante.jeu.cuts.every(x=>x.etiquette.raisonHumaine?x.etiquette.raisonHumaine.source==='collante':true));
 /* le voisinage (classes des cuts d'avant) est celui du journal : aucune raison de cuts voisins */
 assert.ok(!JSON.stringify(collante.jeu.cuts.map(x=>x.traits?.voisinage)).includes('raison'));
});

test('(b) la liste des traits de l\'apprentissage ne contient aucun nom de raison, et chaque trait ignore la raison de la ligne',()=>{
 assert.ok(Array.isArray(A.TRAITS)&&A.TRAITS.length>10);
 for(const t of A.TRAITS)assert.ok(!/raison/i.test(t.nom),t.nom);
 /* les calculs des traits : aucun ne lit un champ de raison (texte de la fonction) */
 for(const t of A.TRAITS)assert.ok(!/raison(Humaine|Correction)/.test(String(t.f)),t.nom);
 /* et le résultat d'un trait ne change pas quand la ligne porte une raison */
 const ligne={cut:5,partie:9,voisin:{distRouge:2,grappeTaille:3,grappeBord:1},traits:{g0:{dzMm:2,rails:{left:{dzMm:2}}}},propositions:null};
 for(const t of A.TRAITS){const avant=t.f(ligne);const avec=t.f({...ligne,raisonHumaine:{code:'adv',source:'collante',serie:1},etiquette:{raisonHumaine:{code:'pn'}}});assert.deepEqual(avec,avant,t.nom);}
});

test('(c) recherche de texte : la raison n\'apparaît que dans les fichiers prévus de src/, et dans aucun fichier qui fabrique des traits',()=>{
 const prevus=new Set(['src/raison-correction.js','src/native-session.js','src/settings.js']);
 const trouves=fs.readdirSync(path.join(racine,'src')).filter(f=>f.endsWith('.js')).map(f=>'src/'+f).filter(f=>/raisonCorrection|BananeRaisonCorrection|raison-correction|raisonHumaine|raisonSeries/.test(lire(f)));
 /* native-export.js ne cite que le nom d'une clé d'en-tête (`raisonSeries`), pour l'écrire une fois */
 const hors=trouves.filter(f=>!prevus.has(f)&&f!=='src/native-export.js');assert.deepEqual(hors,[],'fichiers de src/ qui citent la raison sans être prévus');
 assert.ok(!/raisonCorrection|raisonHumaine/.test(lire('src/native-export.js')),'le compactage ne filtre ni ne lit le champ de la visite');
 /* aucun module de traits ni de décision */
 for(const f of ['src/engine.js','src/geometry.js','src/geometry-brain.js','src/geometry-candidate-v1.js','src/placement-convention.js','src/lot-decision.js','src/continuity-observer.js','src/voie-recentree.js','src/regles-metier.js',
  'src/hauteur-apprise.js','src/faux-vert-ombre.js','src/verts-a-controler.js','src/relecture-ombre.js','src/relecture-critere.js','src/gcv1-shadow.js','src/appuis-liste.js','src/liste-memoire.js','src/level-crossing.js','src/adapter-page.js','src/early-input.js'])
  assert.ok(!/raison[A-Z-]|ariane-raison|BananeRaison/.test(lire(f)),f);
 /* hors de src/, seuls le panneau et le service worker (affichage, réglage, secours) et les outils d'étiquette */
 const outils=fs.readdirSync(path.join(racine,'tools')).filter(f=>/\.(cjs|js|py)$/.test(f)).filter(f=>/raisonHumaine|raisonCorrection|raisonSeries/.test(lire('tools/'+f)));
 assert.deepEqual(outils.sort(),['jeu-apprentissage.cjs','jointure-echo-orbite.cjs'],'les outils qui lisent la raison : la jointure (étiquette) et le jeu (étiquette)');
});
test('(c) la session Écho ne passe la raison ni à l\'entrée sans fuite, ni aux ombres, ni à la pose de départ, ni aux captures',()=>{
 const src=lire('src/native-session.js');
 /* Corps d'une méthode ou d'une fonction, par appariement des accolades à partir de sa signature. */
 /* Ce qui lit la raison de la correction (et non le mot « raison » d'un verdict ou d'un message, qui existait déjà). */
 const LIT=/raisonCorrection|raisonHumaine|raisonSeries|n\.raison\b|\.raison\.|\bR\.[a-zA-Z]+\(|raisonFrappe|raisonFin|raisonResume|raisonPoser|raisonPanneau/;
 const corps=signature=>{const i=src.indexOf(signature);assert.ok(i>=0,signature);let n=0,j=src.indexOf('{',i);const debut=j;
  for(;j<src.length;j++){if(src[j]==='{')n++;else if(src[j]==='}'&&--n===0)break;}return src.slice(debut,j+1);};
 for(const signature of ['function entreeSansFuite(','async observeContinuity(','async observeMemoire(','continuityTools(','memoireOutils(','valideePourMemoire(','differesDuLot(','async writeContinuity('.replace('async ','')])
  assert.ok(!LIT.test(corps(signature)),signature+' : ne lit pas la raison');
 for(const signature of ['establishBefore(','classify(','chooseGeometry(','summariseGesture(','visitRelation(','crossSessionIndex(','redactedEvent(','partialReason('])
  assert.ok(!LIT.test(corps(signature)),signature+' : ne lit pas la raison');
 /* le traitement des événements : la raison n'est citée que dans les crochets prévus (héritage à l'ouverture, frappe, fin de séance, résumé), jamais dans la pose de départ,
  * la référence humaine, les états, les captures */
 const handle=corps('async handle(type,data)');
 const citations=handle.split('\n').filter(l=>LIT.test(l));
 assert.equal(citations.length,3,'les seules lignes de handle() qui citent la raison :\n'+citations.join('\n'));
 assert.ok(/^\s*if\(n\.raison\)try\{const h=R\.heriter\(/.test(citations[0]),'à l\'ouverture de la visite : l\'héritage de la collante');
 assert.ok(/^\s*if\(record\.raisonCorrection\)n\.visits\.at\(-1\)\.raison=/.test(citations[1]),'le résumé de la visite pour la bande du panneau');
 assert.ok(/^\s*if\(n\.raison\)try\{await this\.raisonFrappe\(record,observed\)/.test(citations[2]),'à la frappe d\'un operator-event, après qu\'elle est consignée');
 const pose=handle.slice(handle.indexOf('if(!record.startPose&&data.stateObservedBeforeInput'),handle.indexOf('if(observed.intent){'));assert.ok(pose.length>200&&!LIT.test(pose),'startPose');
 const ref=handle.slice(handle.indexOf('if(observed.intent){const state='),handle.indexOf('/* RM-11 : une touche de raison'));assert.ok(ref.length>500&&!LIT.test(ref),'référence humaine');
 for(const type of ["if(type==='capture-checkpoint'){","if(type==='capture-ready'){","if(type==='state-observed'){"]){const i=handle.indexOf(type);assert.ok(i>=0);assert.ok(!LIT.test(handle.slice(i,handle.indexOf("\n   if(type==",i+10))),type);}
 /* la visite n'est lue pour sa raison que par la méthode de la raison */
 assert.ok(/record\.raisonCorrection/.test(corps('async raisonPoser(')));
});
