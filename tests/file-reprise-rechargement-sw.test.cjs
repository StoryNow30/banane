'use strict';
/* CH-043 (terrain du 02/11, test 35) — après un F5, le lot de la Constellation reprend SEUL (même lot, mêmes `processed`) :
 * la page rechargée est ré-équipée et attendue prête, ESV rouvre une autre partie (la 0 le 02/11) : retour par le lien du sélecteur, puis la reprise
 * ordinaire du lot. Hors file, pause de l'opérateur ou réglage coupé : rien ne part. Service worker réel en VM, lot et ESV simulés. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const { montage, fermer, FICHE } = require('./helpers/file-parties-sw.cjs');
test.afterEach(fermer);
const attendre = ms => new Promise(r => setTimeout(r, ms));

async function enPause(fiche = FICHE) {
  const M = montage({ fiche }); await M.vie(); await M.demarrer(2);
  await M.jusqua(() => M.etat()?.partie?.lotId, 2000, 'lot de la file');
  const eng = M.engine(), lot = eng.s.batch, part = lot.scope.part;
  Object.assign(lot, { state: 'PAUSED_ADAPTER_UNRESPONSIVE', processed: [{ cut: 5 }, { cut: 6 }], scope: { ...lot.scope, geometryEngine: 'autre' } });
  let reprises = 0; eng.resume = async () => { reprises++; lot.state = 'RUNNING'; };
  M.adapter.identity = { ...M.adapter.identity, part: 99, cut: 1, pageId: 'page-99' };   /* ESV rouvre une autre partie après le F5 */
  /* La page rechargée dit son libellé de cut (ping.label) et est prête sans l'attente de la liste. */
  const ping = M.adapter.ping.bind(M.adapter); M.adapter.ping = async o => ({ ...(await ping(o)), label: { part: M.adapter.identity.part, cut: M.adapter.identity.cut } });
  M.b.ctx.BananeSettings = { ...M.b.ctx.BananeSettings, echo: { ...(M.b.ctx.BananeSettings.echo || {}), reprise: { attenteSansListeMs: 0, pollMs: 20 } } };
  return { M, lot, part, reprises: () => reprises };
}
const lancer = M => M.b.get('fileRepriseApresRechargement')(1);

test('F5 : lot de la file « sans réponse », ESV rouvre une autre partie → retour par le lien, puis reprise du MÊME lot', async () => {
  const { M, lot, part, reprises } = await enPause();
  await lancer(M);
  assert.equal(M.adapter.identity.part, part, 'ESV ramené sur la partie du lot');
  assert.ok(M.adapter.calls.includes('changerPartie:' + part), 'par changerPartie');
  assert.equal(reprises(), 1, 'la reprise du moteur est lancée une fois'); assert.equal(M.engine().s.batch.id, lot.id, 'même lot');
  assert.deepEqual(lot.processed.map(p => p.cut), [5, 6], 'les cuts d’avant le F5 restent dans le lot (relecture de tous)');
  assert.equal(M.journal('file-reprise-rechargement').at(-1).resultat, 'reprise');
  assert.ok(!M.adapter.calls.some(c => ['skip', 'validate', 'apply'].includes(c)), 'ni SKIP ni validation ni pose');
});
test('F5 : le sélecteur n’est pas encore lisible (partie absente), il le devient → le retour réussit à un des essais suivants', async () => {
  const { M, part, reprises } = await enPause();
  M.adapter.refus = 'partie-absente'; setTimeout(() => { M.adapter.refus = null; }, 400);
  await lancer(M);
  assert.equal(M.adapter.identity.part, part); assert.equal(reprises(), 1);
});
test('lot en pause de l’OPÉRATEUR (PAUSED), ou file absente, ou réglage coupé : aucune reprise seule', async () => {
  let c = await enPause(); c.lot.state = 'PAUSED'; await lancer(c.M); assert.equal(c.reprises(), 0, 'pause de l’opérateur'); assert.equal(c.M.journal('file-reprise-rechargement').length, 0);
  c = await enPause({ ...FICHE, repriseApresRechargement: false }); await lancer(c.M); assert.equal(c.reprises(), 0, 'réglage coupé');
  c = await enPause(); await c.M.b.api('file-arreter'); await lancer(c.M); assert.equal(c.reprises(), 0, 'file arrêtée');
});
test('retour impossible : le lot reste en pause avec son message, aucune reprise', async () => {
  const { M, lot, reprises } = await enPause(); M.adapter.refus = 'partie-absente';
  await lancer(M);
  assert.equal(reprises(), 0); assert.equal(M.engine().s.batch.state, 'PAUSED_ADAPTER_UNRESPONSIVE');
  assert.equal(M.journal('file-reprise-rechargement').at(-1).resultat, 'refus');
});
