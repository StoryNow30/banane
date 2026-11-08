/* CH-078, piste 5 — changements de cible hors cycle normal (cut qui change sans validation, changement de partie, réouverture par ESV : CH-043, CH-046, CH-047).
 * Pour chaque `cut-target-changed` : la cible change-t-elle de partie ? d'un pas « normal » (même partie, cut suivant d'une validation ou d'un différé) ou d'un saut ?
 * Après chaque changement : la première capture lue porte-t-elle la nouvelle identité ? (règle 4.2 : un résultat n'est jamais appliqué à la mauvaise coupe).
 * Usage : node piste5-parties.cjs <dossier de collection> [...]. Agrégats seulement. */
'use strict';
const L = require('./lib-zips.cjs'), r = L.r;
for (const dir of process.argv.slice(2)) {
  const j = L.journal(dir), name = dir.split('/').filter(Boolean).pop().replace(/^\d{4}-\d\d-\d\d_/, '').replace(/parties?-[\d-]+/g, 'parties');
  const ev = j.events.map(e => ({ ...e, t: Date.parse(e.timestamp || e.at || '') })).filter(e => Number.isFinite(e.t)).sort((a, b) => a.t - b.t);
  const ctc = ev.filter(e => e.type === 'cut-target-changed'), acc = ev.filter(e => e.type === 'validation-accepted'), dfn = ev.filter(e => e.type === 'defer-navigation-observation' && e.accepted);
  const caps = ev.filter(e => e.type === 'adapter-result' && e.action === 'capture');
  const goto_ = ev.filter(e => e.type === 'goto-cut'), cats = {}, add = k => cats[k] = (cats[k] || 0) + 1;
  let capSuivie = 0, capAucune = 0; const parNat = {}; const delaisPartie = [];
  for (let i = 0; i < ctc.length; i++) {
    const c = ctc[i], from = c.identity, to = c.nextIdentity, partChg = from.part !== to.part;
    const vOk = acc.some(a => Math.abs(a.t - c.t) < 3000 && a.nextIdentity?.cut === to.cut && a.nextIdentity?.part === to.part);
    const dOk = dfn.some(a => Math.abs(a.t - c.t) < 3000 && a.nextIdentity?.cut === to.cut);
    const gOk = goto_.some(g => Math.abs(g.t - c.t) < 3000);
    const nat = partChg ? 'changement_de_partie' : vOk ? 'apres_validation' : dOk ? 'apres_differe' : gOk ? 'saut_commande_goto-cut' : 'autre_meme_partie';
    add(nat);
    const suiv = ctc[i + 1], limite = suiv ? Math.min(suiv.t, c.t + 120000) : c.t + 120000;   // la capture doit finir avant le changement de cible suivant
    const cap = caps.find(e => e.t > c.t && e.t <= limite && !e.error);
    if (!cap) { capAucune++; continue; }
    capSuivie++; const ok = cap.identity?.part === to.part && cap.identity?.cut === to.cut; (parNat[nat] ||= { bonne: 0, autre: 0 })[ok ? 'bonne' : 'autre']++;
    if (partChg) delaisPartie.push(cap.t - c.t);
  }
  const fp = ev.filter(e => e.type === 'file-parties-changement'), esvEv = {};
  for (const e of ev) if (e.type === 'esv-observation' && e.kind === 'esv-event') esvEv[e.nom] = (esvEv[e.nom] || 0) + 1;
  const lec = ev.filter(e => e.type === 'adapter-result' && e.action === 'capture' && e.error).length;
  console.log(JSON.stringify({ collection: name, changements_de_cible: ctc.length, nature: cats, premiere_capture_apres_le_changement_par_nature: parNat, aucune_capture_avant_le_changement_suivant: capAucune,
    delai_changement_de_partie_vers_fin_de_capture_ms: delaisPartie.length ? { n: delaisPartie.length, med: r(L.mediane(delaisPartie)), max: r(Math.max(...delaisPartie)) } : { n: 0 },
    evenements_file_parties_changement: fp.length, evenements_esv_comptes: esvEv, captures_en_erreur: lec,
    captures_abandonnees_ou_perimees: ['capture-abandoned', 'capture-stale', 'capture-failed'].map(t => [t, ev.filter(e => e.type === t).length]) }, null, 1));
}
