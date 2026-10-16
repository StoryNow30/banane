'use strict';
/*
 * manifeste-parties.cjs — lecture du manifeste des parties (B1 de l'audit 5.0, règle 4 du cahier).
 *
 * Le fichier versionné `datasets/manifeste-parties.json` dit quelles parties ont déjà servi à régler (« apprentissage »).
 * Toute autre partie est « réservée » : aucun outil de réglage ne la lit, tant qu'une décision écrite ne l'a pas fait
 * passer en apprentissage (on l'ajoute alors à la liste du fichier). Les projets sont désignés par leur rang
 * (projet 1, projet 2), jamais par leur code.
 *
 * Les outils de réglage prennent `--partie PROJET:PARTIE[,PROJET:PARTIE...]`. Une partie réservée est refusée, sauf avec
 * `--juger-partie-reservee` : le jugement est alors permis, SANS RÉGLAGE (aucun réglage ne doit être modifié d'après ce
 * résultat), et l'outil le dit.
 */
const fs = require('node:fs');
const path = require('node:path');

const FORMAT = 'ariane-manifeste-parties-v1';
const CHEMIN = path.join(__dirname, '..', 'datasets', 'manifeste-parties.json');
const entierPositif = v => Number.isInteger(v) && v > 0;

function lire(chemin = CHEMIN) {
  let m;
  try { m = JSON.parse(fs.readFileSync(chemin, 'utf8')); }
  catch (e) { throw Error(`manifeste des parties illisible (${chemin}) : ${e.message}`); }
  if (!m || m.format !== FORMAT) throw Error(`manifeste des parties : format attendu ${FORMAT}`);
  if (typeof m.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(m.date)) throw Error('manifeste des parties : date AAAA-MM-JJ attendue');
  if (!Array.isArray(m.apprentissage)) throw Error('manifeste des parties : liste « apprentissage » attendue');
  const vus = new Set();
  for (const bloc of m.apprentissage) {
    if (!bloc || !entierPositif(bloc.projet) || !Array.isArray(bloc.parties)) throw Error('manifeste des parties : chaque bloc donne un projet (1, 2…) et ses parties');
    for (const n of bloc.parties) {
      if (!entierPositif(n)) throw Error(`manifeste des parties : numéro de partie invalide (${JSON.stringify(n)})`);
      const cle = `${bloc.projet}:${n}`;
      if (vus.has(cle)) throw Error(`manifeste des parties : la partie ${n} du projet ${bloc.projet} est déclarée deux fois`);
      vus.add(cle);
    }
  }
  return m;
}

/* 'apprentissage' si la partie est listée ; 'reservee' sinon (partie reçue plus tard, projet inconnu). */
function statut(m, projet, partie) {
  return m.apprentissage.some(b => b.projet === projet && b.parties.includes(partie)) ? 'apprentissage' : 'reservee';
}

/* « 1:17,2:1 » -> [{ projet: 1, partie: 17 }, { projet: 2, partie: 1 }] */
function lireDesignations(texte) {
  const bonnes = String(texte).split(',').map(s => /^([1-9]\d*):([1-9]\d*)$/.exec(s.trim()));
  if (!bonnes.length || bonnes.some(x => !x)) throw Error(`--partie attend projet:partie (par exemple 1:17, ou 1:17,1:24) ; reçu « ${texte} »`);
  return bonnes.map(x => ({ projet: Number(x[1]), partie: Number(x[2]) }));
}

const nommer = d => `la partie ${d.partie} du projet ${d.projet}`;

/* Contrôle des parties reçues par un outil. Rend { reservees, avis }. Sans option de partie (liste vide), rien à contrôler. */
function controler(m, designations, { outil = 'outil', jugerReservee = false } = {}) {
  const reservees = designations.filter(d => statut(m, d.projet, d.partie) === 'reservee');
  if (!reservees.length) return { reservees: [], avis: '' };
  const liste = reservees.map(d => `${d.partie} du projet ${d.projet}`).join(', ');
  if (!jugerReservee) {
    const une = reservees.length === 1;
    throw Error(`${une ? nommer(reservees[0]) + ' est réservée' : 'les parties ' + liste + ' sont réservées'} (manifeste du ${m.date}, datasets/manifeste-parties.json). `
      + `Un outil de réglage ne ${une ? 'la' : 'les'} lit pas. Pour ${une ? 'la' : 'les'} juger sans rien régler, ajoute --juger-partie-reservee ; pour ${une ? 'la' : 'les'} faire servir à régler, il faut une décision écrite et une mise à jour du manifeste.`);
  }
  return { reservees, avis: `${outil} : partie ${liste} réservée, jugée sans réglage (--juger-partie-reservee) : aucun réglage ne doit être modifié d'après ce résultat.` };
}

module.exports = { FORMAT, CHEMIN, lire, statut, lireDesignations, controler };
