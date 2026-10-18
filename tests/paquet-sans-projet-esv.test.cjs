'use strict';
/* A1 (relecture du test 3) : aucune donnée d'ESV dans le dépôt, donc aucune dans le paquet installable. Une consigne
 * versionnée (`consignes/`, empaquetée) nommait le projet ESV ; un paquet reconstruit l'aurait embarqué. Contrôle : on
 * construit le paquet installable comme `tools/package.py` et on cherche, dans chaque entrée, un identifiant de projet
 * au format d'ESV (date_heure_lettre_CODE_numéro). Le motif est générique : aucun identifiant réel n'est écrit ici. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
/* Revue finale de la test 7 : le code du milieu est facultatif (une forme courte, date_heure_lettre_numéro, avait passé dans DECISIONS.md). */
const PROJET=String.raw`(?<![0-9A-Za-z])[0-9]{6}_[0-9]{6}_[A-Z]_(?:[A-Z0-9]{2,}_)?[0-9]+(?![0-9A-Za-z])`;
test('le paquet installable ne contient aucun identifiant de projet ESV (consignes comprises)',()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ariane-paquet-esv-')),zip=path.join(temp,'p.zip'),python=process.platform==='win32'?'python':'python3';
 try{const built=spawnSync(python,[path.join(root,'tools/package.py'),'--output',zip],{encoding:'utf8'});assert.equal(built.status,0,built.stderr);
  const scan=spawnSync(python,['-I','-c',[
   'import re,sys,zipfile,json',
   'z=zipfile.ZipFile(sys.argv[1]);p=re.compile(sys.argv[2].encode())',
   'hits=[n for n in z.namelist() if p.search(z.read(n))]',
   'print(json.dumps({"entries":len(z.namelist()),"consignes":sum(n.startswith("consignes/") for n in z.namelist()),"hits":hits}))'].join('\n'),zip,PROJET],{encoding:'utf8'});
  assert.equal(scan.status,0,scan.stderr);const r=JSON.parse(scan.stdout);
  assert.ok(r.entries>30,'paquet lu');
  assert.deepEqual(r.hits,[],'identifiant de projet ESV trouvé dans : '+r.hits.join(', '));
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
});
test('le motif reconnaît bien un identifiant de projet au format ESV (témoin, valeur fabriquée)',()=>{
 const re=new RegExp(PROJET);
 const temoin=['111111','222222','E','ABCDE','1'].join('_');   // composé à l'exécution : le motif n'est écrit nulle part dans l'arbre
 assert.ok(re.test('du projet `'+temoin+'`'));
 const court=['111111','222222','E','1'].join('_');   // forme courte, sans code du milieu
 assert.ok(re.test('Projet confirmé : `RAIL-'+court+'`'));
 assert.ok(!re.test('ariane-bilan-v4-2026-10-07T08-34-45-seg01.json'));
 assert.ok(!re.test('banane-lidar-part-23-cut-2860-1788942528253.json'));
});
