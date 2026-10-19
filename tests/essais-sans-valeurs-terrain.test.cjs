'use strict';
/* Relecture du test 4 (constat P1) : les essais disent « données FABRIQUÉES » ; ils ne doivent donc recopier aucune valeur
 * d'une séance réelle (numéro de cut, nombre total de cuts de la partie, horodatage de fin de lot, identifiants de lots).
 * Contrôle : aucun fichier d'essai (tests/*.test.cjs, tests/helpers) ne contient ces valeurs. Elles sont COMPOSÉES à
 * l'exécution : ce fichier ne les écrit nulle part en entier (même méthode que tests/paquet-sans-projet-esv.test.cjs).
 * Les jeux de données hérités (tests/fixtures, tests/corpus, tests/incidents) sont hors de ce contrôle : voir le rapport. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const dir=__dirname;
const VALEURS={
  'dernier cut du lot (séance du 12 octobre)':new RegExp('(?<![0-9])'+['71','98'].join('')+'(?![0-9])'),
  'nombre total de cuts de la partie (séance du 12 octobre)':new RegExp('(?<![0-9])'+['92','09'].join('')+'(?![0-9])'),
  'horodatage de fin de lot (séance du 12 octobre)':new RegExp(['12','33','05'].join(':')),
  'identifiants des deux lots de la séance':new RegExp(['a7a4','869f'].join('')+'|'+['c714','cd0e'].join(''))};
const fichiers=()=>[...fs.readdirSync(dir).filter(f=>/\.(cjs|js)$/.test(f)).map(f=>path.join(dir,f)),
  ...(fs.existsSync(path.join(dir,'helpers'))?fs.readdirSync(path.join(dir,'helpers')).filter(f=>/\.(cjs|js)$/.test(f)).map(f=>path.join(dir,'helpers',f)):[])];
test('aucun essai ne recopie de valeur de la séance réelle du 12 octobre',()=>{
  const lus=fichiers();assert.ok(lus.length>50,'essais lus : '+lus.length);
  const trouves=[];
  for(const f of lus){const t=fs.readFileSync(f,'utf8');
    for(const [nom,re] of Object.entries(VALEURS))if(re.test(t))trouves.push(path.basename(f)+' : '+nom);}
  assert.deepEqual(trouves,[],'valeur(s) de séance réelle dans les essais : '+trouves.join(' ; '));
});
test('témoin : les motifs reconnaissent bien les valeurs (valeurs composées ici, jamais écrites en entier)',()=>{
  const cut=['71','98'].join(''),total=['92','09'].join(''),heure=['2026-10-12T12','33','05.966Z'].join(':');
  assert.ok(VALEURS['dernier cut du lot (séance du 12 octobre)'].test('{cut:'+cut+'}'));
  assert.ok(!VALEURS['dernier cut du lot (séance du 12 octobre)'].test('{cut:'+cut+'0}'),'un autre nombre qui contient les mêmes chiffres n’est pas reconnu');
  assert.ok(VALEURS['nombre total de cuts de la partie (séance du 12 octobre)'].test('total:'+total));
  assert.ok(VALEURS['horodatage de fin de lot (séance du 12 octobre)'].test("at:'"+heure+"'"));
  assert.ok(VALEURS['identifiants des deux lots de la séance'].test(['a7a4','869f'].join('')));
});
