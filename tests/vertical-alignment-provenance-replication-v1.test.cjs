#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const V = require('../tools/vertical-alignment-provenance-replication-v1.cjs');
const ROOT = path.resolve(__dirname, '..');
const ART = path.join(ROOT, 'audit/vertical-alignment-provenance-replication-v1.json');
let n = 0;
function test(name, fn) { n++; fn(); process.stdout.write('ok ' + n + ' ' + name + '\n'); }
test('hashes gelés', () => { const h = V.assertFrozen(); assert.equal(h.match, true); });
test('pas G.propose(', () => {
  const src = fs.readFileSync(path.join(ROOT, 'tools/vertical-alignment-provenance-replication-v1.cjs'), 'utf8');
  assert.equal(/G\\.propose\\s*\\(/.test(src), false);
});
test('railProvenance synthétique', () => {
  const base = () => ({ association:{status:'ok'}, localTransformed:{zLocalHeadWindow:{median:0.005}}, landscape:{status:'measured', coarseZ:-0.04, refinedZ:-0.043} });
  assert.equal(V.railProvenance(base()), 'coarse-search-offset-while-local-near-plane');
});
test('quantiles', () => { assert.equal(V.quantiles([1,2,3,4,5]).median, 3); });
test('artefact 63/176', () => {
  const d = JSON.parse(fs.readFileSync(ART, 'utf8'));
  assert.equal(d.population.failures, 63);
  assert.equal(d.population.controls, 176);
  assert.equal(d.provenance.stage, 'coarse-search-z');
});
process.stdout.write('# pass ' + n + '/' + n + '\n');
