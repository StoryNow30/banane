#!/usr/bin/env node
'use strict';
/*
 * trace-ecritures.cjs — compare, cut par cut, les ÉCRITURES SERVEUR d'un lot Orbite (Ariane) à celles d'une Écho
 * (l'opérateur) de la même partie. Mesure I6 de l'audit 5.0 : la trace laissée dans ESV par Ariane doit être celle d'un
 * traitement manuel, sans marque distinctive. Outil hors ligne, lecture seule, aucune dépendance, aucune requête.
 *
 *   node tools/trace-ecritures.cjs --orbite <journal ou dossier…> --echo <dossier ou fichiers…>
 *        [--partie N] [--pause-s 120] [--sortie resultat.json] [--csv-cuts table.csv]
 *
 * Ce qui est lu (les mêmes relevés que tools/jointure-echo-orbite.cjs, qui lit `serverWrites`, et que les mesures S6,
 * qui lisent les événements `esv-observation`) :
 *  - les événements `esv-observation` de genre `write` : une ligne par requête d'écriture vue par l'observateur de la page
 *    (méthode, code de retour, tentative, durée, numéro de ligne `rowIndex` = numéro du cut, corps) ; c'est la liste
 *    COMPLÈTE, dans le journal Orbite comme dans l'export Écho ;
 *  - les événements `esv-observation` de genre `esv-event` (`railPairSelected`, `railPairSeen`, `railPairUpdated`…) : ce
 *    qu'ESV annonce lui-même sur sa page, utile pour dater l'arrivée sur un cut ;
 *  - dans l'Écho, les `serverWrites` des visites : recoupement seulement (ils sont rattachés à une visite et limités à 16 par
 *    visite) ; ils servent de repli si l'export n'a aucun événement `write`.
 * Les cuts « visités » viennent du journal Orbite (événements portant une identité : proposition, changement de cible…) et
 * des visites de l'Écho (records). Une écriture est rattachée à un cut par son `rowIndex` ; sans lui (requête en échec,
 * reprise ensuite par ESV), elle prend celui de sa reprise.
 *
 * Nature d'une écriture (comme `noteServerWriteNow` dans src/native-session.js, en plus strict) :
 *  - « validation » : ExtractionStatus « valid » et TreatedByOperator vrai ;
 *  - « seen »       : le seul champ est SeenByOperator (vrai) ;
 *  - « autre »      : le reste (ExtractionStatus « skipped », champs inattendus, corps absent), détaillé en sous-natures.
 *
 * Par source, l'outil donne :
 *  - écritures par nature, par cut, et séquence des natures par cut (ordre) ;
 *  - champs écrits (ordre des clés compris), valeurs des champs énumérés, nombre de chiffres des nombres ;
 *  - codes de retour, issues, tentatives, méthode, classe d'adresse ;
 *  - intervalles : entre toutes les écritures, entre validations successives (« cycle »), du seen à la validation d'un
 *    cut, durée de la requête ; les pauses (plus de `--pause-s` secondes) sont comptées à part ;
 *  - régularité du cycle : coefficient de variation, écart absolu médian, part dans ±10 % / ±25 % de la médiane,
 *    autocorrélation d'ordre 1 ;
 *  - enchaînements d'écritures consécutives (nature, même cut ou autre cut) ;
 *  - événements ESV par cut, délai de l'événement « sélectionné » à l'écriture seen.
 * L'Écho est aussi coupée en deux : cuts que le lot avait déjà visités (SeenByOperator déjà écrit par le lot) et les autres,
 * car ESV n'écrit « seen » que la première fois.
 *
 * Comparaison (`comparer`) : écart de champs, écritures qu'un humain ne fait jamais (présentes chez Orbite, absentes de
 * l'Écho), écritures qu'Ariane ne fait jamais (l'inverse), rythme (comparaison des cycles, test de Kolmogorov-Smirnov à deux
 * échantillons), et une liste de drapeaux : « identique », « difference », « trahison-possible » (règles écrites dans
 * `drapeaux`). Un drapeau est un indicateur à lire avec la fiche, pas un verdict.
 *
 * Ce que l'outil NE voit PAS : tout ce qui n'est pas une requête d'écriture vue par l'observateur (télémétrie cliente
 * d'ESV, requêtes de lecture, événements d'interface), les en-têtes, l'adresse réseau, et ce que le serveur enregistre de son
 * côté. Voir fiches/TRACE_ESV.md.
 */
const fs = require('node:fs');
const path = require('node:path');
const X = require('../src/native-export.js');
const V = require('./lire-volumes.cjs');

const PAUSE_DEFAUT_S = 120;
const REPRISE_MAX_MS = 10000;          // une écriture sans numéro de ligne prend celui de sa reprise, si celle-ci suit de moins de 10 s
const SELECTION_MAX_MS = 60000;        // au-delà, l'événement « sélectionné » n'est plus celui de l'arrivée
const NOM_EXPORT_ECHO = /^(ariane|banane)-(native-v\d+|echo)-/;
const NOM_JOURNAL = /-journal-v\d+-/;
const BORNES_HISTO_S = [0.5, 1, 1.5, 2, 3, 5, 10, 30, 120];
const CLES_ENUMEREES = ['ExtractionStatus', 'SeenByOperator', 'TreatedByOperator', 'RailType'];

/* ------------------------------------------------------------------ outils numériques */
const fini = v => Number.isFinite(v);
const arrondi = (v, d = 3) => fini(v) ? Math.round(v * 10 ** d) / 10 ** d : null;
const trier = v => v.filter(fini).sort((a, b) => a - b);
function quantile(trie, p) {
  if (!trie.length) return null;
  const at = (trie.length - 1) * p, lo = Math.floor(at), hi = Math.ceil(at);
  return trie[lo] + (trie[hi] - trie[lo]) * (at - lo);
}
const moyenne = v => v.reduce((a, b) => a + b, 0) / v.length;
function stat(valeurs, d = 3) {
  const v = trier(valeurs);
  if (!v.length) return { n: 0 };
  return { n: v.length, min: arrondi(v[0], d), p5: arrondi(quantile(v, .05), d), p25: arrondi(quantile(v, .25), d), med: arrondi(quantile(v, .5), d),
    p75: arrondi(quantile(v, .75), d), p90: arrondi(quantile(v, .9), d), p95: arrondi(quantile(v, .95), d), p99: arrondi(quantile(v, .99), d),
    max: arrondi(v[v.length - 1], d), moy: arrondi(moyenne(v), d) };
}
const compte = (liste, f) => { const o = {}; for (const x of liste) { const k = f(x); o[k] = (o[k] || 0) + 1; } return o; };
const classe3 = n => n >= 3 ? '3+' : String(n);
const part = (n, total) => total ? arrondi(n / total, 4) : null;
const trieCles = o => Object.fromEntries(Object.entries(o).sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]))));

/* Régularité d'une suite chronologique d'intervalles (secondes) : plus le coefficient de variation et l'écart absolu médian
 * sont petits, plus le rythme est régulier ; une autocorrélation proche de 0 est celle d'un rythme sans mémoire. */
function regularite(chrono) {
  const v = chrono.filter(fini), n = v.length;
  if (n < 3) return { n };
  const moy = moyenne(v), sd = Math.sqrt(moyenne(v.map(x => (x - moy) ** 2))), tri = trier(v), med = quantile(tri, .5);
  const mad = quantile(trier(v.map(x => Math.abs(x - med))), .5);
  const dans = f => v.filter(x => Math.abs(x - med) <= f * med).length / n;
  const paires = [];
  for (let i = 0; i + 1 < chrono.length; i++) if (fini(chrono[i]) && fini(chrono[i + 1])) paires.push([chrono[i], chrono[i + 1]]);
  let autocorrelation1 = null;
  if (paires.length >= 3) {
    const ma = moyenne(paires.map(p => p[0])), mb = moyenne(paires.map(p => p[1]));
    const cov = moyenne(paires.map(p => (p[0] - ma) * (p[1] - mb))), va = moyenne(paires.map(p => (p[0] - ma) ** 2)), vb = moyenne(paires.map(p => (p[1] - mb) ** 2));
    autocorrelation1 = va > 0 && vb > 0 ? arrondi(cov / Math.sqrt(va * vb), 3) : null;
  }
  return { n, cv: arrondi(sd / moy, 3), madSurMediane: arrondi(mad / med, 3), partMed10: arrondi(dans(.1), 3), partMed25: arrondi(dans(.25), 3), autocorrelation1 };
}
function histogramme(valeurs) {
  const noms = [], bornes = BORNES_HISTO_S;
  bornes.forEach((b, i) => noms.push(i ? `${bornes[i - 1]}-${b}` : `<${b}`));
  noms.push(`>${bornes[bornes.length - 1]}`);
  const o = Object.fromEntries(noms.map(n => [n, 0]));
  for (const x of valeurs.filter(fini)) { let i = bornes.findIndex(b => x < b); if (i < 0) i = bornes.length; o[noms[i]]++; }
  return o;
}
/* Test de Kolmogorov-Smirnov à deux échantillons : écart maximal D des fonctions de répartition, p asymptotique. */
function kolmogorovSmirnov(a, b) {
  const x = trier(a), y = trier(b);
  if (x.length < 2 || y.length < 2) return null;
  let i = 0, j = 0, D = 0;
  while (i < x.length && j < y.length) {
    const t = Math.min(x[i], y[j]);
    while (i < x.length && x[i] <= t) i++;
    while (j < y.length && y[j] <= t) j++;
    D = Math.max(D, Math.abs(i / x.length - j / y.length));
  }
  const ne = x.length * y.length / (x.length + y.length), lambda = (Math.sqrt(ne) + 0.12 + 0.11 / Math.sqrt(ne)) * D;
  /* Loi de Kolmogorov : deux séries équivalentes, la seconde (en 1/λ) converge vite pour les petits λ. */
  let p = 0;
  if (lambda < 1.18) {
    let q = 0;
    for (let k = 1; k <= 50; k++) q += Math.exp(-((2 * k - 1) ** 2) * Math.PI ** 2 / (8 * lambda * lambda));
    p = lambda > 0 ? 1 - Math.sqrt(2 * Math.PI) / lambda * q : 1;
  } else {
    for (let k = 1; k <= 100; k++) { const t = 2 * (k % 2 ? 1 : -1) * Math.exp(-2 * k * k * lambda * lambda); p += t; if (Math.abs(t) < 1e-12) break; }
  }
  return { D: arrondi(D, 4), p: Math.min(1, Math.max(0, arrondi(p, 6))), nOrbite: x.length, nEcho: y.length };
}

/* Test exact de Fisher bilatéral sur un tableau 2×2 [[a, b], [c, d]] (somme des probabilités au plus égales à celle observée). */
function fisherExact(a, b, c, d) {
  const n = a + b + c + d;
  if (!n) return null;
  const lf = [0];
  for (let i = 1; i <= n; i++) lf[i] = lf[i - 1] + Math.log(i);
  const lp = (x, r1, c1) => lf[r1] + lf[n - r1] + lf[c1] + lf[n - c1] - lf[n] - lf[x] - lf[r1 - x] - lf[c1 - x] - lf[n - r1 - c1 + x];
  const r1 = a + b, c1 = a + c, obs = lp(a, r1, c1);
  let p = 0;
  for (let x = Math.max(0, r1 + c1 - n); x <= Math.min(r1, c1); x++) { const l = lp(x, r1, c1); if (l <= obs + 1e-9) p += Math.exp(l); }
  return Math.min(1, arrondi(p, 8));
}

/* ------------------------------------------------------------------ lecture */
const lireDoc = e => { let d = JSON.parse(e.lire().toString('utf8')); if (d.dictionaries) d = X.unfoldRefs(d, d.dictionaries); return d; };
function sources(entrees, nomOk) {
  const out = [];
  for (const e of entrees) {
    const dossier = fs.existsSync(e) && fs.statSync(e).isDirectory();
    for (const x of V.entrees(e)) { if (dossier && !nomOk.test(x.nom)) continue; out.push(x); }
  }
  return out;
}
const estObs = e => e && e.type === 'esv-observation' && (e.kind === 'write' || e.kind === 'esv-event' || e.kind === 'resource' || e.kind === 'list-page');

/* Journal(aux) Orbite déjà lus (documents) → { nom:'orbite', evenements:[esv-observation…], visites:[{partie,cut,visites}] }. */
function lireOrbiteDoc(docs, { avis = () => {} } = {}) {
  const evenements = new Map(), visites = new Map();
  let anonymes = 0;
  for (const doc of Array.isArray(docs) ? docs : [docs]) {
    if (!Array.isArray(doc.events) || !/journal/.test(doc.format || '')) { avis('ignoré (pas un journal Orbite)'); continue; }
    for (const ev of doc.events) {
      if (estObs(ev)) evenements.set(ev.eventId || `#${anonymes++}`, ev);
      const id = ev.identity || (Number.isInteger(ev.cut) && Number.isInteger(ev.part) ? ev : null);
      if (!id || !Number.isInteger(id.part) || !Number.isInteger(id.cut)) continue;
      if (ev.type !== 'proposed' && ev.type !== 'cut-target-changed') continue;
      const k = `${id.part}|${id.cut}`;
      if (!visites.has(k)) visites.set(k, { partie: id.part, cut: id.cut, visites: 0 });
      if (ev.type === 'cut-target-changed') visites.get(k).visites++;
    }
  }
  if (!evenements.size && !visites.size) throw Error('Aucun journal Orbite lisible.');
  return { nom: 'orbite', evenements: [...evenements.values()], visites: [...visites.values()].map(v => ({ ...v, visites: Math.max(1, v.visites) })), serverWrites: [] };
}
function lireOrbite(entrees, { avis = () => {} } = {}) {
  const liste = sources(entrees, NOM_JOURNAL);
  if (!liste.length) throw Error('Aucun journal Orbite (ariane-journal-v4-*.json) trouvé.');
  return lireOrbiteDoc(liste.map(e => { const d = lireDoc(e); if (!Array.isArray(d.events) || !/journal/.test(d.format || '')) avis(`ignoré (pas un journal Orbite) : ${e.nom}`); return d; }), { avis });
}

/* Export(s) Écho déjà lus (documents) → { nom:'echo', evenements, visites:[{partie,cut,session}], serverWrites:[…] }. Les segments et
 * sessions s'unissent : événements par eventId, records par (session, recordId). */
function lireEchoDoc(docs, { avis = () => {} } = {}) {
  const evenements = new Map(), records = new Map(), sessions = new Set();
  let anonymes = 0, segments = 0;
  for (const doc of Array.isArray(docs) ? docs : [docs]) {
    if (!/^banane-native-session-/.test(doc.format || '')) { avis('ignoré (pas un export Écho)'); continue; }
    segments++;
    const session = doc.session && doc.session.id || null;
    for (const ev of doc.events || []) if (estObs(ev)) evenements.set(ev.eventId || `#${anonymes++}`, ev);
    for (const r of doc.records || []) {
      const s = r.nativeSessionId || session || '';
      if (s) sessions.add(s);
      const id = r.identity || {};
      records.set(`${s}|${r.recordId || r.visitIndex}`, { partie: id.part, cut: id.cut, session: s, debut: r.startedAt || null, serverWrites: Array.isArray(r.serverWrites) ? r.serverWrites : [] });
    }
  }
  if (!segments) throw Error('Aucun des fichiers donnés n\'est un export Écho (banane-native-session-*).');
  const visites = [...records.values()].filter(r => Number.isInteger(r.partie) && Number.isInteger(r.cut));
  return { nom: 'echo', evenements: [...evenements.values()], visites, serverWrites: visites.flatMap(r => r.serverWrites), sessions: sessions.size, segments };
}
function lireEcho(entrees, { avis = () => {} } = {}) {
  const liste = sources(entrees, NOM_EXPORT_ECHO);
  if (!liste.length) throw Error('Aucun export Écho (ariane-echo-*.json, ariane-native-v4-*.json) trouvé.');
  return lireEchoDoc(liste.map(e => { const d = lireDoc(e); if (!/^banane-native-session-/.test(d.format || '')) avis(`ignoré (pas un export Écho) : ${e.nom}`); return d; }), { avis });
}

/* ------------------------------------------------------------------ extraction */
function natureDe(c) {
  if (!c) return 'autre';
  if (c.ExtractionStatus === 'valid' && c.TreatedByOperator === true) return 'validation';
  if (Object.keys(c).length === 1 && c.SeenByOperator === true) return 'seen';
  return 'autre';
}
function sousNatureDe(c) {
  if (!c) return 'sans-corps';
  if (c.ExtractionStatus !== undefined) return `ExtractionStatus=${c.ExtractionStatus}`;
  return `champs:${Object.keys(c).join('+')}`;
}
const LETTRE = { seen: 'S', validation: 'V', autre: 'A' };
function ecritureDe(e) {
  const corps = e.body && typeof e.body === 'object' ? e.body : null;
  const recu = Date.parse(e.timestamp || e.at || '');
  const t = fini(e.startedEpochMs) ? e.startedEpochMs : recu;
  return { id: e.eventId || null, t, recu: fini(recu) ? recu : t, dureeMs: fini(e.durationMs) ? e.durationMs : null, cut: Number.isInteger(e.rowIndex) ? e.rowIndex : null,
    nature: natureDe(corps), sousNature: sousNatureDe(corps), champs: corps ? Object.keys(corps) : [], corps, status: e.status ?? null, outcome: e.outcome ?? null,
    attempt: e.attempt ?? null, method: e.method ?? null, urlClass: e.urlClass ?? null, via: e.via ?? null, seq: e.observer && fini(e.observer.seq) ? e.observer.seq : 0, reattribuee: false };
}
/* Extrait d'une source : écritures triées (avec rattachement au cut), événements ESV, cuts visités. */
function extraire(source, { partie = null } = {}) {
  const visites = source.visites.filter(v => partie === null || v.partie === partie);
  const cuts = new Map();
  for (const v of visites) cuts.set(v.cut, (cuts.get(v.cut) || 0) + (v.visites || 1));
  const brutes = source.evenements.filter(e => e.kind === 'write');
  let origine = 'esv-observation';
  let ecritures = brutes.map(ecritureDe);
  /* Recoupement avec les `serverWrites` des visites (Écho), et repli si l'export n'a aucun événement `write`. */
  const ids = new Set(ecritures.map(w => w.id));
  const sw = source.serverWrites || [];
  const recoupement = { serverWrites: sw.length, dansEvenements: sw.filter(w => ids.has(w.eventId)).length, seulementServerWrites: 0 };
  if (!ecritures.length && sw.length) {
    origine = 'serverWrites';
    ecritures = sw.map(w => ({ ...ecritureDe({ ...w, timestamp: w.at }), id: w.eventId || null }));
    recoupement.seulementServerWrites = sw.length;
  }
  ecritures.sort((a, b) => a.t - b.t || a.seq - b.seq);
  /* Écriture sans numéro de ligne (échec puis reprise) : elle prend celui de la reprise (tentative suivante, même corps). */
  let reattribuees = 0;
  ecritures.forEach((w, i) => {
    if (w.cut !== null) return;
    const suite = ecritures.slice(i + 1).find(x => x.cut !== null && x.attempt === (w.attempt || 1) + 1 && JSON.stringify(x.corps) === JSON.stringify(w.corps) && x.t - w.t <= REPRISE_MAX_MS);
    if (suite) { w.cut = suite.cut; w.reattribuee = true; reattribuees++; }
  });
  const evenements = source.evenements.filter(e => e.kind === 'esv-event').map(e => ({ nom: e.nom, t: Date.parse(e.timestamp || ''), cut: Array.isArray(e.args) && Number.isInteger(e.args[1]) ? e.args[1] : null,
    statut: Array.isArray(e.args) && typeof e.args[2] === 'string' ? e.args[2] : null })).filter(e => fini(e.t)).sort((a, b) => a.t - b.t);
  /* Lectures (hors périmètre des écritures, mais vues du serveur) : relevés `resource` (requêtes de nuages de points, par fenêtres
   * de 250 ms), rattachés au cut sélectionné à ce moment-là ; relevés `list-page` (rechargements de la liste). */
  const selections = evenements.filter(e => e.nom === 'railPairSelected' && e.cut !== null);
  let k = -1;
  const ressources = source.evenements.filter(e => e.kind === 'resource').map(e => ({ t: Date.parse(e.timestamp || ''), classe: e.class || '?', n: fini(e.ept) ? e.ept : (e.n || 0), octets: e.bytes || 0,
    statuts: e.statuts || {}, echecs: e.echecs || 0, dureeTotMs: e.dureeTotMs || 0, cut: null })).filter(r => fini(r.t)).sort((a, b) => a.t - b.t);
  for (const r of ressources) { while (k + 1 < selections.length && selections[k + 1].t <= r.t) k++; r.cut = k >= 0 ? selections[k].cut : null; }
  const listPages = source.evenements.filter(e => e.kind === 'list-page').length;
  return { nom: source.nom, cuts, nVisites: visites.length, ecritures, evenements, ressources, listPages, origine, recoupement, reattribuees, sessions: source.sessions || null, segments: source.segments || null };
}

/* ------------------------------------------------------------------ mesure d'une source */
function mesurer(ex, { pauseS = PAUSE_DEFAUT_S, cutsLot = null } = {}) {
  /* Une tentative en échec reprise par ESV (tentative suivante, même corps) est la même écriture logique : elle compte dans les
   * codes de retour, pas dans les natures, les séquences ni le rythme. */
  const toutes = ex.ecritures, w = toutes.filter(x => !x.reattribuee), dansCut = x => x.cut !== null && ex.cuts.has(x.cut);
  const parCut = new Map([...ex.cuts.keys()].map(c => [c, []]));
  for (const x of w) if (dansCut(x)) parCut.get(x.cut).push(x);
  const cutsListe = [...parCut.keys()];
  const nbCuts = cutsListe.length;
  const nat = n => w.filter(x => x.nature === n);
  const res = { source: ex.nom };

  res.entrees = { origineEcritures: ex.origine, ecritures: toutes.length, ecrituresLogiques: w.length, ecrituresDansCutVisite: w.filter(dansCut).length, ecrituresHorsCutVisite: w.filter(x => x.cut !== null && !ex.cuts.has(x.cut)).length,
    ecrituresSansCut: w.filter(x => x.cut === null).length, reattribueesParReprise: ex.reattribuees, evenementsEsv: ex.evenements.length, recoupementServerWrites: ex.recoupement,
    sessions: ex.sessions, segments: ex.segments };
  res.cuts = { visites: ex.nVisites, cutsVisites: nbCuts, visitesParCut: trieCles(compte(cutsListe, c => classe3(ex.cuts.get(c)))),
    cutsAvecEcriture: cutsListe.filter(c => parCut.get(c).length).length, cutsSansEcriture: cutsListe.filter(c => !parCut.get(c).length).length };

  const parNature = { seen: nat('seen').length, validation: nat('validation').length, autres: nat('autre').length };
  res.natures = { ...parNature, autresDetail: trieCles(compte(nat('autre'), x => x.sousNature)) };
  const dist = f => trieCles(compte(cutsListe, c => classe3(f(parCut.get(c)))));
  res.parCut = {
    ecrituresParCutVisite: arrondi(res.entrees.ecrituresDansCutVisite / (nbCuts || 1), 3),
    histoEcritures: dist(l => l.length), histoSeen: dist(l => l.filter(x => x.nature === 'seen').length), histoValidation: dist(l => l.filter(x => x.nature === 'validation').length),
    histoAutres: dist(l => l.filter(x => x.nature === 'autre').length),
    cutsAvecSeen: cutsListe.filter(c => parCut.get(c).some(x => x.nature === 'seen')).length,
    cutsAvecValidation: cutsListe.filter(c => parCut.get(c).some(x => x.nature === 'validation')).length,
    cutsAvecPlusieursSeen: cutsListe.filter(c => parCut.get(c).filter(x => x.nature === 'seen').length > 1).length,
    cutsAvecPlusieursValidations: cutsListe.filter(c => parCut.get(c).filter(x => x.nature === 'validation').length > 1).length,
    validationSansSeenAvant: cutsListe.filter(c => { const l = parCut.get(c), v = l.findIndex(x => x.nature === 'validation'), s = l.findIndex(x => x.nature === 'seen'); return v >= 0 && (s < 0 || s > v); }).length,
  };
  /* Ordre : suite des natures par cut. */
  const sequence = c => parCut.get(c).map(x => LETTRE[x.nature]).join('>') || '(aucune)';
  res.ordre = { sequencesParCut: trieCles(compte(cutsListe, sequence)), enchainements: null, validationsApresEcritureAutreCut: null };
  /* Enchaînements d'écritures consécutives : (nature précédente > nature suivante, même cut ou autre cut), dans une même plage de travail. */
  const enchainements = {};
  let apresAutreCut = 0, validationsAvecPrecedente = 0;
  for (let i = 1; i < w.length; i++) {
    if ((w[i].t - w[i - 1].t) / 1000 > pauseS) continue;
    const m = w[i].cut === null || w[i - 1].cut === null ? '?' : w[i].cut === w[i - 1].cut ? 'même' : 'autre';
    const k = `${LETTRE[w[i - 1].nature]}>${LETTRE[w[i].nature]} ${m}`;
    enchainements[k] = (enchainements[k] || 0) + 1;
    if (w[i].nature === 'validation') { validationsAvecPrecedente++; if (m === 'autre') apresAutreCut++; }
  }
  res.ordre.enchainements = trieCles(enchainements);
  /* Parcours : ordre dans lequel les cuts reçoivent leur première écriture, pas d'un cut au suivant (numéros de ligne). */
  const premiers = [], vus = new Set();
  for (const x of w) if (x.cut !== null && ex.cuts.has(x.cut) && !vus.has(x.cut)) { vus.add(x.cut); premiers.push({ cut: x.cut, t: x.t }); }
  const pas = [];
  for (let i = 1; i < premiers.length; i++) if ((premiers[i].t - premiers[i - 1].t) / 1000 <= pauseS) pas.push(premiers[i].cut - premiers[i - 1].cut);
  res.ordre.parcours = { cutsParOrdreDePremiereEcriture: premiers.length, pas: pas.length, pasAbsolu: stat(pas.map(Math.abs), 0), partCroissants: part(pas.filter(x => x > 0).length, pas.length),
    partPasDeUn: part(pas.filter(x => x === 1).length, pas.length), retoursEnArriere: pas.filter(x => x < 0).length };
  res.ordre.validationsApresEcritureAutreCut = { n: apresAutreCut, sur: validationsAvecPrecedente, part: part(apresAutreCut, validationsAvecPrecedente) };

  /* Champs écrits. */
  const signatures = {};
  for (const n of ['seen', 'validation', 'autre']) signatures[n] = trieCles(compte(nat(n), x => x.champs.join('+') || '(corps absent)'));
  const valeurs = {};
  for (const k of CLES_ENUMEREES) valeurs[k] = trieCles(compte(w.filter(x => x.corps && k in x.corps), x => String(x.corps[k])));
  for (const k of ['RailOrientationLeft', 'RailOrientationRight']) {
    const l = w.filter(x => x.corps && fini(x.corps[k])).map(x => x.corps[k]);
    valeurs[k] = { n: l.length, distinctes: new Set(l).size, parmi: trieCles(compte(l, v => String(v))) };
    if (Object.keys(valeurs[k].parmi).length > 3) valeurs[k].parmi = Object.fromEntries(Object.entries(valeurs[k].parmi).slice(0, 3));
  }
  const chiffres = {};
  for (const k of new Set(w.flatMap(x => x.champs))) {
    const l = w.filter(x => x.corps && typeof x.corps[k] === 'number' && fini(x.corps[k])).map(x => String(Math.abs(x.corps[k])).replace(/e.*$/, '').replace('.', '').replace(/^0+/, '').length);
    if (l.length && k !== 'RailOrientationLeft' && k !== 'RailOrientationRight') chiffres[k] = { n: l.length, med: quantile(trier(l), .5), min: Math.min(...l), max: Math.max(...l) };
  }
  const types = {};
  for (const k of new Set(w.flatMap(x => x.champs))) types[k] = trieCles(compte(w.filter(x => x.corps && k in x.corps), x => x.corps[k] === null ? 'null' : typeof x.corps[k]));
  res.champs = { signatures, valeurs, typesParChamp: types, chiffresSignificatifs: chiffres };

  /* Codes de retour et forme de la requête. */
  const echecs = toutes.filter(x => !(Number.isInteger(x.status) && x.status >= 200 && x.status < 300));
  res.codes = { status: trieCles(compte(toutes, x => String(x.status))), outcome: trieCles(compte(toutes, x => String(x.outcome))), tentative: trieCles(compte(toutes, x => String(x.attempt))),
    methode: trieCles(compte(toutes, x => String(x.method))), classeAdresse: trieCles(compte(toutes, x => String(x.urlClass))), canal: trieCles(compte(toutes, x => String(x.via))),
    echecs: echecs.length, reprises: toutes.filter(x => (x.attempt || 1) > 1).length, dureeRequeteMs: stat(toutes.map(x => x.dureeMs), 1) };

  /* Rythme. */
  const tS = w.map(x => x.t / 1000);
  const intervalles = [];
  for (let i = 1; i < w.length; i++) intervalles.push(tS[i] - tS[i - 1]);
  const vals = w.filter(x => x.nature === 'validation');
  const cycleBrut = [];
  for (let i = 1; i < vals.length; i++) cycleBrut.push((vals[i].t - vals[i - 1].t) / 1000);
  const cycleChrono = cycleBrut.map(x => x <= pauseS ? x : NaN);
  const cycle = cycleBrut.filter(x => x <= pauseS);
  const actifs = intervalles.filter(x => x <= pauseS);
  const dwell = [];
  for (const c of cutsListe) {
    const l = parCut.get(c), s = l.find(x => x.nature === 'seen');
    if (!s) continue;
    const v = l.find(x => x.nature === 'validation' && x.t >= s.t);
    if (v) dwell.push((v.t - s.t) / 1000);
  }
  /* Débit : validations par minute de travail (intervalles sans pause) et plus grand nombre de validations dans une fenêtre glissante de 5 minutes. */
  let pic = 0;
  for (let i = 0, j = 0; i < vals.length; i++) { while (vals[i].t - vals[j].t > 300000) j++; pic = Math.max(pic, i - j + 1); }
  /* Plus longue plage de travail continue : durée entre deux pauses (un cycle de plus de 10 s) ou jusqu'aux bouts de la série. */
  let plage = 0, debutPlage = vals.length ? vals[0].t : 0;
  for (let i = 1; i < vals.length; i++) if ((vals[i].t - vals[i - 1].t) / 1000 > 10) { plage = Math.max(plage, vals[i - 1].t - debutPlage); debutPlage = vals[i].t; }
  if (vals.length) plage = Math.max(plage, vals[vals.length - 1].t - debutPlage);
  const sommeCycle = cycle.reduce((a, b) => a + b, 0);
  const span = w.length > 1 ? (w[w.length - 1].t - w[0].t) / 1000 : 0;
  res.rythme = { pauseS, etendueS: arrondi(span, 1), ecrituresParMinuteActif: actifs.length ? arrondi(60 * (actifs.length + 1) / actifs.reduce((a, b) => a + b, 0), 2) : null,
    intervallesEcritures: stat(actifs), pausesEcritures: { n: intervalles.length - actifs.length, secondesTotal: arrondi(intervalles.filter(x => x > pauseS).reduce((a, b) => a + b, 0), 0), plusLongueS: arrondi(Math.max(0, ...intervalles), 1) },
    validationsParMinuteActive: sommeCycle ? arrondi(60 * cycle.length / sommeCycle, 2) : null, picValidationsEn5Min: pic, plageContinueMax10sMin: arrondi(plage / 60000, 1),
    cycleValidation: stat(cycle), pausesCycle: cycleBrut.length - cycle.length, histoCycleS: histogramme(cycle), regulariteCycle: regularite(cycleChrono),
    cyclePlusCourtQue1s: part(cycle.filter(x => x < 1).length, cycle.length), seenAValidationS: stat(dwell),
    queue: { intervalleEcritureSup5s: { n: intervalles.filter(x => x > 5).length, sur: intervalles.length }, cycleSup10s: { n: cycleBrut.filter(x => x > 10).length, sur: cycleBrut.length },
      cycleSup30s: { n: cycleBrut.filter(x => x > 30).length, sur: cycleBrut.length } } };

  /* Événements ESV par cut ; délai « sélectionné » → écriture seen. */
  const evNoms = compte(ex.evenements, e => e.nom);
  const evCuts = ex.evenements.filter(e => e.cut !== null && ex.cuts.has(e.cut));
  const selParCut = new Map();
  for (const e of ex.evenements) if (e.nom === 'railPairSelected' && e.cut !== null) { if (!selParCut.has(e.cut)) selParCut.set(e.cut, []); selParCut.get(e.cut).push(e.t); }
  const delais = [];
  for (const x of nat('seen')) {
    const l = x.cut !== null && selParCut.get(x.cut); if (!l) continue;
    const avant = l.filter(t => t <= x.recu).pop();
    if (fini(avant) && x.recu - avant <= SELECTION_MAX_MS) delais.push((x.recu - avant) / 1000);
  }
  res.evenementsEsv = { parNom: trieCles(evNoms), parCutVisite: arrondi(evCuts.length / (nbCuts || 1), 3), misesAJourParStatut: trieCles(compte(ex.evenements.filter(e => e.nom === 'railPairUpdated'), e => String(e.statut))),
    selectionneAEcritureSeenS: stat(delais) };

  /* Lectures. */
  const lect = ex.ressources, parCutLect = new Map(cutsListe.map(c => [c, { n: 0, octets: 0 }]));
  for (const r of lect) if (r.cut !== null && parCutLect.has(r.cut)) { const a = parCutLect.get(r.cut); a.n += r.n; a.octets += r.octets; }
  const statutsL = {};
  for (const r of lect) for (const [c, n] of Object.entries(r.statuts)) statutsL[c] = (statutsL[c] || 0) + n;
  const sommeN = lect.reduce((a, r) => a + r.n, 0), sommeO = lect.reduce((a, r) => a + r.octets, 0);
  res.lectures = { fenetres: lect.length, requetes: sommeN, octets: sommeO, parClasse: trieCles(compte(lect, r => r.classe)), statuts: trieCles(statutsL), echecs: lect.reduce((a, r) => a + r.echecs, 0),
    requetesParCutVisite: arrondi([...parCutLect.values()].reduce((a, x) => a + x.n, 0) / (nbCuts || 1), 3), octetsParCutVisiteMo: arrondi([...parCutLect.values()].reduce((a, x) => a + x.octets, 0) / (nbCuts || 1) / 1e6, 3),
    requetesParCut: stat([...parCutLect.values()].map(x => x.n), 1), octetsParCutMo: stat([...parCutLect.values()].map(x => x.octets / 1e6), 2),
    dureeMoyenneMsParRequete: sommeN ? arrondi(lect.reduce((a, r) => a + r.dureeTotMs, 0) / sommeN, 1) : null,
    listPages: ex.listPages, listPagesParValidation: ex.listPages === null ? null : part(ex.listPages, parNature.validation) };

  /* Strates (Écho) : cuts que le lot avait déjà visités (« seen » déjà écrit) et les autres. */
  if (cutsLot) {
    const strate = liste => ({ cuts: liste.length, cutsAvecSeen: liste.filter(c => parCut.get(c).some(x => x.nature === 'seen')).length, seenTotal: liste.reduce((a, c) => a + parCut.get(c).filter(x => x.nature === 'seen').length, 0),
      cutsAvecValidation: liste.filter(c => parCut.get(c).some(x => x.nature === 'validation')).length, validationsTotal: liste.reduce((a, c) => a + parCut.get(c).filter(x => x.nature === 'validation').length, 0),
      cutsAvecPlusieursVisites: liste.filter(c => ex.cuts.get(c) > 1).length });
    const dedans = cutsListe.filter(c => cutsLot.has(c)), dehors = cutsListe.filter(c => !cutsLot.has(c));
    res.strates = { dansLot: strate(dedans), horsLot: strate(dehors) };
    for (const s of Object.values(res.strates)) s.partCutsAvecSeen = part(s.cutsAvecSeen, s.cuts);
  }
  res._tables = { parCut, cycle, dwell, delaisSelection: delais, pas: pas.map(Math.abs), lecturesParCut: [...parCutLect.values()].map(x => x.n) };      // pour la comparaison et l'export, retiré du JSON
  return res;
}

/* ------------------------------------------------------------------ comparaison */
/* Éléments présents d'un côté seulement, dans deux tables de comptes. */
function ecartTable(rubrique, o, e) {
  const seulO = [], seulE = [];
  /* « (aucune) » : cut visité sans aucune écriture (déjà vu et non validé) ; compté dans `cuts.cutsSansEcriture`, ce n'est pas une séquence. */
  const compte = (rubrique !== 'ordre.sequenceParCut') ? () => true : k => k !== '(aucune)';
  for (const k of Object.keys(o || {})) if (compte(k) && !(e && k in e)) seulO.push({ rubrique, valeur: k, n: o[k] });
  for (const k of Object.keys(e || {})) if (compte(k) && !(o && k in o)) seulE.push({ rubrique, valeur: k, n: e[k] });
  return { seulO, seulE };
}
function comparer(o, e, { pauseS = PAUSE_DEFAUT_S, sansRythme = false } = {}) {
  const jamaisHumain = [], jamaisAriane = [];
  const ajout = (rubrique, to, te) => { const r = ecartTable(rubrique, to, te); jamaisHumain.push(...r.seulO); jamaisAriane.push(...r.seulE); };
  ajout('nature.autres', o.natures.autresDetail, e.natures.autresDetail);
  for (const n of ['seen', 'validation', 'autre']) ajout(`champs.${n}`, o.champs.signatures[n], e.champs.signatures[n]);
  for (const k of CLES_ENUMEREES) ajout(`valeur.${k}`, o.champs.valeurs[k], e.champs.valeurs[k]);
  for (const k of ['RailOrientationLeft', 'RailOrientationRight']) ajout(`valeur.${k}`, o.champs.valeurs[k].parmi, e.champs.valeurs[k].parmi);
  for (const k of ['status', 'outcome', 'tentative', 'methode', 'classeAdresse', 'canal']) ajout(`code.${k}`, o.codes[k], e.codes[k]);
  ajout('ordre.sequenceParCut', o.ordre.sequencesParCut, e.ordre.sequencesParCut);
  ajout('ordre.enchainement', o.ordre.enchainements, e.ordre.enchainements);
  ajout('evenement.esv', o.evenementsEsv.parNom, e.evenementsEsv.parNom);
  for (const k of new Set([...Object.keys(o.champs.typesParChamp), ...Object.keys(e.champs.typesParChamp)])) ajout(`type.${k}`, o.champs.typesParChamp[k], e.champs.typesParChamp[k]);
  /* Champs : écart de chiffres significatifs (médiane) sur les champs communs. */
  const ecartChiffres = [];
  for (const k of Object.keys(o.champs.chiffresSignificatifs)) {
    const a = o.champs.chiffresSignificatifs[k], b = e.champs.chiffresSignificatifs[k];
    if (b && a.med !== b.med) ecartChiffres.push({ champ: k, medOrbite: a.med, medEcho: b.med });
  }
  /* Rythme. */
  const ks = kolmogorovSmirnov(o._tables.cycle, e._tables.cycle), ksDwell = kolmogorovSmirnov(o._tables.dwell, e._tables.dwell), ksSel = kolmogorovSmirnov(o._tables.delaisSelection, e._tables.delaisSelection);
  const co = o.rythme.cycleValidation, ce = e.rythme.cycleValidation, ro = o.rythme.regulariteCycle, re = e.rythme.regulariteCycle;
  const triE = trier(e._tables.cycle);
  const p1E = quantile(triE, .01), p5E = quantile(triE, .05), p95E = quantile(triE, .95);
  const sousP1 = p1E === null ? null : part(o._tables.cycle.filter(x => x < p1E).length, o._tables.cycle.length);
  const dansP5P95 = p5E === null ? null : part(o._tables.cycle.filter(x => x >= p5E && x <= p95E).length, o._tables.cycle.length);
  const rythme = { pauseS, cycleOrbite: co, cycleEcho: ce, rapportMedianes: co.n && ce.n && ce.med ? arrondi(co.med / ce.med, 3) : null,
    regulariteOrbite: ro, regulariteEcho: re, rapportCV: ro.cv && re.cv ? arrondi(ro.cv / re.cv, 3) : null, rapportMAD: ro.madSurMediane && re.madSurMediane ? arrondi(ro.madSurMediane / re.madSurMediane, 3) : null,
    kolmogorovSmirnovCycle: ks, kolmogorovSmirnovSeenAValidation: ksDwell, kolmogorovSmirnovSelectionneASeen: ksSel,
    queue: Object.fromEntries(Object.keys(o.rythme.queue).map(k => { const a = o.rythme.queue[k], b = e.rythme.queue[k];
      return [k, { orbite: a, echo: b, partOrbite: part(a.n, a.sur), partEcho: part(b.n, b.sur), fisherP: fisherExact(a.n, a.sur - a.n, b.n, b.sur - b.n) }]; })),
    cyclesOrbiteSousP1Echo: sousP1, cyclesOrbiteDansP5P95Echo: dansP5P95, p1Echo: arrondi(p1E), p5Echo: arrondi(p5E), p95Echo: arrondi(p95E),
    ecrituresParMinuteActif: { orbite: o.rythme.ecrituresParMinuteActif, echo: e.rythme.ecrituresParMinuteActif },
    validationsParMinuteActive: { orbite: o.rythme.validationsParMinuteActive, echo: e.rythme.validationsParMinuteActive }, picValidationsEn5Min: { orbite: o.rythme.picValidationsEn5Min, echo: e.rythme.picValidationsEn5Min },
    plageContinueMax10sMin: { orbite: o.rythme.plageContinueMax10sMin, echo: e.rythme.plageContinueMax10sMin } };
  /* Par cut. */
  const parCut = { ecrituresParCut: { orbite: o.parCut.ecrituresParCutVisite, echo: e.parCut.ecrituresParCutVisite },
    partCutsAvecSeen: { orbite: part(o.parCut.cutsAvecSeen, o.cuts.cutsVisites), echo: part(e.parCut.cutsAvecSeen, e.cuts.cutsVisites), echoDansLot: e.strates ? e.strates.dansLot.partCutsAvecSeen : null, echoHorsLot: e.strates ? e.strates.horsLot.partCutsAvecSeen : null },
    partCutsAvecValidation: { orbite: part(o.parCut.cutsAvecValidation, o.cuts.cutsVisites), echo: part(e.parCut.cutsAvecValidation, e.cuts.cutsVisites) },
    validationsParCutValide: { orbite: part(o.natures.validation, o.parCut.cutsAvecValidation), echo: part(e.natures.validation, e.parCut.cutsAvecValidation) },
    ordreSeenPuisValidation: { orbite: part(o.parCut.cutsAvecValidation - o.parCut.validationSansSeenAvant, o.parCut.cutsAvecValidation), echo: part(e.parCut.cutsAvecValidation - e.parCut.validationSansSeenAvant, e.parCut.cutsAvecValidation) },
    validationApresEcritureAutreCut: { orbite: o.ordre.validationsApresEcritureAutreCut.part, echo: e.ordre.validationsApresEcritureAutreCut.part } };
  const champs = { signaturesCommunes: [], seulementOrbite: jamaisHumain.filter(x => x.rubrique.startsWith('champs.') || x.rubrique.startsWith('valeur.') || x.rubrique.startsWith('type.')),
    seulementEcho: jamaisAriane.filter(x => x.rubrique.startsWith('champs.') || x.rubrique.startsWith('valeur.') || x.rubrique.startsWith('type.')), ecartChiffresSignificatifs: ecartChiffres };
  for (const n of ['seen', 'validation', 'autre']) for (const k of Object.keys(o.champs.signatures[n])) if (k in e.champs.signatures[n]) champs.signaturesCommunes.push({ nature: n, champs: k });

  /* Drapeaux : règles écrites, indicateurs seulement. */
  const drapeaux = [];
  const drapeau = (id, niveau, texte) => drapeaux.push({ id, niveau, texte });
  const nO = jamaisHumain.filter(x => !x.rubrique.startsWith('evenement.')), nE = jamaisAriane.filter(x => !x.rubrique.startsWith('evenement.'));
  drapeau('champs', champs.seulementOrbite.length ? 'trahison-possible' : champs.seulementEcho.length ? 'difference' : 'identique',
    champs.seulementOrbite.length ? `${champs.seulementOrbite.length} champ(s)/valeur(s) écrit(s) par Orbite et jamais par l'Écho` : champs.seulementEcho.length ? `${champs.seulementEcho.length} champ(s)/valeur(s) écrit(s) par l'Écho seulement (geste qu'Ariane ne fait pas)` : 'mêmes champs, mêmes valeurs énumérées, mêmes types');
  const codesO = nO.filter(x => x.rubrique.startsWith('code.')), codesE = nE.filter(x => x.rubrique.startsWith('code.'));
  drapeau('codes', codesO.length ? 'trahison-possible' : codesE.length ? 'difference' : 'identique',
    codesO.length ? `code(s)/forme de requête chez Orbite seulement : ${codesO.map(x => x.rubrique + '=' + x.valeur).join(', ')}` : codesE.length ? `code(s)/forme de requête chez l'Écho seulement : ${codesE.map(x => x.rubrique + '=' + x.valeur).join(', ')} (Orbite n'a eu aucun échec)` : 'mêmes codes de retour, tentatives, méthode, classe d\'adresse');
  const seqO = jamaisHumain.filter(x => x.rubrique === 'ordre.sequenceParCut' || x.rubrique === 'nature.autres'), seqE = jamaisAriane.filter(x => x.rubrique === 'ordre.sequenceParCut' || x.rubrique === 'nature.autres');
  drapeau('natures-et-sequences', seqO.length ? 'trahison-possible' : seqE.length ? 'difference' : 'identique',
    seqO.length ? `séquence(s) par cut chez Orbite seulement : ${seqO.map(x => x.valeur + ' (' + x.n + ')').join(', ')}` : seqE.length ? `séquences/natures chez l'Écho seulement : ${seqE.map(x => x.valeur + ' (' + x.n + ')').join(', ')}` : 'mêmes natures et mêmes séquences par cut');
  const encO = jamaisHumain.filter(x => x.rubrique === 'ordre.enchainement');
  drapeau('enchainements', encO.length ? 'trahison-possible' : 'identique', encO.length ? `enchaînement(s) chez Orbite seulement : ${encO.map(x => x.valeur + ' (' + x.n + ')').join(', ')}` : 'aucun enchaînement d\'écritures propre à Orbite');
  /* Parcours : sens et taille des pas d'un cut au suivant. */
  const po = o.ordre.parcours, pe = e.ordre.parcours;
  const ksPas = kolmogorovSmirnov(o._tables.pas, e._tables.pas);
  drapeau('parcours', po.pas >= 10 && pe.pas >= 10 && ksPas && ksPas.p < 0.01 ? 'difference' : 'identique',
    `pas d'un cut au suivant (médiane ${po.pasAbsolu.med ?? '–'} contre ${pe.pasAbsolu.med ?? '–'}, p90 ${po.pasAbsolu.p90 ?? '–'} contre ${pe.pasAbsolu.p90 ?? '–'}) : croissants ${pct(po.partCroissants)} contre ${pct(pe.partCroissants)}, de un seul cut ${pct(po.partPasDeUn)} contre ${pct(pe.partPasDeUn)}, retours en arrière ${po.retoursEnArriere} contre ${pe.retoursEnArriere}${ksPas ? `, KS D=${ksPas.D} p=${ksPas.p}` : ''}`);
  const lo = o.lectures, le = e.lectures, ksLect = kolmogorovSmirnov(o._tables.lecturesParCut, e._tables.lecturesParCut);
  const rapportLect = lo.requetesParCutVisite && le.requetesParCutVisite ? arrondi(lo.requetesParCutVisite / le.requetesParCutVisite, 3) : null;
  const lectures = { requetesParCutVisite: { orbite: lo.requetesParCutVisite, echo: le.requetesParCutVisite }, octetsParCutVisiteMo: { orbite: lo.octetsParCutVisiteMo, echo: le.octetsParCutVisiteMo },
    requetesParCut: { orbite: lo.requetesParCut, echo: le.requetesParCut }, rapport: rapportLect, kolmogorovSmirnov: ksLect, statutsOrbite: lo.statuts, statutsEcho: le.statuts,
    listPagesParValidation: { orbite: lo.listPagesParValidation, echo: le.listPagesParValidation } };
  drapeau('lectures', ksLect && ksLect.p < 0.01 && rapportLect !== null && (rapportLect > 1.3 || rapportLect < 0.77) ? 'trahison-possible' : 'identique',
    `requêtes de nuages de points par cut visité : ${lo.requetesParCutVisite} contre ${le.requetesParCutVisite} (rapport ${rapportLect ?? '–'}${ksLect ? `, KS D=${ksLect.D} p=${ksLect.p}` : ''}) ; octets par cut : ${lo.octetsParCutVisiteMo} Mo contre ${le.octetsParCutVisiteMo} Mo ; statuts ${Object.keys(lo.statuts).join('/') || '–'} contre ${Object.keys(le.statuts).join('/') || '–'}`);
  const parcours = { orbite: po, echo: pe, kolmogorovSmirnovPas: ksPas };
  if (sansRythme) return { jamaisHumain, jamaisAriane, champs, parCut, parcours, lectures, drapeaux };
  /* Délais internes à un cut : de l'événement « sélectionné » à l'écriture seen, de l'écriture seen à la validation. */
  drapeau('delais-internes', (ksSel && ksSel.p < 0.01) || (ksDwell && ksDwell.p < 0.01) ? 'difference' : 'identique',
    `sélectionné → seen : médiane ${o.evenementsEsv.selectionneAEcritureSeenS.med ?? '–'} s contre ${e.evenementsEsv.selectionneAEcritureSeenS.med ?? '–'} s${ksSel ? ` (KS D=${ksSel.D}, p=${ksSel.p})` : ''} ; seen → validation : médiane ${o.rythme.seenAValidationS.med ?? '–'} s (p90 ${o.rythme.seenAValidationS.p90 ?? '–'}) contre ${e.rythme.seenAValidationS.med ?? '–'} s (p90 ${e.rythme.seenAValidationS.p90 ?? '–'})${ksDwell ? ` (KS D=${ksDwell.D}, p=${ksDwell.p})` : ''}`);
  /* Régularité : le coefficient de variation est tiré par les longues pauses de l'humain ; l'écart absolu médian (MAD) est le
   * critère de la règle. Queue : absence de pauses chez Orbite quand l'humain en fait (test exact de Fisher). */
  const ksP = ks ? ks.p : null, rcv = rythme.rapportMAD;
  const q = rythme.queue.cycleSup10s, qe = rythme.queue.intervalleEcritureSup5s;
  const sansPauses = q.partEcho !== null && q.partOrbite !== null && q.fisherP !== null && q.fisherP < 0.01 && q.partOrbite < q.partEcho;
  const tropRegulier = rcv !== null && rcv < 0.5 && ksP !== null && ksP < 0.01;
  const inhumain = sousP1 !== null && sousP1 >= 0.2;
  drapeau('rythme', tropRegulier || inhumain || sansPauses ? 'trahison-possible' : (ksP !== null && ksP < 0.05) || (rcv !== null && (rcv < 0.5 || rcv > 2)) || (qe.fisherP !== null && qe.fisherP < 0.01) ? 'difference' : 'identique',
    ks ? `cycle médian Orbite ${co.med ?? '–'} s contre Écho ${ce.med ?? '–'} s ; MAD/médiane ${ro.madSurMediane ?? '–'} contre ${re.madSurMediane ?? '–'} (rapport ${rcv ?? '–'}) ; KS D=${ks.D}, p=${ks.p} ; ${sousP1 === null ? '–' : Math.round(sousP1 * 100)} % des cycles d'Orbite sous le 1er centile de l'Écho ; cycles de plus de 10 s : ${pct(q.partOrbite)} contre ${pct(q.partEcho)} (Fisher p=${q.fisherP}) ; écritures espacées de plus de 5 s : ${pct(qe.partOrbite)} contre ${pct(qe.partEcho)} (p=${qe.fisherP}) ; validations par minute de travail ${o.rythme.validationsParMinuteActive ?? '–'} contre ${e.rythme.validationsParMinuteActive ?? '–'}, pic sur 5 min ${o.rythme.picValidationsEn5Min} contre ${e.rythme.picValidationsEn5Min}, plus longue plage sans pause de 10 s ${o.rythme.plageContinueMax10sMin} contre ${e.rythme.plageContinueMax10sMin} min` : 'rythme non comparable (trop peu de validations)');
  return { jamaisHumain, jamaisAriane, champs, rythme, parCut, parcours, lectures, drapeaux };
}

/* ------------------------------------------------------------------ sortie */
const sansTables = m => { const { _tables, ...reste } = m; return reste; };
function enCsv(mesures) {
  const lignes = ['source;cut;visites;seen;validation;autres;sequence;seenAValidationS'];
  for (const m of mesures) {
    for (const [cut, l] of m._tables.parCut) {
      const s = l.find(x => x.nature === 'seen'), v = s && l.find(x => x.nature === 'validation' && x.t >= s.t);
      lignes.push([m.source, cut, m._visites.get(cut) || 0, l.filter(x => x.nature === 'seen').length, l.filter(x => x.nature === 'validation').length, l.filter(x => x.nature === 'autre').length,
        l.map(x => LETTRE[x.nature]).join('>'), v ? arrondi((v.t - s.t) / 1000, 3) : ''].join(';'));
    }
  }
  return lignes.join('\n') + '\n';
}
const pct = v => v === null || v === undefined ? '–' : `${Math.round(v * 1000) / 10} %`;
function texte(res) {
  const L = [];
  for (const m of [res.orbite, res.echo].filter(Boolean)) {
    L.push(`== ${m.source === 'orbite' ? 'Orbite (lot Ariane)' : 'Écho (opérateur)'}`);
    L.push(`  cuts visités ${m.cuts.cutsVisites} (${m.cuts.visites} visites) ; écritures ${m.entrees.ecritures} dont hors cut visité ${m.entrees.ecrituresHorsCutVisite}, sans cut ${m.entrees.ecrituresSansCut} ; origine : ${m.entrees.origineEcritures}`);
    L.push(`  natures : seen ${m.natures.seen}, validation ${m.natures.validation}, autres ${m.natures.autres}${Object.keys(m.natures.autresDetail).length ? ' (' + Object.entries(m.natures.autresDetail).map(([k, v]) => k + ' ' + v).join(', ') + ')' : ''}`);
    L.push(`  par cut visité : ${m.parCut.ecrituresParCutVisite} écritures ; séquences : ${Object.entries(m.ordre.sequencesParCut).slice(0, 6).map(([k, v]) => k + ' ' + v).join(', ')}`);
    L.push(`  codes : ${Object.entries(m.codes.status).map(([k, v]) => k + ' ' + v).join(', ')} ; reprises ${m.codes.reprises} ; durée de requête médiane ${m.codes.dureeRequeteMs.med ?? '–'} ms`);
    L.push(`  cycle de validation : médiane ${m.rythme.cycleValidation.med ?? '–'} s (p5 ${m.rythme.cycleValidation.p5 ?? '–'}, p95 ${m.rythme.cycleValidation.p95 ?? '–'}), n=${m.rythme.cycleValidation.n}, pauses ${m.rythme.pausesCycle} ; CV ${m.rythme.regulariteCycle.cv ?? '–'}, autocorrélation ${m.rythme.regulariteCycle.autocorrelation1 ?? '–'}`);
    if (m.strates) L.push(`  strates : cuts déjà visités par le lot ${m.strates.dansLot.cuts} (seen sur ${pct(m.strates.dansLot.partCutsAvecSeen)}), autres ${m.strates.horsLot.cuts} (seen sur ${pct(m.strates.horsLot.partCutsAvecSeen)})`);
  }
  if (res.echoCutsNeufs) {
    const m = res.echoCutsNeufs;
    L.push('== Écho, cuts neufs seulement (non visités par le lot)');
    L.push(`  cuts ${m.cuts.cutsVisites} ; natures : seen ${m.natures.seen}, validation ${m.natures.validation}, autres ${m.natures.autres} ; séquences : ${Object.entries(m.ordre.sequencesParCut).slice(0, 6).map(([k, v]) => k + ' ' + v).join(', ')}`);
  }
  for (const [titre, c] of [['Comparaison Orbite / Écho (tous cuts)', res.comparaison], ['Comparaison Orbite / Écho (cuts neufs)', res.comparaisonCutsNeufs]]) {
    if (!c) continue;
    L.push('== ' + titre);
    for (const d of c.drapeaux) L.push(`  [${d.niveau}] ${d.id} : ${d.texte}`);
    L.push(`  écritures qu'un humain ne fait jamais (chez Orbite seulement) : ${c.jamaisHumain.length}${c.jamaisHumain.length ? ' — ' + c.jamaisHumain.map(x => `${x.rubrique}=${x.valeur} (${x.n})`).join(' ; ') : ''}`);
    L.push(`  écritures qu'Ariane ne fait jamais (chez l'Écho seulement) : ${c.jamaisAriane.length}${c.jamaisAriane.length ? ' — ' + c.jamaisAriane.map(x => `${x.rubrique}=${x.valeur} (${x.n})`).join(' ; ') : ''}`);
  }
  return L.join('\n');
}

/* ------------------------------------------------------------------ ligne de commande */
const USAGE = 'Usage : node tools/trace-ecritures.cjs --orbite <journal ou dossier…> --echo <dossier ou fichiers…> [--partie N] [--pause-s 120] [--sortie resultat.json] [--csv-cuts table.csv]';
function lireArguments(argv) {
  const a = { orbite: [], echo: [], partie: null, pauseS: PAUSE_DEFAUT_S, sortie: null, csv: null };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--orbite' || k === '--echo') { while (i + 1 < argv.length && !argv[i + 1].startsWith('--')) a[k.slice(2)].push(argv[++i]); }
    else if (k === '--partie') { a.partie = Number(argv[++i]); if (!Number.isInteger(a.partie)) throw Error('--partie attend un entier.'); }
    else if (k === '--pause-s') { a.pauseS = Number(argv[++i]); if (!(a.pauseS > 0)) throw Error('--pause-s attend un nombre de secondes positif.'); }
    else if (k === '--sortie') a.sortie = argv[++i];
    else if (k === '--csv-cuts') a.csv = argv[++i];
    else throw Error(`Argument inconnu : ${k}`);
  }
  if (!a.orbite.length && !a.echo.length) throw Error(USAGE);
  return a;
}
/* L'Écho réduite aux cuts que le lot n'avait pas visités : le lot a déjà écrit « seen » sur les autres, ESV ne le réécrit pas,
 * leurs séquences ne sont donc pas comparables à celles d'Orbite (qui travaille des cuts neufs). */
function restreindre(ex, garder) {
  const cuts = new Map([...ex.cuts].filter(([c]) => garder(c)));
  const dedans = x => x.cut !== null && cuts.has(x.cut);
  return { ...ex, nom: ex.nom + '-cuts-neufs', cuts, nVisites: [...cuts.values()].reduce((a, b) => a + b, 0), ecritures: ex.ecritures.filter(dedans), evenements: ex.evenements.filter(dedans), ressources: ex.ressources.filter(dedans), listPages: null };
}
function analyser({ orbite = null, echo = null }, { partie = null, pauseS = PAUSE_DEFAUT_S } = {}) {
  const exO = orbite && extraire(orbite, { partie }), exE = echo && extraire(echo, { partie });
  const cutsLot = exO ? new Set(exO.cuts.keys()) : null;
  const mO = exO && mesurer(exO, { pauseS }), mE = exE && mesurer(exE, { pauseS, cutsLot });
  const exN = exE && cutsLot ? restreindre(exE, c => !cutsLot.has(c)) : null;
  const mN = exN && mesurer(exN, { pauseS });
  if (mO) mO._visites = exO.cuts;
  if (mE) mE._visites = exE.cuts;
  if (mN) mN._visites = exN.cuts;
  const comparaison = mO && mE ? comparer(mO, mE, { pauseS }) : null;
  const comparaisonCutsNeufs = mO && mN ? comparer(mO, mN, { pauseS, sansRythme: true }) : null;
  return { mO, mE, mN, comparaison, comparaisonCutsNeufs };
}
function executer(argv, sortie = console.log) {
  const a = lireArguments(argv), avis = [];
  const orbite = a.orbite.length ? lireOrbite(a.orbite, { avis: m => avis.push(m) }) : null;
  const echo = a.echo.length ? lireEcho(a.echo, { avis: m => avis.push(m) }) : null;
  const parties = new Set([...(orbite ? orbite.visites : []), ...(echo ? echo.visites : [])].map(v => v.partie));
  if (a.partie === null && parties.size > 1) avis.push(`Plusieurs parties dans les sources (${[...parties].sort((x, y) => x - y).join(', ')}) : les écritures ne portent pas la partie, elles sont rattachées par numéro de ligne. Donne --partie.`);
  const { mO, mE, mN, comparaison, comparaisonCutsNeufs } = analyser({ orbite, echo }, { partie: a.partie, pauseS: a.pauseS });
  const res = { format: 'ariane-trace-ecritures-v1', options: { partie: a.partie, pauseS: a.pauseS }, orbite: mO && sansTables(mO), echo: mE && sansTables(mE), echoCutsNeufs: mN && sansTables(mN), comparaison, comparaisonCutsNeufs };
  for (const k of ['orbite', 'echo', 'echoCutsNeufs']) if (res[k]) delete res[k]._visites;
  if (a.sortie) { fs.mkdirSync(path.dirname(path.resolve(a.sortie)), { recursive: true }); fs.writeFileSync(a.sortie, JSON.stringify(res, null, 1)); }
  if (a.csv) { fs.mkdirSync(path.dirname(path.resolve(a.csv)), { recursive: true }); fs.writeFileSync(a.csv, enCsv([mO, mE, mN].filter(Boolean))); }
  sortie(texte(res) + (avis.length ? '\n' + avis.map(m => `Avis : ${m}`).join('\n') : ''));
  return res;
}
if (require.main === module) {
  try { executer(process.argv.slice(2)); } catch (e) { console.error(e.message); process.exitCode = 1; }
}
module.exports = { PAUSE_DEFAUT_S, fisherExact, natureDe, sousNatureDe, ecritureDe, lireOrbite, lireOrbiteDoc, lireEcho, lireEchoDoc, extraire, mesurer, comparer, analyser, regularite, kolmogorovSmirnov, stat, histogramme, lireArguments, executer, enCsv, texte };
