#!/usr/bin/env node
'use strict';
/*
 * controle-passe.cjs — CONTRÔLE A POSTERIORI DE LA DEUXIÈME PASSE (architecture 5.0 § d.7, cahier v2 § 6 ch. 7 ; T21a). Hors ligne, lecture seule.
 *
 *   node tools/controle-passe.cjs --collections DOSSIER [--seuil 60] [--json SORTIE.json] [--md SORTIE.md] [--graine N]
 *
 * (1) Liste des cuts ÉCRITS par la deuxième passe, tirée des journaux de lots archivés : événement `passe-differes-ecriture` à `resultat: "ecrit"`.
 *     PREUVE D'ÉCRITURE (fiches/H_PREUVE_SERVEUR.md) : jamais `serverConfirmed` (faux par instrumentation sur le lot, constant à faux sur
 *     `applied-verified`). Un cut est « écriture prouvée » quand l'observateur passif a vu l'écriture de validation de sa ligne : événement
 *     `esv-observation` de genre `write`, statut 2xx, ligne (`rowIndex`) = le cut, corps `ExtractionStatus: "valid"` et `TreatedByOperator: true`,
 *     dans la fenêtre de la pose (durée de la pose + 5 s avant l'événement, 10 s après) ; et/ou quand un instantané de la liste d'ESV de la
 *     même partie, pris APRÈS l'écriture, montre le cut « valid ». Aucun corps d'écriture (bords, coordonnées) n'est recopié.
 * (2) Échantillon pour un Écho ciblé d'au moins `--seuil` cuts (60 : zéro erreur observée donne une borne haute de Wilson à 95 % d'environ 6 %) ;
 *     au-delà du seuil, tirage reproductible (graine écrite). Seuil d'acceptation (D-250) : 0 mauvaise voie, 0 pose à plus de 20 mm.
 * (3) Si les cuts disponibles sont moins nombreux que le seuil, le rapport dit « contrôle non fait : N cuts disponibles » et ce qu'il faut
 *     demander à l'opérateur. Jamais « contrôle fait » sans effectif ni preuve : cet outil ne juge pas les poses (il n'a pas l'Écho ciblé).
 * Source des comptes, par lot : `evenements` (événements de la passe présents), `manquant` (version qui écrit, aucun événement de passe :
 * cache vidé ou passe jamais partie), `sans-objet` (version d'avant la passe en écriture, < 4.9.5.18).
 */
const fs = require('node:fs');
const X = require('./exports-lots.cjs');
const J = require('./juger.cjs');

const VERSION_PASSE_ECRITURE = [4, 9, 5, 18];
const t = x => Date.parse(x || '');
function versionAuMoins(v, ref = VERSION_PASSE_ECRITURE) {
  const a = String(v || '').split('.').map(Number);
  for (let i = 0; i < ref.length; i++) { const x = a[i] || 0; if (x !== ref[i]) return x > ref[i]; }
  return true;
}
const ok2xx = s => Number.isInteger(s) && s >= 200 && s < 300;
const ecritureValidation = e => e && e.type === 'esv-observation' && e.kind === 'write' && ok2xx(e.status) && Number.isInteger(e.rowIndex)
  && e.body && typeof e.body === 'object' && e.body.ExtractionStatus === 'valid' && e.body.TreatedByOperator === true;

/* Les écritures de la passe d'un journal, par lot. `listes` : instantanés décompactés [{ partie, at, st }] (facultatif). */
function ecrituresPasse(journal, { listes = [] } = {}) {
  const ev = Array.isArray(journal && journal.events) ? journal.events : [];
  const ecritures = ev.filter(ecritureValidation);
  const lots = new Map();
  const lot = id => { if (!lots.has(id)) lots.set(id, { lotId: id, partie: null, version: null, ombre: { decisions: 0, poserait: 0, rien: 0, erreur: 0, fin: null }, ecriture: { fin: null }, cuts: [] }); return lots.get(id); };
  for (const e of ev) {
    if (!e || !e.type) continue;
    if (e.type === 'batch-started' && e.batch && e.batch.id) { const L = lot(e.batch.id); L.partie = e.batch.scope ? e.batch.scope.part ?? null : null; L.version = e.batch.scope ? e.batch.scope.extensionVersion || null : null; }
  }
  for (const e of ev) {
    if (!e || !/^passe-differes/.test(e.type || '')) continue;
    const id = e.lotId || e.batchId; if (!id) continue;
    const L = lot(id);
    if (e.type === 'passe-differes-ombre') { L.ombre.decisions++; if (e.decision === 'poserait') L.ombre.poserait++; else if (e.decision === 'rien') L.ombre.rien++; else L.ombre.erreur++; if (L.partie == null && e.identity) L.partie = e.identity.part ?? null; }
    else if (e.type === 'passe-differes-ombre-fin') L.ombre.fin = { mode: e.mode ?? null, differes: e.differes ?? null, posees: e.posees ?? null, ms: e.ms ?? null };
    else if (e.type === 'passe-differes-ecriture-fin') L.ecriture.fin = { issue: e.issue ?? null, raison: e.raison != null ? String(e.raison).slice(0, 120) : null, ecrites: e.ecrites ?? null, demandees: e.demandees ?? null, decidees: e.decidees ?? null };
    else if (e.type === 'passe-differes-ecriture' && e.identity && Number.isInteger(e.identity.cut)) {
      const cut = e.identity.cut, te = t(e.timestamp), avant = (Number.isFinite(e.ms) ? e.ms : 30000) + 5000;
      const w = ecritures.filter(x => x.rowIndex === cut && t(x.timestamp) >= te - avant && t(x.timestamp) <= te + 10000).sort((a, b) => Math.abs(t(a.timestamp) - te) - Math.abs(t(b.timestamp) - te))[0] || null;
      const partie = e.identity.part ?? L.partie;
      const lApres = listes.filter(l => l.partie === partie && t(l.at) > te && l.st && cut < l.st.length).sort((a, b) => t(a.at) - t(b.at))[0] || null;
      L.cuts.push({ cut, partie, passe: e.passe ?? null, resultat: e.resultat || null, raison: e.raison != null ? String(e.raison).slice(0, 120) : null,
        preuveEcriture: w ? { statut: w.status, ecartMs: t(w.timestamp) - te } : null,
        preuveListe: lApres ? { at: lApres.at, valide: lApres.st[cut] === 0 } : null });
    }
  }
  const out = [];
  for (const L of lots.values()) {
    const ecrits = L.cuts.filter(c => c.resultat === 'ecrit');
    const passe = L.ombre.decisions || L.ombre.fin || L.ecriture.fin || L.cuts.length;
    const source = passe ? 'evenements' : versionAuMoins(L.version) ? 'manquant' : 'sans-objet';
    if (!passe && !L.version) continue;
    out.push({ ...L, source, ecrits: ecrits.length, ecritsProuves: ecrits.filter(c => c.preuveEcriture || (c.preuveListe && c.preuveListe.valide)).length,
      ecritsSansPreuve: ecrits.filter(c => !c.preuveEcriture && !(c.preuveListe && c.preuveListe.valide)).map(c => c.cut) });
  }
  return out;
}

/* Tirage reproductible (générateur congruentiel de graine donnée). */
function echantillon(liste, n, graine = 1) {
  if (liste.length <= n) return liste.slice();
  let s = graine >>> 0; const r = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32;
  const a = liste.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a.slice(0, n).sort((x, y) => x.partie - y.partie || x.cut - y.cut);
}

/* Contrôle sur un ensemble de lots déjà extraits (dédoublonnés par identifiant de lot). */
function controler(lots, { seuil = 60, graine = 1 } = {}) {
  const parLot = new Map();
  for (const l of lots) { const old = parLot.get(l.lotId); if (!old || l.cuts.length + l.ombre.decisions > old.cuts.length + old.ombre.decisions) parLot.set(l.lotId, l); }
  const L = [...parLot.values()];
  const disponibles = L.flatMap(l => l.cuts.filter(c => c.resultat === 'ecrit' && (c.preuveEcriture || (c.preuveListe && c.preuveListe.valide))).map(c => ({ partie: c.partie, cut: c.cut, lot: String(l.lotId).slice(0, 8) })));
  const fait = disponibles.length >= seuil;
  const borne = J.wilson(0, disponibles.length);
  return { seuil, graine, lots: L.length, disponibles: disponibles.length, ecritsSansPreuve: L.flatMap(l => l.ecritsSansPreuve.map(cut => ({ partie: l.partie, cut }))),
    statut: fait ? 'echantillon-pret' : 'controle-non-fait', borneWilson95SiZeroErreur: borne,
    echantillon: fait ? echantillon(disponibles, seuil, graine) : disponibles,
    message: fait ? `échantillon de ${seuil} cuts prêt pour l'Écho ciblé (sur ${disponibles.length} écrits et prouvés) ; seuil : 0 mauvaise voie, 0 pose à plus de 20 mm`
      : `contrôle non fait : ${disponibles.length} cut(s) disponible(s) (écrits par la passe, écriture prouvée), il en faut ${seuil}`,
    parLot: L.map(l => ({ lot: String(l.lotId).slice(0, 8), partie: l.partie, version: l.version, source: l.source, ombre: l.ombre, ecriture: l.ecriture, ecrits: l.ecrits, ecritsProuves: l.ecritsProuves,
      refuses: l.cuts.filter(c => c.resultat && c.resultat !== 'ecrit').map(c => ({ cut: c.cut, resultat: c.resultat, raison: c.raison })),
      cuts: l.cuts.filter(c => c.resultat === 'ecrit').map(c => ({ cut: c.cut, passe: c.passe, preuveEcriture: c.preuveEcriture, preuveListe: c.preuveListe })) })) };
}

function lireCollections(racine) {
  const L = require('../src/liste-memoire.js');
  const inv = X.inventaire(racine), listes = [], lots = [];
  for (const x of inv.lisibles.filter(y => y.type === 'liste')) { try { const d = L.decompacter(JSON.parse(X.lireEntree(x).toString('utf8'))); listes.push({ partie: d.partie, at: d.at, st: d.st }); } catch { /* instantané illisible : ignoré */ } }
  for (const x of inv.lisibles.filter(y => y.type === 'journal')) {
    const buf = X.lireEntree(x);
    const j = JSON.parse(buf.toString('utf8'));
    for (const l of ecrituresPasse(j, { listes })) lots.push({ ...l, export: { collection: x.collection, nom: x.nom, sha256: X.sha256(buf) } });
  }
  return { lots, illisibles: inv.illisibles };
}

function markdown(r) {
  const L = ['# Contrôle a posteriori de la deuxième passe', '', `**${r.message}.**`, '',
    `Lots lus : ${r.lots} ; cuts écrits par la passe avec écriture prouvée : ${r.disponibles}${r.ecritsSansPreuve.length ? ` ; écrits sans preuve : ${r.ecritsSansPreuve.map(c => `${c.partie}:${c.cut}`).join(', ')}` : ''}. Preuve : écriture de validation 2xx vue par l'observateur passif, ou liste d'ESV postérieure ; jamais \`serverConfirmed\`.`, '',
    '| Lot | Partie | Version | Source | Décisions en ombre | « poserait » | Demandées | Écrites | Écrites prouvées | Issue |', '|---|---|---|---|---|---|---|---|---|---|'];
  for (const l of r.parLot.filter(x => x.source !== 'sans-objet')) L.push(`| ${l.lot} | ${l.partie ?? '?'} | ${l.version ?? '?'} | ${l.source} | ${l.ombre.decisions} | ${l.ombre.poserait} | ${l.ecriture.fin ? l.ecriture.fin.demandees ?? '—' : '—'} | ${l.ecrits} | ${l.ecritsProuves} | ${l.ecriture.fin ? `${l.ecriture.fin.issue}${l.ecriture.fin.raison ? ` (${l.ecriture.fin.raison})` : ''}` : '—'} |`);
  L.push('', `Lots d'avant la passe en écriture (< 4.9.5.18) : ${r.parLot.filter(x => x.source === 'sans-objet').length}, sans objet.`);
  if (r.statut === 'echantillon-pret') L.push('', `Échantillon (graine ${r.graine}) : ${r.echantillon.map(c => `${c.partie}:${c.cut}`).join(', ')}.`);
  else if (r.echantillon.length) L.push('', `Cuts disponibles : ${r.echantillon.map(c => `${c.partie}:${c.cut}`).join(', ')}.`);
  return L.join('\n') + '\n';
}

function main(argv) {
  const o = { seuil: 60, graine: 1 };
  for (let i = 0; i < argv.length; i++) { const k = argv[i], v = () => argv[++i]; if (k === '--collections') o.collections = v(); else if (k === '--seuil') o.seuil = Number(v()); else if (k === '--json') o.json = v(); else if (k === '--md') o.md = v(); else if (k === '--graine') o.graine = Number(v()); else throw Error('argument inconnu : ' + k); }
  if (!o.collections) throw Error('usage : node tools/controle-passe.cjs --collections DOSSIER [--seuil 60] [--json S.json] [--md S.md] [--graine N]');
  const { lots, illisibles } = lireCollections(o.collections), r = { ...controler(lots, o), illisibles: illisibles.length };
  if (o.json) fs.writeFileSync(o.json, JSON.stringify(r, null, 1) + '\n');
  const md = markdown(r); if (o.md) fs.writeFileSync(o.md, md); else process.stdout.write(md);
  return r;
}
module.exports = { VERSION_PASSE_ECRITURE, versionAuMoins, ecritureValidation, ecrituresPasse, echantillon, controler, lireCollections, markdown, main };
if (require.main === module) { try { main(process.argv.slice(2)); } catch (e) { process.stderr.write(`controle-passe : ${e.message}\n`); process.exitCode = 1; } }
