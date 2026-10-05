'use strict';
// Suite g-resume : réécriture U1 de la mission G. Données et attendus de G copiés
// tels quels dans fixtures-resume-g.cjs (source : missions/G_PANNEAU/pour-F/
// fixtures-resume.cjs, SHA-256 dans le rapport F). Contrôles F ajoutés à chaque cas :
// pas de nombre nu si l'historique n'est pas complet, nombres exacts sinon,
// transactions IndexedDB du panneau en lecture seule, aucune commande envoyée.
const CAS = require('./fixtures-resume-g.cjs');

async function attendre(p) {
  await p.waitForFunction(() => { const s = document.getElementById('part-summary'), n = document.getElementById('part-summary-note');
    return s && !s.hidden && n && n.textContent && !n.textContent.startsWith('Lecture de l’historique en cours'); }, null, { timeout: 2500, polling: 20 });
}
async function lire(p) {
  return p.evaluate(() => {
    const t = id => document.getElementById(id)?.textContent ?? null;
    return { titre: t('part-summary-title'), differes: t('part-summary-deferred'), inconnu: t('part-summary-unknown'), note: t('part-summary-note'),
      lotsTitre: t('part-summary-lots-title'), lots: [...document.querySelectorAll('#part-summary-lots li')].map(li => li.textContent),
      tuiles: [...document.querySelectorAll('#part-summary-counts .tuile')].map(x => ({ lbl: x.querySelector('.lbl')?.textContent, val: x.querySelector('b')?.textContent, sous: x.querySelector('small')?.textContent })) };
  });
}
const ligneTuiles = (r, sous) => r.tuiles.map(x => `${x.lbl} ${x.val}${sous && x.lbl === 'Différés restants' ? ` (${x.sous})` : ''}`).join(' · ');
function controlerAttendu(assert, r, a) {
  if (a.titre) assert.equal(r.titre, a.titre, 'titre');
  if (a.note) assert.match(r.note, a.note, 'note');
  if (a.differes) assert.equal(r.differes, a.differes, 'différés');
  if (a.lots) assert.equal(r.lotsTitre, a.lots, 'titre des lots');
  if (a.inconnu) assert.match(r.inconnu, a.inconnu, 'ligne inconnu / en cours');
  if (a.tuiles) assert.ok(ligneTuiles(r, false).startsWith(a.tuiles) || ligneTuiles(r, true).startsWith(a.tuiles), 'tuiles : ' + ligneTuiles(r, true));
}
function controlerF(assert, r) {
  const complet = r.note.startsWith('Historique lu en entier.');
  if (r.tuiles.length) assert.ok(r.tuiles.every(x => complet ? /^\d+$/.test(x.val) : /^(inconnu|au moins \d+)$/.test(x.val)),
    (complet ? 'complet : nombres exacts' : 'incomplet : aucun nombre nu') + ' ' + JSON.stringify(r.tuiles.map(x => x.val)));
}
async function sansEcriture(p, assert) {
  const j = await p.evaluate(() => ({ idb: __u2.idb || [], commandes: __u2.calls.map(c => c.action).filter(a => !['view', 'list-tabs', 'bandeau-etat', 'bornes-partie'].includes(a)) }));
  assert.ok(j.idb.every(t => t.mode === 'readonly'), 'transactions en lecture seule : ' + JSON.stringify(j.idb.filter(t => t.mode !== 'readonly')));
  assert.deepEqual(j.commandes, [], 'aucune commande envoyée par le résumé');
  return { transactions: j.idb.length, modes: [...new Set(j.idb.map(t => t.mode))] };
}
function cas(nom, extra = {}) {
  const c = CAS[nom];
  return {
    id: 'g-resume-' + nom, view: 'automatic', requires: 'partSummary', source: 'missions/G_PANNEAU/pour-F (cas ' + nom + ') ; panel.js (G) afficherResume',
    expected: 'Attendu de G pour le cas « ' + nom + ' » ; contrôles F : inconnus jamais écrits 0, lecture seule.',
    state: () => JSON.parse(JSON.stringify(c.state)), history: c.history ? () => JSON.parse(JSON.stringify(c.history)) : () => [],
    fault: c.bloquerIndexedDB ? 'indexeddb-indisponible' : null,
    async run(p, o) {
      await attendre(p); const r = await lire(p); await o.capture('resume', '#part-summary');
      controlerAttendu(o.assert, r, c.attendu); controlerF(o.assert, r);
      // G : « le cut 4 en cours n'est pas compté dans les coupes traitées » (cuts 1, 2, 3 seulement).
      if (nom === 'lotEnCours') o.assert.equal(r.tuiles.find(x => x.lbl === 'Coupes traitées')?.val, '3', 'cut en cours non compté');
      return { affiche: r, lecture: await sansEcriture(p, o.assert) };
    }, ...extra,
  };
}
module.exports = { CAS, cas, attendre, lire, controlerF, sansEcriture, ligneTuiles };
