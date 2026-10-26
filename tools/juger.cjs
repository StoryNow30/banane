#!/usr/bin/env node
'use strict';
/*
 * juger.cjs — JUGE DU BANC, versé au dépôt (T21a, garde de non-régression GCV2 ; cahier 5.0 v2 § 2.5, architecture § a.3).
 * Hors ligne, lecture seule. Port fidèle du juge qui vivait hors dépôt (`juger.cjs` des chantiers L1 et cap 5) : mêmes règles, même
 * arithmétique, mêmes comptes ; il ajoute deux colonnes (sans passe / avec passe), le classement par étape de décision et la liste par cut.
 *
 *   node tools/juger.cjs --rejeu R.jsonl --verite V.json [--profil L1-se] [--json SORTIE.json]
 *
 * Entrées : un rejeu de `tools/banc-differes.cjs rejouer` (profils base et L1-se) et une vérité { "<cut>": { mic: { left: [long, lat, vert],
 * right: [...] } } } en millimètres dans le repère profil de la pose de départ du lot (aucune coordonnée absolue).
 *
 * Règles du juge d'origine (inchangées) :
 *  - un cut est « posé en base » quand le profil `base` du rejeu (la chaîne sans la GCV2) le pose ; ces cuts ne sont pas rejugés : seul un
 *    changement de leur pose par le profil jugé compte (« verts changés ») ;
 *  - une pose du profil jugé sur un cut que la base ne pose pas est « nouvelle » ; elle est jugée si la vérité porte ce cut ;
 *  - écart = pire des deux rails, distance 3D entre la pose et la vérité (mm) ; mauvaise voie = écart latéral > 100 mm sur un rail ;
 *  - différé : cut non posé ; « sans nuage » : différé sans nuage ou avec moins de 100 points ; « cuts laissés sans pose » = différés − sans nuage ;
 *  - médiane : élément de rang ⌊n/2⌋ de la liste triée (comme le juge d'origine).
 * Ajouts T21a :
 *  - colonne « sans passe » : une pose faite par la deuxième passe (`passe2.passe` sur une pose) y redevient un différé. Exact au banc : la passe
 *    tourne après la boucle du lot et ne change aucune décision du lot (tools/banc-differes.cjs, `rejouerLot`) ;
 *  - étape de chaque pose nouvelle : `gcv2-lot` (cut d'abord différé par la chaîne, repris par la GCV2 dans le lot : sources gcv2 sans passe,
 *    l1s-chaine, l1s-vue ; D-250, priorité 1), `passe` (deuxième passe), `autre` ;
 *  - pose sans preuve du nuage : pose du profil jugé (hors sort réel recopié) sur un cut sans nuage ou à moins de 100 points ;
 *  - Wilson à 95 % (borne haute) pour la part à plus de 50 mm et la mauvaise voie, comme le juge d'origine.
 */
const fs = require('node:fs');

const SIDES = ['left', 'right'];
const ETAPES = Object.freeze(['gcv2-lot', 'passe', 'autre']);
const SOURCES_GCV2_LOT = new Set(['gcv2', 'l1s-chaine', 'l1s-vue']);

const ecart = (d, m) => Math.max(...SIDES.map(s => Math.hypot(...d[s].map((v, i) => v - m[s][i]))));
const ecartLateral = (d, m) => Math.max(...SIDES.map(s => Math.abs(d[s][1] - m[s][1])));
const arrondi = (v, n = 1) => v == null ? null : Math.round(v * 10 ** n) / 10 ** n;

/* Borne haute de Wilson à 95 %, en pour cent à 0,1 près (formule du juge d'origine). */
function wilson(k, n) {
  if (!n) return null;
  const z = 1.96, p = k / n, d = 1 + z * z / n, c = p + z * z / (2 * n), h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n));
  return Math.round((c + h) / d * 1000) / 10;
}

function lireJsonl(texte) { return texte.split('\n').filter(l => l.trim()).map(l => JSON.parse(l)); }
function lireRejeu(texte) {
  const tout = lireJsonl(texte), entete = tout.find(o => o.type === 'entete') || null;
  return { entete, lignes: tout.filter(o => o.type === 'cut') };
}
function lireVerite(doc) { return new Map(Object.entries(doc).map(([k, v]) => [Number(k), v.mic])); }

/* La ligne vue « sans passe » : une pose de la deuxième passe redevient un différé. */
function sansPasse(x) { return x && x.etat === 'pose' && x.passe2 && Number.isInteger(x.passe2.passe) ? { ...x, etat: 'differe', retireeSansPasse: true } : x; }
function etapeDe(x) { if (x.passe2 && Number.isInteger(x.passe2.passe)) return 'passe'; return SOURCES_GCV2_LOT.has(x.source) ? 'gcv2-lot' : 'autre'; }
function baseDe(l, x) {
  return l.profils.base || (x.etat === 'pose' && x.source === 'lot' ? { etat: 'pose', decal: x.decal } : { etat: x.source === 'lot' && !l.nuage && l.reel && l.reel.pose ? 'pose' : 'differe' });
}
const sansNuageLigne = l => !l.nuage || (l.points != null && l.points < 100);

function agregatVide() {
  return { traites: 0, differes: 0, sansNuage: 0, sansPose: 0, approches: 0, nouvelles: 0, juges: 0, a5: 0, a10: 0, a20: 0, p20: 0, p50: 0, mauvaiseVoie: 0, vertsChanges: 0, sansPreuve: 0,
    mediane: null, tauxP50: null, wilsonP50: null, tauxMV: null, wilsonMV: null, details: [], _e: [] };
}
function finir(r) {
  const s = r._e.slice().sort((a, b) => a - b);
  r.mediane = s.length ? Math.round(s[s.length >> 1] * 10) / 10 : null;
  r.sansPose = r.differes - r.sansNuage;
  r.tauxP50 = r.juges ? Math.round(r.p50 / r.juges * 1000) / 10 : null; r.wilsonP50 = wilson(r.p50, r.juges);
  r.tauxMV = r.juges ? Math.round(r.mauvaiseVoie / r.juges * 1000) / 10 : null; r.wilsonMV = wilson(r.mauvaiseVoie, r.juges);
  delete r._e; return r;
}
function compterJuge(r, e, mv, detail) {
  r.juges++; r._e.push(e);
  if (e <= 5) r.a5++;
  if (e <= 10) r.a10++; else if (e <= 20) r.a20++; else r.p20++;
  if (e > 50) r.p50++;
  if (mv) r.mauvaiseVoie++;
  if (e > 10 && detail) r.details.push(detail);
}

/* Juge un rejeu : par cut, l'état et l'écart dans les deux colonnes ; agrégats par colonne et par étape (colonne « avec passe »). */
function juger(lignes, verite, { profil = 'L1-se' } = {}) {
  const colonnes = { sansPasse: agregatVide(), avecPasse: agregatVide() }, etapes = Object.fromEntries(ETAPES.map(k => [k, agregatVide()])), cuts = [];
  for (const l of lignes) {
    const x0 = l.profils && l.profils[profil];
    if (!x0) throw Error(`cut ${l.cut} : profil ${profil} absent du rejeu`);
    const b = baseDe(l, x0), poseeBase = b.etat === 'pose', m = verite.get(l.cut) || null;
    const fiche = { cut: l.cut, poseeBase, verite: !!m };
    for (const [col, x] of [['avecPasse', x0], ['sansPasse', sansPasse(x0)]]) {
      const r = colonnes[col]; r.traites++;
      const c = { etat: x.etat === 'pose' ? 'pose' : x.etat === 'pose-non-validee' ? 'approche' : 'differe' };
      if (poseeBase && (x.etat !== 'pose' || JSON.stringify(b.decal) !== JSON.stringify(x.decal))) { r.vertsChanges++; c.vertChange = true; }
      if (x.etat === 'pose-non-validee') { r.approches++; r.differes++; }
      else if (x.etat !== 'pose') { r.differes++; if (sansNuageLigne(l)) { r.sansNuage++; c.sansNuage = true; } }
      else {
        if (sansNuageLigne(l) && x.source !== 'reel-sans-nuage') { r.sansPreuve++; c.sansPreuve = true; }
        if (!poseeBase) {
          r.nouvelles++; c.etape = etapeDe(x);
          if (m && x.decal) {
            const e = ecart(x.decal, m), mv = ecartLateral(x.decal, m) > 100;
            c.mm = arrondi(e, 2); if (mv) c.mauvaiseVoie = true;
            const detail = `${l.cut}:${e.toFixed(1)}:${x.source}${x.l1 && x.l1.correction && x.l1.correction.appliquee ? ':corr' : ''}`;
            compterJuge(r, e, mv, detail);
            if (col === 'avecPasse') compterJuge(etapes[c.etape], e, mv, detail);
          }
          if (col === 'avecPasse') etapes[c.etape].nouvelles++;
        }
      }
      fiche[col] = c;
    }
    cuts.push(fiche);
  }
  for (const r of [...Object.values(colonnes), ...Object.values(etapes)]) finir(r);
  for (const r of Object.values(etapes)) { delete r.traites; delete r.differes; delete r.sansNuage; delete r.sansPose; delete r.approches; delete r.vertsChanges; delete r.sansPreuve; }
  return { profil, colonnes, etapes, cuts };
}

/* Somme d'agrégats (groupe de lots) : les comptes s'additionnent, la médiane est recalculée sur les écarts par cut. */
function sommer(jugements, cle) {
  const r = agregatVide(), tous = jugements.map(j => cle(j)).filter(Boolean);
  for (const a of tous) for (const k of Object.keys(r)) if (typeof r[k] === 'number' && typeof a[k] === 'number' && !['mediane', 'tauxP50', 'wilsonP50', 'tauxMV', 'wilsonMV'].includes(k)) r[k] += a[k];
  for (const a of tous) r.details.push(...(a.details || []));
  return r;
}
function sommerColonne(jugements, col) {
  const r = sommer(jugements, j => j.colonnes[col]);
  r._e = jugements.flatMap(j => j.cuts.map(c => c[col] && c[col].mm).filter(v => v != null));
  return finir(r);
}
function sommerEtape(jugements, etape) {
  const r = sommer(jugements, j => j.etapes[etape]);
  r._e = jugements.flatMap(j => j.cuts.filter(c => c.avecPasse && c.avecPasse.etape === etape && c.avecPasse.mm != null).map(c => c.avecPasse.mm));
  const out = finir(r);
  for (const k of ['traites', 'differes', 'sansNuage', 'sansPose', 'approches', 'vertsChanges', 'sansPreuve']) delete out[k];
  return out;
}

function args(argv) {
  const o = { profil: 'L1-se' };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i], v = () => { const x = argv[++i]; if (x === undefined) throw Error('valeur manquante après ' + k); return x; };
    if (k === '--rejeu') o.rejeu = v(); else if (k === '--verite') o.verite = v(); else if (k === '--profil') o.profil = v(); else if (k === '--json') o.json = v();
    else throw Error('argument inconnu : ' + k);
  }
  if (!o.rejeu || !o.verite) throw Error('usage : node tools/juger.cjs --rejeu R.jsonl --verite V.json [--profil L1-se] [--json SORTIE.json]');
  return o;
}
function main(argv) {
  const a = args(argv), R = lireRejeu(fs.readFileSync(a.rejeu, 'utf8')), V = lireVerite(JSON.parse(fs.readFileSync(a.verite, 'utf8')));
  const j = juger(R.lignes, V, { profil: a.profil }), out = { partie: R.entete && R.entete.partie, lot: R.entete && R.entete.lot, ...j };
  if (a.json) fs.writeFileSync(a.json, JSON.stringify(out, null, 1) + '\n');
  const f = c => `sans pose ${c.sansPose} (sans nuage ${c.sansNuage}) · jugées ${c.juges} · ≤ 5 ${c.a5} · ≤ 10 ${c.a10} · 10–20 ${c.a20} · > 20 ${c.p20} · > 50 ${c.p50} · MV ${c.mauvaiseVoie} · verts changés ${c.vertsChanges} · sans preuve ${c.sansPreuve}`;
  process.stdout.write(`${out.partie} ${out.lot}\n  avec passe : ${f(j.colonnes.avecPasse)}\n  sans passe : ${f(j.colonnes.sansPasse)}\n`
    + ETAPES.map(e => `  étape ${e} : ${j.etapes[e].nouvelles} poses, ${j.etapes[e].juges} jugées, > 20 ${j.etapes[e].p20}, > 50 ${j.etapes[e].p50}, MV ${j.etapes[e].mauvaiseVoie}`).join('\n') + '\n');
}

module.exports = { ETAPES, SOURCES_GCV2_LOT, wilson, ecart, ecartLateral, lireRejeu, lireVerite, sansPasse, etapeDe, juger, sommerColonne, sommerEtape, args, main };
if (require.main === module) { try { main(process.argv.slice(2)); } catch (e) { process.stderr.write(`juger : ${e.message}\n`); process.exitCode = 4; } }
