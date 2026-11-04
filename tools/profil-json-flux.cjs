#!/usr/bin/env node
'use strict';
/*
 * profil-json-flux.cjs — CH-049-C. Pèse un JSON énorme (plusieurs centaines de Mo, plus que la chaîne maximale de Node) en UN
 * passage, sans le charger : mémoire bornée par la profondeur demandée et par la taille du plus gros élément extrait. Sert à
 * trouver où est le poids d'un fichier de trajectoire brute (`traj_raw`) avant d'en tirer des leviers.
 *
 *   node tools/profil-json-flux.cjs FICHIER.json[.gz]|- [--profondeur 4] [--haut 40]
 *        [--extraire '$.traj[]' [--pas 1000] [--max 20] [--sortie echantillon.ndjson]]
 *
 *  - Profil : pour chaque chemin ($ racine, .clé, [] élément de tableau) jusqu'à --profondeur : nombre de valeurs, octets
 *    (sérialisation compacte : les espaces et retours à la ligne ne comptent pas), part du fichier, octets moyens.
 *    Les tableaux sont repliés : $.traj[].p[] = tous les éléments de tous les « p » des éléments de « traj ».
 *  - Échantillon : --extraire CHEMIN écrit, une ligne JSON par élément, un élément sur --pas (le 0, le pas, 2 pas…), au plus
 *    --max, en lisant TOUT le fichier une seule fois (le profil est calculé en même temps). Chemin d'un élément de tableau : '[]'.
 *  - `-` lit l'entrée standard ; pour un zip : `unzip -p volume.zip fichier.json | node tools/profil-json-flux.cjs -`.
 *  - Un JSON invalide (accolade ou crochet mal fermé, fin de fichier prématurée) est refusé avec le décalage de l'erreur.
 * Lecture seule, aucune dépendance, déterministe.
 */
const fs = require('node:fs'), zlib = require('node:zlib');

const WS = new Uint8Array(256); WS[0x20] = WS[0x09] = WS[0x0a] = WS[0x0d] = 1;
const QUOTE = 0x22, BSLASH = 0x5c, LBRACE = 0x7b, RBRACE = 0x7d, LBRACK = 0x5b, RBRACK = 0x5d, COMMA = 0x2c, COLON = 0x3a;
const MAX_CHEMINS = 20000;

class OctetsTampon {   // tampon extensible pour l'élément en cours d'extraction
  constructor() { this.b = Buffer.allocUnsafe(1024); this.n = 0; }
  push(x) { if (this.n === this.b.length) { const c = Buffer.allocUnsafe(this.b.length * 2); this.b.copy(c); this.b = c; } this.b[this.n++] = x; }
  texte() { return this.b.toString('utf8', 0, this.n); }
}

class Profil {
  constructor(opt = {}) {
    this.profondeur = Number.isInteger(opt.profondeur) ? opt.profondeur : 4;
    this.extraire = opt.extraire || null;
    this.pas = Math.max(1, opt.pas || 1); this.max = opt.max || 20;
    this.profExtraction = this.extraire ? (this.extraire.match(/\.[^.\[\]]+|\[\]/g) || []).length : -1;
    this.profMax = Math.max(this.profondeur, this.profExtraction);
    this.chemins = Object.create(null); this.octetsLus = 0; this.sig = 0;
    this.echantillon = []; this.onEchantillon = opt.onEchantillon || null;
    this.pile = []; this.dansChaine = false; this.echap = false; this.chaineCle = false; this.cleOctets = [];
    this.scalaire = null;   // { chemin, sig0 } pour un nombre / littéral en cours
    this.attendValeur = true; this.fini = false; this.cap = null; this.nExtraits = 0; this.valeurChaine = null;
  }
  erreur(msg) { return new Error(`JSON invalide à l'octet ${this.octetsLus} : ${msg}`); }
  note(chemin, octets) {
    let e = this.chemins[chemin];
    if (!e) { if (Object.keys(this.chemins).length >= MAX_CHEMINS) { chemin = '(autres chemins)'; e = this.chemins[chemin]; } if (!e) e = this.chemins[chemin] = { n: 0, octets: 0 }; }
    e.n++; e.octets += octets;
  }
  /* Chemin de la valeur qui commence, ou null au-delà de la profondeur utile. */
  cheminCourant() {
    const d = this.pile.length;
    if (d > this.profMax) return null;
    if (d === 0) return '$';
    const p = this.pile[d - 1];
    if (p.chemin === null) return null;
    if (p.tab) return p.chemin + '[]';
    return p.chemin + '.' + p.cle;
  }
  debutValeur() {
    const p = this.pile.length ? this.pile[this.pile.length - 1] : null;
    const idx = p && p.tab ? p.n++ : 0;
    const chemin = this.cheminCourant();
    if (this.extraire && chemin === this.extraire && idx % this.pas === 0 && this.nExtraits < this.max && !this.cap) { this.cap = { depth: this.pile.length, buf: new OctetsTampon() }; this.nExtraits++; }
    this.attendValeur = false;
    return chemin;
  }
  finValeur(chemin, sig0) {
    if (chemin !== null && this.pile.length <= this.profondeur) this.note(chemin, this.sig - sig0);
  }
  clore(octetsProfondeur) {   // fin d'une valeur de profondeur donnée : termine l'extraction éventuelle
    if (this.cap && this.cap.depth === octetsProfondeur) {
      const t = this.cap.buf.texte(); this.cap = null;
      if (this.onEchantillon) this.onEchantillon(t); else this.echantillon.push(t);
    }
  }
  ecrire(buf) {
    const n = buf.length;
    for (let i = 0; i < n; i++, this.octetsLus++) {
      const c = buf[i];
      if (this.dansChaine) {
        this.sig++; if (this.cap) this.cap.buf.push(c);
        if (this.echap) { this.echap = false; if (this.chaineCle && this.cleOctets.length < 200) this.cleOctets.push(c); continue; }
        if (c === BSLASH) { this.echap = true; if (this.chaineCle && this.cleOctets.length < 200) this.cleOctets.push(c); continue; }
        if (c === QUOTE) {
          this.dansChaine = false;
          if (this.chaineCle) { this.pile[this.pile.length - 1].cle = Buffer.from(this.cleOctets).toString('utf8'); this.chaineCle = false; }
          else if (this.valeurChaine) { const v = this.valeurChaine; this.valeurChaine = null; this.finValeur(v.chemin, v.sig0); this.clore(this.pile.length); }
        } else if (this.chaineCle && this.cleOctets.length < 200) this.cleOctets.push(c);
        continue;
      }
      if (WS[c]) {
        if (this.scalaire) this.finScalaire();
        continue;
      }
      if (this.fini) throw this.erreur('contenu après la fin du document');
      /* Octet significatif. */
      if (this.scalaire && (c === COMMA || c === RBRACE || c === RBRACK)) this.finScalaire();
      if (this.scalaire) {   // suite d'un nombre ou d'un littéral
        if (c === QUOTE || c === LBRACE || c === LBRACK || c === COLON) throw this.erreur('caractère inattendu dans une valeur');
        this.sig++; if (this.cap) this.cap.buf.push(c); continue;
      }
      if (c === QUOTE) {
        const top = this.pile.length ? this.pile[this.pile.length - 1] : null;
        if (top && !top.tab && top.attendCle) {   // clé d'objet
          top.attendCle = false; this.chaineCle = true; this.cleOctets.length = 0;
          this.sig++; if (this.cap) this.cap.buf.push(c); this.dansChaine = true; continue;
        }
        if (!this.attendValeur) throw this.erreur('chaîne inattendue');
        const sig0 = this.sig;
        const chemin = this.debutValeur();
        this.valeurChaine = { chemin, sig0 };
        this.sig++; if (this.cap) this.cap.buf.push(c); this.dansChaine = true; continue;
      }
      if (c === LBRACE || c === LBRACK) {
        if (!this.attendValeur) throw this.erreur('conteneur inattendu');
        const sig0 = this.sig, chemin = this.debutValeur();
        this.sig++; if (this.cap) this.cap.buf.push(c);
        this.pile.push({ tab: c === LBRACK, chemin, sig0, cle: null, n: 0, attendCle: c === LBRACE, vide: true });
        this.attendValeur = c === LBRACK; continue;
      }
      if (c === RBRACE || c === RBRACK) {
        const top = this.pile.length ? this.pile[this.pile.length - 1] : null;
        if (!top || top.tab !== (c === RBRACK)) throw this.erreur('fermeture inattendue');
        if ((top.attendCle || (top.tab && this.attendValeur)) && !top.vide) throw this.erreur('virgule finale');
        if (!top.tab && !top.attendCle && this.attendValeur) throw this.erreur('valeur manquante');
        this.sig++; if (this.cap) this.cap.buf.push(c);
        this.pile.pop();
        this.finValeur(top.chemin, top.sig0);
        this.clore(this.pile.length);
        this.attendValeur = false;
        if (!this.pile.length) this.fini = true;
        continue;
      }
      if (c === COMMA) {
        const top = this.pile.length ? this.pile[this.pile.length - 1] : null;
        if (!top || this.attendValeur) throw this.erreur('virgule inattendue');
        this.sig++; if (this.cap) this.cap.buf.push(c);
        top.vide = false;
        if (top.tab) this.attendValeur = true; else top.attendCle = true;
        continue;
      }
      if (c === COLON) {
        const top = this.pile.length ? this.pile[this.pile.length - 1] : null;
        if (!top || top.tab || top.attendCle || this.attendValeur) throw this.erreur('deux-points inattendu');
        this.sig++; if (this.cap) this.cap.buf.push(c);
        this.attendValeur = true; top.vide = false; continue;
      }
      /* Nombre ou littéral. */
      if (!this.attendValeur) throw this.erreur('valeur inattendue');
      const sig0 = this.sig, chemin = this.debutValeur();
      this.scalaire = { chemin, sig0 };
      this.sig++; if (this.cap) this.cap.buf.push(c);
    }
  }
  finScalaire() {
    const s = this.scalaire; this.scalaire = null;
    this.finValeur(s.chemin, s.sig0); this.clore(this.pile.length);
    if (!this.pile.length) this.fini = true;
  }
  fin() {
    if (this.scalaire) this.finScalaire();
    if (this.dansChaine || this.pile.length || !this.fini) throw this.erreur('document incomplet');
    return { chemins: this.chemins, octetsLus: this.octetsLus, octetsSignificatifs: this.sig, echantillon: this.echantillon };
  }
}
/* Interface en mémoire (essais) : `blocs` est un itérable de Buffer. */
function profiler(blocs, opt = {}) {
  const p = new Profil(opt);
  for (const b of blocs) p.ecrire(b);
  return p.fin();
}

function tableau(res, opt) {
  const total = res.octetsSignificatifs || 1;
  const rows = Object.entries(res.chemins).sort((a, b) => b[1].octets - a[1].octets).slice(0, opt.haut || 40);
  const lignes = rows.map(([c, v]) => `${c.padEnd(48)} ${String(v.n).padStart(12)} ${String(v.octets).padStart(14)} ${(v.octets / total * 100).toFixed(1).padStart(6)} % ${(v.octets / v.n).toFixed(1).padStart(10)}`);
  return [`${'chemin'.padEnd(48)} ${'valeurs'.padStart(12)} ${'octets'.padStart(14)} ${'part'.padStart(8)} ${'moyenne'.padStart(10)}`, ...lignes].join('\n');
}

function main() {
  const argv = process.argv.slice(2);
  const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
  const fichier = argv.find((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--')));
  if (!fichier) { console.error('Usage : FICHIER.json[.gz]|- [--profondeur 4] [--haut 40] [--extraire CHEMIN [--pas N] [--max N] [--sortie f.ndjson]]'); process.exit(1); }
  const sortie = opt('--sortie');
  const fd = sortie ? fs.openSync(sortie, 'w') : null;
  const p = new Profil({
    profondeur: Number(opt('--profondeur', 4)), extraire: opt('--extraire'), pas: Number(opt('--pas', 1)), max: Number(opt('--max', 20)),
    onEchantillon: t => { if (fd !== null) fs.writeSync(fd, t + '\n'); else console.log(t); },
  });
  let src = fichier === '-' ? process.stdin : fs.createReadStream(fichier, { highWaterMark: 4 << 20 });
  if (/\.gz$/i.test(fichier)) src = src.pipe(zlib.createGunzip());
  const t0 = Date.now();
  src.on('data', b => { try { p.ecrire(b); } catch (e) { console.error(e.message); process.exit(2); } });
  src.on('error', e => { console.error(e.message); process.exit(1); });
  src.on('end', () => {
    let r; try { r = p.fin(); } catch (e) { console.error(e.message); process.exit(2); }
    if (fd !== null) fs.closeSync(fd);
    console.log(`lu : ${(r.octetsLus / 1e6).toFixed(1)} Mo en ${((Date.now() - t0) / 1000).toFixed(1)} s ; octets significatifs ${r.octetsSignificatifs} ; chemins ${Object.keys(r.chemins).length} ; mémoire résidente de pointe ${(process.memoryUsage().rss / 1e6).toFixed(0)} Mo`);
    console.log(tableau(r, { haut: Number(opt('--haut', 40)) }));
    if (opt('--extraire')) console.log(`échantillon : ${p.nExtraits} élément(s) ${fd !== null ? 'écrits dans ' + sortie : 'ci-dessus'}`);
  });
}
if (require.main === module) main();
module.exports = { Profil, profiler, tableau };
