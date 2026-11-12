#!/usr/bin/env node
'use strict';
/* CH-112 : rejeu séquentiel d'un signe « mauvaise voie » sur les cuts posés d'un lot.
 *   node regle-voie.cjs --journal j.json --liste l.json --partie 16 --jointure p16.json [--seuil 80] [--ecart 12]
 *        [--zone adv|tout] [--csv sortie.csv]
 * Principe : la voie juste est celle des derniers cuts SÛRS (posés par le lot plus tôt et non arrêtés par la règle,
 * ou traités par l'opérateur avant le lot) ; les cuts validés d'office par ESV ne servent pas de référence (en zone
 * d'aiguillage, ESV suit souvent l'autre voie). Pour chaque cut posé, dans l'ordre du lot : décalage latéral
 * (horizontal, perpendiculaire à la voie) de chaque rail posé par rapport au même rail du dernier cut sûr d'au plus
 * `ecart` cuts en arrière, la direction de la voie étant prise dans la liste d'ESV autour du cut (cuts i−1 → i+1,
 * direction seulement : une voie voisine est presque parallèle). Arrêt si le décalage moyen des deux rails dépasse
 * `seuil` mm et que les deux rails vont du même côté. Sans référence sûre : abstention (le cut passe).
 * Sortie : numéros de cut et millimètres seulement. */
const fs = require('node:fs');
const { lireListe } = require('./liste.cjs');
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : d; };

function charger(journal, listeFichier, partie, jointure) {
  const ev = (typeof journal === 'string' ? JSON.parse(fs.readFileSync(journal, 'utf8')) : journal).events.filter(e => e.identity?.part === partie);
  const liste = lireListe(listeFichier).cuts;
  const touches = new Set(ev.map(e => e.identity.cut));
  const prop = ev.filter(e => e.type === 'proposed').sort((a, b) => a.timestamp < b.timestamp ? -1 : 1);
  const poses = new Map();
  for (const e of ev.filter(e => e.type === 'applied-verified')) {
    const r = e.observed?.rails; if (!r?.left?.positionSceneRelative || !r?.right?.positionSceneRelative) continue;
    const m = r.left.profileLocalToSceneRelative;
    poses.set(e.identity.cut, { gauche: r.left.positionSceneRelative, droite: r.right.positionSceneRelative, lat: Array.isArray(m) ? [m[4], m[5], m[6]] : null });
  }
  const valides = new Set(ev.filter(e => e.type === 'validation-accepted').map(e => e.identity.cut));
  const zone = new Map();
  for (const e of ev.filter(e => e.type === 'regles-metier-ombre' && e.portee === 'cut')) zone.set(e.identity.cut, e.zone?.adv || '');
  const ordre = [...new Set(prop.map(e => e.identity.cut))];
  let etiquettes = null;
  if (jointure) {
    etiquettes = new Map();
    for (const r of JSON.parse(fs.readFileSync(jointure, 'utf8')).table) if (r.partie === partie && r.classe === 'posee')
      etiquettes.set(r.cut, r.ecartHumain ? r.ecartHumain.maxDist3dMm : (r.dansEcho ? 0 : null));
  }
  return { liste, touches, ordre, poses, valides, zone, etiquettes };
}

/* Décalage dans l'axe latéral du profil du cut (plan de coupe d'ESV). Avec deux références (r1 la plus proche, r2),
 * la position attendue au cut est extrapolée en ligne droite (pas de cut supposé régulier). */
function decalageProfil(c, pose, r1, p1, r2, p2) {
  if (!pose.lat) return null;
  const out = {};
  for (const k of ['gauche', 'droite']) {
    let att = p1[k];
    if (p2) { const f = (c - r1) / (r1 - r2); att = [0, 1, 2].map(j => p1[k][j] + (p1[k][j] - p2[k][j]) * f); }
    const d = [0, 1, 2].map(j => pose[k][j] - att[j]);
    out[k] = (d[0] * pose.lat[0] + d[1] * pose.lat[1] + d[2] * pose.lat[2]) * 1000;
  }
  return out;
}
function decalage(liste, i, ref, pose, poseRef) {
  // direction locale de la voie : rails de la liste de i−1 à i+1 (ou au plus près)
  let a = null, b = null;
  for (let k = 1; k <= 3 && !a; k++) if (liste[i - k]?.gauche) a = liste[i - k];
  for (let k = 1; k <= 3 && !b; k++) if (liste[i + k]?.gauche) b = liste[i + k];
  if (!a || !b) return null;
  const out = {};
  for (const c of ['gauche', 'droite']) {
    const dx = b[c][0] - a[c][0], dy = b[c][1] - a[c][1], n = Math.hypot(dx, dy);
    if (n < 1e-6) return null;
    const ux = dx / n, uy = dy / n, px = pose[c][0] - poseRef[c][0], py = pose[c][1] - poseRef[c][1];
    out[c] = (ux * py - uy * px) * 1000;
  }
  return out;
}

function rejouer(d, { seuil = 80, ecart = 12, zoneMode = 'adv', methode = 'profil2', abstenuSur = true, marges = true, courbure = 0, traites = true } = {}) {
  const { liste, touches, ordre, poses, valides, zone } = d;
  const surs = new Map(); // cut -> pose, références sûres
  // traités par l'opérateur hors de ce lot (drapeau « traité » et aucun événement du lot sur ce cut)
  if (traites) for (let i = 0; i < liste.length; i++) if (liste[i]?.traite && liste[i].statut === 0 && liste[i].gauche && !touches.has(i)) surs.set(i, liste[i]);
  const res = [];
  for (const c of ordre) {
    if (!valides.has(c) || !poses.has(c)) continue; // seulement les cuts posés
    const pose = poses.get(c), z = zone.get(c) || '';
    let ref = null, ref2 = null;
    for (let k = c - 1; k >= c - ecart; k--) if (surs.has(k)) { if (ref === null) ref = k; else { ref2 = k; break; } }
    const o = { cut: c, zone: z, ref: ref === null ? '' : c - ref, latG: '', latD: '', arret: 0 };
    const enZone = zoneMode === 'tout' || z === 'alerte' || (marges && (z === 'marge-apres' || z === 'marge-avant'));
    if (ref !== null) {
      const dl = methode === 'liste' ? decalage(liste, c, ref, pose, surs.get(ref))
        : methode === 'profil1' || ref2 === null ? decalageProfil(c, pose, ref, surs.get(ref), null, null)
        : decalageProfil(c, pose, ref, surs.get(ref), ref2, surs.get(ref2));
      if (dl) {
        o.latG = Math.round(dl.gauche * 10) / 10; o.latD = Math.round(dl.droite * 10) / 10;
        const meme = Math.sign(dl.gauche) === Math.sign(dl.droite);
        o.moyMm = Math.round((dl.gauche + dl.droite) / 2 * 10) / 10;
        o.seuilMm = seuil + courbure * (c - ref) ** 2;
        if (enZone && meme && Math.abs(o.moyMm) > o.seuilMm) o.arret = 1;
      }
    }
    o.abstenu = o.latG === '' ? 1 : 0;
    if (!o.arret && (abstenuSur || !o.abstenu || !(z === 'alerte' || zoneMode === 'tout'))) surs.set(c, pose);
    res.push(o);
  }
  return res;
}

function bilan(res, etiquettes) {
  const b = { poses: res.length, arretes: 0, faux100: 0, faux100Arretes: 0, faux10: 0, faux10Arretes: 0, bonsArretesZone: 0, bonsArretesHors: 0, bonsZone: 0, bonsHors: 0, nonJugesArretes: 0, listeArretes: [] };
  for (const o of res) {
    const e = etiquettes?.get(o.cut);
    if (o.arret) { b.arretes++; b.listeArretes.push(o.cut); }
    if (e === null || e === undefined) { if (o.arret) b.nonJugesArretes++; continue; }
    const z = o.zone === 'alerte';
    if (e > 100) { b.faux100++; if (o.arret) b.faux100Arretes++; }
    if (e > 10) { b.faux10++; if (o.arret) b.faux10Arretes++; }
    else { if (z) { b.bonsZone++; if (o.arret) b.bonsArretesZone++; } else { b.bonsHors++; if (o.arret) b.bonsArretesHors++; } }
  }
  return b;
}
module.exports = { charger, rejouer, bilan };
if (require.main === module) {
  const partie = Number(arg('partie'));
  const d = charger(arg('journal'), arg('liste'), partie, arg('jointure'));
  const res = rejouer(d, { seuil: Number(arg('seuil', 80)), ecart: Number(arg('ecart', 12)), zoneMode: arg('zone', 'adv') });
  if (arg('csv')) { const cols = ['cut', 'zone', 'ref', 'latG', 'latD', 'moyMm', 'arret']; fs.writeFileSync(arg('csv'), [cols.join(';'), ...res.map(o => cols.map(k => o[k] ?? '').join(';'))].join('\n') + '\n'); }
  console.log(JSON.stringify(bilan(res, d.etiquettes)));
}
