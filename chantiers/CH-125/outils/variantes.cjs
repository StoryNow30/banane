'use strict';
/* CH-125 : variantes de la mesure, pour la simulation statique de mesure.cjs. Une variante = { texte, mesurer(rail, ctx) → mesure brute (sans
 * constante apprise), apprendre(railsApprentissage) → constantes du pli, poser(rail, mesure, constantes) → pose [u, z] (m) }.
 * Constantes de convention (décalage entre le centre du nuage et la pose de l'opérateur) : médiane, sur les rails d'apprentissage RETOUCHÉS par
 * l'opérateur sur l'axe (plus de 2 mm), de (pose finale − centre mesuré). Aucune pose humaine n'entre dans `mesurer`. */
const E = require('./estimateurs.cjs'), N = require('./nuage.cjs');
const med = N.mediane;
const VIS = { origines: [0], xMax: 0.25 }, CHG = { origines: [0, 1], xMax: 0.5, pentes: true };
const retV = r => Math.abs(r.finale[1] - r.livre[1]) > 0.002, retL = r => Math.abs(r.finale[0] - r.livre[0]) > 0.002;
const cste = (rails, nom, axe, ok, ret) => { const v = rails.filter(r => ret(r) && r.m[nom] && ok(r.m[nom])).map(r => (r.finale[axe] - r.m[nom].pose[axe]) * 1000); return v.length >= 5 ? med(v) : null; };

const vertical = (lecture, texte, extra = {}) => ({ texte,
  mesurer: (r, { gab }) => E.centreBandes(r.pts, gab, r.livre, { ...lecture, lateral: false, ...extra }),
  apprendre: (rails, nom) => ({ c: cste(rails, nom, 1, m => m.deplaceVert, retV) }),
  poser: (r, m, k) => m.deplaceVert && k.c !== null ? [r.livre[0], m.pose[1] + k.c / 1000] : r.livre });
const lateral = (lecture, texte, extra = {}) => ({ texte,
  mesurer: (r, { gab }) => E.centreBandes(r.pts, gab, r.livre, { ...lecture, vertical: false, ...extra }),
  apprendre: (rails, nom) => ({ k: cste(rails, nom, 0, m => m.deplaceLat, retL) }),
  poser: (r, m, k) => m.deplaceLat && k.k !== null ? [m.pose[0] + k.k / 1000, r.livre[1]] : r.livre });
const lesDeux = (lecture, texte, extra = {}) => ({ texte,
  mesurer: (r, { gab }) => E.centreBandes(r.pts, gab, r.livre, { ...lecture, ...extra }),
  apprendre: (rails, nom) => ({ c: cste(rails, nom, 1, m => m.deplaceVert, retV), k: cste(rails, nom, 0, m => m.deplaceLat, retL) }),
  poser: (r, m, k) => [m.deplaceLat && k.k !== null ? m.pose[0] + k.k / 1000 : r.livre[0], m.deplaceVert && k.c !== null ? m.pose[1] + k.c / 1000 : r.livre[1]] });
const gabarit = (lecture, texte, extra = {}) => ({ texte,
  mesurer: (r, { gab }) => { const m = E.ajusterGabarit(r.pts, gab, r.livre, { ...lecture, ...extra }); return { ...m, deplaceVert: !!m.cov && m.sigmaZ < (extra.sigmaZMax ?? 1.5), deplaceLat: !!m.cov && m.sigmaU < (extra.sigmaUMax ?? 1.5) }; },
  apprendre: (rails, nom) => ({ c: cste(rails, nom, 1, m => m.deplaceVert, retV), k: cste(rails, nom, 0, m => m.deplaceLat, retL) }),
  poser: (r, m, k) => [m.deplaceLat && k.k !== null ? m.pose[0] + k.k / 1000 : r.livre[0], m.deplaceVert && k.c !== null ? m.pose[1] + k.c / 1000 : r.livre[1]] });

const VARIANTES = {
  'livre': { texte: 'la pose livrée (rejeu du code livré), sans rien changer', mesurer: () => null, poser: r => r.livre },
  'livre-refait': { texte: 'le calage livré (q90 + 1 ; flanc médian − 2,6 dès 6 points ; domaine 8 mm) refait une fois à la pose livrée',
    mesurer: (r, { gab }) => E.conventionLivree(r.pts, gab, r.livre, VIS), poser: (r, m) => m.applique ? m.pose : r.livre },
  'v-med': vertical(VIS, 'hauteur = médiane du dessus (points visibles, point fixe) + c ; travers inchangé'),
  'v-med-charges': vertical(CHG, 'hauteur = médiane du dessus sur tous les points chargés (±0,5 m, pente le long de la voie retirée) + c ; travers inchangé'),
  'l-flanc': lateral(VIS, 'travers = médiane du flanc (points visibles, 6 points au moins, point fixe) + k ; hauteur inchangée'),
  'l-flanc-charges': lateral(CHG, 'travers = médiane du flanc sur tous les points chargés (±0,5 m, pente retirée, 6 points au moins) + k ; hauteur inchangée'),
  'l-flanc-charges-4': lateral(CHG, 'comme l-flanc-charges, dès 4 points de flanc', { minFlanc: 4 }),
  'vl-med': lesDeux(VIS, 'hauteur = médiane du dessus + c et travers = médiane du flanc + k (points visibles, 6 points de flanc au moins)'),
  'vl-med-charges': lesDeux(CHG, 'hauteur et travers sur tous les points chargés (±0,5 m, pentes retirées, 6 points de flanc au moins)'),
  'gabarit': gabarit(VIS, 'gabarit entier ajusté en moindres carrés robustes (points visibles) + (k, c) ; un axe n\'est déplacé que si son incertitude est sous 1,5 mm'),
  'gabarit-charges': gabarit({ origines: [0, 1], xMax: 0.5 }, 'gabarit entier ajusté sur tous les points chargés (±0,5 m) + (k, c) ; incertitude sous 1,5 mm par axe'),
};
module.exports = { VARIANTES, vertical, lateral, lesDeux, gabarit, VIS, CHG };

/* ------------------------------------------------------------------ CH-125 : variantes « enveloppe » (hauteur au k-ième point le plus haut, travers à la médiane du flanc) */
const env = (opt, texte, garde = () => true) => ({ texte,
  mesurer: (r, { gab }) => { const m = E.enveloppeDessus(r.pts, gab, r.livre, opt); return { ...m, deplaceVert: m.ok && garde(m) }; },
  apprendre: (rails, nom) => ({ c: cste(rails, nom, 1, m => m.deplaceVert, retV) }),
  poser: (r, m, k) => m.deplaceVert && k.c !== null ? [r.livre[0], m.pose[1] + k.c / 1000] : r.livre });
const fl = (opt, texte, garde = () => true) => ({ texte,
  mesurer: (r, { gab }) => { const m = E.centreFlanc(r.pts, gab, r.livre, opt); return { ...m, deplaceLat: m.ok && garde(m) }; },
  apprendre: (rails, nom) => ({ k: cste(rails, nom, 0, m => m.deplaceLat, retL) }),
  poser: (r, m, k) => m.deplaceLat && k.k !== null ? [m.pose[0] + k.k / 1000, r.livre[1]] : r.livre });
/* Hauteur puis travers (le flanc est lu à la hauteur corrigée). */
const envFl = (optV, optL, texte, gardeV = () => true, gardeL = () => true) => ({ texte,
  mesurer: (r, { gab }) => { const v = E.enveloppeDessus(r.pts, gab, r.livre, optV), okV = v.ok && gardeV(v); return { v, okV, deplaceVert: okV, pose: v.pose, _r: r, _gab: gab }; },
  apprendre: (rails, nom) => { const c = cste(rails, nom, 1, m => m.deplaceVert, retV);
    /* le flanc se lit à la hauteur finale (centre + c) : mesuré ici pour l'apprentissage de k */
    const vals = []; for (const r of rails) { const m = r.m[nom]; const z = m.okV && c !== null ? m.pose[1] + c / 1000 : r.livre[1], f = E.centreFlanc(r.pts, m._gab, [r.livre[0], z], optL); if (f.ok && gardeL(f) && retL(r)) vals.push((r.finale[0] - f.pose[0]) * 1000); }
    return { c, k: vals.length >= 5 ? med(vals) : null }; },
  poser: (r, m, k) => { const z = m.okV && k.c !== null ? m.pose[1] + k.c / 1000 : r.livre[1], f = E.centreFlanc(r.pts, m._gab, [r.livre[0], z], optL);
    return [f.ok && gardeL(f) && k.k !== null ? f.pose[0] + k.k / 1000 : r.livre[0], z]; } });
Object.assign(VARIANTES, {
  'env8': env({ k: 8 }, 'hauteur = 8e point le plus haut du dessus (points visibles, fenêtre −12 à +14 mm, une lecture) + c ; travers inchangé'),
  'env8-pf': env({ k: 8, tours: 6 }, 'comme env8, la fenêtre suit la pose (point fixe, 6 tours au plus)'),
  'env5': env({ k: 5 }, 'hauteur = 5e point le plus haut + c'),
  'env12': env({ k: 12 }, 'hauteur = 12e point le plus haut + c'),
  'env8-fin': env({ k: 8 }, 'comme env8, seulement si l\'épaisseur du dessus, pente le long de la voie retirée, est de 10 mm au plus', m => m.epSansPente <= 10),
  'flanc': fl({ charges: false }, 'travers = médiane du flanc (points visibles, 6 au moins, une lecture) + k ; hauteur inchangée'),
  'flanc-charges': fl({ charges: true }, 'travers = médiane du flanc ; sous 6 points visibles, tous les points chargés de la capture (±0,5 m) ; + k'),
  'flanc-charges-pf': fl({ charges: true, tours: 6 }, 'comme flanc-charges, la fenêtre suit la pose (point fixe)'),
  'env8+flanc': envFl({ k: 8 }, { charges: true }, 'hauteur = 8e point le plus haut + c, puis travers = médiane du flanc à cette hauteur (points chargés sous 6 visibles) + k'),
  'env8-fin+flanc': envFl({ k: 8 }, { charges: true }, 'comme env8+flanc, la hauteur seulement si l\'épaisseur sans pente est de 10 mm au plus', m => m.epSansPente <= 10),
});

/* Politique « rails refusés seulement » : la hauteur ne change que là où le calage livré, relu à la pose, sortirait de son domaine en hauteur
 * (|q90 + 1| > 8 mm : rail que le livré pose brut). Approche statique de « refusé à la source ». */
const refuse = (r, gab) => { const c = E.conventionLivree(r.pts, gab, r.livre, VIS); return !c.applique && c.raison === 'shift-out-of-domain' && Math.abs(c.dz) > 8; };
Object.assign(VARIANTES, {
  'env8-refuses': { texte: 'hauteur = 8e point le plus haut + c, seulement pour les rails que le calage livré refuse en hauteur à la pose (|q90 + 1| > 8 mm)',
    mesurer: (r, { gab }) => { const m = E.enveloppeDessus(r.pts, gab, r.livre, { k: 8 }); return { ...m, refuse: refuse(r, gab), deplaceVert: m.ok }; },
    apprendre: (rails, nom) => ({ c: cste(rails, nom, 1, m => m.deplaceVert, retV) }),
    poser: (r, m, k) => m.ok && m.refuse && k.c !== null ? [r.livre[0], m.pose[1] + k.c / 1000] : r.livre },
});
Object.assign(VARIANTES, {
  'v-med-refuses': { texte: 'hauteur = médiane du dessus (point fixe) + c, seulement pour les rails que le calage livré refuse en hauteur à la pose',
    mesurer: (r, { gab }) => { const m = E.centreBandes(r.pts, gab, r.livre, { ...VIS, lateral: false }); return { ...m, refuse: refuse(r, gab) }; },
    apprendre: (rails, nom) => ({ c: cste(rails, nom, 1, m => m.deplaceVert, retV) }),
    poser: (r, m, k) => m.deplaceVert && m.refuse && k.c !== null ? [r.livre[0], m.pose[1] + k.c / 1000] : r.livre },
  'env8-refuses-15': { texte: 'comme env8-refuses, seulement si l\'épaisseur brute du dessus (q90 − q10) est de 15 mm au plus',
    mesurer: (r, { gab }) => { const m = E.enveloppeDessus(r.pts, gab, r.livre, { k: 8 }); return { ...m, refuse: refuse(r, gab), deplaceVert: m.ok }; },
    apprendre: (rails, nom) => ({ c: cste(rails, nom, 1, m => m.deplaceVert, retV) }),
    poser: (r, m, k) => m.ok && m.refuse && m.ep <= 15 && k.c !== null ? [r.livre[0], m.pose[1] + k.c / 1000] : r.livre },
});
Object.assign(VARIANTES, {
  'v-med-refuses+flanc': { texte: 'rails refusés en hauteur : hauteur = médiane du dessus + c, puis travers = médiane du flanc relue à cette hauteur − 2,6 mm (constante du livré), 6 points au moins, 8 mm au plus',
    mesurer: (r, { gab }) => { const m = E.centreBandes(r.pts, gab, r.livre, { ...VIS, lateral: false }); return { ...m, refuse: refuse(r, gab), _gab: gab }; },
    apprendre: (rails, nom) => ({ c: cste(rails, nom, 1, m => m.deplaceVert, retV) }),
    poser: (r, m, k) => { if (!(m.deplaceVert && m.refuse && k.c !== null)) return r.livre; const z = m.pose[1] + k.c / 1000, f = E.centreFlanc(r.pts, m._gab, [r.livre[0], z], { charges: false });
      const du = f.ok ? f.du - 2.6 : 0; return [r.livre[0] + (Math.abs(du) <= 8 ? du : 0) / 1000, z]; } },
});
