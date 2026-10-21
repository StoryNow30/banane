#!/usr/bin/env node
'use strict';
/*
 * parite-l1se-sw.cjs — PARITÉ DU PROFIL « L1-se » ENTRE LE BANC ET L'EXTENSION. Un lot archivé est rejoué dans le VRAI service worker
 * (background.js en vm, tests/helpers/perf-production.cjs), cut par cut dans l'ordre du lot du banc (`lotReel`), sur les VRAIS nuages du
 * corpus, contre un ESV simulé qui présente chaque cut à sa pose de départ. L'instantané de la liste d'ESV de la partie est mis dans le
 * stockage local, comme le pont le fait au départ de la partie. Le profil du lot est le défaut livré (src/settings.js).
 * Sortie : une ligne par cut au format du banc (la ligne du rejeu de référence, `profils['L1-se']` remplacé par ce que le service worker a
 * commandé), et sur la sortie standard la comparaison décision par décision avec le rejeu du banc.
 *
 *   node tools/parite-l1se-sw.cjs --partie P:N --journal J.json --corpus C.json [--corpus …] --lot ID --liste LISTE.json --banc R.jsonl
 *        --sortie S.jsonl [--racine DÉPÔT] [--leviers JSON] [--passe]
 *
 * `--leviers` (mesure seulement) : leviers de la décision L1-e réglés dans le service worker (`reglerLeviers`), comme BANC_LEVIERS au banc ; le
 * rejeu de référence doit être fait avec les mêmes leviers.
 * `--passe` : le service worker fait la deuxième passe EN OMBRE (aucune écriture vers ESV), avec la recette livrée (`lot.passeDifferes` de src/settings.js : `passes`,
 * `leviers`) ; les cuts qu'il poserait sont comptés comme posés (`passe2.ombre`) et leur passe est comparée à celle de la deuxième passe du banc. Le rejeu de référence doit
 * avoir la même recette (BANC_LEVIERS `deuxiemePasse` et `passe2Leviers`) : l'en-tête du rejeu est contrôlé avant de commencer.
 *
 * HORS DÉPÔT : aucune donnée de lot n'est écrite dans le dépôt. Lecture seule sur ESV : il n'y en a pas, l'ESV est simulé.
 */
const fs = require('node:fs'), path = require('node:path');
const SIDES = ['left', 'right'];

function args(argv) {
  const o = { corpus: [], racine: path.resolve(__dirname, '..') };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i], v = () => argv[++i];
    if (k === '--partie') o.partie = v(); else if (k === '--journal') o.journal = v(); else if (k === '--corpus') o.corpus.push(v());
    else if (k === '--lot') o.lot = v(); else if (k === '--liste') o.liste = v(); else if (k === '--banc') o.banc = v();
    else if (k === '--sortie') o.sortie = v(); else if (k === '--racine') o.racine = path.resolve(v()); else if (k === '--coupe') o.coupe = Number(v()); else if (k === '--progres') o.progres = true; else if (k === '--leviers') o.leviers = JSON.parse(v()); else if (k === '--passe') o.passe = true;
    else throw Error('argument inconnu : ' + k);
  }
  for (const k of ['partie', 'journal', 'lot', 'liste', 'banc', 'sortie']) if (!o[k]) throw Error('--' + k + ' manquant');
  const [projet, partie] = o.partie.split(':').map(Number);
  return { ...o, projet, partie };
}

async function main(argv) {
  const a = args(argv), R0 = a.racine;
  const Banc = require(path.join(R0, 'tools/banc-differes.cjs')), G = require(path.join(R0, 'src/gcv2-l1.js'));
  const { production, memoire } = require(path.join(R0, 'tests/helpers/perf-production.cjs')), { SimulatedESV, K } = require(path.join(R0, 'tests/fixtures.cjs'));
  const S = require(path.join(R0, 'src/settings.js')), LM = require(path.join(R0, 'src/liste-memoire.js'));
  const j = JSON.parse(fs.readFileSync(a.journal, 'utf8')), R = Banc.lotReel(j, a.partie, a.lot);
  const cuts = R.lot.cuts.slice().sort((x, y) => x.t - y.t);
  const voulus = new Set(cuts.map(c => c.captureId).filter(Boolean)), nuages = new Map();
  for (const f of a.corpus) { let d = JSON.parse(fs.readFileSync(f, 'utf8')); for (const c of d.clouds || []) if (voulus.has(c.captureId) && c.rails && c.rails.left && c.rails.right) nuages.set(c.captureId, c); d = null; }
  const ordre = cuts.filter(c => nuages.has(c.captureId)).map(c => ({ cut: c.cut, nuage: nuages.get(c.captureId) })).slice(0, a.coupe || undefined);
  const absents = cuts.filter(c => !nuages.has(c.captureId)).map(c => c.cut);
  const pas = [];
  let t0 = Date.now();
  class EsvRejoue extends SimulatedESV {
    constructor() { super(); this.i = 0; this.placer(0); }
    placer(i) { this.i = i; const n = ordre[i] && ordre[i].nuage; if (!n) { this.identity = { ...this.identity, cut: this.identity.cut + 1 }; return; } this.identity = K.clone(n.identity); this.rails = K.clone(n.rails); }
    async next() { this.calls.push('next'); this.placer(this.i + 1); return this.state(); }
    async nextWithoutDecision(...x) { pas.push({ cut: this.identity.cut, action: 'differe' }); const s = ordre[this.i + 1]; this.deferIdentity = s ? K.clone(s.nuage.identity) : null;
      const r = await super.nextWithoutDecision(...x); if (s) this.placer(this.i + 1); return r; }
    async capture(expected) { K.assertTarget(expected.identity, this.identity); this.calls.push('capture'); if (a.progres) process.stderr.write(`${this.i + 1}/${ordre.length} cut ${this.identity.cut} ${Math.round((Date.now() - t0) / 1000)} s\n`); const d = K.clone(ordre[this.i].nuage); d.rails = K.clone(this.rails); return d; }
    async apply(before, proposals, ...reste) { pas.push({ cut: this.identity.cut, action: 'apply', before: K.clone(before), proposals: K.clone(proposals), vue: !!(reste[0] && reste[0].deplacerVue) }); return super.apply(before, proposals); }
    async validateAndNext() { pas.push({ cut: this.identity.cut, action: 'valider' }); return super.validateAndNext(); }
    async skipAndNext() { pas.push({ cut: this.identity.cut, action: 'sauter' }); return super.skipAndNext(); }
    async amenerDansLaVue(cote) { this.calls.push('amenerDansLaVue'); return { version: 'banc', cote, gestes: [], ok: true, remise: { ok: true, crans: 0 } }; }
  }
  /* Toute autre écriture vers ESV est consignée par cut (la ligne d'un cut qui n'est ni validé ni différé les montre). */
  for (const nom of ['validateInPlace', 'validerMajEspace', 'restore', 'goToCut', 'next']) { const f = EsvRejoue.prototype[nom] || SimulatedESV.prototype[nom];
    EsvRejoue.prototype[nom] = async function (...x) { pas.push({ cut: this.identity.cut, action: nom }); return f ? f.apply(this, x) : this.state(); }; }
  const banc = fs.readFileSync(a.banc, 'utf8').trim().split('\n').map(JSON.parse), lignes = [banc[0]], diffs = [];
  if (a.passe) {
    const R = S.lot.passeDifferes, L = banc[0].l1e && banc[0].l1e.leviers || {};
    if (L.deuxiemePasse !== R.passes || JSON.stringify(L.passe2Leviers) !== JSON.stringify(R.leviers)) throw Error(`le rejeu de référence n'a pas la recette de la passe livrée (deuxiemePasse ${R.passes}, passe2Leviers ${JSON.stringify(R.leviers)}) : ${JSON.stringify([L.deuxiemePasse, L.passe2Leviers])}`);
  }
  const local = memoire(); local.m[LM.PRE_INST + a.partie] = JSON.parse(fs.readFileSync(a.liste, 'utf8'));
  const adapter = new EsvRejoue(), b = production({ adapter, local });
  if (a.leviers) b.ctx.BananeGcv2L1.reglerLeviers(a.leviers);
  /* `--passe` : la deuxième passe en ombre (aucune écriture vers ESV) ; ses poses « calculées » sont comparées à celles de la deuxième passe du banc. */
  b.ctx.BananeSettings = { ...b.ctx.BananeSettings, voiePrediteOmbre: { ...S.voiePrediteOmbre, actif: false }, ...(a.passe ? { lot: { ...S.lot, passeDifferes: { ...S.lot.passeDifferes, ombre: true, ecriture: false } } } : {}) };
  await b.api('connect', { tabId: 1 }); await b.api('settings', { mode: 'automatic-test' });
  const SCOPE = { testConfirmed: true, allowNavigationEvidence: true, lowConfidence: 'attempt', geometryEngine: 'geometry-candidate-v1', lotDecision: 'apply' };
  t0 = Date.now();
  await b.api('start', { part: a.partie, start: ordre[0].cut, end: ordre.at(-1).cut, ...SCOPE }); await b.settle();
  await new Promise(r => setTimeout(r, 50));
  { const cours = b.get('passeDiff') && b.get('passeDiff').cours; if (cours) await cours; await new Promise(r => setTimeout(r, 50)); }
  const dureeS = Math.round((Date.now() - t0) / 1000), profil = b.get('engine').s.batch?.scope?.lotProfil ?? null;
  /* Ce que le service worker a commandé, par cut. */
  const obs = new Map();
  for (const e of b.store.events) if (e.type === 'gcv1-shadow-observed' && e.identity && Number.isInteger(e.identity.cut)) obs.set(e.identity.cut, e.lotObservation || {});
  /* Passe des différés en ombre : cuts que le service worker poserait (décalages, passe). */
  const ombre = new Map();
  for (const e of b.store.events) if (e.type === 'passe-differes-ombre' && e.decision === 'poserait' && e.identity && Number.isInteger(e.identity.cut)) ombre.set(e.identity.cut, e);
  const parCut = new Map();
  for (const p of pas) { const x = parCut.get(p.cut) || {}; if (p.action === 'apply') x.apply = p; else x[p.action] = true; parCut.set(p.cut, x); }
  const sourceDe = c => c && c.l1s === 'gcv2' ? 'gcv2' : c && c.l1s === 'chaine' ? 'l1s-chaine' : c && c.l1s === 'vue' ? 'l1s-vue' : 'lot';
  const parN = new Map(ordre.map(o => [o.cut, o.nuage]));
  let differes = 0;
  const dernier = ordre.at(-1).cut;
  for (const l of banc.slice(1).filter(x => x.cut <= dernier)) {
    const x = parCut.get(l.cut) || {}, o = obs.get(l.cut) || null, n = parN.get(l.cut);
    let sw;
    if (!n) sw = { etat: 'absent' };
    /* Dernier cut du lot : le rejeu s'arrête après la pose (`apply`), la validation de fin de lot n'est pas jouée par l'ESV simulé ; la pose
     * envoyée est comparée telle quelle (`finDeLot`). */
    else if (x.apply && (x.valider || (!x.differe && l.cut === ordre.at(-1).cut))) {
      const pos = K.expectedPoses(x.apply.before, x.apply.proposals);
      sw = { etat: 'pose', ...(x.valider ? {} : { finDeLot: true }), source: sourceDe(o && o.command), decal: Object.fromEntries(SIDES.map(s => [s, G.decalage(n.rails[s], pos[s].positionSceneRelative.slice(0, 3)).map(v => Math.round(v * 100) / 100)])) };
    } else if (ombre.has(l.cut)) { const e = ombre.get(l.cut); sw = { etat: 'pose', source: 'gcv2', passe2: { passe: e.passe, ombre: true }, decal: e.decal };
    } else if (x.differe || (o && o.command && o.command.action !== 'lot')) sw = { etat: 'differe', source: o && o.l1 ? 'gcv2' : 'lot', motif: o && o.l1 ? o.l1.motif ?? null : null };
    else sw = { etat: 'inconnu', actions: pas.filter(q => q.cut === l.cut).map(q => q.action) };
    if (sw.etat === 'differe') differes++;
    const bp = l.profils['L1-se'] || {};
    const etatBanc = bp.etat === 'pose' ? 'pose' : 'differe';
    let ecart = null;
    if (sw.etat === 'pose' && bp.etat === 'pose' && bp.decal) ecart = Math.max(...SIDES.flatMap(s => [0, 1, 2].map(i => Math.abs(sw.decal[s][i] - bp.decal[s][i]))));
    const diff = sw.etat !== etatBanc || (sw.etat === 'pose' && (sw.source !== bp.source || !(ecart <= 0.05) || (sw.passe2 && sw.passe2.passe) !== (bp.passe2 && bp.passe2.passe)));
    if (diff) diffs.push({ cut: l.cut, nuage: l.nuage, banc: { etat: bp.etat, source: bp.source, motif: bp.l1 ? bp.l1.motif : null }, sw: { etat: sw.etat, source: sw.source, motif: sw.motif, actions: sw.actions }, ecartMm: ecart == null ? null : Math.round(ecart * 100) / 100 });
    lignes.push({ ...l, profils: { ...l.profils, 'L1-se': sw } });
  }
  fs.writeFileSync(a.sortie, lignes.map(x => JSON.stringify(x)).join('\n') + '\n');
  const fin = b.store.events.find(e => e.type === 'passe-differes-ombre-fin') || null, parPasse = (poses, p) => poses.filter(e => e.passe === p).length;
  process.stdout.write(JSON.stringify({ partie: a.partie, lot: a.lot, profil, leviers: a.leviers || null, passe: a.passe ? { differes: fin && fin.differes, posees: fin && fin.posees, ms: fin && fin.ms, parPasse: [1, 2].map(p => parPasse([...ombre.values()], p)), parPasseBanc: [1, 2].map(p => banc.slice(1).filter(l => l.cut <= dernier && l.profils['L1-se'] && l.profils['L1-se'].etat === 'pose' && l.profils['L1-se'].passe2 && l.profils['L1-se'].passe2.passe === p).length) } : null,
    cuts: lignes.length - 1, rejoues: ordre.length, absents, dureeS, differesSw: differes, lignesDifferentes: diffs.length, diffs }) + '\n');
}
main(process.argv.slice(2)).catch(e => { process.stderr.write('parite-l1se-sw : ' + (e && e.stack || e) + '\n'); process.exitCode = 1; });
