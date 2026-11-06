#!/usr/bin/env node
'use strict';
/* CH-063 : où part l'attente du chargement d'une capture, au regard du réseau.
 *
 * Pour chaque capture d'un journal (`ariane-journal-v4-*.json`), rail par rail : la sélection (fin de la vue précédente → `capture-wait`),
 * l'attente du niveau de détail (`capture-wait` → `capture-read`), la lecture (`capture-read` → `capture-view-ready`), la règle qui a fermé
 * l'attente (signal ou stabilité) et, pendant la sélection et l'attente, les requêtes de points qu'ESV a émises d'elle-même (événements
 * `esv-observation` de classe `point-resource`, agrégés par fenêtre de 250 ms : nombre, octets, première et dernière heure).
 * On en tire, par rail, le « silence après le dernier octet » : le temps d'attente qui suit la fin de la dernière requête de points.
 * C'est la part de l'attente qui ne doit rien au réseau.
 * Le lot et la relecture sont séparés par les événements `relecture-debut` / `relecture-fin`.
 *
 * Aucune adresse (le journal n'en porte pas), aucune coordonnée, aucun identifiant n'est écrit : des durées et des comptes.
 * Usage : node --max-old-space-size=6000 tools/ch063-attente-reseau.cjs --journal J.json [--journal …] [--sortie A.json] */
const fs = require('fs');
const ms = t => { const v = Date.parse(t); return Number.isFinite(v) ? v : null; };
const tri = a => a.filter(Number.isFinite).sort((x, y) => x - y);
const q = (s, x) => { if (!s.length) return null; const i = (s.length - 1) * x, lo = Math.floor(i), hi = Math.ceil(i); return s[lo] + (s[hi] - s[lo]) * (i - lo); };
const somme = a => a.reduce((x, y) => x + (Number.isFinite(y) ? y : 0), 0);
const r0 = x => x === null || !Number.isFinite(x) ? null : Math.round(x);
function resume(v) { const s = tri(v); return s.length ? { n: s.length, mediane: r0(q(s, .5)), p90: r0(q(s, .9)), moyenne: r0(somme(s) / s.length), somme: r0(somme(s)) } : { n: 0 }; }

/* Les captures : étapes horodatées (heure du service worker), rail par rail. */
function captures(ev) {
  const m = new Map();
  for (const e of ev) {
    if ((e.type !== 'adapter-progress' && e.type !== 'adapter-result') || e.action !== 'capture' || !e.requestId) continue;
    let c = m.get(e.requestId); if (!c) { c = { etapes: [], fin: null, debut: null, erreur: null }; m.set(e.requestId, c); }
    const t = ms(e.timestamp);
    if (e.type === 'adapter-result') { c.fin = t; c.debut = ms(e.demandeA); c.erreur = e.error ?? null; continue; }
    c.etapes.push({ st: e.lastStage, t, d: e.lastDetail || {} });
  }
  const out = [];
  for (const c of m.values()) {
    if (!Number.isFinite(c.fin) || !Number.isFinite(c.debut) || c.erreur) continue;
    c.etapes.sort((a, b) => a.t - b.t);
    const rails = {}; let fin = c.debut;
    for (const x of c.etapes) {
      const s = x.d.side; if (!s) continue;
      const r = rails[s] || (rails[s] = { selDebut: fin, attDebut: null, lecDebut: null, lecFin: null, regle: null, tentatives: 0, diag: null });
      if (x.st === 'capture-wait') { r.tentatives++; if (r.attDebut === null) r.attDebut = x.t; }
      else if (x.st === 'capture-read') { r.lecDebut = x.t; r.regle = r.regle || x.d.regle || null; r.diag = r.diag || x.d.diag || null; r.lecture = x.d.lecture || null; }
      else if (x.st === 'capture-view-ready') { r.lecFin = x.t; fin = x.t; }
    }
    const ok = ['left', 'right'].every(s => rails[s] && [rails[s].attDebut, rails[s].lecDebut, rails[s].lecFin].every(Number.isFinite));
    if (ok) out.push({ debut: c.debut, fin: c.fin, rails });
  }
  return out.sort((a, b) => a.debut - b.debut);
}
/* Fenêtres de requêtes de points, triées. */
function ressources(ev) {
  return ev.filter(e => e.type === 'esv-observation' && e.class === 'point-resource' && Number.isFinite(e.startedEpochMs) && Number.isFinite(e.endedEpochMs))
    .map(e => ({ a: e.startedEpochMs, b: e.endedEpochMs, n: e.n || 0, octets: e.bytes || 0, echecs: e.echecs || 0 })).sort((x, y) => x.a - y.a);
}
/* Requêtes dont la fenêtre recoupe [a, b]. */
function dans(R, a, b) { const out = []; for (const r of R) { if (r.a > b) break; if (r.b >= a) out.push(r); } return out; }
/* Temps « en vol » d'un ensemble de fenêtres dans [a, b] : longueur de l'union des empans [début de la 1re requête, fin de la dernière]
 * de chaque fenêtre de 250 ms, coupés à [a, b]. Borne HAUTE du temps où au moins une requête de points était en vol. */
function enVol(res, a, b) {
  const I = res.map(r => [Math.max(a, r.a), Math.min(b, r.b)]).filter(([x, y]) => y > x).sort((x, y) => x[0] - y[0]);
  let tot = 0, cx = null, cy = null;
  for (const [x, y] of I) { if (cy === null || x > cy) { if (cy !== null) tot += cy - cx; cx = x; cy = y; } else cy = Math.max(cy, y); }
  if (cy !== null) tot += cy - cx;
  return tot;
}
function plagesRelecture(ev) {
  const P = []; let d = null;
  for (const e of ev.filter(x => x.type === 'relecture-debut' || x.type === 'relecture-fin').sort((x, y) => ms(x.timestamp) - ms(y.timestamp))) {
    if (e.type === 'relecture-debut') d = ms(e.timestamp); else if (d !== null) { P.push([d, ms(e.timestamp)]); d = null; }
  }
  if (d !== null) P.push([d, Infinity]);
  return P;
}
function analyser(j) {
  const ev = Array.isArray(j.events) ? j.events : [], C = captures(ev), R = ressources(ev), PR = plagesRelecture(ev);
  const lignes = [];
  for (let i = 0; i < C.length; i++) {
    const c = C[i], relecture = PR.some(([a, b]) => c.debut >= a && c.debut <= b);
    const suivant = C[i + 1] ? C[i + 1].debut - c.debut : null;
    const l = { relecture, captureMs: c.fin - c.debut, cutMs: suivant !== null && suivant <= 60000 ? suivant : null, rails: {} };
    for (const s of ['left', 'right']) {
      const r = c.rails[s], res = dans(R, r.selDebut, r.lecDebut), dernier = res.length ? Math.max(...res.map(x => x.b)) : null;
      l.rails[s] = { selectionMs: r.attDebut - r.selDebut, attenteMs: r.lecDebut - r.attDebut, lectureMs: r.lecFin - r.lecDebut, regle: r.regle, lecture: r.lecture,
        requetes: somme(res.map(x => x.n)), octets: somme(res.map(x => x.octets)), echecs: somme(res.map(x => x.echecs)),
        /* fin de la dernière requête de points, comptée depuis le début de l'attente (négatif : finie pendant la sélection) ; null : aucune */
        reseauFiniMs: dernier !== null ? dernier - r.attDebut : null,
        enVolMs: enVol(dans(R, r.attDebut, r.lecDebut), r.attDebut, r.lecDebut),
        silenceApresReseauMs: dernier !== null ? r.lecDebut - Math.max(dernier, r.attDebut) : r.lecDebut - r.attDebut,
        derniereModifNoeudsMs: Number.isFinite(r.diag?.tc) ? r.diag.tc : null };
    }
    lignes.push(l);
  }
  return lignes;
}
function agreger(lignes) {
  const out = {};
  for (const [nom, f] of [['lot', l => !l.relecture], ['relecture', l => l.relecture]]) {
    const L = lignes.filter(f), rails = L.flatMap(l => Object.values(l.rails));
    const parRegle = {};
    for (const g of ['signal', 'stabilite']) {
      const X = rails.filter(r => r.regle === g);
      parRegle[g] = { rails: X.length, attenteMs: resume(X.map(r => r.attenteMs)), silenceApresReseauMs: resume(X.map(r => r.silenceApresReseauMs)),
        sansRequete: X.filter(r => r.requetes === 0).length, requetes: resume(X.map(r => r.requetes)), derniereModifNoeudsMs: resume(X.map(r => r.derniereModifNoeudsMs)) };
    }
    const capt = somme(L.map(l => l.captureMs)), att = somme(rails.map(r => r.attenteMs)), sel = somme(rails.map(r => r.selectionMs)), lec = somme(rails.map(r => r.lectureMs));
    const sil = somme(rails.map(r => Math.max(0, r.silenceApresReseauMs))), vol = somme(rails.map(r => r.enVolMs));
    const cuts = L.filter(l => l.cutMs !== null);
    out[nom] = { captures: L.length, captureMs: resume(L.map(l => l.captureMs)), cutMs: resume(cuts.map(l => l.cutMs)),
      partCaptureDansCut: cuts.length ? Math.round(1000 * somme(cuts.map(l => l.captureMs)) / somme(cuts.map(l => l.cutMs))) / 10 : null,
      partsDeLaCapture: capt ? { selection: Math.round(1000 * sel / capt) / 10, attente: Math.round(1000 * att / capt) / 10, lecture: Math.round(1000 * lec / capt) / 10 } : null,
      partDeLAttenteSansReseau: att ? Math.round(1000 * sil / att) / 10 : null,
      partDeLAttenteEnVol: att ? Math.round(1000 * vol / att) / 10 : null, enVolSommeS: r0(vol / 1000),
      attenteSommeS: r0(att / 1000), silenceSommeS: r0(sil / 1000), captureSommeS: r0(capt / 1000), parRegle,
      echecsReseau: somme(rails.map(r => r.echecs)) };
  }
  return out;
}
module.exports = { captures, ressources, dans, enVol, analyser, agreger, plagesRelecture };
if (require.main === module) {
  const v = process.argv.slice(2), J = [], o = {}; for (let i = 0; i < v.length; i++) { if (v[i] === '--journal') J.push(v[++i]); else if (v[i] === '--sortie') o.sortie = v[++i]; else throw Error('argument inconnu : ' + v[i]); }
  const res = {};
  for (const f of J) { let j = JSON.parse(fs.readFileSync(f, 'utf8')); const lignes = analyser(j); j = null; res[f.split('/').slice(-2).join('/')] = { ...agreger(lignes), _lignes: lignes }; }
  const tout = agreger(Object.values(res).flatMap(x => x._lignes));
  const sans = Object.fromEntries(Object.entries(res).map(([k, x]) => { const { _lignes, ...y } = x; return [k, y]; }));
  const sortie = { format: 'ariane-ch063-attente-reseau-v1', journaux: J.length, total: tout, parJournal: sans };
  if (o.sortie) fs.writeFileSync(o.sortie, JSON.stringify(sortie, null, 1) + '\n');
  process.stdout.write(JSON.stringify(tout, null, 1) + '\n');
}
