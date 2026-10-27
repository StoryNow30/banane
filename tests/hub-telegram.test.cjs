'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), crypto = require('node:crypto');
let W; test.before(async () => { W = await import('../hub/telegram/worker.js'); });

test('telegram : le chantier vient de la réponse à un message du hub, du préfixe, ou du seul chantier ouvert', () => {
  const rep = '[integrateur → operateur] question · CH-002 · 27/10/2026 10:00\n\nQuelle durée ?';
  assert.deepEqual(W.lireTelegram('150 ms', rep, ['CH-002']), { chantier: 'CH-002', type: 'reponse', a: 'integrateur', texte: '150 ms' });
  assert.deepEqual(W.lireTelegram('CH-001 on fusionne', '', ['CH-001', 'CH-002']), { chantier: 'CH-001', type: 'info', a: 'integrateur', texte: 'on fusionne' });
  assert.deepEqual(W.lireTelegram('ok go', '', ['CH-007']), { chantier: 'CH-007', type: 'info', a: 'integrateur', texte: 'ok go' });
  assert.deepEqual(W.lireTelegram('CH-003 question tu peux préciser ?', '', []), { chantier: 'CH-003', type: 'question', a: 'integrateur', texte: 'tu peux préciser ?' });
});
test('telegram : sans chantier déterminable, le relais demande lequel', () => {
  assert.match(W.lireTelegram('salut', '', ['CH-001', 'CH-002']).erreur, /Quel chantier/);
  assert.match(W.lireTelegram('salut', '', []).erreur, /Aucun chantier/);
  assert.match(W.lireTelegram('   ', '', ['CH-001']).erreur, /vide/);
});
test('telegram : le scan refuse courriel, UUID, code projet, adresse web et motif confidentiel', () => {
  assert.deepEqual(W.scan('rien', {}), []);
  assert.deepEqual(W.scan('a@b.fr Project__123456', {}).sort(), ['courriel', 'projetESV']);
  assert.deepEqual(W.scan('https://exemple.invalid/x', {}), ['web']);
  assert.deepEqual(W.scan('un SecretX', { ARIANE_MOTIFS_INTERDITS: 'secretx' }), ['confidentiel']);
});
test('telegram : le commentaire créé a le format du hub, signé operateur', () => {
  const c = W.formaterCommentaire({ type: 'reponse', chantier: 'CH-001', texte: ' oui ', date: new Date('2026-10-27T08:05:00Z') });
  assert.match(c, /^\*\*\[operateur → tous\] reponse · CH-001 · 27\/10\/2026 09:05 Paris\*\*\n\noui\n\n---\n_hub Ariane · émetteur : operateur_$/);
  assert.ok(W.estEcho(c) && W.estMessageHub(c));
});
test('telegram : un message du hub est mis en forme pour le téléphone, borné, sans Markdown', () => {
  const body = '**[actions → tous] verdict · CH-001 · 27/10/2026 10:00 Paris**\n\nVERT sur `8896ace` : **verify** ok.\n\n---\n_hub Ariane · émetteur : actions_';
  const t = W.pourTelegram(body, 'https://github.com/o/r/pull/6');
  assert.match(t, /^\[actions → tous\] verdict · CH-001 · 27\/10\/2026 10:00\n\nVERT sur 8896ace : verify ok\.\n\nhttps:\/\/github\.com\/o\/r\/pull\/6$/);
  assert.ok(W.pourTelegram('**[a → b] info · hub · x Paris**\n\n' + 'z'.repeat(5000) + '\n\n---\n_hub Ariane · émetteur : a_', 'u').length < 3600);
});
test('telegram : la signature GitHub est contrôlée en temps constant', async () => {
  const corps = '{"a":1}', sig = 'sha256=' + crypto.createHmac('sha256', 's3cret').update(corps).digest('hex');
  assert.equal(await W.signatureValide('s3cret', corps, sig), true);
  assert.equal(await W.signatureValide('autre', corps, sig), false);
  assert.equal(await W.signatureValide('s3cret', corps + ' ', sig), false);
  assert.equal(await W.signatureValide('s3cret', corps, undefined), false);
});
test('telegram : le relais refuse une requête sans jeton et un autre interlocuteur que l’opérateur', async () => {
  const env = { TG_WEBHOOK_SECRET: 'j', TG_CHAT_ID: '42', GH_WEBHOOK_SECRET: 'g' };
  const r1 = await W.default.fetch(new Request('https://x/telegram', { method: 'POST', body: '{}' }), env);
  assert.equal(r1.status, 401);
  const r2 = await W.default.fetch(new Request('https://x/github', { method: 'POST', body: '{}' }), env);
  assert.equal(r2.status, 401);
  const r3 = await W.default.fetch(new Request('https://x/telegram', { method: 'POST', headers: { 'X-Telegram-Bot-Api-Secret-Token': 'j' }, body: JSON.stringify({ message: { chat: { id: 99 }, text: 'CH-001 salut' } }) }), env);
  assert.equal(r3.status, 200);   // ignoré sans appel réseau : le chat n'est pas celui de l'opérateur
});
test('telegram : le destinataire vient de @mention, sinon de l’auteur du message auquel on répond', () => {
  assert.deepEqual(W.lireTelegram('CH-001 @glm ticket reprends le test rouge', '', []), { chantier: 'CH-001', type: 'ticket', a: 'glm', texte: 'reprends le test rouge' });
  const rep = '[cursor → integrateur] question · CH-001 · 27/10/2026 10:00\n\nOù est le gabarit ?';
  assert.equal(W.lireTelegram('dans chantiers/MODELE.md', rep, ['CH-001']).a, 'cursor');
  const verdict = '[actions → tous] verdict · CH-001 · 27/10/2026 10:00\n\nVERT';
  assert.equal(W.lireTelegram('merci', verdict, ['CH-001']).a, 'integrateur');
  assert.equal(W.lireTelegram('CH-001 @tous pause générale', '', []).a, 'tous');
});
