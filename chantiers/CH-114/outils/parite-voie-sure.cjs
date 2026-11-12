#!/usr/bin/env node
'use strict';
/* CH-114 (point 4) : PARITÉ HORS LIGNE du module src/voie-sure-ombre.js avec l'outil de CH-112 (chantiers/CH-112/outils/regle-voie.cjs).
 * Le module est rejoué sur le journal d'un lot COMME LE SERVICE WORKER LE NOURRIT (background.js, `voieSureEvenement`) : événements de la partie rangés
 * dans l'ordre du temps ; `regles-metier-ombre` (portée cut) donne la zone d'ADV du cut ; `applied-verified` la pose relue (rails, axe latéral du profil
 * du rail gauche) ; `validation-accepted` du moteur (avec la pose vérifiée de la même proposition) fait évaluer le cut. Mémoire neuve à chaque lot (batchId).
 * L'outil de CH-112 est rejoué avec le réglage du rapport, SANS les « cuts traités hors du lot » (retirés, point 3). Comparaison cut par cut :
 * verdict (auraitDiffere / arret), référence (écart en cuts), décalages gauche et droit au dixième de mm, présence d'un événement (zone alerte).
 *   CH112_DONNEES=<dossier d'extraction> node chantiers/CH-114/outils/parite-voie-sure.cjs [--csv DOSSIER]
 * Sortie : numéros de cut et millimètres seulement. Les données restent hors dépôt (CH112_DONNEES). */
const fs = require('node:fs'), path = require('node:path');
const V = require('../../../src/voie-sure-ombre.js'), R = require('../../CH-112/outils/regle-voie.cjs'), LOTS = require('../../CH-112/outils/lots.cjs');
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : d; };
const REG = { methode: 'profil1', seuil: 100, courbure: 2, ecart: 12, abstenuSur: false, marges: false, traites: false };
/* Réglage d'origine de CH-112 (second verdict, examen de la partie 23 du 12/11) : seuil 100 fixe, marges arrêtables. */
const ORG = { methode: 'profil1', seuil: 100, courbure: 0, ecart: 12, abstenuSur: false, marges: true, traites: false };
/* Partie 23 du 12/11 (premier examen vierge), en plus des lots de CH-112. */
const P23 = { lot: '12/11', journal: path.join(process.env.CH112_DONNEES || '.', 'lot1112/ariane-journal-v4-1794484679341.json'), parties: [
  { partie: 23, liste: path.join(process.env.CH112_DONNEES || '.', 'lot1112/ariane-liste-partie23-20261112-105904Z.json') }] };

/* Le chemin du service worker, sur le journal : rend cut -> { evenement, sur } dans l'ordre des validations. */
function rejouerSw(evts, partie) {
  const ev = evts.filter(e => e.identity?.part === partie).sort((a, b) => a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : 0);
  let mem = null; const zones = new Map(), poses = new Map(), out = [];
  for (const e of ev) {
    const cut = e.identity.cut, k = partie + '|' + cut;
    if (e.type === 'regles-metier-ombre' && e.portee === 'cut') zones.set(k, typeof e.zone?.adv === 'string' ? e.zone.adv : '');
    else if (e.type === 'applied-verified') {
      const r = e.observed?.rails, m = r?.left?.profileLocalToSceneRelative;
      poses.set(k, { proposalId: e.proposalId ?? null, pose: { gauche: r?.left?.positionSceneRelative ?? null, droite: r?.right?.positionSceneRelative ?? null,
        lat: Array.isArray(m) && m.length >= 7 ? [m[4], m[5], m[6]] : null } });
    } else if (e.type === 'validation-accepted' && e.passeDifferes !== true) {
      const p = poses.get(k); poses.delete(k);
      if (!p || (p.proposalId && e.proposalId && p.proposalId !== e.proposalId)) continue;
      if (mem?.lotId !== e.batchId) mem = V.creerMemoire(e.batchId);
      const zoneAdv = zones.get(k) ?? ''; zones.delete(k);
      out.push({ cut, zone: zoneAdv, ...V.evaluer(mem, { part: partie, cut, zoneAdv, pose: p.pose }) });
    }
  }
  return out;
}

function comparer(d, sw) {
  const ref = R.rejouer(d, REG), org = R.rejouer(d, ORG);
  const parCut = new Map(sw.map(o => [o.cut, o])), ecarts = [];
  const orgCut = new Map(org.map(o => [o.cut, o]));
  let identiques = 0;
  for (const o of ref) {
    const s = parCut.get(o.cut), e = s?.evenement, motifs = [];
    if (!s) motifs.push('absent du chemin du service worker');
    else {
      const q = orgCut.get(o.cut), zOrg = ['alerte', 'marge-avant', 'marge-apres'].includes(o.zone);
      if (zOrg !== !!e) motifs.push('zone : ' + o.zone + ' / ' + s.zone);
      if (e && zOrg) {
        if (e.auraitDiffereOrigine !== (q.arret === 1)) motifs.push('verdict d’origine ' + q.arret + ' / ' + e.auraitDiffereOrigine);
        if ((e.referenceCutOrigine === null ? '' : o.cut - e.referenceCutOrigine) !== q.ref) motifs.push('référence d’origine ' + q.ref + ' / ' + (e.referenceCutOrigine === null ? '' : o.cut - e.referenceCutOrigine));
      }
      if (e && o.zone === 'alerte') {
        if (e.auraitDiffere !== (o.arret === 1)) motifs.push('verdict ' + o.arret + ' / ' + e.auraitDiffere);
        if ((e.referenceCut === null ? '' : o.cut - e.referenceCut) !== o.ref) motifs.push('référence ' + o.ref + ' / ' + (e.referenceCut === null ? '' : o.cut - e.referenceCut));
        if (o.latG !== '' && (e.decalageGaucheMm !== o.latG || e.decalageDroitMm !== o.latD)) motifs.push('décalages ' + o.latG + ',' + o.latD + ' / ' + e.decalageGaucheMm + ',' + e.decalageDroitMm);
      } else if (s.sur !== !(o.arret || (o.abstenu && o.zone === 'alerte'))) motifs.push('sûr');
    }
    if (motifs.length) ecarts.push({ cut: o.cut, motifs }); else identiques++;
  }
  const enTrop = sw.filter(s => !ref.some(o => o.cut === s.cut)).map(s => ({ cut: s.cut, motifs: ['absent de regle-voie.cjs'] }));
  return { ref, org, identiques, ecarts: [...ecarts, ...enTrop] };
}

if (require.main === module) {
  const tot = { poses: 0, identiques: 0, ecarts: 0, arretsRef: 0, arretsSw: 0, arretsOrgRef: 0, arretsOrgSw: 0, evenements: 0, abstentionsRef: 0, abstentionsSw: 0 };
  for (const L of [...LOTS, ...(fs.existsSync(P23.journal) ? [P23] : [])]) {
    const j = JSON.parse(fs.readFileSync(L.journal, 'utf8'));
    for (const p of L.parties) {
      const d = R.charger(j, p.liste, p.partie, null), sw = rejouerSw(j.events, p.partie), c = comparer(d, sw);
      const aR = c.ref.filter(o => o.arret).map(o => o.cut), aS = sw.filter(s => s.evenement?.auraitDiffere).map(s => s.cut);
      tot.poses += c.ref.length; tot.identiques += c.identiques; tot.ecarts += c.ecarts.length; tot.arretsRef += aR.length; tot.arretsSw += aS.length;
      tot.evenements += sw.filter(s => s.evenement).length;
      const oR = c.org.filter(o => o.arret).map(o => o.cut), oS = sw.filter(s => s.evenement?.auraitDiffereOrigine).map(s => s.cut);
      tot.arretsOrgRef += oR.length; tot.arretsOrgSw += oS.length;
      console.log(`   origine : arrêts ${oR.join(',') || '-'} / ${oS.join(',') || '-'}`);
      tot.abstentionsRef += c.ref.filter(o => o.zone === 'alerte' && o.abstenu).length;
      tot.abstentionsSw += sw.filter(s => s.evenement && s.zone === 'alerte' && /^sans-/.test(s.evenement.motif)).length;
      console.log(`${L.lot} p${p.partie} : posés ${c.ref.length}, identiques ${c.identiques}, écarts ${c.ecarts.length}, événements ${sw.filter(s => s.evenement).length}, arrêts ${aR.join(',') || '-'} / ${aS.join(',') || '-'}`);
      for (const x of c.ecarts.slice(0, 20)) console.log('   écart cut ' + x.cut + ' : ' + x.motifs.join(' ; '));
      if (arg('csv')) {
        const cols = ['cut', 'zone', 'referenceCut', 'decalageGaucheMm', 'decalageDroitMm', 'moyenneMm', 'seuilMm', 'auraitDiffere', 'motif', 'zoneOrigine', 'referenceCutOrigine', 'seuilOrigineMm', 'auraitDiffereOrigine'];
        fs.mkdirSync(arg('csv'), { recursive: true });
        fs.writeFileSync(path.join(arg('csv'), `voie-sure-${L.lot.replace(/\W/g, '')}-p${p.partie}.csv`),
          [cols.join(';'), ...sw.filter(s => s.evenement).map(s => cols.map(k => k === 'cut' ? s.cut : s.evenement[k] ?? '').join(';'))].join('\n') + '\n');
      }
    }
  }
  console.log(JSON.stringify(tot));
}
module.exports = { rejouerSw, comparer };
