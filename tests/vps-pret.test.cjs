'use strict';
/* D-373 : `tools/vps-pret.cjs` dit si la machine d'OpenCode peut faire tout le travail (essais, maquette, paquet, hub).
 * Ce qu'on vérifie ici : il signale ce qui manque, il ne montre jamais le contenu de l'adresse du relais, et son code
 * de sortie suit le verdict. Aucune donnée réelle : un HOME vide fabriqué pour l'essai. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const OUTIL=path.join(__dirname,'..','tools','vps-pret.cjs');

function lancer(home,env={}){
 const e={...process.env,HOME:home,...env};delete e.ARIANE_RELAIS;delete e.ARIANE_MOTIFS_INTERDITS;
 Object.assign(e,env);
 return spawnSync(process.execPath,[OUTIL,'--json'],{encoding:'utf8',env:e,cwd:path.join(__dirname,'..')});
}

test('vps-pret : sans adresse du relais ni motifs confidentiels, le verdict est « pas prêt » et dit quoi poser',()=>{
 const home=fs.mkdtempSync(path.join(os.tmpdir(),'vps-'));
 const r=lancer(home);
 const j=JSON.parse(r.stdout);
 assert.equal(j.pret,false);assert.equal(r.status,1);
 const relais=j.points.find(p=>p.id==='relais');assert.equal(relais.ok,false);assert.match(relais.remede,/relais\.txt/);
 assert.equal(j.points.find(p=>p.id==='motifs').ok,false);
 assert.equal(j.points.find(p=>p.id==='node').ok,true,'node 22 ici');
});

test('vps-pret : avec ~/.ariane/relais.txt, le point est bon et l\'adresse n\'est jamais affichée',()=>{
 const home=fs.mkdtempSync(path.join(os.tmpdir(),'vps-'));
 fs.mkdirSync(path.join(home,'.ariane'));fs.writeFileSync(path.join(home,'.ariane','relais.txt'),'https://relais-fictif.exemple.invalid/x\n');
 const r=lancer(home,{ARIANE_MOTIFS_INTERDITS:'motif-fictif'});
 const j=JSON.parse(r.stdout);
 assert.equal(j.points.find(p=>p.id==='relais').ok,true);
 assert.equal(j.points.find(p=>p.id==='motifs').ok,true);
 assert.ok(!r.stdout.includes('relais-fictif')&&!r.stderr.includes('relais-fictif'),'adresse jamais affichée');
 assert.ok(!r.stdout.includes('motif-fictif'),'motif jamais affiché');
});
