/* Réducteur d'exports — cœur commun au navigateur (tools/reducteur-exports.html) et à Node (essais).
 *
 * But : rendre un export d'Ariane assez léger pour être envoyé, sans rien installer. Un lot Orbite
 * n'a besoin que de son journal et de son diagnostic (le corpus de nuages et le bilan pèsent 95 %
 * du poids et ne changent aucun chiffre du rapport d'acceptation). Une relecture Écho n'a besoin que
 * de ses visites, sans les instantanés de rails, les observations de géométrie, les captures de
 * géométrie, les événements et les nuages. Le rapport d'acceptation (tools/acceptance-report.cjs)
 * donne les mêmes résultats sur ces fichiers allégés (tests/reducteur-exports.test.cjs).
 * Le rejeu hors ligne et les études de règles exigent en revanche les exports complets. */
(function (root, factory) {
  const api = factory(typeof module === 'object' ? require('../src/native-export.js') : root.BananeNativeExport);
  if (typeof module === 'object') module.exports = api; else root.ArianeReducteur = api;
})(typeof self !== 'undefined' ? self : this, function (X) {
  'use strict';
  const LOURDS = ['railSnapshots', 'geometryObservations', 'geometryCaptures'];
  const FORMATS = {
    'banane-test-journal-v4': 'journal', 'banane-gcv1-diagnostic-v1': 'diagnostic', 'banane-gcv1-lidar-corpus-v1': 'corpus',
    'banane-test-dataset-v4': 'bilan', 'banane-native-session-v2': 'relecture', 'banane-native-session-v3-compact': 'relecture',
  };
  /* Le format est la première clé de chaque export : les quelques centaines d'octets du début suffisent. */
  function classer(entete) {
    const m = /"format"\s*:\s*"([^"]+)"/.exec(String(entete).slice(0, 600));
    return (m && FORMATS[m[1]]) || 'autre';
  }
  const alleger = record => { const r = { ...record }; for (const k of LOURDS) delete r[k]; return r; };

  /* Relecture : les segments d'un export se donnent dans l'ordre des noms de fichier (l'horodatage du vidage,
   * puis segNN). Chaque segment est relu avec les dictionnaires du précédent (KI-060), ses visites sont
   * allégées, et pour une même visite la plus récente l'emporte. */
  class Relecture {
    constructor() { this.records = new Map(); this.precedent = null; this.segments = 0; this.visitesLues = 0; this.octetsLourds = 0; this.debut = null; this.version = null; }
    ajouter(brut) {
      const seg = brut.segment || {}, stamp = String(seg.stamp || ''), index = seg.index || 0;
      const prev = this.precedent && this.precedent.stamp === stamp && this.precedent.index === index - 1 ? this.precedent.dictionaries : null;
      const plein = X.expand(brut, { previousDictionaries: prev });
      this.precedent = brut.dictionaries ? { stamp, index, dictionaries: brut.dictionaries } : null;
      const at = String(plein.exportedAt || '');
      for (const r of plein.records || []) {
        const cle = r.recordId || r.id || r.visitId;
        if (!cle) continue;
        this.visitesLues++;
        const ancien = this.records.get(cle);
        if (!ancien || at >= ancien.at) this.records.set(cle, { at, record: alleger(r) });
      }
      this.segments++; this.version = plein.version ?? this.version; this.debut = this.debut || plein.session?.startedAt || null;
      return { visites: (plein.records || []).length };
    }
    parties() { return [...new Set([...this.records.values()].map(x => x.record.identity?.part).filter(Number.isInteger))].sort((a, b) => a - b); }
    /* Un ou plusieurs documents lisibles par acceptance-report (kindOf : `session` + `records`) ; au-delà de
     * `maxOctets` de JSON, les visites sont réparties en plusieurs documents (la fusion en fait l'union). */
    documents(maxOctets = 150e6) {
      const docs = []; let lot = [], taille = 0;
      const clore = () => { if (lot.length) docs.push(lot); lot = []; taille = 0; };
      for (const { record } of this.records.values()) {
        const n = JSON.stringify(record).length;
        if (lot.length && taille + n > maxOctets) clore();
        lot.push(record); taille += n;
      }
      clore();
      if (!docs.length) docs.push([]);
      return docs.map((records, i) => ({
        format: 'ariane-relecture-reduite-v1', version: this.version, session: { id: 'reduite', startedAt: this.debut },
        reduction: { outil: 'reducteur-exports', partie: i + 1, sur: docs.length, segments: this.segments, retire: [...LOURDS, 'events', 'clouds'] },
        records, events: [], clouds: [],
      }));
    }
  }
  return { classer, alleger, Relecture, LOURDS, FORMATS };
});
