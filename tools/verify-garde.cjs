'use strict';
/*
 * verify-garde.cjs — gardes de `tools/verify.cjs` pour une machine partagée (U8 de l'audit 5.0, D-146).
 *
 *  1. Verrou « rejeu lourd ». Quand un rejeu lourd tourne, son auteur pose un fichier `lourd.lock`. `verify` refuse alors de
 *     partir (trois passages ont déjà dépassé leur délai par saturation) et le dit. Le chemin du verrou est lu dans la variable
 *     d'environnement BANANE_VERROU_LOURD ; à défaut, c'est `lourd.lock` dans le dossier qui contient le dépôt (avec des
 *     worktrees rangés côte à côte, un seul verrou sert à tous). Une variable VIDE coupe le contrôle.
 *  2. Priorité basse. `verify` baisse sa propre priorité (nice 10) ; les processus d'essai qu'il lance l'héritent. Seulement
 *     sous Linux, jamais relevée si elle est déjà plus basse, et une erreur du système n'arrête pas `verify`.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const VARIABLE = 'BANANE_VERROU_LOURD';
const NICE = 10;

class VerrouPose extends Error {}

/* Chemin du verrou, ou null si le contrôle est coupé. */
function cheminVerrou(env, racine) {
  if (env[VARIABLE] !== undefined) return env[VARIABLE] === '' ? null : env[VARIABLE];
  return path.join(path.dirname(path.resolve(racine)), 'lourd.lock');
}

/* Lève VerrouPose (message clair) si le verrou existe. */
function refuserSiVerrou(env, racine) {
  const chemin = cheminVerrou(env, racine);
  if (!chemin || !fs.existsSync(chemin)) return;
  let note = '';
  try { note = fs.readFileSync(chemin, 'utf8').trim().split('\n')[0].slice(0, 200); } catch { /* le verrou existe, son contenu est facultatif */ }
  throw new VerrouPose(`verify ne part pas : un rejeu lourd est en cours, le verrou ${chemin} est posé${note ? ` (« ${note} »)` : ''}.\n`
    + `Attends qu'il ait disparu, puis relance. Pour lire le verrou ailleurs, donne son chemin dans ${VARIABLE} ; une valeur vide coupe ce contrôle.`);
}

/* Baisse la priorité du processus courant. Rend la priorité obtenue, ou null si rien n'a été fait. */
function baisserPriorite(systeme = os, plateforme = process.platform, valeur = NICE) {
  if (plateforme !== 'linux') return null;
  try {
    const actuelle = systeme.getPriority(0);
    if (actuelle >= valeur) return actuelle;
    systeme.setPriority(0, valeur);
    return valeur;
  } catch { return null; }
}

module.exports = { VARIABLE, NICE, VerrouPose, cheminVerrou, refuserSiVerrou, baisserPriorite };
