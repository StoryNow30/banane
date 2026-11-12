'use strict';
/* CH-115 : fabrique la PAGE DE COMPARAISON (un seul fichier HTML, aucune dépendance externe). Chaque colonne fait tourner le VRAI panneau
 * (panel.html, ses scripts, ses feuilles, sa police) dans un cadre, avec l'API Chrome simulée : `view` rend l'état de la scène jouée, le panneau
 * se rafraîchit seul toutes les secondes (panel.js), donc chaque changement d'état passe par les vraies transitions du panneau.
 * Colonnes : Vision 14 (« Graphite », feuilles du commit 5e8d305), Vision 15 (« Épure », feuilles du tronc) et les directions de CH-115
 * (feuilles du tronc + chantiers/CH-115/directions/<d>.css + chantiers/CH-115/directions/maquette.js). Le code des scripts est celui du tronc
 * (les scripts du panneau n'ont pas changé de Vision 14 à Vision 15, seulement les feuilles).
 * États : ceux de chantiers/CH-104/outils/capturer.cjs (données fabriquées), joués en une histoire en boucle. Rien n'est envoyé à ESV.
 * Usage : node chantiers/CH-115/outils/page.cjs SORTIE.html [chantiers/CH-115/pages/<page>.json] */
const path = require('node:path'), fs = require('node:fs'), { execFileSync } = require('node:child_process');
const R = path.resolve(__dirname, '../../..');
const SORTIE = process.argv[2]; if (!SORTIE) { console.error('Fichier de sortie attendu.'); process.exit(2); }
const { E, lot, FICHES } = require(R + '/chantiers/CH-104/outils/capturer.cjs');
const V14 = '5e8d305';
const lire = (rev, p, bin) => rev ? execFileSync('git', ['show', `${rev}:${p}`], { cwd: R, encoding: bin ? 'buffer' : 'utf8', maxBuffer: 64e6 }) : fs.readFileSync(path.join(R, p), bin ? null : 'utf8');
const html = lire(null, 'panel.html');
const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
const feuilles = [...html.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)].map(m => m[1]);
const corps = html.slice(html.indexOf('<body'), html.indexOf('<script src=')).replace(/^<body[^>]*>/, '');
const attrsBody = (html.match(/<body([^>]*)>/) || [])[1] || '';
/* les polices : chaque url(fonts/…) devient une donnée embarquée, lue à la même révision que la feuille */
const polices = (css, rev) => css.replace(/url\((fonts\/[^)]+\.woff2)\)/g, (_, p) => `url(data:font/woff2;base64,${lire(rev, p, true).toString('base64')})`);
const feuillesDe = rev => feuilles.map(f => polices(lire(rev, f), rev)).join('\n');
const DIR = path.join(R, 'chantiers/CH-115/directions');
/* CONFIG : chantiers/CH-115/pages/<page>.json : { titre, intro, pied, reglages: { fond, ralenti }, mesures: chemin, variantes: [{ id, nom, sous, note,
 * rev: '5e8d305' (feuilles de Vision 14) ou absent (tronc), css: [feuilles posées par-dessus, dans directions/], maquette: bool, defautClair: bool }] } */
const CONFIG = JSON.parse(fs.readFileSync(path.resolve(process.argv[3] || path.join(R, 'chantiers/CH-115/pages/tour1.json')), 'utf8'));
const VARIANTES = CONFIG.variantes.map(v => ({ ...v, css: feuillesDe(v.rev || null) + '\n' + (v.css || []).map(f => polices(fs.readFileSync(path.join(DIR, f), 'utf8'), null)).join('\n'), maquette: !!v.maquette }));
const MESURES = CONFIG.mesures && fs.existsSync(path.join(R, CONFIG.mesures)) ? JSON.parse(fs.readFileSync(path.join(R, CONFIG.mesures), 'utf8')) : null;
const JS = scripts.map(s => ({ s, t: lire(null, s) }));
const MAQ = fs.readFileSync(path.join(DIR, 'maquette.js'), 'utf8');

/* ------------------------------------------------------------ l'histoire : des scènes, chacune une ou plusieurs images (états) */
const clone = o => JSON.parse(JSON.stringify(o));
const S = (nom, cle, images, o = {}) => ({ nom, cle, images: images.map(x => ({ rel: { choix: 'corriger', lot: null, passe: null }, fiches: [], onglet: 'orbite', ...x })), ...o });
const avecFile = st => ({ ...st, fileParties: st.fileParties ?? null });
const cours = n => ({ state: avecFile(lot('RUNNING', n, { cutStartedAt: 'MAINTENANT-2' })) });
const relImg = faits => ({ state: avecFile(E.relecture.state), rel: { ...clone(E.relecture.rel), passe: { ...E.relecture.rel.passe, faits, cut: 4790 + faits, corriges: Math.floor(faits / 9) } } });
const p2 = ecrites => ({ state: avecFile({ ...E.rattrapage.state, passeDifferes: { ...E.rattrapage.state.passeDifferes, ecrites, cut: [4796, 4803, 4809][Math.min(2, ecrites)] } }) });
const erreur = { state: avecFile(lot('ERROR', 4811, { activeIdentity: null })) };
const SCENES = [
  S('Repos', 'repos', [{ state: avecFile(E.pret.state) }], { duree: 4200 }),
  S('Lot en cours', 'cours', [4800, 4801, 4802, 4804, 4805, 4807, 4808, 4810, 4811].map(cours), { pas: 1300 }),
  S('Pause', 'pause', [{ state: avecFile(E.pause.state) }], { duree: 4200 }),
  S('À toi', 'toi', [{ state: avecFile(E.toi.state) }], { duree: 5000 }),
  S('Rattrapage', 'rattrapage', [0, 1, 2, 3].map(p2), { pas: 1500 }),
  S('Relecture', 'relecture', [12, 24, 37, 49, 61, 73, 85].map(relImg), { pas: 1200 }),
  S('Fin du lot', 'fin', [{ state: avecFile(E.fin.state) }], { duree: 5200 }),
  S('Constellation', 'constellation', [{ ...E['file-cours'], onglet: 'file' }, { ...E['file-passage'], onglet: 'file' }, { ...E['file-fin'], onglet: 'file' }].map(x => ({ state: x.state, fiches: x.fiches || [], onglet: 'file' })), { pas: 3200 }),
  S('ESV ne répond plus', 'panne', [{ state: avecFile(E.panne.state) }], { duree: 5000 }),
  S('Erreur du lot', 'erreur', [erreur], { duree: 4500 }),
];

const DONNEES = { titre: CONFIG.titre, intro: CONFIG.intro, pied: CONFIG.pied, reglages: CONFIG.reglages || {}, mesures: MESURES, variantes: VARIANTES.map(({ id, nom, sous, note, maquette, defautClair }) => ({ id, nom, sous, note: note || '', maquette, defautClair: !!defautClair })), scenes: SCENES };
const CSS = Object.fromEntries(VARIANTES.map(v => [v.id, v.css]));
const JSX = Object.fromEntries(VARIANTES.map(v => [v.id, (v.js || []).map(f => fs.readFileSync(path.join(DIR, f), 'utf8')).join('\n;\n')]));
const garde = s => s.replace(/<\/(script)/gi, '<\\/$1').replace(/<!--/g, '<\\!--');
const json = o => garde(JSON.stringify(o));

const page = fs.readFileSync(path.join(__dirname, 'page-modele.html'), 'utf8')
  .replace('/*DONNEES*/', () => `const DONNEES=${json(DONNEES)};const CSS=${json(CSS)};const JSX=${json(JSX)};const JS=${json(JS)};const MAQ=${json(MAQ)};const CORPS=${json(corps)};const ATTRS_BODY=${json(attrsBody)};`);
fs.writeFileSync(SORTIE, page);
console.log(`${SORTIE} : ${(page.length / 1048576).toFixed(2)} Mo, ${VARIANTES.length} colonnes, ${SCENES.length} scènes`);
