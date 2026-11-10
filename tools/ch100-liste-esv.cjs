#!/usr/bin/env node
'use strict';
/*
 * ch100-liste-esv.cjs — CH-100, mesure 3 : COUVERTURE DE LA LISTE D'ESV AUTOUR DES FAUTES ET DES DIFFÉRÉS JUGÉS.
 * Un comptage, aucun module. Hors ligne, lecture seule : aucune écriture dans ESV, aucun fichier d'export modifié.
 *
 *   node tools/ch100-liste-esv.cjs --nom <étiquette> --lot <dossier-du-lot> --echo <dossier>... [--partie N]... --sortie <dossier>
 *   node tools/ch100-liste-esv.cjs --bilan <dossier>          (relit les <étiquette>.json du dossier et rend les tableaux)
 *
 * QUESTION. Autour de chaque faute et de chaque différé jugé, la liste d'ESV offre-t-elle des cuts « sains » des deux côtés, assez près
 * pour servir de référence indépendante de la chaîne du lot ?
 *
 * OÙ EST LA LISTE. Un fichier à part des zips, `ariane-liste-partieN-<heure>Z.json` (src/liste-memoire.js) : une ligne par cut (indice =
 * numéro de cut), statut (valid, invalid, skipped), drapeaux (traité, vu par l'opérateur), six bords. C'est la table que la page tient en
 * mémoire (liste chargée par ESV, puis écritures de la page appliquées), relevée au début d'une séance sur la partie ; `at` est l'heure du
 * résumé `list-summary` du journal qui la déclenche. UN SEUL instantané par partie est gardé : le dernier. Le journal ne porte par ailleurs
 * que des comptes (fiches de départ, `list-summary`, `list-page`, `audit-serveur`) et les écritures ligne à ligne (`esv-observation`, write).
 *
 * DÉFINITIONS, ÉCRITES AVANT DE COMPTER (ne pas les changer après avoir vu un résultat).
 *  - cible, posé, différé, exécution : ceux de tools/juger-lot.cjs (dernière exécution de la partie dans le journal).
 *  - FAUTE : posé du lot jugé à plus de 50 mm, pire rail, 3D, par tools/juge-poses-faux.cjs (état « valide », source « lot »). Les écrits de
 *    la deuxième passe à plus de 50 mm sont comptés À PART (« faute-passe »), jamais additionnés.
 *  - DIFFÉRÉ JUGÉ : cible de l'exécution non posée pendant le lot, vue par l'Écho, référence humaine observée, validation de l'opérateur
 *    (étiquette VALIDATE…), hors « visité sans action ». mm = écart entre la pose vue à la première visite et la validation.
 *  - HEURE DE LA DÉCISION d'un cut : premier `gcv1-shadow-observed` du cut dans les lots de l'exécution (il précède l'écriture).
 *  - CUT SAIN, deux définitions comptées toutes les deux :
 *      D1 (CH-033, protocole § 4) : ligne de statut « valid » dans l'instantané, six bords présents, qui n'est pas une cible de l'exécution et
 *         qu'AUCUNE écriture du journal n'a touchée (toute écriture observée de la même liste, y compris « vu », à toute heure) ;
 *      D2 (lettre du ticket) : ligne de statut « valid », six bords présents, pas cible de l'exécution, pas posée par Ariane dans
 *         l'exécution (ni par le lot, ni par la deuxième passe).
 *    Les écritures sont rattachées à la liste par l'empreinte du préfixe de leur identifiant (égale à `cle` de l'instantané) ; une écriture
 *    sans identifiant compte pour toutes les parties (prudence).
 *  - PREUVE D'ANTÉRIORITÉ (N1, la seule qui retient un cut) : il existe un instantané de la partie dont `at` + 10 s est antérieur ou égal à
 *    l'heure de la décision du cut (10 s : la table est demandée à la page juste après `at`, délai borné à 4 s). On prend le plus récent de
 *    ceux-là. Sinon le cut est EXCLU et COMPTÉ, avec son motif : « aucun-instantane », « instantane-posterieur », « sans-heure-de-decision ».
 *  - VARIANTE RECONSTITUÉE (N2, donnée à part, ne retient aucun cut de plus dans le verdict) : pour un cut exclu « instantane-posterieur »,
 *    distances D1 et D2 dans le premier instantané postérieur. Une ligne « valid » jamais écrite au journal (D1), ou ni cible ni posée par
 *    Ariane (D2), y était valide avant le lot SI aucune écriture n'a échappé au journal (autre poste, autre onglet) : ce n'est pas une
 *    preuve par l'horodatage de l'instantané. La colonne D2 de N2 et les deux contrôles ci-dessous ont été ajoutés après le premier
 *    passage (N2 ne portait que D1) ; N1, les deux définitions, les portées et le seuil n'ont pas bougé.
 *  - DEUX CONTRÔLES de la reconstitution, par partie (ils ne retiennent aucun cut) :
 *      fiche de départ : le nombre de cuts sains D2 de l'instantané est-il égal au nombre de « validés » de la fiche de départ du lot
 *        (compte de la liste chargée, daté du départ, donc antérieur à toute décision) ?
 *      fenêtre de décision : `b1-ombre` relève à chaque décision les 5 lignes de chaque côté du cut dans la table de la page (comptes
 *        seulement). Pour chaque cible relevée (appariement exact), les sains D2 de l'instantané dans cette fenêtre doivent être au plus
 *        « valid − fraîches » du relevé ; un dépassement réfute la reconstitution pour ce cut.
 *    L'écart entre D1 et D2 est décrit : lignes saines en D2 et pas en D1, selon que l'écriture qui les a touchées ne porte que « vu »
 *    (ni statut ni bords : la pose de la ligne n'a pas changé) ou porte un statut ou des bords.
 *  - DISTANCE : différence de numéro de ligne entre le cut et le premier cut sain de chaque côté (avant = numéros plus petits), cherchée
 *    jusqu'au bout de la liste ; vide = aucun cut sain de ce côté.
 *  - COUVERT à K cuts (K = 15 et 27, portée de CH-033 § 3) : « un côté » = le plus proche des deux est à K au plus ; « deux côtés » = les
 *    deux existent et le plus lointain est à K au plus. Intervalle de Wilson à 95 %.
 *  - SEUIL, ÉCRIT AVANT : moins de la moitié des FAUTES couvertes des deux côtés à 27 cuts = piste close. Le verdict est rendu sur les fautes
 *    retenues (preuve N1), en D1 puis en D2 ; il est aussi donné sur toutes les fautes (exclues comptées non couvertes). Aucune faute retenue
 *    = « non mesurable au seuil ».
 *
 * SORTIES : <étiquette>.csv et <étiquette>.json (une ligne par cut : partie, cut, population, mm, distances, exclu et motif) ; rien d'autre
 * que des numéros de cut, des millimètres, des comptes et des heures : ni identifiant, ni coordonnée, ni extrait de journal.
 */
const fs = require('node:fs'), path = require('node:path');
const L = require('./juger-lot.cjs');
const JP = require('./juge-poses-faux.cjs');
const Poses = require('./precision-poses.cjs');
const Lots = require('./exports-lots.cjs');
const LM = require('../src/liste-memoire.js');

const FORMAT = 'ariane-ch100-liste-esv-v1';
const MARGE_S = 10, PORTEES = [15, 27], SEUIL_PART = 0.5, SEUIL_PORTEE = 27;
const fini = v => Number.isFinite(v);
const instant = e => { const t = Date.parse(e && e.timestamp || ''); return fini(t) ? t : null; };
const iso = t => fini(t) ? new Date(t).toISOString().replace(/\.\d+Z$/, 'Z') : null;
const arr = (v, d = 2) => fini(v) ? Math.round(v * 10 ** d) / 10 ** d : null;

/* Tous les instantanés de liste des dossiers (lot et Écho), dédoublonnés par partie, heure et signature. */
function lireInstantanes(dossiers) {
  const vus = new Map();
  for (const dir of dossiers) for (const a of Lots.archives(dir)) {
    if (a.type !== 'zip') continue;
    let noms; try { noms = Lots.nomsZip(a.chemin); } catch { continue; }
    if (!noms.some(n => Lots.MOTIF_LISTE.test(n))) continue;
    for (const e of Lots.entreesArchive(a)) {
      if (!Lots.MOTIF_LISTE.test(e.nom)) continue;
      const snap = JSON.parse(e.lire().toString('utf8')), dec = LM.decompacter(snap);
      if (!dec || !Number.isInteger(snap.partie) || !fini(Date.parse(snap.at))) continue;
      const k = `${snap.partie}|${snap.at}|${snap.sig}`;
      if (!vus.has(k)) vus.set(k, { partie: snap.partie, at: Date.parse(snap.at), cle: snap.cle || null, dec, archives: 0 });
      vus.get(k).archives++;
    }
  }
  return [...vus.values()].sort((a, b) => a.partie - b.partie || a.at - b.at);
}
const avecBords = (dec, i) => { for (let j = 0; j < 6; j++) if (!fini(dec.ed[6 * i + j])) return false; return true; };

/* Lignes écrites au journal, par empreinte de liste (cut → première heure d'écriture) ; `sansCle` : écritures sans identifiant. */
function ecrituresDuJournal(journal) {
  const parCle = new Map(), sansCle = new Set(), avecPose = new Map();
  for (const e of journal.events) {
    if (e.type !== 'esv-observation' || e.kind !== 'write' || !Number.isInteger(e.rowIndex)) continue;
    const id = typeof e.railPairId === 'string' ? e.railPairId : '', k = id.lastIndexOf('/');
    if (k <= 0) { sansCle.add(e.rowIndex); continue; }
    const cle = LM.empreinte(id.slice(0, k));
    if (!parCle.has(cle)) { parCle.set(cle, new Set()); avecPose.set(cle, new Set()); }
    parCle.get(cle).add(e.rowIndex);
    /* Écriture qui porte autre chose que « vu » (statut, bords…) : la pose ou l'état de la ligne a pu changer. */
    if (!e.body || Object.keys(e.body).some(k => k !== 'SeenByOperator')) avecPose.get(cle).add(e.rowIndex);
  }
  return { parCle, sansCle, avecPose };
}

function distances(sains, cut, n) {
  let av = null, ap = null;
  for (let i = cut - 1; i >= 0; i--) if (sains.has(i)) { av = cut - i; break; }
  for (let i = cut + 1; i < n; i++) if (sains.has(i)) { ap = i - cut; break; }
  return { av, ap };
}

function mesurerPartie({ journal, echo, partie, instantanes, ecritures, jugement }) {
  const run = L.lotsDe(journal, partie);
  if (!run) return null;
  const { cibles, poses } = L.ciblesPosesDe(run, partie);
  const batchs = new Set(run.lots.map(l => l.B));
  const decision = new Map(), ecritsPasse = new Set();
  for (const e of run.ev) {
    if (!e.identity || e.identity.part !== partie || !Number.isInteger(e.identity.cut)) continue;
    if (e.type === 'gcv1-shadow-observed' && batchs.has(e.batchId)) { const t = instant(e), c = e.identity.cut; if (!decision.has(c) || t < decision.get(c)) decision.set(c, t); }
    if (e.type === 'passe-differes-ecriture' && e.resultat === 'ecrit' && (e.batchId ? batchs.has(e.batchId) : instant(e) >= run.t0)) ecritsPasse.add(e.identity.cut);
  }
  const debut = run.t0, fin = Math.max(...run.lots.map(l => fini(l.fin) ? l.fin : 0)) || null;
  const resumes = new Set(journal.events.filter(e => e.type === 'esv-observation' && e.kind === 'list-summary').map(e => e.timestamp));
  const snaps = instantanes.filter(s => s.partie === partie);
  /* Ensembles sains par instantané. */
  for (const s of snaps) {
    if (s.d1) continue;
    const ecrits = new Set([...(ecritures.parCle.get(s.cle) || []), ...ecritures.sansCle]);
    s.d1 = new Set(); s.d2 = new Set(); s.comptes = { lignes: s.dec.n, valid: 0, invalid: 0, skipped: 0, autre: 0, traites: 0, vus: 0, sansBords: 0 };
    for (let i = 0; i < s.dec.n; i++) {
      const st = s.dec.st[i]; s.comptes[['valid', 'invalid', 'skipped', 'autre'][st]]++;
      if (s.dec.fl[i] & 1) s.comptes.traites++; if (s.dec.fl[i] & 2) s.comptes.vus++;
      const b = avecBords(s.dec, i); if (!b) s.comptes.sansBords++;
      if (st !== 0 || !b || cibles.has(i)) continue;
      if (!ecrits.has(i)) s.d1.add(i);
      if (!poses.has(i) && !ecritsPasse.has(i)) s.d2.add(i);
    }
  }
  /* Population. */
  const pj = jugement.parties.find(p => p.partie === partie), pop = [];
  for (const c of (pj ? pj.cuts : [])) if (c.etat === 'valide' && c.classe === 'faute') pop.push({ cut: c.cut, population: c.source === 'lot' ? 'faute' : 'faute-passe', mm: c.mm });
  const lignes = L.indexLignes(journal, echo, partie);
  let differes = 0;
  for (const c of [...cibles].sort((a, b) => a - b)) {
    if (poses.has(c)) continue;
    differes++;
    const l = lignes.get(c);
    if (!l || !l.dansEcho || l.referenceHumaine !== 'observee' || l.regleVisiteBon || !/^VALIDATE/.test(l.etiquetteEcho || '')) continue;
    pop.push({ cut: c, population: 'differe', mm: arr(l.ecartHumain && l.ecartHumain.maxDist3dMm), ecritPasse: ecritsPasse.has(c) });
  }
  const cuts = pop.map(p => {
    const t = decision.get(p.cut), o = { partie, ...p, exclu: false, motif: null, instantane: null, avanceS: null, etatDansInstantane: null,
      d1Avant: null, d1Apres: null, d2Avant: null, d2Apres: null, n2Instantane: null, n2d1Avant: null, n2d1Apres: null, n2d2Avant: null, n2d2Apres: null };
    const anterieurs = fini(t) ? snaps.filter(s => s.at + MARGE_S * 1000 <= t) : [], posterieurs = fini(t) ? snaps.filter(s => s.at + MARGE_S * 1000 > t) : [];
    if (!snaps.length) { o.exclu = true; o.motif = 'aucun-instantane'; }
    else if (!fini(t)) { o.exclu = true; o.motif = 'sans-heure-de-decision'; }
    else if (!anterieurs.length) { o.exclu = true; o.motif = 'instantane-posterieur'; }
    if (!o.exclu) {
      const s = anterieurs[anterieurs.length - 1], a = distances(s.d1, p.cut, s.dec.n), b = distances(s.d2, p.cut, s.dec.n);
      Object.assign(o, { instantane: iso(s.at), avanceS: arr((t - s.at) / 1000, 0), etatDansInstantane: ['valid', 'invalid', 'skipped', 'autre'][s.dec.st[p.cut]] || null,
        d1Avant: a.av, d1Apres: a.ap, d2Avant: b.av, d2Apres: b.ap });
    } else if (o.motif === 'instantane-posterieur') {
      const s = posterieurs[0], a = distances(s.d1, p.cut, s.dec.n), b = distances(s.d2, p.cut, s.dec.n);
      Object.assign(o, { n2Instantane: iso(s.at), avanceS: arr((t - s.at) / 1000, 0), n2d1Avant: a.av, n2d1Apres: a.ap, n2d2Avant: b.av, n2d2Apres: b.ap });
    }
    return o;
  });
  /* Contrôles de la reconstitution (premier instantané de la partie). */
  const controles = { fiche: null, fenetre: null };
  if (snaps.length) {
    const s = snaps[0], f = (journal.fichesDepart || []).filter(x => x.partie === partie && fini(Date.parse(x.at))).sort((a, b) => Math.abs(Date.parse(a.at) - debut) - Math.abs(Date.parse(b.at) - debut))[0];
    if (f && Math.abs(Date.parse(f.at) - debut) <= 60000) controles.fiche = { validesFiche: f.valides, sainsD2: s.d2.size, egal: f.valides === s.d2.size };
    const c = { releves: 0, depassements: 0, egalites: 0 };
    for (const e of run.ev) {
      if (e.type !== 'b1-ombre' || !batchs.has(e.batchId) || !e.identity || e.identity.part !== partie || !e.fenetre || !e.appariement || e.appariement.ecartIndice !== 0) continue;
      const cut = e.identity.cut, borne = e.fenetre.valid - e.fenetre.fraiches; let k = 0;
      if (!Number.isInteger(cut) || !fini(borne)) continue;
      for (let i = cut - 5; i <= cut + 5; i++) if (i !== cut && s.d2.has(i)) k++;
      c.releves++; if (k > borne) c.depassements++; if (k === borne) c.egalites++;
    }
    controles.fenetre = c;
    /* Lignes saines en D2 et pas en D1 : touchées par une écriture « vu » seule, ou par une écriture qui porte un statut ou des bords. */
    const ap = ecritures.avecPose.get(s.cle) || new Set(), d = { lignes: 0, vuSeul: 0, avecStatutOuBords: 0 };
    for (const i of s.d2) if (!s.d1.has(i)) { d.lignes++; if (ap.has(i) || ecritures.sansCle.has(i)) d.avecStatutOuBords++; else d.vuSeul++; }
    controles.ecartD1D2 = d;
  }
  return { partie, controles, lots: run.lots.length, debut: iso(debut), fin: iso(fin), cibles: cibles.size, poses: poses.size, differes, ecritsPasse: ecritsPasse.size,
    instantanes: snaps.map(s => ({ at: iso(s.at), archives: s.archives, ...s.comptes, sainsD1: s.d1.size, sainsD2: s.d2.size,
      position: s.at < debut ? 'avant-le-depart' : s.at <= debut + MARGE_S * 1000 ? 'au-depart' : fin && s.at >= fin ? 'apres-la-fin' : 'pendant-le-lot',
      resumeAuJournal: [...resumes].some(x => Date.parse(x) === s.at || iso(Date.parse(x)) === iso(s.at)) })),
    cuts };
}

function mesurer({ nom, lot, echos, parties }) {
  const journal = Poses.lireJournalDir(lot);
  const echo = echos.length ? Poses.lireEcho(L.dossiersEcho(echos)) : null;
  const liste = parties.length ? parties : L.partiesDuJournal(journal);
  const jugement = JP.juger({ journal, echo, parties: liste });
  const instantanes = lireInstantanes([...new Set([lot, ...echos])]), ecritures = ecrituresDuJournal(journal);
  const fiches = (journal.fichesDepart || []).map(f => ({ partie: f.partie, at: iso(Date.parse(f.at)), valides: f.valides, invalides: f.invalides, total: f.total }));
  const out = liste.map(partie => mesurerPartie({ journal, echo, partie, instantanes, ecritures, jugement })).filter(Boolean);
  for (const p of out) p.fichesDepart = fiches.filter(f => f.partie === p.partie);
  return { format: FORMAT, nom, build: journal.build || null, margeS: MARGE_S, portees: PORTEES, parties: out };
}

/* ---------------------------------------------------------------- comptes et textes */
const couvert = (av, ap, k, deux) => deux ? (av !== null && ap !== null && Math.max(av, ap) <= k) : ((av !== null && av <= k) || (ap !== null && ap <= k));
function compter(cuts, def) {
  const A = def + 'Avant', B = def + 'Apres', r = { n: cuts.length };
  for (const k of PORTEES) { r['un' + k] = Poses.wilson(cuts.filter(c => couvert(c[A], c[B], k, false)).length, cuts.length); r['deux' + k] = Poses.wilson(cuts.filter(c => couvert(c[A], c[B], k, true)).length, cuts.length); }
  r.sansAucunCote = cuts.filter(c => c[A] === null && c[B] === null).length;
  r.sansUnCote = cuts.filter(c => (c[A] === null) !== (c[B] === null)).length;
  return r;
}
const pc = w => w && w.n ? `${w.k}/${w.n} (${Math.round(w.part * 100)} % [${Math.round(w.bas * 100)} ; ${Math.round(w.haut * 100)}])` : '0/0';
function ligneCompte(titre, cuts, def) {
  const c = compter(cuts, def);
  return `  ${titre} : n ${c.n} ; à 15 cuts un côté ${pc(c.un15)}, deux côtés ${pc(c.deux15)} ; à 27 cuts un côté ${pc(c.un27)}, deux côtés ${pc(c.deux27)}`;
}
function blocPopulation(titre, cuts) {
  const o = [], motifs = {};
  for (const c of cuts) if (c.exclu) motifs[c.motif] = (motifs[c.motif] || 0) + 1;
  const ret = cuts.filter(c => !c.exclu), post = cuts.filter(c => c.motif === 'instantane-posterieur');
  o.push(` ${titre} : ${cuts.length} ; retenus (instantané prouvé antérieur) ${ret.length} ; exclus ${cuts.length - ret.length}` + (Object.keys(motifs).length ? ' (' + Object.entries(motifs).map(([k, v]) => `${k} ${v}`).join(', ') + ')' : ''));
  if (ret.length) o.push(ligneCompte('retenus, D1 (CH-033)', ret, 'd1'), ligneCompte('retenus, D2 (ticket)', ret, 'd2'));
  if (post.length) o.push(ligneCompte('exclus « instantane-posterieur », variante reconstituée N2 (à part), D1', post, 'n2d1'), ligneCompte('exclus « instantane-posterieur », variante reconstituée N2 (à part), D2', post, 'n2d2'));
  return o;
}
function texteLot(r) {
  const o = [`Lot ${r.nom} — paquet ${r.build || '?'}`];
  for (const p of r.parties) {
    o.push(`Partie ${p.partie} : exécution du ${p.debut} au ${p.fin} (${p.lots} lot(s)) ; cibles ${p.cibles}, posés ${p.poses}, différés ${p.differes}, écrits par la passe ${p.ecritsPasse}`);
    for (const f of p.fichesDepart) o.push(`  fiche de départ ${f.at} : validés ${f.valides}, invalides ${f.invalides}, total ${f.total}`);
    if (!p.instantanes.length) o.push('  instantané de liste : AUCUN');
    for (const s of p.instantanes) o.push(`  instantané ${s.at} (${s.position}, dans ${s.archives} archive(s), résumé au journal : ${s.resumeAuJournal ? 'oui' : 'non'}) : ${s.lignes} lignes, valid ${s.valid}, invalid ${s.invalid}, skipped ${s.skipped}, traités ${s.traites}, vus ${s.vus}, sans bords ${s.sansBords} ; sains D1 ${s.sainsD1}, D2 ${s.sainsD2}`);
    const k = p.controles || {};
    if (k.fiche) o.push(`  contrôle « fiche de départ » : sains D2 du premier instantané ${k.fiche.sainsD2}, validés de la fiche ${k.fiche.validesFiche} : ${k.fiche.egal ? 'ÉGAUX' : 'DIFFÉRENTS'}`);
    if (k.ecartD1D2) o.push(`  lignes saines en D2 et pas en D1 : ${k.ecartD1D2.lignes}, dont écriture « vu » seule ${k.ecartD1D2.vuSeul}, écriture avec statut ou bords ${k.ecartD1D2.avecStatutOuBords}`);
    if (k.fenetre) o.push(`  contrôle « fenêtre de décision » : ${k.fenetre.releves} cibles relevées, dépassements ${k.fenetre.depassements}, égalités ${k.fenetre.egalites}`);
    for (const [pop, titre] of [['faute', 'FAUTES'], ['differe', 'DIFFÉRÉS JUGÉS'], ['faute-passe', 'fautes de la passe (à part)']]) {
      const cuts = p.cuts.filter(c => c.population === pop);
      if (cuts.length) o.push(...blocPopulation(titre, cuts));
    }
  }
  return o.join('\n');
}
const COLONNES = ['lot', 'partie', 'cut', 'population', 'mm', 'exclu', 'motif', 'instantane', 'avanceS', 'etatDansInstantane', 'd1Avant', 'd1Apres', 'd2Avant', 'd2Apres', 'n2Instantane', 'n2d1Avant', 'n2d1Apres', 'n2d2Avant', 'n2d2Apres'];
function enCsv(r) {
  const v = x => x === null || x === undefined ? '' : x === true ? 'oui' : x === false ? 'non' : String(x);
  return [COLONNES.join(';'), ...r.parties.flatMap(p => p.cuts.map(c => COLONNES.map(k => v(k === 'lot' ? r.nom : c[k])).join(';')))].join('\n') + '\n';
}
function verdict(fautes, def, titre) {
  if (!fautes.length) return `  ${titre} : aucune faute, NON MESURABLE AU SEUIL`;
  const k = fautes.filter(c => couvert(c[def + 'Avant'], c[def + 'Apres'], SEUIL_PORTEE, true)).length, w = Poses.wilson(k, fautes.length);
  return `  ${titre} : ${pc(w)} couvertes des deux côtés à ${SEUIL_PORTEE} cuts → ${k / fautes.length < SEUIL_PART ? 'moins de la moitié : PISTE CLOSE' : 'la moitié ou plus : piste non close'}`;
}
function texteBilan(lots) {
  const o = lots.map(texteLot), tous = lots.flatMap(r => r.parties.flatMap(p => p.cuts.map(c => ({ ...c, lot: r.nom }))));
  o.push('', `TOTAL (${lots.length} lots)`);
  for (const [pop, titre] of [['faute', 'FAUTES'], ['differe', 'DIFFÉRÉS JUGÉS'], ['faute-passe', 'fautes de la passe (à part)']]) {
    const cuts = tous.filter(c => c.population === pop);
    o.push(...(cuts.length ? blocPopulation(titre, cuts) : [` ${titre} : 0`]));
  }
  const f = tous.filter(c => c.population === 'faute'), ret = f.filter(c => !c.exclu);
  o.push('', `VERDICT AU SEUIL (écrit avant : moins de la moitié des fautes couvertes des deux côtés à ${SEUIL_PORTEE} cuts = piste close)`,
    verdict(ret, 'd1', `fautes retenues (${ret.length} sur ${f.length}), D1`), verdict(ret, 'd2', `fautes retenues (${ret.length} sur ${f.length}), D2`),
    verdict(f, 'd1', `toutes les fautes (${f.length}), exclues comptées non couvertes, D1`), verdict(f, 'd2', `toutes les fautes (${f.length}), exclues comptées non couvertes, D2`),
    verdict(f.map(c => c.exclu ? { ...c, d1Avant: c.n2d1Avant, d1Apres: c.n2d1Apres } : c), 'd1', `à part, hors preuve N1 : toutes les fautes (${f.length}), exclues lues dans l'instantané postérieur (N2), D1`),
    verdict(f.map(c => c.exclu ? { ...c, d2Avant: c.n2d2Avant, d2Apres: c.n2d2Apres } : c), 'd2', `à part, hors preuve N1 : toutes les fautes (${f.length}), exclues lues dans l'instantané postérieur (N2), D2`));
  const ctl = lots.flatMap(r => r.parties.map(p => p.controles || {})), fi = ctl.filter(c => c.fiche), fe = ctl.filter(c => c.fenetre);
  const ec = ctl.filter(c => c.ecartD1D2);
  o.push('', `ÉCART ENTRE D1 ET D2 : ${ec.reduce((s, c) => s + c.ecartD1D2.lignes, 0)} lignes saines en D2 et pas en D1, dont écriture « vu » seule ${ec.reduce((s, c) => s + c.ecartD1D2.vuSeul, 0)}, écriture avec statut ou bords ${ec.reduce((s, c) => s + c.ecartD1D2.avecStatutOuBords, 0)}`);
  o.push(`CONTRÔLES DE LA RECONSTITUTION : fiche de départ égale sur ${fi.filter(c => c.fiche.egal).length} parties sur ${fi.length} ; fenêtre de décision : ${fe.reduce((s, c) => s + c.fenetre.releves, 0)} cibles relevées, ${fe.reduce((s, c) => s + c.fenetre.depassements, 0)} dépassements, ${fe.reduce((s, c) => s + c.fenetre.egalites, 0)} égalités`);
  return o.join('\n');
}

const USAGE = 'Usage : node tools/ch100-liste-esv.cjs --nom <étiquette> --lot <dossier> --echo <dossier>... [--partie N]... --sortie <dossier> | --bilan <dossier>';
function lireArguments(argv) {
  const a = { nom: null, lot: null, echos: [], parties: [], sortie: null, bilan: null };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--nom') a.nom = argv[++i];
    else if (k === '--lot') a.lot = argv[++i];
    else if (k === '--echo') a.echos.push(argv[++i]);
    else if (k === '--partie') a.parties.push(Number(argv[++i]));
    else if (k === '--sortie') a.sortie = argv[++i];
    else if (k === '--bilan') a.bilan = argv[++i];
    else throw Error(`Argument inconnu : ${k}. ${USAGE}`);
  }
  if (!a.bilan && (!a.nom || !a.lot || !a.sortie)) throw Error(USAGE);
  return a;
}
function executer(argv, sortie = console.log) {
  const a = lireArguments(argv);
  if (a.bilan) {
    const lots = fs.readdirSync(a.bilan).filter(n => /\.json$/.test(n)).sort().map(n => JSON.parse(fs.readFileSync(path.join(a.bilan, n), 'utf8'))).filter(r => r && r.format === FORMAT);
    if (!lots.length) throw Error('aucune sortie de mesure dans ' + path.basename(a.bilan));
    sortie(texteBilan(lots));
    return lots;
  }
  const r = mesurer(a);
  fs.mkdirSync(a.sortie, { recursive: true });
  fs.writeFileSync(path.join(a.sortie, a.nom + '.json'), JSON.stringify(r, null, 1));
  fs.writeFileSync(path.join(a.sortie, a.nom + '.csv'), enCsv(r));
  sortie(texteLot(r));
  return r;
}
if (require.main === module) {
  try { executer(process.argv.slice(2)); } catch (e) { console.error(String(e && e.message || e)); process.exit(1); }
}
module.exports = { FORMAT, MARGE_S, PORTEES, lireInstantanes, ecrituresDuJournal, distances, couvert, compter, mesurer, texteLot, texteBilan, enCsv, executer };
