'use strict';
/* CH-130 (D-361) — aucun hôte `<nom>.workers.dev` réel dans l'historique disponible du dépôt (toutes branches). Séparé de tests/ch130-adresse.test.cjs à l'intégration de la Vision 19 :
 * plus de 7 s à lui seul, le fichier entier dépassait 20 s pendant le verify. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
const racine=path.resolve(__dirname,'..');
/* Un hôte réel : au moins une étiquette collée devant « workers.dev ». Écrit pour ne pas se reconnaître lui-même. */
const HOTE=new RegExp('([a-z0-9-]+[.])+'+'workers'+'[.]dev','gi');
const permis=h=>/^([a-z0-9-]+\.)*exemple\.workers\.dev$/i.test(h);
const git=(...a)=>spawnSync('git',['-C',racine,...a],{encoding:'utf8',maxBuffer:1<<28});

test('aucune adresse *.workers.dev réelle dans l’historique disponible (toutes branches)',()=>{
 /* Intégration : `-G` ne sort que les commits dont le diff porte un hôte *.workers.dev ; sans lui, l'historique de toutes les branches dépassait le tampon (statut null). */
 const r=git('log','--all','-p','--format=commit %h','-G','[.]workers[.]dev');assert.equal(r.status,0,r.stderr);
 const vus=[];let c='';for(const l of r.stdout.split('\n')){if(l.startsWith('commit '))c=l.slice(7);else for(const m of l.matchAll(HOTE))if(!permis(m[0]))vus.push(c+' : '+m[0].replace(/^[^.]+/,'<…>'));}
 assert.deepEqual(vus,[]);
});

