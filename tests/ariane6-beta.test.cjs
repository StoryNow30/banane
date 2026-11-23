'use strict';
/* Bêta Ariane 6 : le paquet non empaqueté est clairement distingué d’Ariane 5.x dans edge://extensions,
 * dans la fenêtre et dans le lanceur de la page. */
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '..');

test('Ariane 6 bêta : identité du manifeste, du panneau et du lanceur', () => {
  const m = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
  const K = require('../src/core.js');
  assert.equal(m.name, 'Ariane 6 bêta');
  assert.equal(m.version, '6.0.0');
  assert.equal(m.action.default_title, 'Ouvrir Ariane 6 bêta');
  assert.equal(K.VERSION, '6.0.0');
  assert.equal(K.VERSION_NAME, '6.0.0');
  const html = fs.readFileSync(path.join(root, 'panel.html'), 'utf8');
  assert.ok(html.includes('<title>Ariane 6 bêta</title>'));
  assert.ok(html.includes('ARIANE 6 BÊTA <span>6.0.0</span>'));
  assert.ok(html.includes('<footer>Ariane 6 bêta ·'));
  assert.ok(fs.readFileSync(path.join(root, 'src/bridge.js'), 'utf8').includes('Ariane 6.0.0 · ouvrir'));
});
