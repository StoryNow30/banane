'use strict';
/* CH-064-E : parité de ariane-etat (synthèse). Le corpus réel est rejoué par tools/ch064-e-parite.cjs --corpus.
 * Le binaire est celui de la crate (pas encore fusionné dans ariane-coeur : le chef ajoute la fonction 100). */
const fs = require('node:fs'), path = require('node:path'), { spawnSync } = require('node:child_process');
const RACINE = path.resolve(__dirname, '..', '..');
const CRATE = path.join(RACINE, 'ariane-rs', 'crates', 'ariane-etat');
const WASM = path.join(CRATE, 'target', 'wasm32-unknown-unknown', 'release', 'ariane_etat.wasm');
const Etat = require('../../src/etat-morceaux.js');
const Corr = require('../../src/correction-liste.js');
const Liste = require('../../src/liste-memoire.js');
const Verts = require('../../src/verts-a-controler.js');
let coeurEtat = null;
function assurer() {
  if (!fs.existsSync(WASM)) {
    const r = spawnSync('cargo', ['build', '--release', '--target', 'wasm32-unknown-unknown', '-q'], { cwd: CRATE, encoding: 'utf8' });
    if (r.status !== 0) throw Error(r.stderr || r.stdout);
  }
  if (!coeurEtat) coeurEtat = require('../coquille/coeur.js').creer(fs.readFileSync(WASM), { seuilReinstanciation: 32 * 1024 * 1024 });
  return coeurEtat;
}
const bords = (i, dg = 0) => ({ left: [i, -0.7175 - dg / 2000, 0], right: [i, 0.7175 + dg / 2000, 0] });
function entreeVerts() {
  const lot = [20, 40, 41, 42, 43, 44, 59, 60, 62, 63].map(cut => ({ cut, differe: [40, 41, 43].includes(cut) }));
  const au = new Set(lot.map(x => x.cut)), lignes = [];
  for (let i = 0; i < 80; i++) lignes.push({ i, statut: au.has(i) ? 'invalid' : 'valid', operateur: false, bords: bords(i, i === 47 ? 30 : 0) });
  return { partie: 7, lot, lignes, zonesPN: [{ debut: 59, fin: 63 }] };
}
const events = [
  { type: 'batch-started', timestamp: '2026-11-06T10:00:00.000Z', batch: { id: 'B' }, identity: { part: 7, cut: 20 } },
  { type: 'gcv1-shadow-observed', timestamp: '2026-11-06T10:00:01.000Z', batchId: 'B', identity: { part: 7, cut: 20 }, lotObservation: { command: { action: 'lot', reason: 'essai' }, anchorsUsed: [] } },
  { type: 'gcv1-shadow-observed', timestamp: '2026-11-06T10:00:02.000Z', batchId: 'B', identity: { part: 7, cut: 21 }, lotObservation: { command: { action: 'rien' }, anchorsUsed: [1] } },
  { type: 'esv-observation', timestamp: '2026-11-06T10:00:03.000Z', kind: 'write', status: 200, rowIndex: 20, body: { ExtractionStatus: 'valid', TreatedByOperator: true } },
  { type: 'batch-stopped-at-end', timestamp: '2026-11-06T10:05:00.000Z' },
];
const etat0 = { native: { id: 'sess', visits: [{ a: 1 }, { a: 2 }], cloudIds: ['c0', 'c1'], exportState: { exportedCloudIds: ['c0'], releasedCloudIds: [] }, qualityRails: { r1: 1 }, observationPeriods: [], incomplete: [] } };
function* cas() {
  yield { id: 'verts-liste', entree: { f: 'vertsListe' } };
  yield { id: 'correction', entree: { f: 'correction' } };
  yield { id: 'etat', entree: { f: 'decouper' } };
  yield { id: 'liste', entree: { f: 'liste' } };
  yield { id: 'journal', entree: { f: 'journal' } };
}
function js(e) {
  if (e.f === 'vertsListe') return Verts.liste(entreeVerts());
  if (e.f === 'correction') return Corr.construire(events, { partie: 7, population: true });
  if (e.f === 'decouper') { const r = Etat.decouper(etat0); return { etat: r.etat, morceaux: [...r.morceaux.entries()], simples: [...r.simples.entries()] }; }
  if (e.f === 'liste') {
    const t = { st: [0, 1], fl: [1, 0], ed: [0, 0, 0, 10000, 0, 0, null, 1, 2, 3, 4, 5] };
    const snap = Liste.compacter(t, { partie: 3, at: '2026-11-06T12:00:00.000Z', cle: 'abcd' });
    return { snap, dec: Liste.decompacter(snap), nom: Liste.nomFichier(3, '2026-11-06T12:00:00.000Z') };
  }
  const ev = [{ eventId: 'b', type: 'batch-started', nativeSessionId: 's' }, { eventId: 'a', type: 'autre', nativeSessionId: 's' }];
  const set = new Set(['batch-started']);
  const m = new Map();
  for (const x of ev) if (set.has(x.type)) { const s = m.get(x.type) || new Set(); s.add(x.eventId); m.set(x.type, s); }
  return { parType: [...m.entries()].map(([k, s]) => [k, [...s].sort()]) };
}
function rs(e) {
  const c = assurer();
  if (e.f === 'vertsListe') return c.appeler(0, { f: 'vertsListe', entree: entreeVerts(), options: null });
  if (e.f === 'correction') return c.appeler(0, { f: 'correction', events, options: { partie: 7, population: true } });
  if (e.f === 'decouper') return c.appeler(0, { f: 'decouper', etat: etat0, connus: null });
  if (e.f === 'liste') {
    const t = { st: [0, 1], fl: [1, 0], ed: [0, 0, 0, 10000, 0, 0, null, 1, 2, 3, 4, 5] };
    const meta = { partie: 3, at: '2026-11-06T12:00:00.000Z', cle: 'abcd' };
    return { snap: c.appeler(0, { f: 'listeCompacter', t, meta }), dec: c.appeler(0, { f: 'listeDecompacter', snap: Liste.compacter(t, meta) }), nom: c.appeler(0, { f: 'listeNom', partie: 3, at: '2026-11-06T12:00:00.000Z' }) };
  }
  const j = c.appeler(0, { f: 'journal', events: [{ eventId: 'b', type: 'batch-started', nativeSessionId: 's' }, { eventId: 'a', type: 'autre', nativeSessionId: 's' }], records: [], types: ['batch-started'] });
  return { parType: j.parType };
}
const b64 = () => fs.readFileSync(WASM).toString('base64');
module.exports = {
  nom: 'etat', description: 'état, journal, listes (CH-064-E), synthèse',
  sources: ['src/etat-morceaux.js', 'src/journal-index.js', 'src/correction-liste.js', 'src/liste-memoire.js', 'src/verts-a-controler.js', 'src/native-session.js'],
  cas, js, rs,
  get navigateur() {
    assurer();
    const wasm = b64();
    const F = JSON.stringify({ entreeVerts: entreeVerts(), events, etat0 });
    return {
      scripts: ['src/etat-morceaux.js', 'src/correction-liste.js', 'src/liste-memoire.js', 'src/verts-a-controler.js', 'ariane-rs/coquille/vba.js', 'ariane-rs/coquille/coeur.js'],
      preparer: `coeur=>{const o=Uint8Array.from(atob(${JSON.stringify(wasm)}),c=>c.charCodeAt(0));globalThis.__F=${F};return {e:ArianeCoeur.creer(o)};}`,
      js: `(e)=>{const F=globalThis.__F,V=BananeVertsAControler,C=ArianeCorrectionListe,L=BananeListeMemoire,M=BananeEtatMorceaux;
        if(e.f==='vertsListe')return V.liste(F.entreeVerts);
        if(e.f==='correction')return C.construire(F.events,{partie:7,population:true});
        if(e.f==='decouper'){const r=M.decouper(F.etat0);return {etat:r.etat,morceaux:[...r.morceaux.entries()],simples:[...r.simples.entries()]};}
        if(e.f==='liste'){const t={st:[0,1],fl:[1,0],ed:[0,0,0,10000,0,0,null,1,2,3,4,5]},meta={partie:3,at:'2026-11-06T12:00:00.000Z',cle:'abcd'},snap=L.compacter(t,meta);return {snap,dec:L.decompacter(snap),nom:L.nomFichier(3,'2026-11-06T12:00:00.000Z')};}
        const ev=[{eventId:'b',type:'batch-started',nativeSessionId:'s'},{eventId:'a',type:'autre',nativeSessionId:'s'}],set=new Set(['batch-started']),m=new Map();
        for(const x of ev)if(set.has(x.type)){const s=m.get(x.type)||new Set();s.add(x.eventId);m.set(x.type,s);}return {parType:[...m.entries()].map(([k,s])=>[k,[...s].sort()])};}`,
      rs: `(e,etat)=>{const c=etat.e,F=globalThis.__F;
        if(e.f==='vertsListe')return c.appeler(0,{f:'vertsListe',entree:F.entreeVerts,options:null});
        if(e.f==='correction')return c.appeler(0,{f:'correction',events:F.events,options:{partie:7,population:true}});
        if(e.f==='decouper')return c.appeler(0,{f:'decouper',etat:F.etat0,connus:null});
        if(e.f==='liste'){const t={st:[0,1],fl:[1,0],ed:[0,0,0,10000,0,0,null,1,2,3,4,5]},meta={partie:3,at:'2026-11-06T12:00:00.000Z',cle:'abcd'};
          return {snap:c.appeler(0,{f:'listeCompacter',t,meta}),dec:c.appeler(0,{f:'listeDecompacter',snap:BananeListeMemoire.compacter(t,meta)}),nom:c.appeler(0,{f:'listeNom',partie:3,at:'2026-11-06T12:00:00.000Z'})};}
        const j=c.appeler(0,{f:'journal',events:[{eventId:'b',type:'batch-started',nativeSessionId:'s'},{eventId:'a',type:'autre',nativeSessionId:'s'}],records:[],types:['batch-started']});
        return {parType:j.parType};}`,
    };
  },
};
