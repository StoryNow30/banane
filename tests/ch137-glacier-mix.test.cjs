'use strict';
/* CH-137 (D-371), premier lot : ce qui ne dépend pas de la maquette de l'interface alternative.
 *  - Réglages › Interface : « Glacier » (valeur gardée `signal`, inchangée) / « Mix » (valeur `mix`, l'interface alternative à venir) ; plus aucun
 *    « Instrument » ni « Cadran » à l'écran ; un choix gardé `cadran` (clé `banane51Interface`, inchangée) s'affiche sur « Mix » ;
 *  - le Cadran est retiré : ni src/cadran-rendu.js, ni panel-cadran.css, ni ses essais, ni sa balise dans panel.html ;
 *  - src/ui5.js connaît `signal` et `mix`, replie `cadran` et `riche` (D-371, abandonnée par D-372) sur `mix` ; `mix` a son rendu (src/mix-rendu.js) et sa
 *    feuille (classe `u-mix` seule, panel-mix.css). */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const R=path.resolve(__dirname,'..'),lire=f=>fs.readFileSync(path.join(R,f),'utf8');
const S=require('../src/signal-rendu.js');

const reglages=variante=>S.rendre({ar:{etat:'pret'},sig:{activite:'orbite',theme:'sombre',palette:'glacier'},variante},{couche:'reglages'});
const ligneInterface=h=>(h.match(/<div class="sg-reg"><span class="sg-lib"><span>Interface<\/span>[\s\S]*?<\/button><\/span><\/div>/)||[''])[0];

test('CH-137 : Réglages › Interface dit « Glacier » et « Mix », jamais « Instrument » ni « Cadran »',()=>{
  const h=reglages('signal'),l=ligneInterface(h);
  assert.ok(l,'ligne Interface présente');
  assert.match(l,/data-act="sg:choix:variante:signal">Glacier</);
  assert.match(l,/data-act="sg:choix:variante:mix">Mix</);
  assert.doesNotMatch(h,/Instrument|Cadran/);
  assert.match(l,/aria-pressed="true" data-act="sg:choix:variante:signal"/,'Glacier par défaut');
});
test('CH-137 : le choix « mix » est montré pressé ; un ancien choix « cadran » aussi (pas d’interface perdue)',()=>{
  for(const v of ['mix','cadran','riche']){const l=ligneInterface(reglages(v));
    assert.match(l,/aria-pressed="true" data-act="sg:choix:variante:mix"/,v);assert.match(l,/aria-pressed="false" data-act="sg:choix:variante:signal"/,v);}
});
test('CH-137 : le Cadran est retiré du paquet et des essais',()=>{
  for(const f of ['src/cadran-rendu.js','panel-cadran.css'])assert.ok(!fs.existsSync(path.join(R,f)),f+' retiré');
  assert.deepEqual(fs.readdirSync(path.join(R,'tests')).filter(f=>/^ch135-/.test(f)),[],'essais ch135 retirés');
  const html=lire('panel.html');assert.doesNotMatch(html,/cadran/i);
});
test('CH-137 : src/ui5.js connaît signal et mix, replie cadran et riche sur mix, mix a son rendu et sa feuille',()=>{
  const u=lire('src/ui5.js');
  assert.match(u,/const VARIANTES = \['signal', 'mix'\]/);
  assert.doesNotMatch(u,/ArianeCadranRendu|u-cadran/);
  assert.match(u,/\['cadran', 'riche'\]\.includes\(v\) \? 'mix'/,'repli des choix gardés « cadran » et « riche »');
  assert.match(u,/v === 'mix' \? 'u-mix' : 'u-signal'/);
  assert.match(u,/root\.ArianeMixRendu/);
});
test('CH-137 : le téléphone reste sur le rendu Glacier (comme pour le Cadran)',()=>{
  const t=lire('src/telecommande-instantane.js');
  assert.match(t,/variante: 'signal'/);assert.doesNotMatch(t,/ArianeMixRendu|mix-rendu/);
});
