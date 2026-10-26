'use strict';
/* T21d (D-250, priorité 2) — montage des essais « la deuxième passe survit au redémarrage du service worker ». Service worker réel en VM, ESV simulé
 * (tests/helpers/passe-differes.cjs : liste de la partie, aller au cut, validation sur place prouvée par le compteur et l'écriture « valid »), données
 * synthétiques. Le lot va de 111 à `fin` ; les cuts de `sansPoints` n'ont aucun point (la GCV2 « tombe en panne » pendant le lot : ils sont différés ;
 * le dernier, laissé sans commande, clôt le lot sans pose en attente). Pendant la passe, `decider(cut, n)` (n : rang de l'appel de la passe pour ce cut)
 * dit « valider » (pose du cut 111) ou « rien ».
 * Deux « vies » du service worker partagent l'ESV simulé, chrome.storage.local et le magasin (IndexedDB) : l'arrêt du service worker est simulé en
 * GELANT la première vie (`geler`) : à partir de cet instant, chacun de ses accès au stockage, au magasin et à ESV reste sans réponse, comme un
 * service worker tué ; rien de ce qu'elle n'a pas encore écrit ne l'est jamais. La seconde vie démarre sur ce qui a été écrit. `tuer(pred, avant)` :
 * gèle la vie 1 à la première écriture de stockage qui satisfait `pred` (avant de l'écrire si `avant`, après sinon). */
const { memoire, base, K, S, SCOPE, ev, attendre } = require('./lot-profil.cjs');
const { EsvEcriture } = require('./passe-differes.cjs');
const { production } = require('./perf-production.cjs');
const { MemoryStore } = require('../fixtures.cjs');
const jamais = () => new Promise(() => {});
const CLE = 'banane56PasseDiff';

function montage({ sansPoints = [112, 114, 116], fin = 116, decider = () => 'valider', passe = {}, relecture = null, stockage = {}, attenteEcritureMs = 300 } = {}) {
  const adapter = new EsvEcriture({}, sansPoints), local = memoire(), store = new MemoryStore(), appels = [], vies = [];
  Object.assign(local.m, stockage);
  if (relecture) local.m.banane50Relecture = relecture;
  let seq = 0;
  /* Écriture « valid » relayée par la page après la validation sur place ; `surValidationVie` (cut, vie) peut geler la vie avant. */
  const M = { adapter, local, store, appels, vies, surValidationVie: null, tueur: null };
  adapter.surValidation = async cut => {
    const v = M.vieCourante;
    if (M.surValidationVie) await M.surValidationVie(cut, v);
    if (v.gelee) return jamais();
    const t = Date.now();
    v.b.raw({ kind: 'esv-observation', observer: 'obs-passe', entries: [{ kind: 'write', seq: ++seq, method: 'PUT', status: 204, outcome: 'ok', attempt: 1, rowIndex: cut, railPairId: 'ligne-' + cut,
      bodyKeys: 12, body: { ExtractionStatus: 'valid', TreatedByOperator: true }, startedEpochMs: t, endedEpochMs: t + 50, durationMs: 50 }] });
  };
  M.vie = () => {
    const n = vies.length + 1, v = { n, gelee: false };
    const geler = () => { v.gelee = true; };
    const loc = {
      get: k => v.gelee ? jamais() : local.get(k),
      set: async o => { if (v.gelee) return jamais(); const t = M.tueur; if (t && t.vie === n && t.pred(o)) { if (t.avant) { geler(); M.tueur = null; return jamais(); } await local.set(o); geler(); M.tueur = null; return jamais(); } return local.set(o); },
      remove: k => v.gelee ? jamais() : local.remove(k),
    };
    const magasin = new Proxy(store, { get: (cible, p) => { const x = cible[p]; return typeof x === 'function' ? (...a) => v.gelee ? jamais() : x.apply(cible, a) : x; },
      set: (cible, p, x) => { cible[p] = x; return true; } });
    const b = production({ adapter, local: loc, store: magasin });
    v.b = b; v.geler = geler; vies.push(v); M.vieCourante = v;
    b.ctx.BananeSettings = { ...b.ctx.BananeSettings, voiePrediteOmbre: { ...S.voiePrediteOmbre, actif: false }, observateurPassif: { ...S.observateurPassif, actif: true },
      relecture: { attenteEcritureMs, attenteVuMs: 100 }, lot: { ...S.lot, passeDifferes: { ...S.lot.passeDifferes, passes: 2, ...passe } } };
    const envoyer = b.ctx.chrome.tabs.sendMessage;
    b.ctx.chrome.tabs.sendMessage = async (id, m) => { if (v.gelee) return jamais();
      return m?.kind === 'b1-voisins' && adapter.calls.includes('goToCut') ? JSON.parse(JSON.stringify(adapter.voisins(m))) : envoyer(id, m); };
    const G = b.ctx.BananeGcv2L1;
    b.ctx.BananeGcv2L1 = { ...G, deciderDiffere: a => {
      const cut = a.capture.identity.cut, dansPasse = G.leviersActifs().sansVoieRien === true;
      appels.push({ vie: n, cut, passe: dansPasse });
      if (!dansPasse && adapter.sansPoints.includes(cut)) throw Error('panne simulée de la GCV2');
      const r = G.deciderDiffere(a);
      if (!dansPasse || !adapter.sansPoints.includes(cut)) return r;
      const rang = appels.filter(x => x.passe && x.cut === cut).length;
      if (decider(cut, rang) !== 'valider') return { ...r, decision: { ...r.decision, etat: 'rien', motif: 'essai-rien' }, positions: null };
      const p0 = store.events.find(e => e.type === 'gcv1-shadow-observed' && e.identity?.cut === 111)?.lotObservation?.positions;
      const paire = { left: { decal: G.decalage(a.capture.rails.left, p0.left) }, right: { decal: G.decalage(a.capture.rails.right, p0.right) } };
      return { ...r, decision: { ...r.decision, etat: 'valider', motif: null, p: 0.9, paire, hypothese: 'H1', ecartDepartMm: 1 }, positions: G.positionsDe(a.capture, paire) };
    } };
    return v;
  };
  /* Vie 1 : le lot, puis la passe jusqu'à sa fin ou jusqu'au gel. */
  M.lot = async () => {
    const v = M.vie(), b = v.b;
    await b.api('connect', { tabId: 1 }); await b.api('settings', { mode: 'automatic-test' });
    adapter.identity.cut = 111; adapter.rails = K.clone(base.rails); adapter.ajuster();
    await b.api('start', { part: 23, start: 111, end: fin, ...SCOPE }); await b.settle();
    for (let i = 0; i < 400 && !v.gelee; i++) { const c = b.get('passeDiff').cours; if (!c && i > 5) break; await attendre(10); }
    return v;
  };
  /* Vie suivante : réveil du service worker (une action du panneau), puis la passe reprise jusqu'à sa fin. */
  M.reveil = async () => {
    const v = M.vie(), b = v.b;
    await b.api('view');
    for (let i = 0; i < 400; i++) { const c = b.get('passeDiff').cours; if (c) await c; else if (i > 5) break; await attendre(10); }
    const r = b.get('relecture').tache; if (r) await r.catch(() => {});
    await attendre(30);
    return v;
  };
  M.tuer = (pred, { vie = 1, avant = true } = {}) => { M.tueur = { pred, vie, avant }; };
  M.etat = () => local.m[CLE] ?? null;
  M.ev = type => store.events.filter(e => e.type === type);
  return M;
}
/* Ce qu'une passe a fait, vies réunies : décisions par (cut, tour), cuts écrits, validations sur place par cut, intentions restantes. */
function bilan(M) {
  const dec = M.ev('passe-differes-ombre').map(e => [e.identity.cut, e.passe, e.decision, JSON.stringify(e.decal ?? null)]);
  const ecr = M.ev('passe-differes-ecriture').map(e => [e.identity.cut, e.resultat, JSON.stringify(e.decal ?? null)]);
  const parCut = {}; for (const e of M.adapter.enPlace) parCut[e.cut] = (parCut[e.cut] || 0) + 1;
  const appelsPasse = {}; for (const a of M.appels.filter(x => x.passe)) appelsPasse[a.cut] = (appelsPasse[a.cut] || 0) + 1;
  return { dec, ecr, enPlace: parCut, appelsPasse, intentions: (M.local.m.banane50RelectureIntention || []).map(x => x.cut), etat: M.etat() };
}
module.exports = { montage, bilan, ev, attendre, CLE };
