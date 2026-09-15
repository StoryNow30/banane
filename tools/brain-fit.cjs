#!/usr/bin/env node
'use strict';
/* Ajustement et évaluation du cerveau de placement.
 *
 * DÉCOUPAGE. Les blocs sont des PARTS entières, pas des cuts tirés au hasard :
 * deux cuts voisins de la même part partagent la même voie, le même passage et
 * souvent le même geste. Un tirage au hasard ferait fuir l'information d'un
 * bloc à l'autre et gonflerait le résultat. Le bloc réservé n'est utilisé qu'à
 * la toute fin, une seule fois, avec des réglages déjà figés.
 *
 * AUCUN SEUIL N'EST RÉGLÉ SUR LE BLOC RÉSERVÉ. Les deux garde-fous de la
 * sélection viennent de lignes AUTRES que celles qu'ils filtrent : ils sont
 * dérivés de la distribution des gestes humains sur les rails que le moteur
 * résout, dans le bloc de développement.
 */
const fs = require('node:fs'), path = require('node:path');
const Brain = require('../src/brain.js');

const mediane = a => { if (!a.length) return null; const b = a.slice().sort((x, y) => x - y); const m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
const quantile = (a, p) => { if (!a.length) return null; const b = a.slice().sort((x, y) => x - y); return b[Math.min(b.length - 1, Math.floor(b.length * p))]; };
const moyenne = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
const ecart = a => { const m = moyenne(a); return a.length ? Math.sqrt(moyenne(a.map(x => (x - m) ** 2))) : null; };

/* Reconstitue une proposition au format du moteur à partir d'une ligne du jeu,
 * pour que le cerveau reçoive exactement ce qu'il recevra en production. */
function proposition(ligne) {
  const c = ligne.moteur.candidats || {};
  const metrics = { seed: c.graine, surfaceIntersection: c.surface,
    templateAmbiguity: { alternative: c.alternative, separation: c.separation, lossRatio: c.rapportPerte },
    topCount: c.nTable, faceCount: c.nFace, residual: c.residuel };
  return { side: ligne.side, status: ligne.moteur.statut, delta: ligne.moteur.delta,
    confidence: ligne.moteur.confiance, reasons: ligne.moteur.motifs, source: ligne.moteur.source, metrics };
}
const cle = l => l.part + '/' + l.cut;
function parCut(lignes) {
  const m = new Map();
  for (const l of lignes) { const k = cle(l); if (!m.has(k)) m.set(k, {}); m.get(k)[l.side] = l; }
  return m;
}

/* Erreur euclidienne (latéral, vertical) entre une proposition et le geste humain. */
const erreur = (delta, cible) => delta ? Math.hypot(delta[1] - cible[1], delta[2] - cible[2]) : null;

/* --- Ajustement : uniquement sur le bloc fourni ------------------------- */
function ajuster(dev) {
  const resolues = dev.filter(l => l.moteur.statut === 'candidate' && l.moteur.delta);
  const rz = resolues.map(l => l.cible.deplacementLocal[2] - l.moteur.delta[2]);
  const ru = resolues.map(l => l.cible.deplacementLocal[1] - l.moteur.delta[1]);
  /* Un biais ne se corrige que s'il DOMINE sa propre dispersion. Le rapport
   * |moyenne| / écart-type tranche : au-dessus de 1, la moyenne est le signal ;
   * en dessous, la corriger revient à ajouter du bruit. Le latéral échoue à ce
   * test sur ce corpus, et n'est donc pas corrigé. */
  const retenu = (r) => { const m = moyenne(r), s = ecart(r); return (s > 0 && Math.abs(m) / s >= 1) ? m : 0; };
  /* Garde-fous, dérivés de lignes AUTRES que les ambiguës qu'ils filtrent. */
  const gestesLateraux = resolues.map(l => Math.abs(l.cible.deplacementLocal[1]));
  const cuts = parCut(dev); const diffZ = [];
  for (const [, c] of cuts) if (c.left && c.right)
    diffZ.push(c.left.cible.deplacementLocal[2] - c.right.cible.deplacementLocal[2]);
  return {
    biaisVertical: retenu(rz), biaisLateral: retenu(ru),
    plausibiliteLaterale: quantile(gestesLateraux, 0.9),
    ecartVerticalMax: 1.5 * ecart(diffZ),
    selectionActive: true,
    _mesures: {
      n: resolues.length,
      residuVerticalMoyen: moyenne(rz), residuVerticalEcart: ecart(rz),
      residuLateralMoyen: moyenne(ru), residuLateralEcart: ecart(ru),
      rapportVertical: ecart(rz) ? Math.abs(moyenne(rz)) / ecart(rz) : null,
      rapportLateral: ecart(ru) ? Math.abs(moyenne(ru)) / ecart(ru) : null,
      cutsApparies: diffZ.length, diffVerticaleEcart: ecart(diffZ),
    },
  };
}

/* --- Évaluation : applique le cerveau, compte ce qui change ------------- */
function evaluer(lignes, reglages) {
  const cuts = parCut(lignes);
  const avant = [], apres = [], journal = [];
  let proposeAvant = 0, proposeApres = 0, selections = 0, abstentions = 0;
  for (const [k, c] of cuts) {
    const props = { left: c.left ? proposition(c.left) : null, right: c.right ? proposition(c.right) : null };
    const r = Brain.corrigerPaire(props, reglages);
    for (const side of ['left', 'right']) {
      const l = c[side]; if (!l) continue;
      const cible = l.cible.deplacementLocal;
      const a = props[side], b = r.proposals[side];
      if (a?.status === 'candidate' && a.delta) { proposeAvant++; avant.push(erreur(a.delta, cible)); }
      if (b?.status === 'candidate' && b.delta) { proposeApres++; apres.push(erreur(b.delta, cible)); }
      const act = r.brain.perRail[side]?.action;
      if (act === 'sélection') selections++;
      if (act === 'abstention') abstentions++;
      journal.push({ cut: k, side, action: act, avant: erreur(a?.delta, cible), apres: erreur(b?.delta, cible) });
    }
  }
  /* Comparaison APPARIÉE : les mêmes rails avant et après. Comparer deux
   * médianes calculées sur des populations différentes ne dirait rien. */
  const apparies = journal.filter(j => Number.isFinite(j.avant) && Number.isFinite(j.apres));
  const gains = apparies.map(j => j.avant - j.apres);
  return {
    rails: journal.length, proposeAvant, proposeApres, selections, abstentions,
    avant: { n: avant.length, p50: mediane(avant), p90: quantile(avant, .9), moyenne: moyenne(avant) },
    apres: { n: apres.length, p50: mediane(apres), p90: quantile(apres, .9), moyenne: moyenne(apres) },
    apparies: {
      n: apparies.length, gainMedian: mediane(gains), gainMoyen: moyenne(gains),
      ameliores: gains.filter(g => g > 0).length, degrades: gains.filter(g => g < 0).length,
    },
    nouvelles: journal.filter(j => !Number.isFinite(j.avant) && Number.isFinite(j.apres))
      .map(j => ({ cut: j.cut, side: j.side, erreur: j.apres })),
    journal,
  };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const jeu = JSON.parse(fs.readFileSync(args[args.indexOf('--input') + 1], 'utf8'));
  const dev = Number(args[args.indexOf('--dev') + 1]);
  const reserve = Number(args[args.indexOf('--reserve') + 1]);
  const sortie = args.includes('--out') ? args[args.indexOf('--out') + 1] : null;
  const L = jeu.lignes;
  const bDev = L.filter(l => l.part === dev), bRes = L.filter(l => l.part === reserve);
  if (!bDev.length || !bRes.length) throw Error('Bloc vide : dev=' + bDev.length + ' réserve=' + bRes.length);
  const reglages = ajuster(bDev);
  const { _mesures, ...figes } = reglages;
  const rapport = {
    format: 'banane-brain-fit-v1', builtAt: new Date().toISOString(),
    unites: 'unités de scène — PAS des millimètres : la calibration physique n’est pas attestée',
    decoupage: { developpement: { part: dev, rails: bDev.length }, reserve: { part: reserve, rails: bRes.length },
      regle: 'blocs = parts entières ; le bloc réservé n’a servi à aucun ajustement ni choix de seuil' },
    mesuresDeveloppement: _mesures, reglagesFiges: figes,
    developpement: evaluer(bDev, figes),
    reserve: evaluer(bRes, figes),
  };
  delete rapport.developpement.journal; delete rapport.reserve.journal;
  if (sortie) fs.writeFileSync(sortie, JSON.stringify(rapport, null, 1));
  console.log(JSON.stringify(rapport, null, 1));
}
module.exports = { ajuster, evaluer, proposition, erreur, mediane, quantile, moyenne, ecart };
