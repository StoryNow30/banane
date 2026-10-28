'use strict';
/* tools/perf-relecture-phases.cjs : temps d'une relecture par phase, pauses exclues.
 * Journal fictif. Les commandes portent souvent l'identité du cut d'avant (demande) :
 * elles se rangent par la fenêtre de temps, jamais par ce numéro. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
const {measure,toMarkdown}=require('../tools/perf-relecture-phases.cjs');

const T0=Date.parse('2026-10-20T17:00:00.000Z');
const iso=ms=>new Date(T0+ms).toISOString();
/* Assemblé : le fichier source ne contient pas le motif que le scan interdit. */
const UUID=['12345678','1234','1234','1234','123456789abc'].join('-');
const cmd=(ms,action,elapsed,cut=999)=>({type:'adapter-result',timestamp:iso(ms),action,elapsedMs:elapsed,identity:{part:3,cut}});

function journalCorriger(){
  const ev=[
    {type:'relecture-debut',timestamp:iso(0),lotId:UUID,mode:'corriger',modeEffectif:'corriger'},
    /* commande du lot, avant la passe : elle n'appartient à aucun cut relu */
    cmd(-5000,'capture',9999,1),
    cmd(500,'goToCut',400),cmd(2600,'capture',2000),
    {type:'relecture-ombre',timestamp:iso(3000),lotId:UUID,mode:'corriger',action:'visite',zone:'pn',role:'vert',
      identity:{part:3,cut:10},durees:{navigationMs:500,captureMs:2200,calculMs:300,totalMs:3000}},
    {type:'relecture-pause',timestamp:iso(4000),lotId:UUID,raison:'mic'},
    {type:'relecture-reprise',timestamp:iso(10000),lotId:UUID},
    {type:'relecture-navigation-attente',timestamp:iso(10300),identity:{part:3,cut:11},code:'ADAPTER_BUSY',essai:1,attenteMs:250},
    cmd(10280,'goToCut',80),cmd(10700,'goToCut',120),cmd(11800,'capture',1000),cmd(12600,'capture',700),
    cmd(13200,'apply',400),cmd(13600,'validerMajEspace',150),
    {type:'relecture-ombre',timestamp:iso(14000),lotId:UUID,mode:'corriger',action:'corrige',zone:'adv',role:'vert',
      identity:{part:3,cut:11},durees:{navigationMs:800,captureMs:1800,calculMs:250,totalMs:3900}},
    /* commande du cut suivant, hors de cette fenêtre */
    cmd(15000,'capture',5000,11),
    {type:'relecture-fin',timestamp:iso(16500),lotId:UUID,mode:'corriger',modeEffectif:'corriger',issue:'fin',faits:2,corriges:1,dureeMs:16500},
  ];
  return {format:'banane-test-journal-v4',version:'4.9.5.15',events:ev};
}

test('fenêtre de temps : identité périmée ignorée, pause explicite retranchée, phases et résidu',()=>{
  const m=measure(journalCorriger(),{source:'collections/2026-10-20_v4.9.5.15_partie-0/journal'});
  assert.equal(m.passes.length,1);
  const p=m.passes[0];
  assert.equal(p.partie,3);assert.equal(p.mode,'corriger');assert.equal(p.faits,2);assert.equal(p.corriges,1);
  assert.equal(p.pauseMs,6000);assert.equal(p.silenceMs,0);assert.equal(p.attenteHorsCutMs,0);
  assert.equal(p.actifMs,10500);assert.equal(p.msParCut,5250);assert.equal(p.ecartCibleMs,3450);
  assert.equal(p.brutMsParCut,8250,'dureeMs / faits, pauses encore dedans');
  const [a,b]=p.cuts;
  assert.deepEqual(a.phases,{attentePage:400,lectureNuage:2000,recapture:0,decision:300,ecriture:0,validation:0,attenteAdaptateur:0});
  assert.equal(a.sources.attentePage,'commandes');assert.equal(a.sources.lectureNuage,'commandes');
  assert.equal(a.residuMs,300);
  assert.deepEqual(b.phases,{attentePage:200,lectureNuage:1000,recapture:700,decision:250,ecriture:400,validation:150,attenteAdaptateur:250});
  assert.equal(b.residuMs,950);
  const g=m.parMode.corriger;
  assert.equal(g.n,2);assert.equal(g.phases.attentePage.median,400);assert.equal(g.phases.lectureNuage.median,2000);
  assert.equal(g.phases.recapture.median,700);assert.equal(g.phases.decision.median,300);
  assert.equal(g.phases.ecriture.median,400);assert.equal(g.phases.validation.median,150);
  assert.equal(g.phases.attenteAdaptateur.median,250);
  assert.equal(g.sommeMedianesMs,4200);assert.equal(g.phases.attentePage.part,400/4200);
  assert.equal(g.phases.lectureNuage.moyenne,1500);assert.equal(g.residu.moyenne,625);
  assert.equal(g.msParCut.n,1);assert.equal(g.msParCut.median,5250);
  const md=toMarkdown(m);
  assert.match(md,/Attente de la page/);assert.match(md,/2,0 s/);
  assert.equal(md.includes(UUID),false,'aucun identifiant dans le rapport');
  assert.equal(md.includes('999'),false);
});

test('repli sur les durées du cut, recapture non séparable, silence inféré, mode ombre à part',()=>{
  const ev=[
    {type:'relecture-debut',timestamp:iso(0),lotId:'L',mode:'ombre',modeEffectif:'ombre'},
    {type:'relecture-ombre',timestamp:iso(1000),lotId:'L',mode:'ombre',action:'visite',zone:'abords',identity:{part:11,cut:4},
      durees:{navigationMs:100,captureMs:600,calculMs:100,totalMs:800}},
    {type:'relecture-ombre',timestamp:iso(71000),lotId:'L',mode:'ombre',action:'visite',zone:'abords',identity:{part:11,cut:5},
      skipOmbre:{captures:2,capturesVides:2,raison:'aucun-point'},durees:{navigationMs:100,captureMs:5000,calculMs:100,totalMs:5200}},
    {type:'relecture-ombre',timestamp:iso(72000),lotId:'L',mode:'ombre',action:'navigation-refusee',identity:{part:11,cut:6}},
    {type:'relecture-navigation-attente',timestamp:iso(72500),lotId:'L',identity:{part:11,cut:6},code:'ADAPTER_BUSY',essai:1,attenteMs:250},
    {type:'relecture-fin',timestamp:iso(73000),lotId:'L',mode:'ombre',modeEffectif:'ombre',issue:'fin',faits:2,dureeMs:73000},
  ];
  const m=measure({version:'4.9.5.7',events:ev},{source:'collections/essai'});
  const p=m.passes[0];
  assert.equal(p.cuts.length,2);assert.equal(p.sansDurees,1);
  assert.equal(p.cuts[0].sources.attentePage,'repli-durees');
  assert.deepEqual(p.cuts[0].phases,{attentePage:100,lectureNuage:600,recapture:0,decision:100,ecriture:0,validation:0,attenteAdaptateur:0});
  assert.equal(p.cuts[0].residuMs,0);
  assert.equal(p.cuts[1].phases.lectureNuage,null);assert.equal(p.cuts[1].phases.recapture,null);
  assert.equal(p.cuts[1].captureNonDecoupeeMs,5000);
  /* trou entre les deux cuts : 70 000 − 5 200 de travail = 64 800, au-dessus de 60 s */
  assert.equal(p.silenceMs,64800);assert.equal(p.pauseMs,0);
  assert.equal(p.attenteHorsCutN,1);assert.equal(p.attenteHorsCutMs,250,'le refus final, après le dernier cut journalisé');
  assert.equal(p.actifMs,73000-64800);assert.equal(m.parMode.ombre.n,2);assert.equal(m.parMode.corriger,undefined);
});

test('la même passe dans deux journaux ne compte qu\'une fois',()=>{
  const j=journalCorriger();
  const m=measure([j,JSON.parse(JSON.stringify(j))],{source:'collections/double'});
  assert.equal(m.passes.length,1);assert.equal(m.parMode.corriger.n,2);
});

test('ligne de commande : un journal fictif, résumé sans identifiant',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'perf-rel-'));
  const fichier=path.join(dir,'journal.json'),sortie=path.join(dir,'out.json');
  fs.writeFileSync(fichier,JSON.stringify(journalCorriger()));
  const r=spawnSync(process.execPath,[path.join(__dirname,'..','tools/perf-relecture-phases.cjs'),fichier,'--json',sortie],{encoding:'utf8'});
  assert.equal(r.status,0,r.stderr);
  assert.equal(r.stdout.includes(UUID),false);
  const lu=JSON.parse(fs.readFileSync(sortie,'utf8'));
  assert.equal(lu.passes[0].msParCut,5250);
  fs.rmSync(dir,{recursive:true,force:true});
});
