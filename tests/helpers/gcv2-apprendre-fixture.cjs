'use strict';
/* Jeu SYNTHÉTIQUE pour l'essai de l'apprentissage de la GCV2 (tests/gcv2-apprendre.test.cjs) : les lignes ont la forme d'un jeu de
 * tools/gcv2-jeu.cjs (entete, cut, rail, hyp), mais tout est inventé, graine fixe, aucune donnée de terrain. Dans chaque cut, la pose finale de
 * l'opérateur est tirée au hasard ; certaines hypothèses la visent (avec un bruit), d'autres non. Le trait `ecartVoisinsMm` et `strong` sont
 * informatifs, les autres sont du bruit : un modèle correct doit s'en servir. */
function alea(graine) { let a = graine >>> 0; return () => { a = (Math.imul(a, 1664525) + 1013904223) >>> 0; return a / 4294967296; }; }
const SIDES = ['left', 'right'];

function jeuSynthetique({ partie = '9:1', cuts = 60, graine = 1, humains = true, jeu = 'apprentissage', gMed = 1450 } = {}) {
  const rnd = alea(graine * 7919 + 13), N = (s = 1) => (rnd() + rnd() + rnd() - 1.5) * 2 * s;
  const lignes = [{ type: 'entete', format: 'ariane-gcv2-jeu-v1', partie, jeu, note: 'jeu synthétique', maxHypParRail: 12, doublonMm: 0.75, seuilsMm: { juste: 5, faux: 10, mauvaiseVoie: 50 }, gMedMm: gMed }];
  const zones = ['pn', 'adv', 'abords', 'hors'], roles = ['vert', 'vert', 'vert', 'rouge', 'differe'];
  for (let c = 0; c < cuts; c++) {
    const zone = zones[Math.floor(rnd() * zones.length)], role = roles[Math.floor(rnd() * roles.length)];
    const corrige = rnd() < 0.35, G0 = gMed + N(4), mic = {};
    for (const s of SIDES) mic[s] = corrige ? [0, N(14), N(10)] : [0, N(1.2), N(1.2)];
    const micMax = Math.max(...SIDES.map(s => Math.hypot(...mic[s]))), voisinsHumains = humains && rnd() < 0.5;
    lignes.push({ type: 'cut', partie, cut: c, zone, role, etat: 'calcule', reference: rnd() < 0.5 ? 'validation' : 'visite-bon', visites: 1 + Math.floor(rnd() * 4),
      etiquette: { mic, micMaxMm: Math.round(micMax * 100) / 100, grosse: micMax > 10 }, moteur: { abstenu: false, differe: false, etage: 'first-pass', raison: null, ecartementMm: G0, ecartementRejete: false },
      contexte: { etageChaine: 'first-pass', appuisChaine: 0, voisins: { n: voisinsHumains ? 2 : 0, humains: voisinsHumains ? 2 : 0, lot: 0, encadre: voisinsHumains, coupMin: voisinsHumains ? 1 : null, ecartementMm: voisinsHumains ? G0 : null }, ecartDepartMm: Math.round(G0 * 10) / 10 },
      nHyp: { left: 0, right: 0 }, tronques: { left: 0, right: 0 }, tronquesPoses: null, erreur: null });
    const cutLigne = lignes[lignes.length - 1], nH = {};
    for (const s of SIDES) {
      lignes.push({ type: 'rail', partie, cut: c, rail: s, statut: 'candidate', motif: 'candidate', confianceAstar: 60 + Math.floor(rnd() * 30), rapportPerteAstar: 5 + rnd() * 20, s1: false,
        fortsConcurrents: Math.floor(rnd() * 3), competitives: 1 + Math.floor(rnd() * 3), grappes: 1, fortsReservoir: 4, reservoir: 40, pointsRail: 100 + Math.floor(rnd() * 80), perteMin: 1e-6 * (1 + rnd()), micRailMm: Math.round(Math.hypot(...mic[s]) * 100) / 100 });
      const poses = [{ o: 'H0', sous: 'depart', d: [0, 0, 0] }];
      const vise = (bruit) => [0, mic[s][1] + N(bruit), mic[s][2] + N(bruit)];
      poses.push({ o: 'H1', sous: 'astar', d: rnd() < 0.55 ? vise(2) : [0, N(25), N(12)] });
      for (let h = 0; h < 4; h++) poses.push({ o: 'H2', sous: 'comp', d: rnd() < 0.2 ? vise(3) : [0, N(30), N(15)] });
      if (voisinsHumains) poses.push({ o: 'H4', sous: 'voisins-humains', d: rnd() < 0.7 ? vise(3) : [0, N(20), N(10)] });
      nH[s] = 0;
      poses.forEach((p, rang) => {
        const proche = Math.hypot(p.d[1] - mic[s][1], p.d[2] - mic[s][2]);
        const sign = s === 'left' ? 1 : -1;
        const traits = { perte: p.o === 'H0' || p.o === 'H4' ? null : 1e-6 * (1 + rnd() * 5), ratioPerte: p.o === 'H0' || p.o === 'H4' ? null : 1 + rnd() * 2, lignesSommet: p.o === 'H0' ? null : 40 + Math.floor(rnd() * 60),
          faces: p.o === 'H0' ? null : 4 + Math.floor(rnd() * 8), strong: p.o === 'H0' ? null : proche < 6 ? rnd() < 0.85 : rnd() < 0.4, palier: p.o === 'H0' ? null : 'STRONG_FACE', pente: p.o === 'H0' ? null : false,
          fenetre: p.o === 'H0' ? null : true, competitive: p.o === 'H0' ? null : true, astar: p.o === 'H1', publiee: p.o === 'H1', s1: false, balises: p.o === 'H0' ? null : ['local-min', 'top>=15'],
          distCelluleMm: null, ratioCelluleProche: null, strongCelluleProche: null, pointsDessus: 60 + Math.floor(rnd() * 40), pointsFlanc: 10 + Math.floor(rnd() * 10), epaisseurDessusMm: 5 + rnd() * 5,
          dzConventionMm: p.o === 'H0' ? null : N(1), duConventionMm: p.o === 'H0' ? null : N(1), convention: p.o === 'H0' ? null : 'appliquee', groupeHauteur: null, deplMm: Math.round(Math.hypot(p.d[1], p.d[2]) * 100) / 100,
          ecartVoieMm: null, ecartVoisinsMm: voisinsHumains ? Math.round((proche < 6 ? 1 + rnd() * 5 : 4 + rnd() * 40) * 100) / 100 : null,
          ecartementAutreH0Mm: Math.round((G0 + sign * p.d[1]) * 10) / 10, ecartMedAutreH0Mm: Math.round((G0 + sign * p.d[1] - gMed) * 10) / 10, chaineEtage: null, hauteurMm: null, hauteurAbstention: null,
          ecartPaireMedMm: Math.round(Math.abs(G0 - gMed) * 10) / 10 };
        lignes.push({ type: 'hyp', partie, cut: c, rail: s, rang, origine: p.o, sous: p.sous, origines: [p.o], sousOrigines: [p.sous], hauteur: false, decal: p.d.map(v => Math.round(v * 100) / 100),
          traits: { ...traits, zone, role }, etiquette: { ecartMm: Math.round(proche * 100) / 100, classe: proche <= 5 ? '<=5' : proche <= 10 ? '<=10' : '>10' } });
        nH[s]++;
      });
    }
    cutLigne.nHyp = nH;
  }
  return lignes;
}
module.exports = { jeuSynthetique, alea, SIDES };
