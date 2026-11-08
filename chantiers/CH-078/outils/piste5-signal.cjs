/* CH-078, piste 5 — y a-t-il, dans les journaux, un signal fiable de changement de coupe, et quel gain une anticipation pourrait-elle donner ?
 * Usage : node piste5-signal.cjs <dossier de collection banane-data> [...]. Sortie : agrégats seulement (aucun identifiant).
 * Un « cycle » = de la validation acceptée du cut N à celle du cut suivant, dans le même lot, avec la coupe suivante annoncée par la validation
 * égale à la coupe validée ensuite (sinon le cycle est écarté et compté). Horloges : événements du service worker = `timestamp` ;
 * événements d'ESV (`esv-event`) = `timestamp` de réception (la date de la page, timeOrigin + pageMs, ne concorde pas avec celle du service worker après un rechargement ; retard de réception d'environ 0,2 s, donc marge de ± 0,3 s sur ces seuls événements) ; ressources de points = endedEpochMs (horloge de la page). */
'use strict';
const L = require('./lib-zips.cjs');
const med = L.mediane, q = L.quantile, r = L.r;
const resume = a => a.length ? { n: a.length, med: r(med(a)), p90: r(q(a, .9)), max: r(Math.max(...a)) } : { n: 0 };
for (const dir of process.argv.slice(2)) {
  const j = L.journal(dir), name = dir.split('/').filter(Boolean).pop().replace(/^\d{4}-\d\d-\d\d_/, '').replace(/parties?-[\d-]+/g, 'parties');
  const ev = [];
  for (const e of j.events) {
    let t = Date.parse(e.timestamp || e.at || '');
    if (e.type === 'esv-observation' && e.kind === 'resource' && Number.isFinite(e.endedEpochMs)) t = e.endedEpochMs;
    if (Number.isFinite(t)) ev.push({ ...e, t });
  }
  ev.sort((a, b) => a.t - b.t);
  const par = {}; for (const e of ev) (par[e.type] ||= []).push(e);
  const acc = (par['validation-accepted'] || []).filter(e => e.nextIdentity && e.identity);
  const evEsv = ev.filter(e => e.type === 'esv-observation' && e.kind === 'esv-event');
  const res = ev.filter(e => e.type === 'esv-observation' && e.kind === 'resource' && e.class === 'point-resource');
  const ctc = par['cut-target-changed'] || [], resultCap = (par['adapter-result'] || []).filter(e => e.action === 'capture' && !e.error);
  const proposes = par['proposed'] || [], appl = par['applied-verified'] || [];
  const out = { cycles: 0, ecartes_identite: 0, ecartes_autre: 0 };
  const d = { nav_vers_selected: [], selected_vers_ctc: [], nav_vers_debutLecture: [], nav_vers_finLecture: [], dernierPoint_vers_finLecture: [], seen_vers_finLecture: [], calcul: [], apply_valid: [], cycle: [] };
  let seenAvant = 0, seenApres = 0, seenAbsent = 0, selectedAbsent = 0, ctcIdOk = 0, ctcIdKo = 0, capIdKo = 0, capIdOk = 0, selVersFin = 0;
  const regles = {}; let progAttente = [];
  for (let k = 0; k + 1 < acc.length; k++) {
    const a = acc[k], b = acc[k + 1];
    if (a.batchId !== b.batchId || b.t - a.t > 60000) { out.ecartes_autre++; continue; }
    const nx = a.nextIdentity, same = x => x && x.part === nx.part && x.cut === nx.cut;
    if (!same(b.identity)) { out.ecartes_identite++; continue; }
    out.cycles++; d.cycle.push(b.t - a.t);
    const W = x => x.t >= a.t - 50 && x.t <= b.t;
    const sel = evEsv.find(e => W(e) && e.nom === 'railPairSelected' && e.args?.[1] === nx.cut);
    if (sel) d.nav_vers_selected.push(sel.t - a.t); else selectedAbsent++;
    const c = ctc.find(e => W(e) && e.fromCutId !== undefined && same(e.nextIdentity));
    if (c) { ctcIdOk++; d.selected_vers_ctc.push(sel ? c.t - sel.t : NaN); } else { const cc = ctc.find(e => W(e)); if (cc) ctcIdKo++; }
    const fin = resultCap.find(e => W(e) && same(e.identity)), pg = (par['adapter-progress'] || []).find(e => W(e) && e.action === 'capture' && same(e.identity));
    if (pg) d.nav_vers_debutLecture.push(pg.t - a.t);
    if (!fin) { out.ecartes_autre++; continue; }
    capIdOk++; d.nav_vers_finLecture.push(fin.t - a.t);
    const rs = res.filter(e => e.t > a.t && e.t <= fin.t);
    if (rs.length) d.dernierPoint_vers_finLecture.push(fin.t - Math.max(...rs.map(e => e.t)));
    const seen = evEsv.find(e => e.t > (sel ? sel.t : a.t) && e.t <= b.t && e.nom === 'railPairSeen' && e.args?.[1] === nx.cut);
    if (!seen) seenAbsent++; else { d.seen_vers_finLecture.push(fin.t - seen.t); if (seen.t < fin.t) seenAvant++; else seenApres++; }
    const prop = proposes.find(e => e.t > fin.t && e.t <= b.t && same(e.identity));
    if (prop) d.calcul.push(prop.t - fin.t);
    const ap = appl.find(e => e.t > fin.t && e.t <= b.t && same(e.identity));
    if (ap) d.apply_valid.push(b.t - (prop ? prop.t : fin.t));
  }
  /* Règle de fin d'attente par lecture (champ `regle` des détails de `capture-read`) : signal / stabilité / repli. */
  for (const e of par['adapter-progress'] || []) if (e.action === 'capture' && e.lastStage === 'capture-read' && e.lastDetail?.regle) { regles[e.lastDetail.regle] = (regles[e.lastDetail.regle] || 0) + 1; }
  const lectures = Object.values(regles).reduce((s, v) => s + v, 0);
  /* Changement de cut : l'identité annoncée par la validation, par `railPairSelected` d'ESV et par `cut-target-changed` doit être la même. */
  console.log(JSON.stringify({
    collection: name, evenements: j.events.length, validations_acceptees: acc.length, cycles_exploitables: out.cycles, cycles_ecartes_identite_suivante_differente: out.ecartes_identite, cycles_ecartes_autre: out.ecartes_autre,
    duree_cycle_ms: resume(d.cycle),
    annonce_esv_railPairSelected: { absent_sur_cycles: selectedAbsent, delai_apres_validation_ms: resume(d.nav_vers_selected) },
    cut_target_changed: { identite_conforme: ctcIdOk, identite_non_conforme: ctcIdKo },
    capture_identite_conforme: capIdOk,
    debut_lecture_apres_validation_ms: resume(d.nav_vers_debutLecture),
    fin_lecture_apres_validation_ms: resume(d.nav_vers_finLecture),
    dernier_point_recu_avant_fin_lecture_ms: resume(d.dernierPoint_vers_finLecture),
    railPairSeen: { avant_fin_de_lecture: seenAvant, apres_fin_de_lecture: seenApres, absent: seenAbsent, marge_ms: resume(d.seen_vers_finLecture) },
    calcul_ms_fin_lecture_vers_proposition: resume(d.calcul), proposition_vers_validation_ms: resume(d.apply_valid),
    regle_fin_attente: regles, lectures
  }, null, 1));
}
