#!/usr/bin/env node
'use strict';
/*
 * precision-poses.cjs — précision des poses de la GCV2 (CH-009). Lecture seule.
 *
 *   node tools/precision-poses.cjs --donnees <dossier> [--sortie precision.json] [--detail detail.json]
 *        [--graine N] [--reglage PARTIE] [--examen PARTIE]
 *
 * Le dossier est celui des collectes, ou la racine de banane-data (sous-dossier collections/).
 * Aucun chemin n'est écrit ici. La sortie publique n'a ni numéro de cut, ni coordonnée, ni identifiant :
 * des comptes et des millimètres. `--detail` écrit, à part, la liste par cut (pour banane-data).
 *
 * Définitions (v6, lots 4.9.5.21 à 4.9.5.23) :
 *   - Pose du lot : dernière décision gcv1-shadow-observed du lot (avant la passe et avant la relecture)
 *     dont la commande est action « lot », reason « gcv2-l1 », l1s « gcv2 », et dont la pose est vérifiée
 *     (applied-verified) ou validée avant cette borne. La pose mesurée est celle de l'applied-verified,
 *     pas un record réécrit ensuite.
 *   - Écart : plus grand des deux rails, en 3D, entre cette pose et la dernière validation de l'Écho
 *     (tools/jointure-echo-orbite.cjs, base auto, repère calibré sur la pose du lot). Une visite sans
 *     validation n'est pas comptée 0 mm.
 *   - Passe en ombre : événement passe-differes-ombre, passe 1, décision « poserait ». L'écart est celui
 *     du décalage journalisé à la pose finale (même jointure). Tableau séparé, jamais additionné au lot.
 *   - Zone grise : part des écarts à ±1,5 mm de 5 mm ou de 10 mm (bruit de référence, borne latérale).
 *     Les autres seuils (2, 20, 50) sont donnés à part.
 *   - Intervalles à 95 % : Wilson pour les parts, bootstrap par cut (2 000 tirages, graine fixe) pour la médiane.
 *   - Réglage ou examen : seulement si l'argument le dit. L'outil ne classe pas une partie tout seul.
 */
const fs = require('node:fs'), path = require('node:path');
const J = require('./jointure-echo-orbite.cjs');
const Voie = require('../src/voie-recentree.js');
const Export = require('../src/native-export.js');
const Lots = require('./exports-lots.cjs');

const VERSIONS = new Set(['4.9.5.21', '4.9.5.22', '4.9.5.23', '4.9.5.24', '4.9.5.25', '4.9.5.26', '4.9.5.27', '4.9.5.28', '4.9.5.29']);
const SEUILS = [2, 5, 10, 20, 50];
const ZONE_MM = 1.5;
const REPLIQUES = 2000;
const GRAINE = 20261028;
const FORMAT = 'ariane-precision-poses-v1';

const fini = v => Number.isFinite(v);
const arr = (v, d = 2) => fini(v) ? Math.round(v * 10 ** d) / 10 ** d : null;
const mm3 = v => fini(v) ? Math.round(v * 1000) / 1000 : null;

function quantile(valeurs, p) {
  const v = valeurs.filter(fini).sort((a, b) => a - b);
  if (!v.length) return null;
  const at = (v.length - 1) * p, lo = Math.floor(at), hi = Math.ceil(at);
  return v[lo] + (v[hi] - v[lo]) * (at - lo);
}
function aleatoire(graine) {
  let s = (graine >>> 0) || 1;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function wilson(k, n) {
  if (!n) return { n: 0, k: 0, part: null, bas: null, haut: null };
  const z = 1.96, p = k / n, d = 1 + z * z / n, c = p + z * z / (2 * n);
  const m = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n));
  return { n, k, part: arr(p, 4), bas: arr(Math.max(0, (c - m) / d), 4), haut: arr(Math.min(1, (c + m) / d), 4) };
}
function icMediane(valeurs, graine, repliques) {
  if (valeurs.length < 2) return [null, null];
  const alea = aleatoire(graine), tirages = [];
  for (let b = 0; b < repliques; b++) {
    const tirage = [];
    for (let i = 0; i < valeurs.length; i++) tirage.push(valeurs[Math.floor(alea() * valeurs.length)]);
    tirages.push(quantile(tirage, .5));
  }
  tirages.sort((a, b) => a - b);
  return [arr(quantile(tirages, .025)), arr(quantile(tirages, .975))];
}
function dansZone(x, seuil, zoneMm) { return Math.abs(x - seuil) <= zoneMm + 1e-9; }

/* Compte une liste d'écarts en millimètres. Chiffres publics : aucun cut. */
function compter(valeurs, options = {}) {
  const zoneMm = options.zoneMm || ZONE_MM, graine = options.graine || GRAINE, repliques = options.repliques || REPLIQUES;
  const v = valeurs.filter(fini).map(mm3).filter(fini);
  const n = v.length;
  const part = (pred) => wilson(v.filter(pred).length, n);
  const zoneParSeuil = {};
  for (const s of SEUILS) zoneParSeuil[s] = part(x => dansZone(x, s, zoneMm));
  return {
    n, medianeMm: arr(quantile(v, .5)), icMediane: icMediane(v, graine, repliques), maxMm: n ? arr(Math.max(...v), 3) : null,
    auPlus2mm: part(x => x <= 2), auPlus5mm: part(x => x <= 5), auPlus10mm: part(x => x <= 10),
    plusDe20mm: part(x => x > 20), plusDe50mm: part(x => x > 50),
    zoneGrise: part(x => dansZone(x, 5, zoneMm) || dansZone(x, 10, zoneMm)), zoneParSeuil,
  };
}

function partieDe(chemin) {
  const segs = chemin.split(path.sep);
  for (let i = segs.length - 1; i >= 0; i--) {
    const m = segs[i].match(/partie(?!s)[- ]?(\d+)/i);
    if (m) return Number(m[1]);
  }
  return null;
}
function versionDe(chemin) {
  const m = chemin.match(/v(4\.9\.5\.2[123])(?!\d)/);
  return m ? m[1] : null;
}
function feuilles(racine) {
  const out = [];
  const walk = (dir) => {
    let ents;
    try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    const fichiers = ents.filter(e => e.isFile());
    if (fichiers.some(e => /\.zip$/i.test(e.name) || /^ariane-.*\.json(\.gz)?$/i.test(e.name))) out.push(dir);
    for (const e of ents) if (e.isDirectory()) walk(path.join(dir, e.name));
  };
  walk(racine);
  return out;
}
function racineCollections(p) {
  const c = path.join(p, 'collections');
  return fs.existsSync(c) && fs.statSync(c).isDirectory() ? c : p;
}
/* Associe, par numéro de partie, le dossier du lot et les dossiers Écho des versions 21 à 23. */
function decouvrir(racine) {
  const cols = racineCollections(racine);
  const lots = new Map(), echos = new Map();
  for (const dir of feuilles(cols)) {
    const version = versionDe(dir);
    if (!VERSIONS.has(version)) continue;
    const partie = partieDe(dir);
    if (partie === null) continue;
    const echo = /echo/i.test(dir);
    const map = echo ? echos : lots;
    if (!map.has(partie)) map.set(partie, []);
    map.get(partie).push({ dir, version, collection: path.relative(cols, dir).split(path.sep)[0] });
  }
  const parties = new Set([...lots.keys(), ...echos.keys()]);
  const out = [];
  for (const partie of parties) {
    const ls = lots.get(partie) || [];
    if (!ls.length) continue;
    ls.sort((a, b) => a.dir.length - b.dir.length);
    const lot = ls[0];
    const es = (echos.get(partie) || []).sort((a, b) => a.dir.localeCompare(b.dir));
    out.push({
      partie, version: lot.version, versionEcho: es.length ? es[0].version : null, reglage: 'inconnu',
      lotDir: lot.dir, echoDirs: es.map(e => e.dir),
      collection: lot.collection, collectionEcho: es.length ? es[0].collection : null,
    });
  }
  return out.sort((a, b) => a.version.localeCompare(b.version) || a.partie - b.partie);
}

function deplier(brut) {
  let doc = JSON.parse(Buffer.isBuffer(brut) ? brut.toString('utf8') : brut);
  if (doc && doc.dictionaries) doc = Export.unfoldRefs(doc, doc.dictionaries);
  if (!doc || !Array.isArray(doc.events)) throw Error('journal sans liste events');
  return doc;
}
function lireJournalDir(dir) {
  const docs = [];
  for (const a of Lots.archives(dir)) {
    if (a.type === '7z') continue;
    let es;
    try { es = Lots.entreesArchive(a); } catch { continue; }
    for (const e of es) if (Lots.MOTIF_JOURNAL.test(e.nom)) docs.push(deplier(e.lire()));
  }
  if (!docs.length) {
    const noms = fs.readdirSync(dir).filter(n => /^ariane-journal-v4-.*\.json$/i.test(n)).sort();
    for (const n of noms) docs.push(deplier(fs.readFileSync(path.join(dir, n))));
  }
  if (!docs.length) throw Error('aucun journal dans ' + path.basename(dir));
  docs.sort((a, b) => b.events.length - a.events.length);
  return docs[0];
}
function lireEcho(dirs) {
  const liste = (Array.isArray(dirs) ? dirs : [dirs]).filter(Boolean);
  if (!liste.length) return null;
  return J.lireEcho(liste);
}

const instant = e => { const t = Date.parse(e && e.timestamp || ''); return fini(t) ? t : null; };
const identiteUtile = id => id ? { part: id.part, cut: id.cut, pageId: id.pageId || null, frameId: id.frameId || id.sceneFrameId || null } : null;
function distPoseMm(railsA, railsB) {
  if (!railsA || !railsB) return null;
  let m = null;
  for (const cote of ['left', 'right']) {
    const a = railsA[cote] && railsA[cote].positionSceneRelative;
    const brut = railsB[cote];
    const b = brut && (brut.corrected || brut).positionSceneRelative;
    if (!a || !b) return null;
    const d = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) * 1000;
    m = m === null ? d : Math.max(m, d);
  }
  return m;
}

/* Isole les poses GCV2 du lot et les « poserait » de la passe 1, et substitue la pose vérifiée au record. */
/* Bornes de fin de lot (passe, relecture), dans l'ordre du temps. Dans un journal cumulé, la passe
 * d'une partie précédente est antérieure aux décisions de la suivante : la borne d'un cut est la
 * première de ces bornes STRICTEMENT après sa décision, pas la première du journal. */
function bornesFin(doc) {
  const t = [];
  for (const e of doc.events) if (e.type === 'passe-differes-ombre' || e.type === 'relecture-debut' || e.type === 'relecture-ombre') {
    const x = instant(e); if (x !== null) t.push(x);
  }
  return t.sort((a, b) => a - b);
}
const apres = (bornes, t0) => { for (const t of bornes) if (t > t0) return t; return Infinity; };

function preparer(doc, partie) {
  const bornes = bornesFin(doc);
  const decisions = new Map(), verifies = new Map(), acceptes = new Set();
  for (const e of doc.events) {
    if (e.type !== 'gcv1-shadow-observed' || !e.identity || e.identity.part !== partie) continue;
    const cmd = e.lotObservation && e.lotObservation.command || {};
    if (cmd.action === 'lot' && cmd.reason === 'gcv2-l1' && cmd.l1s === 'gcv2') decisions.set(e.identity.cut, e);
  }
  for (const e of doc.events) {
    if (!e.identity || e.identity.part !== partie || !decisions.has(e.identity.cut)) continue;
    const t0 = instant(decisions.get(e.identity.cut));
    const t = instant(e);
    if (t0 !== null && t !== null && (t < t0 - 2000 || t >= apres(bornes, t0))) continue;
    if (e.type === 'applied-verified') verifies.set(e.identity.cut, e);
    else if (e.type === 'validation-accepted') acceptes.add(e.identity.cut);
  }
  const records = new Map();
  for (const r of doc.records || []) {
    if (!r.identity || r.identity.part !== partie) continue;
    const prev = records.get(r.identity.cut);
    if (!prev || String(r.capturedAt || '') >= String(prev.capturedAt || '')) records.set(r.identity.cut, r);
  }
  const poses = new Map();
  let decideeNonVerifiee = 0, recordDifferent = 0, ecartRecordMaxMm = null;
  for (const [cut, dec] of decisions) {
    const av = verifies.get(cut);
    const rec = records.get(cut);
    if (!av && !acceptes.has(cut)) { decideeNonVerifiee++; continue; }
    const railsLot = av && av.observed && av.observed.rails && av.observed.rails.left && av.observed.rails.right ? av.observed.rails : null;
    const ecart = railsLot && rec ? distPoseMm(railsLot, rec.rails) : null;
    if (ecart !== null && ecart > 0.5) recordDifferent++;
    if (ecart !== null) ecartRecordMaxMm = ecartRecordMaxMm === null ? ecart : Math.max(ecartRecordMaxMm, ecart);
    poses.set(cut, { id: dec.identity, railsLot, rec });
  }
  const remplaces = new Map();
  for (const [cut, info] of poses) {
    if (!info.railsLot) continue;
    const base = info.rec;
    const rails = {};
    for (const cote of ['left', 'right']) {
      const ancien = base && base.rails && base.rails[cote] || {};
      rails[cote] = { ...ancien, corrected: info.railsLot[cote], initial: ancien.initial || info.railsLot[cote] };
    }
    remplaces.set(cut, {
      recordId: base && base.recordId || `lot-${partie}-${cut}`,
      identity: identiteUtile((base && base.identity) || info.id),
      capturedAt: '9999-01-01T00:00:00.000Z', rails,
    });
  }
  const gardes = [], vus = new Set();
  for (const r of doc.records || []) {
    if (r.identity && r.identity.part === partie && remplaces.has(r.identity.cut)) {
      if (!vus.has(r.identity.cut)) { gardes.push(remplaces.get(r.identity.cut)); vus.add(r.identity.cut); }
      continue;
    }
    gardes.push(r);
  }
  for (const [cut, r] of remplaces) if (!vus.has(cut)) gardes.push(r);
  const ombres = new Map();
  for (const e of doc.events) {
    if (e.type !== 'passe-differes-ombre' || e.passe !== 1 || !e.identity || e.identity.part !== partie) continue;
    ombres.set(e.identity.cut, e);
  }
  const poserait = [];
  for (const e of ombres.values()) {
    const d = e.decal;
    if (e.decision !== 'poserait' || !d || !Array.isArray(d.left) || !Array.isArray(d.right)) continue;
    poserait.push({ cut: e.identity.cut, decal: { left: d.left.slice(0, 3), right: d.right.slice(0, 3) } });
  }
  return {
    journal: { events: doc.events, records: gardes, format: doc.format || null, version: doc.version || null },
    poses, poserait, decideeNonVerifiee, recordDifferent, ecartRecordMaxMm: arr(ecartRecordMaxMm, 3),
  };
}

function etatLot(ligne) {
  if (!ligne || !ligne.dansEcho) return { etat: 'sans-echo' };
  if (ligne.referenceHumaine !== 'observee' || ligne.regleVisiteBon) return { etat: 'sans-pose-finale' };
  if (typeof ligne.base !== 'string' || !ligne.base.startsWith('ariane')) return { etat: 'repere' };
  const d = ligne.ecartHumain && ligne.ecartHumain.maxDist3dMm;
  if (!fini(d)) return { etat: 'sans-mesure' };
  return { etat: 'juge', mm: d };
}
function etatOmbre(ligne, decal) {
  if (!ligne || !ligne.dansEcho) return { etat: 'sans-echo' };
  if (ligne.referenceHumaine !== 'observee' || ligne.regleVisiteBon) return { etat: 'sans-pose-finale' };
  const mic = J.micDepuisDepart(ligne);
  const mm = Voie.ecartPose(decal, mic);
  if (!fini(mm)) return { etat: 'sans-mesure' };
  return { etat: 'juge', mm };
}
function indexLignes(journal, echo, partie) {
  if (!echo) return new Map();
  const { table } = J.joindre(echo.records, journal, {
    partie, base: 'auto', poses: false, sessions: echo.sessions || [],
    pagesPerdues: echo.pagesPerdues || [], capturesParVisite: echo.capturesParVisite || {},
    evenementsEcho: echo.evenements || [],
  });
  const m = new Map();
  for (const l of table) if (l.partie === partie) m.set(l.cut, l);
  return m;
}

function blocVide(mm) {
  return compter(mm);
}
function juger(entrees, options = {}) {
  const graine = options.graine || GRAINE;
  const parties = [];
  const detail = [];
  for (const e of entrees) {
    const prep = preparer(e.journal, e.partie);
    const lignes = indexLignes(prep.journal, e.echo, e.partie);
    const pop = { posesLot: prep.poses.size, juges: 0, sansEcho: 0, sansPoseFinale: 0, repereNonCalibre: 0, sansMesure: 0,
      decideeNonVerifiee: prep.decideeNonVerifiee, recordDifferent: prep.recordDifferent, ecartRecordMaxMm: prep.ecartRecordMaxMm };
    const mm = [];
    for (const [cut, info] of prep.poses) {
      const et = etatLot(lignes.get(cut));
      if (et.etat === 'juge') { pop.juges++; mm.push(et.mm); }
      else if (et.etat === 'sans-echo') pop.sansEcho++;
      else if (et.etat === 'sans-pose-finale') pop.sansPoseFinale++;
      else if (et.etat === 'repere') pop.repereNonCalibre++;
      else pop.sansMesure++;
      if (options.detail) detail.push({ population: 'lot', partie: e.partie, version: e.version, cut, etat: et.etat, ecartMm: et.mm == null ? null : arr(et.mm, 3) });
    }
    const ombrePop = { poserait: prep.poserait.length, juges: 0, sansEcho: 0, sansPoseFinale: 0, sansMesure: 0 };
    const mmO = [];
    for (const o of prep.poserait) {
      const et = etatOmbre(lignes.get(o.cut), o.decal);
      if (et.etat === 'juge') { ombrePop.juges++; mmO.push(et.mm); }
      else if (et.etat === 'sans-echo') ombrePop.sansEcho++;
      else if (et.etat === 'sans-pose-finale') ombrePop.sansPoseFinale++;
      else ombrePop.sansMesure++;
      if (options.detail) detail.push({ population: 'ombre', partie: e.partie, version: e.version, cut: o.cut, etat: et.etat, ecartMm: et.mm == null ? null : arr(et.mm, 3) });
    }
    parties.push({
      partie: e.partie, version: e.version, versionEcho: e.versionEcho || null, versionJournal: prep.journal.version || null,
      reglage: e.reglage || 'inconnu', collection: e.collection || null, collectionEcho: e.collectionEcho || null,
      population: pop, precision: compter(mm, { graine }),
      ombre: { poserait: prep.poserait.length, population: ombrePop, precision: compter(mmO, { graine: graine + 1 }) },
      _mm: mm, _mmO: mmO,
    });
  }
  const total = (role) => {
    const ps = parties.filter(p => p.reglage === role);
    const somme = (cle) => ps.reduce((a, p) => a + (p.population[cle] || 0), 0);
    const sommeO = (cle) => ps.reduce((a, p) => a + ((p.ombre.population[cle]) || 0), 0);
    return {
      parties: ps.map(p => p.partie), versions: [...new Set(ps.map(p => p.version))],
      population: { posesLot: somme('posesLot'), juges: somme('juges'), sansEcho: somme('sansEcho'), sansPoseFinale: somme('sansPoseFinale'),
        repereNonCalibre: somme('repereNonCalibre'), sansMesure: somme('sansMesure'), recordDifferent: somme('recordDifferent') },
      precision: compter(ps.flatMap(p => p._mm), { graine }),
      ombre: {
        poserait: ps.reduce((a, p) => a + p.ombre.poserait, 0),
        population: { poserait: ps.reduce((a, p) => a + p.ombre.poserait, 0), juges: sommeO('juges'), sansEcho: sommeO('sansEcho'), sansPoseFinale: sommeO('sansPoseFinale') },
        precision: compter(ps.flatMap(p => p._mmO), { graine: graine + 1 }),
      },
    };
  };
  const pub = (p) => { const { _mm, _mmO, ...reste } = p; return reste; };
  const resultat = {
    format: FORMAT, zoneGriseMm: ZONE_MM, seuilsMm: SEUILS, graine,
    definition: 'Pose GCV2 du lot (commande gcv2-l1 vérifiée) contre la dernière validation Écho, pire rail 3D. Passe en ombre séparée. Zone grise : ±1,5 mm de 5 ou 10 mm.',
    parties: parties.map(pub),
    totaux: { reglage: total('reglage'), examen: total('examen'), inconnu: total('inconnu') },
  };
  if (options.detail) resultat.detail = detail;
  return resultat;
}

const f1 = v => v === null || v === undefined ? '—' : String(arr(v, 1)).replace('.', ',');
const fmm = v => v === null || v === undefined ? '—' : String(v).replace('.', ',');
function lignePart(nom, w) {
  if (!w || !w.n) return `${nom} : —`;
  const pct = (x) => x === null ? '—' : (arr(x * 100, 1).toFixed(1).replace('.', ','));
  return `${nom} : ${w.k}/${w.n} (${pct(w.part)} %, ${pct(w.bas)} à ${pct(w.haut)})`;
}
function blocTexte(titre, precision, population) {
  const L = [`${titre} — jugés ${precision.n}` + (population && population.posesLot != null ? ` sur ${population.posesLot} posés` : '')];
  if (!precision.n) { L.push('  aucun écart mesuré'); return L; }
  const ic = precision.icMediane || [null, null];
  L.push(`  médiane ${fmm(precision.medianeMm)} mm [${fmm(ic[0])} ; ${fmm(ic[1])}], max ${fmm(precision.maxMm)} mm`);
  L.push('  ' + lignePart('≤ 2 mm', precision.auPlus2mm));
  L.push('  ' + lignePart('≤ 5 mm', precision.auPlus5mm));
  L.push('  ' + lignePart('≤ 10 mm', precision.auPlus10mm));
  L.push('  ' + lignePart('> 20 mm', precision.plusDe20mm));
  L.push('  ' + lignePart('> 50 mm', precision.plusDe50mm));
  L.push('  ' + lignePart('zone grise ±1,5 mm de 5 ou 10', precision.zoneGrise));
  return L;
}
function texte(r) {
  const L = ['Précision des poses GCV2, base v6. Écart = pire rail, 3D, contre la dernière validation de l\'Écho.'];
  L.push('Une visite sans validation n\'est pas un écart de 0. La passe en ombre est à part. Un rôle « inconnu » n\'est ni réglage ni examen.');
  const role = { reglage: 'réglage', examen: 'examen', inconnu: 'rôle non établi' };
  for (const p of r.parties) {
    const pop = p.population;
    L.push('', `Partie ${p.partie} · ${p.version} · ${role[p.reglage] || p.reglage}` + (p.collection ? ` · ${p.collection}` : ''));
    L.push(`  posés ${pop.posesLot}, jugés ${pop.juges}, sans Écho ${pop.sansEcho}, sans pose finale ${pop.sansPoseFinale}, repère non calibré ${pop.repereNonCalibre}`
      + (pop.recordDifferent ? `, record différent de la pose du lot ${pop.recordDifferent} (max ${f1(pop.ecartRecordMaxMm)} mm)` : ''));
    L.push(...blocTexte('  Lot', p.precision).map(x => x.replace(/^  /, '  ')));
    L.push(`  Ombre : ${p.ombre.poserait} poserait, jugés ${p.ombre.precision.n}, sans Écho ${p.ombre.population.sansEcho}, sans pose finale ${p.ombre.population.sansPoseFinale}`);
    if (p.ombre.precision.n) L.push(...blocTexte('  Ombre', p.ombre.precision).slice(1));
  }
  L.push('', 'Totaux (un rôle n\'est pas mélangé à l\'autre)');
  for (const [cle, lib] of [['reglage', 'réglage'], ['examen', 'examen'], ['inconnu', 'rôle non établi']]) {
    const t = r.totaux[cle];
    if (!t || !t.parties.length) continue;
    L.push(...blocTexte(`${lib} · parties ${t.parties.join(', ')}`, t.precision, t.population));
    if (t.ombre.precision.n) L.push(...blocTexte(`${lib}, passe en ombre`, t.ombre.precision, { posesLot: t.ombre.poserait }));
  }
  return L.join('\n');
}

const USAGE = 'Usage : node tools/precision-poses.cjs --donnees <dossier> [--sortie fichier.json] [--detail fichier.json] [--graine N] [--reglage PARTIE] [--examen PARTIE]';
function lireArguments(argv) {
  const a = { donnees: null, sortie: null, detail: null, graine: GRAINE, reglage: new Set(), examen: new Set() };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--donnees') a.donnees = argv[++i];
    else if (k === '--sortie') a.sortie = argv[++i];
    else if (k === '--detail') a.detail = argv[++i];
    else if (k === '--graine') a.graine = Number(argv[++i]);
    else if (k === '--reglage') a.reglage.add(Number(argv[++i]));
    else if (k === '--examen') a.examen.add(Number(argv[++i]));
    else throw Error(`Argument inconnu : ${k}. ${USAGE}`);
  }
  if (!a.donnees) throw Error(USAGE.replace('Usage : ', '--donnees manquant. Usage : '));
  if (!Number.isInteger(a.graine)) throw Error('--graine attend un entier');
  return a;
}
function executer(argv, sortie = console.log) {
  const a = lireArguments(argv);
  const sources = decouvrir(a.donnees);
  const entrees = [];
  for (const s of sources) {
    process.stderr.write(`partie ${s.partie} ${s.version}\n`);
    const reglage = a.reglage.has(s.partie) ? 'reglage' : a.examen.has(s.partie) ? 'examen' : 'inconnu';
    const journal = lireJournalDir(s.lotDir);
    const echo = s.echoDirs.length ? lireEcho(s.echoDirs) : null;
    entrees.push({ ...s, reglage, journal, echo });
  }
  const r = juger(entrees, { graine: a.graine, detail: !!a.detail });
  const ecrire = (fichier, obj) => {
    const abs = path.resolve(fichier);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, JSON.stringify(obj, null, 1));
  };
  if (a.sortie) { const { detail, ...pub } = r; ecrire(a.sortie, pub); }
  if (a.detail) ecrire(a.detail, r.detail || []);
  sortie(texte(r));
  return r;
}
if (require.main === module) {
  try { executer(process.argv.slice(2)); }
  catch (e) { console.error(e.message); process.exitCode = 1; }
}
module.exports = { compter, decouvrir, juger, lireEcho, lireJournalDir, lireArguments, executer, texte, FORMAT, ZONE_MM };
