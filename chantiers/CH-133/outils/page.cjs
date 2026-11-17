'use strict';
/* CH-133 : fabrique la PAGE DE DÉMONSTRATION des bornes de la relecture (un seul fichier HTML, aucune dépendance externe). Le VRAI panneau (panel.html,
 * ses scripts, ses feuilles, sa police, ceux de la branche) tourne dans un cadre à l'échelle 1, avec l'API Chrome simulée (modèle de page de CH-129).
 * Scènes : relecture en cours (pour comparer), relecture en pause sur une série de cuts sans point, pause demandée, relecture arrêtée sur la série,
 * relecture arrêtée après une correction incertaine acquittée, relecture finie. Données fabriquées (partie 13). Rien n'est envoyé à ESV.
 * Usage : node chantiers/CH-133/outils/page.cjs SORTIE.html (la page reste hors du dépôt : elle est publiée en privé). */
const path = require('node:path'), fs = require('node:fs');
const R = path.resolve(__dirname, '../../..');
const SORTIE = process.argv[2]; if (!SORTIE) { console.error('Fichier de sortie attendu.'); process.exit(2); }
const { E } = require(R + '/chantiers/CH-104/outils/capturer.cjs');
const lire = (p, bin) => fs.readFileSync(path.join(R, p), bin ? null : 'utf8');
const html = lire('panel.html');
const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
const feuilles = [...html.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)].map(m => m[1]);
const corps = html.slice(html.indexOf('<body'), html.indexOf('<script src=')).replace(/^<body[^>]*>/, '');
const attrsBody = (html.match(/<body([^>]*)>/) || [])[1] || '';
const polices = css => css.replace(/url\((fonts\/[^)]+\.woff2)\)/g, (_, p) => `url(data:font/woff2;base64,${lire(p, true).toString('base64')})`);
const CSS = { v: feuilles.map(f => polices(lire(f))).join('\n') };
const JS = scripts.map(s => ({ s, t: lire(s) }));

const clone = o => JSON.parse(JSON.stringify(o));
const etatFin = () => ({ ...clone(E.relecture.state), fileParties: null });
const LOT = { id: 'lot-1', mode: 'corriger', etat: 'COMPLETED' };
const passe = p => ({ lotId: 'lot-1', mode: 'corriger', modeEffectif: 'corriger', faits: 21, total: 85, corriges: 4, refusees: 0, vus: 0, cut: null, reprise: true, pauseDemandee: false, pauseRaison: null, expire: null, horsBornes: 0, bornes: null, ...p });
const rel = (p, x = {}) => ({ choix: 'corriger', lot: LOT, passe: passe(p), correctionInterrompue: null, correctionsInterrompues: [], repriseReglage: { actif: true, f5: 'pause' }, ...x });
const S = (nom, cle, images, o = {}) => ({ nom, cle, images: images.map(x => ({ fiches: [], onglet: 'orbite', ...x })), ...o });
const SERIE = 'ESV n’affiche plus les points (3 cuts de suite sans point, dès le cut 4812, même après le rechargement) : relecture gardée en pause au cut 4812. Recharge ESV (F5) puis reprends, ou reprends après la série (cut 4815) (21 cuts relus sur 85).';
const SCENES = [
  S('Relecture en pause : série de cuts sans point', 'pause-serie', [{ state: etatFin(), rel: rel({ etat: 'en-pause', cut: 4812, pauseRaison: 'points', message: SERIE, bornesProposees: { debut: 4815, fin: 4884 } }) }], { duree: 9000 }),
  S('Relecture en pause (demandée)', 'pause-mic', [{ state: etatFin(), rel: rel({ etat: 'en-pause', cut: 4833, faits: 40, pauseRaison: 'mic', message: 'Relecture en pause au cut 4833.', bornesProposees: { debut: 4833, fin: 4884 } }) }], { duree: 7000 }),
  S('Relecture arrêtée : série de cuts sans point', 'arret-serie', [{ state: etatFin(), rel: rel({ etat: 'erreur', reprise: false, message: 'Relecture arrêtée au cut 4812 : ESV n’affiche plus les points (3 cuts de suite sans point, dès le cut 4812). 64 cuts non relus, du cut 4812 au cut 4884 ; rien n’a été écrit sur ces cuts. Recharge ESV (F5) puis relance la relecture.', bornesProposees: { debut: 4815, fin: 4884 } }, { repriseReglage: { actif: false, f5: 'pause' } }) }], { duree: 9000 }),
  S('Relecture arrêtée : correction incertaine, acquittée', 'arret-correction', [{ state: etatFin(), rel: rel({ etat: 'erreur', faits: 30, message: 'Relecture arrêtée : la validation du cut 4824 n’est pas confirmée par ESV.', bornesProposees: { debut: 4825, fin: 4884 } }) }], { duree: 8000 }),
  S('Relecture finie', 'finie', [{ state: etatFin(), rel: rel({ etat: 'finie', faits: 85, message: 'Relecture finie : 85 cuts relus, 6 corrigés.', bornesProposees: { debut: 4790, fin: 4884 } }) }], { duree: 7000 }),
  S('Relecture en cours (rien de nouveau)', 'cours', [{ state: etatFin(), rel: rel({ etat: 'en-cours', faits: 12, cut: 4801 }) }], { duree: 5000 }),
];
const DONNEES = { scenes: SCENES, variantes: [{ id: 'v', nom: 'CH-133' }] };
const garde = s => s.replace(/<\/(script)/gi, '<\\/$1').replace(/<!--/g, '<\\!--');
const json = o => garde(JSON.stringify(o));
const page = fs.readFileSync(path.join(__dirname, 'page-modele.html'), 'utf8')
  .replace('/*DONNEES*/', () => `const DONNEES=${json(DONNEES)};const CSS=${json(CSS)};const JSX={};const JS=${json(JS)};const MAQ='';const CORPS=${json(corps)};const ATTRS_BODY=${json(attrsBody)};`);
fs.writeFileSync(SORTIE, page);
console.log(`${SORTIE} : ${(page.length / 1048576).toFixed(2)} Mo, ${SCENES.length} scènes`);
