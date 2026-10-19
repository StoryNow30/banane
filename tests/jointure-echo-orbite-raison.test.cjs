'use strict';
/* RM-11 (test 9, fiches/RM11_RAISON_CORRECTION.md § 5.2, essai 5) — la raison de la correction dans les outils d'analyse :
 *  - `tools/jointure-echo-orbite.cjs` : la ligne d'un cut gagne `raisonHumaine` (lue sur la visite qui porte la référence humaine, à défaut sur la dernière
 *    visite du cut qui en a une), la durée de visite et le temps entre le dernier geste de rail et la validation (mesure de base), deux colonnes CSV
 *    AJOUTÉES À LA FIN, un résumé `raison` (comptes par code, couverture des corrections de plus de 10 et de plus de 5 mm, séries, mesures avec et sans raison) ;
 *  - `tools/jeu-apprentissage.cjs` : la raison va dans `etiquette`, jamais dans `traits` ;
 *  - rien ne change quand aucune raison n'existe (sortie identique octet pour octet), absent = inconnu. Données synthétiques. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const J=require('../tools/jointure-echo-orbite.cjs'),G=require('../tools/jeu-apprentissage.cjs');
const {visite,decaler,exportEcho}=require('./helpers/jointure-synthetique.cjs');

const G0=[0,0,0],D0=[1.435,0,0];
const dz=mm=>[decaler(G0,0,0,mm/1000),decaler(D0,0,0,mm/1000)];
const raison=(code,source='touche',extra={})=>({format:'ariane-raison-v1',code,source,serie:source==='collante'?1:null,poseeA:'2031-05-01T08:00:00.000Z',eventSeq:7,apresValidationMs:null,historique:[],...extra});
/* Une visite de 10 s, validée à la 8e seconde, dont le dernier geste de rail est à la 5e. */
function v(cut,mm,{raisonCorrection,index=cut,session='s1',decalage=0,gesteS=5,valideS=8}={}){
 const r=visite({session,index,cut,debut:{minutes:cut-1000+decalage,secondes:0},fin:{minutes:cut-1000+decalage,secondes:10},initiale:dz(0),validation:mm===null?undefined:dz(mm)});
 const t=s=>new Date(Date.parse(r.startedAt)+s*1000).toISOString();
 if(mm!==null){r.operatorIntents=[{intent:'VALIDATE',observedAt:t(valideS)}];if(mm>0)r.railPoseHistory=[{observedAt:t(gesteS),eventSeq:1}];}
 if(raisonCorrection!==undefined)r.raisonCorrection=raisonCorrection;
 return r;
}
const RECORDS=()=>[
 v(1001,15,{raisonCorrection:raison('adv','touche',{apresValidationMs:300})}),
 v(1002,12,{raisonCorrection:raison('adv','collante')}),
 v(1003,20),
 v(1004,7,{raisonCorrection:raison('hauteur')}),
 v(1005,null,{raisonCorrection:raison('pn'),index:50}),v(1005,8,{index:51,decalage:1}),   // la raison est sur la première visite du cut, la référence sur la seconde
 v(1006,0,{raisonCorrection:raison(null)}),                                                  // effacée : aucune raison
 v(1007,3),
];
const SERIES=[{serie:1,code:'adv',partie:90,cutDebut:1001,cutFin:1002,nCuts:2,finPar:'touche-0'}];
const joindre=(records=RECORDS(),options={})=>J.joindre(records,{events:[],records:[]},{sansJournal:true,...options});
const ligne=(table,cut)=>table.find(l=>l.cut===cut);

test('la ligne d\'un cut porte la raison de la visite de référence, à défaut celle de la dernière visite du cut qui en a une ; absent = inconnu',()=>{
 const {table}=joindre();
 assert.deepEqual(ligne(table,1001).raisonHumaine,{code:'adv',source:'touche',serie:null,apresValidation:true});
 assert.deepEqual(ligne(table,1002).raisonHumaine,{code:'adv',source:'collante',serie:1,apresValidation:false});
 assert.deepEqual(ligne(table,1004).raisonHumaine,{code:'hauteur',source:'touche',serie:null,apresValidation:false});
 assert.deepEqual(ligne(table,1005).raisonHumaine,{code:'pn',source:'touche',serie:null,apresValidation:false},'raison de la première visite du cut, référence sur la seconde');
 for(const cut of [1003,1006,1007])assert.equal('raisonHumaine' in ligne(table,cut),false,`cut ${cut} : inconnue, jamais « bon » ni « autre »`);
});
test('la raison ne change aucune autre colonne de la ligne : mêmes lignes qu\'avec les visites sans raison, hors le champ ajouté',()=>{
 const avec=joindre().table,sans=joindre(RECORDS().map(r=>{const {raisonCorrection,...reste}=r;return reste;})).table;
 const retire=l=>{const {raisonHumaine,dureeVisiteS,gesteValidationS,...reste}=l;return reste;};
 assert.deepEqual(avec.map(retire),sans.map(retire));
 assert.equal(sans.some(l=>'raisonHumaine' in l),false);
});
test('mesure de base : durée de la visite et temps entre le dernier geste de rail et la validation, par cut',()=>{
 const {table}=joindre();
 assert.equal(ligne(table,1001).dureeVisiteS,10);assert.equal(ligne(table,1001).gesteValidationS,3);
 assert.equal(ligne(table,1003).dureeVisiteS,10);
 assert.equal('gesteValidationS' in ligne(table,1006),false,'aucun geste de rail vu : pas de durée inventée');
 assert.equal(ligne(table,1005).dureeVisiteS,10,'la visite de référence');
});
test('résumé : comptes par code, couverture des corrections de plus de 10 mm et de plus de 5 mm (touche, collante, sans), séries, mesures avec et sans raison',()=>{
 const {resume}=joindre(RECORDS(),{raisonSeries:SERIES});
 const r=resume.raison;
 assert.deepEqual(r.parCode,{adv:2,hauteur:1,pn:1});assert.equal(r.cutsAvecRaison,4);assert.equal(r.cutsEcho,7);
 assert.deepEqual(r.couverture.sup10mm,{corrections:3,parTouche:1,collante:1,sans:1,part:0.667});
 assert.deepEqual(r.couverture.sup5mm,{corrections:5,parTouche:3,collante:1,sans:1,part:0.8});
 assert.deepEqual(r.series,SERIES);
 assert.equal(r.apresValidation,1,'raisons tapées après la validation');
 assert.deepEqual(r.mesures.avecRaison,{n:4,gesteValidationMedianeS:3},'corrections de plus de 5 mm, avec raison');
 assert.deepEqual(r.mesures.sansRaison,{n:1,gesteValidationMedianeS:3});
 assert.deepEqual(r.parTranche[0],{debut:{partie:90,cut:1001},cuts:7,corrections10mm:3,avecRaison10mm:2});
});
test('sans aucune raison, le résumé n\'a pas de section « raison » : sortie identique à celle d\'avant',()=>{
 const sans=RECORDS().map(r=>{const {raisonCorrection,...reste}=r;return reste;});
 const {resume,table}=joindre(sans);
 assert.equal('raison' in resume,false);assert.equal(J.texte(resume).includes('aison de la correction'),false);
 /* colonnes CSV : les 25 premières sont celles d'avant ; les deux colonnes de la raison sont ajoutées à la fin, vides quand la raison est inconnue */
 const csv=J.enCsv(table).split('\n');const entete=csv[0].split(',');
 assert.deepEqual(entete.slice(0,25),['partie','cut','classe','motifGauche','motifDroite','visitesEcho','referenceHumaine','etiquetteEcho','base','gaucheLateralMm','gaucheVerticalMm','gaucheLongitudinalMm','gaucheDist3dMm',
  'droiteLateralMm','droiteVerticalMm','droiteLongitudinalMm','droiteDist3dMm','maxDist3dMm','repere','b1Etat','b1ReelStage','b1HypotheseStage','b1HypotheseRaison','b1Changement','b1Appuis']);
 assert.deepEqual(entete.slice(25),['raison','raisonSource']);
 assert.ok(csv.slice(1).filter(Boolean).every(l=>l.endsWith(',,')),'sans raison : deux cellules vides');
});
test('CSV : la raison et sa source sont les deux dernières colonnes',()=>{
 const {table}=joindre();const csv=J.enCsv(table).trim().split('\n').slice(1).map(l=>l.split(','));
 const par=cut=>csv.find(c=>c[1]===String(cut));
 assert.deepEqual(par(1001).slice(-2),['adv','touche']);assert.deepEqual(par(1002).slice(-2),['adv','collante']);assert.deepEqual(par(1003).slice(-2),['','']);assert.deepEqual(par(1005).slice(-2),['pn','touche']);
});
test('texte du résumé : la couverture est dite en clair',()=>{
 const {resume}=joindre(RECORDS(),{raisonSeries:SERIES});const t=J.texte(resume);
 assert.match(t,/Raison de la correction : 4 cuts sur 7 en portent une \(adv 2, hauteur 1, pn 1\)/);
 assert.match(t,/> 10 mm : 3 corrections, 1 par touche, 1 collante, 1 sans raison \(67 % étiquetées\)/);
 assert.match(t,/Série 1 : adv, partie 90, cuts 1001 à 1002 \(2 cuts\), finie par touche-0/);
});

test('lecture des exports : les séries du résumé d\'export sont lues (le segment le plus récent l\'emporte) ; un export sans résumé en donne une liste vide',()=>{
 const dossier=fs.mkdtempSync(path.join(os.tmpdir(),'ariane-raison-'));
 try{
  const recs=RECORDS();
  const doc=exportEcho({session:'s1',debutSession:{minutes:0},stamp:'a',index:1,records:recs});
  fs.writeFileSync(path.join(dossier,'ariane-echo-1.json'),JSON.stringify({...doc,raisonSeries:[{...SERIES[0],finPar:null,cutFin:1001,nCuts:1}]}));
  fs.writeFileSync(path.join(dossier,'ariane-echo-2.json'),JSON.stringify({...exportEcho({session:'s1',debutSession:{minutes:0},stamp:'b',index:2,records:recs}),raisonSeries:SERIES}));
  const e=J.lireEcho([dossier]);assert.deepEqual(e.raisonSeries.map(s=>[s.serie,s.finPar,s.cutFin,s.session]),[[1,'touche-0',1002,'s1']]);
  fs.rmSync(path.join(dossier,'ariane-echo-2.json'));fs.writeFileSync(path.join(dossier,'ariane-echo-1.json'),JSON.stringify(doc));
  assert.deepEqual(J.lireEcho([dossier]).raisonSeries,[]);
 }finally{fs.rmSync(dossier,{recursive:true,force:true});}
});
test('compatibilité : un lecteur qui ignore le champ lit les visites comme avant (le résumé de l\'ancien outil est celui d\'aujourd\'hui, hors la section ajoutée)',()=>{
 const avec=joindre(RECORDS(),{raisonSeries:SERIES}).resume,sans=joindre(RECORDS().map(r=>{const {raisonCorrection,...reste}=r;return reste;})).resume;
 const {raison,...reste}=avec;assert.deepEqual(reste,sans);
});

/* ---- jeu d'apprentissage : étiquette seulement ---- */
const jointure=()=>({format:'ariane-jointure-echo-orbite-v1',options:{base:'auto'},resume:{cutsJoints:2},table:[
 {partie:90,cut:1001,classe:'posee',dansEcho:true,dansJournal:true,visitesEcho:1,referenceHumaine:'observee',visiteReference:1,validationsDeLaVisite:1,etiquetteEcho:'VALIDATE_CORRECTED_BOTH',base:'ariane',
  ecartHumain:{gauche:{repere:'profil',lateralMm:1,verticalMm:14,longitudinalMm:0,dist3dMm:14},droite:{repere:'profil',lateralMm:1,verticalMm:15,longitudinalMm:0,dist3dMm:15},maxDist3dMm:15},
  propositionMoteur:{etage:'first-pass'},raisonHumaine:{code:'adv',source:'touche',serie:null,apresValidation:true}},
 {partie:90,cut:1002,classe:'posee',dansEcho:true,dansJournal:true,visitesEcho:1,referenceHumaine:'observee',visiteReference:1,validationsDeLaVisite:1,etiquetteEcho:'VALIDATE_NO_MOVEMENT',base:'ariane',
  ecartHumain:{gauche:{repere:'profil',dist3dMm:0},droite:{repere:'profil',dist3dMm:0},maxDist3dMm:0},propositionMoteur:{etage:'first-pass'}}]});
test('jeu d\'apprentissage : la raison est copiée dans `etiquette.raisonHumaine`, jamais dans `traits` ; les cuts sans raison n\'ont pas le champ ; `absents` ne la cite plus quand il y en a',()=>{
 const jeu=G.construire(jointure());
 const [a,b]=jeu.cuts;
 assert.deepEqual(a.etiquette.raisonHumaine,{code:'adv',source:'touche',serie:null,apresValidation:true});assert.equal('raisonHumaine' in b.etiquette,false);
 assert.ok(!JSON.stringify(a.traits).includes('raison'),'aucune raison dans les traits');assert.ok(!JSON.stringify(a.qualite).includes('raison'));
 assert.ok(!jeu.entete.absents.includes('raison de la correction (E3)'));
 const sans=jointure();delete sans.table[0].raisonHumaine;const jeuSans=G.construire(sans);
 assert.ok(jeuSans.entete.absents.includes('raison de la correction (E3)'),'sans raison : comme avant');
 /* Changer ou retirer la raison ne change aucun trait : octet pour octet. */
 assert.equal(JSON.stringify(jeuSans.cuts.map(c=>c.traits)),JSON.stringify(jeu.cuts.map(c=>c.traits)));
 const autre=jointure();autre.table[0].raisonHumaine={code:'pn',source:'collante',serie:3,apresValidation:false};
 assert.equal(JSON.stringify(G.construire(autre).cuts.map(c=>c.traits)),JSON.stringify(jeu.cuts.map(c=>c.traits)));
 /* sans raison dans la table, le jeu est identique à celui d'avant : mêmes lignes, même en-tête */
 assert.equal(G.enJsonLignes(jeuSans),G.enJsonLignes(G.construire(sans)));
});
