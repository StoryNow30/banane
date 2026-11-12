#!/usr/bin/env node
'use strict';
/* CH-116 : corpus jugé commun (D-351). Hors ligne, lecture seule.
 *   CH116_TRAVAIL=… node chantiers/CH-116/outils/corpus.cjs [--rejeu livre] [--lots …] [--sortie DOSSIER]
 * Entrées : le rejeu du code livré (banc.cjs rejouer --nom livre : sort réel du lot, zone, nuage) et la jointure Écho ↔ journal
 * (preparer.cjs, tools/jointure-echo-orbite.cjs, visites sans action retenues à 1,5 s). Une ligne par cut posé ou différé par le lot.
 * Sorties : DOSSIER/corpus.jsonl (numéros et millimètres seulement) et DOSSIER/resume.md (chiffres par lot).
 *
 * Pose finale de l'opérateur, en décalages (mm, [longitudinal, latéral, vertical]) dans le repère profil de la pose de départ d'ESV,
 * le même que celui des poses du banc :
 *  - cut que l'Écho a trouvé posé par Ariane (base « ariane ») : déplacement d'Ariane depuis le départ + écart humain (jointure) ;
 *  - cut que l'Écho a trouvé à la pose de départ (base « première visite ») : écart humain ; écartement du départ de l'Écho égal à
 *    celui du lot à 2 mm près (sinon « depart-different »).
 * Écartés (D-285 et prudence) : validation sans mouvement en moins de 1,5 s, visite sans action de moins de 1,5 s (jugées, classe
 * et pose finale données, mais `exclu` « d285-… » : le banc les ignore sauf `--avec-courtes`) ; visite sans action de moins de 0,8 s ; SKIP
 * de l'opérateur ; repère de scène non calibré (contrôle > 2 mm). Classes : juste ≤ 10 mm, 10-50, mauvaise-voie > 50 (pire rail, 3D,
 * pose du lot contre pose finale) ; différé : differe-corrige (pose finale à plus de 10 mm du départ) ou differe-juste. */
const fs = require('node:fs'), path = require('node:path');
const RACINE = path.join(__dirname, '..', '..', '..');
const { LOTS, SANS_ECHO, cle, travail } = require('./lots.cjs');
const P = require(path.join(RACINE, 'tools', 'gcv2-predire-differes.cjs'));
const SIDES = ['left', 'right'], COTE = { left: 'gauche', right: 'droite' };
const r1 = v => Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100;
const norme = v => Math.hypot(v[0], v[1], v[2]);
const moins = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const vec = h => h && [h.longitudinalMm, h.lateralMm, h.verticalMm].every(Number.isFinite) ? [h.longitudinalMm, h.lateralMm, h.verticalMm] : null;
const lireJsonl = f => fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(s => JSON.parse(s));

function args(a) {
  const o = { rejeu: 'livre', lots: null, sortie: path.join(__dirname, '..', 'sorties') };
  for (let i = 0; i < a.length; i++) {
    const k = a[i], v = () => a[++i];
    if (k === '--rejeu') o.rejeu = v(); else if (k === '--lots') o.lots = v().split(','); else if (k === '--sortie') o.sortie = v(); else throw Error('option inconnue ' + k);
  }
  return o;
}
/* Écart pire rail entre deux poses (décalages) : 3D, et latéral / vertical du rail le pire (signés, b − a). */
function ecart(a, b) {
  let best = null;
  for (const s of SIDES) { const d = moins(b[s], a[s]), n = norme(d); if (!best || n > best.pire3d) best = { pire3d: r1(n), lat: r1(d[1]), vert: r1(d[2]), rail: s }; }
  return best;
}
const ZERO = { left: [0, 0, 0], right: [0, 0, 0] };

function lignesDe(e, o) {
  const k = cle(e), fr = path.join(travail(), 'rejeux', o.rejeu, k + '.jsonl'), fj = path.join(travail(), 'j', k + '.json');
  if (!fs.existsSync(fr) || !fs.existsSync(fj)) return null;
  const R = lireJsonl(fr).filter(x => x.type === 'cut'), T = JSON.parse(fs.readFileSync(fj, 'utf8')).table.filter(x => x.partie === e.partie);
  const parCut = new Map(T.map(x => [x.cut, x]));
  /* Départ de l'Écho pour les cuts trouvés à la pose de départ : écartement (contrôle « même départ que le lot »). */
  const aControler = R.filter(l => { const j = parCut.get(l.cut); return j && j.base === 'premiere-visite'; }).map(l => l.cut);
  const mic = aControler.length ? P.micDepuisEcho(e.echo, e.partie, aControler) : new Map();
  return R.map((l, ordre) => {
    const j = parCut.get(l.cut), re = l.reel || {};
    const x = (l.profils || {})['L1-se'] || {};
    const c = { lot: e.lot, partie: e.partie, rang: e.rang, cut: l.cut, ordre, examen: !!e.examen, zone: l.zone || null,
      chemin: { etage: re.etage || null, motif: re.motif || null, rejeu: x.etage || x.source || null },
      sortLot: re.pose ? 'pose' : 'differe', capture: !!(l.nuage && l.points > 0), points: l.points ?? null, ecartementDepartMm: l.ecartDepartMm ?? null,
      poseAriane: re.pose ? re.decal || null : null, poseFinale: null, ref: null, etiquette: j ? j.etiquetteEcho || null : null,
      dureeVisiteS: j ? (j.dureeVisiteS ?? (j.visiteSansAction ? j.visiteSansAction.dwellMaxS : null)) : null,
      ecart: null, classe: 'non-juge', exclu: null, poseApresLot: false };
    const exclure = r => { c.exclu = r; return c; };
    if (!j || !j.dansEcho) return exclure('absent-de-l-echo');
    if (j.referenceHumaine !== 'observee') return exclure(j.referenceHumaine === 'sans-reference' && j.visiteSansAction ? 'visite-' + j.visiteSansAction.raison : String(j.referenceHumaine));
    if (j.etiquetteEcho === 'SKIP') return exclure('skip-operateur');
    const validation = /^VALIDATE_|^AMBIGUOUS/.test(j.etiquetteEcho || '');
    c.ref = validation ? 'validation' : 'visite-sans-action';
    /* D-285 : validation sans mouvement en moins de 1,5 s, et (prudence) visite sans action de moins de 1,5 s : jugées mais marquées écartées. */
    const d285 = j.etiquetteEcho === 'VALIDATE_NO_MOVEMENT' && !(j.dureeVisiteS >= 1.5) ? 'd285-sans-mouvement-court'
      : !validation && !(c.dureeVisiteS >= 1.5) ? 'd285-visite-courte' : null;
    const eh = j.ecartHumain && Object.fromEntries(SIDES.map(s => [s, vec(j.ecartHumain[COTE[s]])]));
    if (!eh || !SIDES.every(s => eh[s])) return exclure('ecart-humain-incomplet');
    if (j.base === 'ariane') {
      if (Number.isFinite(j.controleRepereMm) && j.controleRepereMm > 2) return exclure('repere-non-calibre');
      const ad = j.arianeDeplacement && Object.fromEntries(SIDES.map(s => [s, vec(j.arianeDeplacement[COTE[s]])]));
      if (!ad || !SIDES.every(s => ad[s])) return exclure('pose-ariane-sans-repere');
      c.poseFinale = Object.fromEntries(SIDES.map(s => [s, ad[s].map((v, i) => r2(v + eh[s][i]))]));
      if (re.pose && re.decal) { const d = ecart(re.decal, ad); if (d.pire3d > 1) c.poseApresLot = true; }
      if (!re.pose) c.poseApresLot = true;
    } else if (j.base === 'premiere-visite') {
      const m = mic.get(l.cut);
      if (!m || !Number.isFinite(m.ecartDepartMm) || !Number.isFinite(l.ecartDepartMm) || Math.abs(m.ecartDepartMm - l.ecartDepartMm) > 2) return exclure('depart-different');
      c.poseFinale = Object.fromEntries(SIDES.map(s => [s, eh[s].map(r2)]));
      if (re.pose) return exclure('pose-du-lot-absente-de-l-echo');
    } else return exclure('base-' + j.base);
    if (re.pose) {
      if (!re.decal) return exclure('pose-du-lot-sans-decalage');
      c.ecart = ecart(re.decal, c.poseFinale);
      c.classe = c.ecart.pire3d <= 10 ? 'juste' : c.ecart.pire3d <= 50 ? '10-50' : 'mauvaise-voie';
    } else {
      c.ecart = ecart(ZERO, c.poseFinale);
      c.classe = c.ecart.pire3d > 10 ? 'differe-corrige' : 'differe-juste';
    }
    if (d285) c.exclu = d285;
    return c;
  });
}

function resume(parLot, absents) {
  const L = ['# CH-116 : corpus jugé, résumé par lot (ÉTABLI, mesuré par `chantiers/CH-116/outils/corpus.cjs`)', '',
    'Une ligne par cut posé ou différé par le lot ; vérité = pose finale de l\'opérateur à l\'Écho (jointure). Classes : juste ≤ 10 mm, 10-50, mauvaise voie > 50 (pire rail, 3D).', '',
    '| lot | parties | cuts | posés | différés | capture | posés jugés | juste | 10-50 | mauvaise voie | différés jugés | corrigés | justes | écartés D-285 | autres non jugés |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|'];
  const tot = {}; const add = (t, k, v = 1) => { t[k] = (t[k] || 0) + v; };
  const ex = {};
  for (const [lot, ls] of Object.entries(parLot)) {
    const t = {}; for (const c of ls) {
      add(t, 'cuts'); add(t, c.sortLot); if (c.capture) add(t, 'capture'); if (!c.exclu) add(t, c.classe); else if (/^d285-/.test(c.exclu)) add(t, 'd285');
      if (c.exclu) { add(t, 'exclus'); add(ex, c.exclu); }
      if (c.sortLot === 'pose' && c.poseFinale && !c.exclu) add(t, 'posesJuges'); if (c.sortLot === 'differe' && c.poseFinale && !c.exclu) add(t, 'diffJuges');
    }
    for (const [k, v] of Object.entries(t)) add(tot, k, v);
    const parties = [...new Set(ls.map(c => c.partie + (ls.some(d => d.partie === c.partie && d.rang !== c.rang) ? '.' + c.rang : '')))].join(', ');
    const g = (t, k) => t[k] || 0;
    L.push(`| ${lot}${ls[0].examen ? ' (examen)' : ''} | ${parties} | ${g(t, 'cuts')} | ${g(t, 'pose')} | ${g(t, 'differe')} | ${g(t, 'capture')} | ${g(t, 'posesJuges')} | ${g(t, 'juste')} | ${g(t, '10-50')} | ${g(t, 'mauvaise-voie')} | ${g(t, 'diffJuges')} | ${g(t, 'differe-corrige')} | ${g(t, 'differe-juste')} | ${g(t, 'd285')} | ${g(t, 'exclus') - g(t, 'd285')} |`);
  }
  const g = k => tot[k] || 0;
  L.push(`| **total** | | ${g('cuts')} | ${g('pose')} | ${g('differe')} | ${g('capture')} | ${g('posesJuges')} | ${g('juste')} | ${g('10-50')} | ${g('mauvaise-voie')} | ${g('diffJuges')} | ${g('differe-corrige')} | ${g('differe-juste')} | ${g('d285')} | ${g('exclus') - g('d285')} |`);
  L.push('', 'Motifs d\'exclusion (non jugés) : ' + Object.entries(ex).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' ; '));
  const mv = Object.values(parLot).flat().filter(c => c.classe === 'mauvaise-voie' && !c.exclu);
  if (mv.length) L.push('', 'Mauvaises voies (lot partie/cut mm zone) : ' + mv.map(c => `${c.lot} ${c.partie}/${c.cut} ${c.ecart.pire3d} ${c.zone}`).join(' ; '));
  const apres = Object.values(parLot).flat().filter(c => c.poseApresLot && !c.exclu);
  L.push('', `Cuts jugés dont la pose vue par l'Écho n'est pas celle du lot (relecture ou deuxième passe passées après) : ${apres.length} ; la classe juge toujours la pose DU LOT.`);
  if (absents.length) L.push('', 'Lots-parties sans rejeu ou sans jointure (non préparés) : ' + absents.join(', '));
  L.push('', 'Lots exportés sans Écho joignable (hors corpus) : ' + SANS_ECHO.map(s => `${s.lot} parties ${s.parties.join(', ')}`).join(' ; ') + '.');
  return L.join('\n') + '\n';
}

function main() {
  const o = args(process.argv.slice(2)), parLot = {}, absents = [];
  fs.mkdirSync(o.sortie, { recursive: true });
  const out = [];
  for (const e of LOTS) {
    if (o.lots && !o.lots.includes(e.lot)) continue;
    const ls = lignesDe(e, o); if (!ls) { absents.push(cle(e)); continue; }
    (parLot[e.lot] = parLot[e.lot] || []).push(...ls); out.push(...ls);
    process.stdout.write(`${cle(e)} : ${ls.length} cuts, ${ls.filter(c => !c.exclu && c.poseFinale).length} jugés\n`);
  }
  fs.writeFileSync(path.join(o.sortie, 'corpus.jsonl'), out.map(c => JSON.stringify(c)).join('\n') + '\n');
  const md = resume(parLot, absents); fs.writeFileSync(path.join(o.sortie, 'resume.md'), md); process.stdout.write('\n' + md);
}
if (require.main === module) { try { main(); } catch (e) { process.stderr.write('corpus : ' + e.message + '\n' + e.stack + '\n'); process.exitCode = 1; } }
module.exports = { lignesDe, ecart };
