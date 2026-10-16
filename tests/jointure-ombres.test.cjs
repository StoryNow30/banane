'use strict';
/* 5.0 (audit 5.0, I8 (3)) — UN FORMAT DE JUGEMENT COMMUN POUR LES DEUX OMBRES. tools/jointure-echo-orbite.cjs lit l'ombre
 * d'Orbite (`voie-predite-ombre`, journal du lot) et celle de l'Écho (`memoire-differes-ombre`, export Écho) et les juge, d'un
 * seul outil, contre la pose finale de l'opérateur : juste à 5 mm, juste à 10 mm, fausse, mauvaise voie (> 50 mm). Une ombre
 * non posable est comptée « abstenue » ; si elle avait une pose, celle-ci est jugée à part (ce que la règle a évité ou
 * perdu). Données synthétiques (partie 90 inventée, repère profil confondu avec la scène). */
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const J=require('../tools/jointure-echo-orbite.cjs'),H=require('./helpers/jointure-synthetique.cjs'),V=require('../src/voie-recentree.js');

const G0=[10,0,0],D0=[10,1.435,0];
/* Mic pose les différés 11 à 14 à 150 mm de la pose de départ (latéral −150 mm). */
const depart=cut=>[H.decaler(G0,cut),H.decaler(D0,cut)],mic=cut=>[H.decaler(G0,cut,-0.150),H.decaler(D0,cut,-0.150)];
const pose=(dLat,dVert=0)=>({left:[0,-150+dLat,dVert],right:[0,-150+dLat,dVert]});
const voie=(cut,posable,p,raison=null)=>({eventId:'vo'+cut,timestamp:'2031-05-01T07:30:00.000Z',type:'voie-predite-ombre',schema:1,batchId:'lot-1',identity:{part:90,cut},
  version:'voie-predite-ombre-v1',etage:'window',poseMm:p,verdict:{posable,raison}});
const memoire=(cut,posable,p,raison=null)=>({eventId:'mo'+cut,timestamp:'2031-05-01T08:30:00.000Z',type:'memoire-differes-ombre',schema:1,nativeSessionId:'S1',identity:{part:90,cut},
  version:'memoire-differes-ombre-v1',etat:'calcule',frontiere:'avant-reference',poseMm:p,verdict:{posable,raison}});

function fixture(){
  const dossier=fs.mkdtempSync(path.join(os.tmpdir(),'jointure-ombres-'));
  const records=[11,12,13,14].map((cut,i)=>H.visite({session:'S1',index:i,cut,debut:{minutes:i},fin:{minutes:i,secondes:30},initiale:depart(cut),validation:mic(cut)}));
  const doc=H.exportEcho({session:'S1',debutSession:{minutes:0},stamp:'a',records});
  doc.events=[memoire(12,true,pose(60)),memoire(13,true,pose(15)),memoire(14,false,null,'sans-memoire'),memoire(11,true,pose(2))];
  H.ecrire(dossier,'ariane-echo-synth-seg01.json',doc);
  const j=H.journal([]);
  for(const cut of [11,12,13,14])j.events.push({eventId:'df'+cut,timestamp:'2031-05-01T07:00:00.000Z',type:'defer-finalized',identity:H.identite(cut),status:'deferred',rails:{}});
  j.events.push(voie(11,true,pose(2)),voie(12,true,pose(8,1)),voie(13,false,pose(30),'confiance'),voie(14,false,null,'differe:no-anchor'));
  const fj=path.join(dossier,'ariane-journal-v4-synth.json');fs.writeFileSync(fj,JSON.stringify(j));
  return {dossier,fj};
}

test('jugement commun : chaque ombre, contre la pose finale de l\'opérateur, dans la même grille',()=>{
  const {dossier,fj}=fixture();
  const echo=J.lireEcho([dossier]);
  assert.equal(echo.evenements.length,4,'les événements d\'ombre de l\'Écho sont lus');
  const {table,resume}=J.joindre(echo.records,J.lireJournal(fj),{sessions:echo.sessions,evenementsEcho:echo.evenements});
  const o=cut=>table.find(l=>l.cut===cut).ombres;
  assert.deepEqual(o(11).voie,{posable:true,raison:null,ecartMm:2,jugement:'juste5'});
  assert.equal(o(12).voie.jugement,'juste10');assert.ok(Math.abs(o(12).voie.ecartMm-Math.hypot(8,1))<0.06,'écart arrondi au dixième de mm');
  assert.deepEqual(o(13).voie,{posable:false,raison:'confiance',ecartMm:30,jugement:'abstenue',jugementSiPosee:'fausse'});
  assert.deepEqual(o(14).voie,{posable:false,raison:'differe:no-anchor',ecartMm:null,jugement:'abstenue'});
  assert.equal(o(12).memoire.jugement,'mauvaise-voie');assert.equal(o(13).memoire.jugement,'fausse');assert.equal(o(11).memoire.jugement,'juste5');
  assert.equal(o(14).memoire.jugement,'abstenue');
  /* Résumé : même format pour les deux sources. */
  const cles=['evenements','posables','juste5','juste10','fausse','mauvaiseVoie','nonJugees','abstenues','refuseesAvecPose','parRaison','seuils'];
  for(const s of ['voie','memoire'])assert.deepEqual(Object.keys(resume.ombres[s]).sort(),cles.slice().sort(),s);
  const v=resume.ombres.voie,m=resume.ombres.memoire;
  assert.deepEqual([v.evenements,v.posables,v.juste5,v.juste10,v.fausse,v.mauvaiseVoie,v.abstenues],[4,2,1,2,0,0,2],'juste10 compte aussi les juste5');
  assert.deepEqual(v.refuseesAvecPose,{n:1,juste10:0,fausse:1,mauvaiseVoie:0});
  assert.deepEqual([m.evenements,m.posables,m.juste5,m.juste10,m.fausse,m.mauvaiseVoie,m.abstenues],[4,3,1,1,1,1,1]);
  assert.deepEqual(v.seuils,{...V.JUGEMENT});
  /* Le texte le dit. */
  const t=J.texte(resume);assert.match(t,/Ombre voie prédite \(Orbite\)/);assert.match(t,/Ombre mémoire des différés \(Écho\)/);
});

test('sans événement d\'ombre : rien n\'est ajouté au résumé, la jointure d\'avant est inchangée',()=>{
  const dossier=fs.mkdtempSync(path.join(os.tmpdir(),'jointure-ombres-'));
  H.ecrire(dossier,'ariane-echo-synth-seg01.json',H.exportEcho({session:'S1',debutSession:{minutes:0},stamp:'a',records:[H.visite({session:'S1',index:0,cut:11,debut:{minutes:0},fin:{minutes:1},initiale:depart(11),validation:mic(11)})]}));
  const echo=J.lireEcho([dossier]),{table,resume}=J.joindre(echo.records,{events:[],records:[]},{sessions:echo.sessions,evenementsEcho:echo.evenements,sansJournal:true});
  assert.equal(table.length,1);assert.equal(resume.ombres,undefined);assert.equal(table[0].ombres,undefined);
});
