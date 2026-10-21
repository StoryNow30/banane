'use strict';
/* Test 17 (fiches/PASSATION_T17_PASSE2.md) — montage commun des essais de la DEUXIÈME PASSE DES DIFFÉRÉS EN ÉCRITURE : service worker réel en VM, ESV simulé.
 * Lot de 111 à 115 : les cuts 112 et 114 n'ont aucun point (le lot les diffère, la GCV2 « tombe en panne » pendant le lot) ; pendant la passe, la GCV2 est forcée à
 * « valider » sur eux (pose du cut 111). Après le lot, l'ESV simulé sait aller à un cut (`goToCut`), tient la liste de la partie, lue une fois la passe partie (rouge pour les différés, `statuts`),
 * valide sur place (Ctrl+Entrée : compteur « N on M treated » de N à N+1, et l'écriture « valid » vue par l'observateur passif). Données synthétiques. */
const { production, memoire, base, K, S, EsvTrou, SCOPE, ev, attendre } = require('./lot-profil.cjs');
const SANS_POINTS = [112, 114];
class EsvEcriture extends EsvTrou {
  constructor(opts = {}) {
    super([]); this.statuts = {}; this.traites = 100; this.total = 200; this.opts = opts; this.restes = []; this.enPlace = [];
  }
  ajuster() { this.noPoints = SANS_POINTS.includes(this.identity.cut); }
  async ping() { return { ...await super.ping(), label: { pageId: this.identity.pageId, part: this.identity.part, cut: this.identity.cut } }; }
  async apply(before, proposals, ...reste) { this.restes.push(K.clone(reste)); return super.apply(before, proposals, ...reste); }
  async goToCut(target, options, operationId) {
    this.calls.push('goToCut'); this.identity.cut = target.cut; this.rails = K.clone(base.rails); this.ajuster();
    return { format: 'ariane-goto-cut-v1', operationId, resultat: 'confirme', confirme: true, chemin: options.chemin === 'pas' ? 'pas-a-pas' : 'evenement', refusal: null };
  }
  /* Ligne de la liste d'ESV : rouge pour un différé du lot, sauf `statuts` (cut → statut forcé). */
  ligne(i) { return { i, s: this.statuts[i] ?? (SANS_POINTS.includes(i) ? 'invalid' : 'valid'), t: false, v: true, f: false, e: null }; }
  voisins(m) {
    const rows = []; for (let i = Math.max(0, m.cut - m.fenetre); i <= Math.min(this.total - 1, m.cut + m.fenetre); i++) rows.push(this.ligne(i));
    return { ok: true, table: { lignes: this.total, pages: 1, fraiches: 0, debut: true, rompue: false, tronquee: false, tables: 1 }, geo: null, rows };
  }
  async validateInPlace(identity, scope, options) {
    this.calls.push('validateInPlace'); this.enPlace.push({ cut: identity.cut, options: K.clone(options) });
    if (this.opts.refusAvantEnvoi) throw Error('Validation sans passage au suivant refusée : le compteur « N on M treated » n’est pas lisible ; rien n’a été envoyé à ESV.');
    const avant = { traites: this.traites, total: this.total }; this.traites++;
    if (this.surValidation) await this.surValidation(identity.cut);
    return { commandSent: true, serverConfirmed: true, navigationObserved: false, afterState: await this.state(), compteurAvant: avant,
      compteurApres: { traites: this.opts.sansEffet ? avant.traites : this.traites, total: this.total }, command: 'ctrl-entrée' };
  }
}
/* `passe` : les réglages de `lot.passeDifferes` de l'essai ; `opts` : défauts de l'ESV simulé (`refusAvantEnvoi`, `sansEffet`, `arreterApres` : « Arrêter » du panneau après la validation de ce cut) ; `observateur` : l'observateur passif ; `ecritureVue` : l'écriture « valid » que la page relaierait (null : rien). */
async function lotPasse({ passe, opts = {}, observateur = true, ecritureVue = true, statuts = {}, attenteEcritureMs = 300 }) {
  const adapter = new EsvEcriture(opts), b = production({ adapter, local: memoire() });
  adapter.statuts = statuts;
  b.ctx.BananeSettings = { ...b.ctx.BananeSettings, voiePrediteOmbre: { ...S.voiePrediteOmbre, actif: false }, observateurPassif: { ...S.observateurPassif, actif: observateur },
    relecture: { attenteEcritureMs }, lot: { ...S.lot, passeDifferes: { ...S.lot.passeDifferes, ...passe } } };
  const envoyer = b.ctx.chrome.tabs.sendMessage;
  b.ctx.chrome.tabs.sendMessage = async (id, m) => m?.kind === 'b1-voisins' && adapter.calls.includes('goToCut') ? JSON.parse(JSON.stringify(adapter.voisins(m))) : envoyer(id, m);
  let seq = 0;
  adapter.surValidation = async cut => { if (opts.arreterApres === cut) await b.api('stop'); if (!ecritureVue) return; const t = Date.now();
    b.raw({ kind: 'esv-observation', observer: 'obs-passe', entries: [{ kind: 'write', seq: ++seq, method: 'PUT', status: 204, outcome: 'ok', attempt: 1, rowIndex: cut, railPairId: 'ligne-' + cut,
      bodyKeys: 12, body: { ExtractionStatus: 'valid', TreatedByOperator: true }, startedEpochMs: t, endedEpochMs: t + 50, durationMs: 50 }] }); };
  const G = b.ctx.BananeGcv2L1, appels = [];
  b.ctx.BananeGcv2L1 = { ...G, deciderDiffere: a => {
    const cut = a.capture.identity.cut; appels.push({ cut, sansVoieRien: G.leviersActifs().sansVoieRien });
    if (SANS_POINTS.includes(cut) && appels.filter(x => x.cut === cut).length < 2) throw Error('panne simulée de la GCV2');
    const r = G.deciderDiffere(a);
    if (!SANS_POINTS.includes(cut)) return r;
    const p0 = b.store.events.find(e => e.type === 'gcv1-shadow-observed' && e.identity?.cut === 111)?.lotObservation?.positions;
    const paire = { left: { decal: G.decalage(a.capture.rails.left, p0.left) }, right: { decal: G.decalage(a.capture.rails.right, p0.right) } };
    return { ...r, decision: { ...r.decision, etat: 'valider', motif: null, p: 0.9, paire, hypothese: 'H1', ecartDepartMm: 1 }, positions: G.positionsDe(a.capture, paire) };
  } };
  await b.api('connect', { tabId: 1 }); await b.api('settings', { mode: 'automatic-test' });
  adapter.identity.cut = 111; adapter.rails = K.clone(base.rails); adapter.ajuster();
  await b.api('start', { part: 23, start: 111, end: 115, ...SCOPE }); await b.settle(); await attendre(30);
  const cours = b.get('passeDiff').cours; if (cours) await cours; await attendre(30);
  const i = adapter.calls.indexOf('goToCut');
  return { b, adapter, appels, pasPasse: i < 0 ? [] : adapter.calls.slice(i) };
}
/* Le lot s'arrête sur une pose d'Ariane non validée au cut 115 (dernier cut du lot) : la passe ne part pas. L'opérateur la valide (ESV passe à un autre cut), puis relance. */
async function relancer(x) {
  x.refus = ev(x.b, 'passe-differes-ecriture-fin').at(-1); x.adapter.identity.cut = 116;
  await x.b.api('passe-differes-ecrire'); await x.b.get('passeDiff').cours;
  const i = x.adapter.calls.indexOf('goToCut'); x.pasPasse = i < 0 ? [] : x.adapter.calls.slice(i);
  return x;
}
module.exports = { lotPasse, relancer, ev, K, base };
