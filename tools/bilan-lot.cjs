#!/usr/bin/env node
/* CH-082 : bilan d'un lot en une commande (D-312).
 *
 *   node tools/bilan-lot.cjs <dossier ou zips d'un export> [...] [--json]
 *
 * Les zips sont décompressés dans un dossier temporaire (supprimé en fin de commande ; seuls les journaux
 * ariane-journal-v4-*.json sont extraits). Les volumes d'un même export sont fusionnés.
 * Sortie : une page Markdown en français ; avec --json, le même bilan en JSON.
 *
 * Règle absolue : la sortie ne porte que des comptes, des mm, des ms et des numéros de partie et de coupe.
 * Aucune adresse, aucun UUID, aucun identifiant de session ou de lot, aucun nom : les champs sont lus un par
 * un (liste blanche) et un filtre final remplace tout motif d'UUID ou d'adresse qui aurait filtré.
 *
 * Définitions (qualification : ce qui est lu au journal est ÉTABLI ; les durées sont celles de l'adaptateur) :
 *  - validées = événements validation-accepted d'action VALIDATE ; différés = defer-intent ;
 *  - cut = intervalle entre deux validations successives, retenu s'il est inférieur à 10 s ;
 *  - capture = elapsedMs de l'étape capture-ready (adapter-progress, action capture), rangée selon le saut
 *    entre la coupe précédente et celle-ci dans l'ordre des before-captured (saut +1, 2-10, 11-50, 51-200,
 *    > 200 en valeur absolue ; « autre » = même coupe ou recul d'une coupe) ;
 *  - médiane classique (moyenne des deux valeurs centrales si l'effectif est pair), P90 au rang le plus proche.
 */
'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const TRANCHE_MS = 10 * 60 * 1000;
const SEUIL_CUT_MS = 10000;
const CLASSES = ['+1', '2-10', '11-50', '51-200', '>200', 'autre'];
const RE_UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const RE_ADRESSE = /https?:\/*[^\s"'<>)]*/gi;

/* ---------- lecture ---------- */
function collecter(chemins, tmp) {
  const journaux = [];
  const vus = new Set();
  const ajouter = f => { const r = path.resolve(f); if (!vus.has(r)) { vus.add(r); journaux.push(r); } };
  let n = 0;
  const dezipper = z => {
    const dest = path.join(tmp, `zip-${++n}`);
    fs.mkdirSync(dest, { recursive: true });
    const r = spawnSync('unzip', ['-o', '-q', z, '*ariane-journal-v4-*.json', '-d', dest], { encoding: 'utf8' });
    /* code 11 d'unzip : aucun fichier correspondant dans ce zip (volume sans journal) */
    if (r.error) throw new Error(`décompression impossible (unzip absent ?) : ${r.error.message}`);
    if (r.status !== 0 && r.status !== 11) throw new Error(`zip illisible (${path.basename(z)}) : ${(r.stderr || '').trim().slice(0, 120)}`);
    parcourir(dest);
  };
  const estJournal = f => /^ariane-journal-v4-.*\.json$/.test(path.basename(f));
  function parcourir(p) {
    const st = fs.statSync(p);
    if (st.isDirectory()) { for (const f of fs.readdirSync(p).sort()) parcourir(path.join(p, f)); }
    else if (/\.zip$/i.test(p)) dezipper(p);
    else if (estJournal(p)) ajouter(p);
  }
  for (const c of chemins) {
    if (!fs.existsSync(c)) throw new Error(`chemin introuvable : ${c}`);
    const st = fs.statSync(c);
    if (st.isFile() && !/\.zip$/i.test(c)) ajouter(c); else parcourir(c);
  }
  return journaux;
}

function lireEvenements(fichiers) {
  const evs = [], ids = new Set();
  for (const f of fichiers) {
    let j;
    try { j = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { throw new Error(`journal illisible (${path.basename(f)}) : ${e.message}`); }
    const liste = Array.isArray(j) ? j : j && j.events;
    if (!Array.isArray(liste)) throw new Error(`journal sans clé events (${path.basename(f)})`);
    for (const e of liste) {
      if (!e || typeof e !== 'object') continue;
      if (e.eventId) { if (ids.has(e.eventId)) continue; ids.add(e.eventId); }
      evs.push(e);
    }
  }
  const t = e => { const v = Date.parse(e.timestamp); return Number.isFinite(v) ? v : Infinity; };
  return evs.map((e, i) => [e, t(e), i]).sort((a, b) => a[1] - b[1] || a[2] - b[2]).map(([e, ms]) => { e._ms = ms; return e; });
}

/* ---------- outils de calcul ---------- */
const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const somme = (a, k) => a.reduce((s, e) => s + (num(e[k]) || 0), 0);
const compter = (a, f) => { const m = {}; for (const e of a) { const k = f(e); m[k] = (m[k] || 0) + 1; } return m; };
/* Texte libre : jamais d'identifiant ni d'adresse, longueur bornée. */
const propre = s => (typeof s === 'string' ? s.replace(RE_UUID, '[id]').replace(RE_ADRESSE, '[adresse]').slice(0, 60) : null);
const cle = s => (s === null || s === undefined ? '(vide)' : propre(String(s)));
const arrondi = (v, d = 2) => (v === null ? null : Math.round(v * 10 ** d) / 10 ** d);
function stats(v) {
  if (!v.length) return { n: 0, medianMs: null, p90Ms: null };
  const s = [...v].sort((a, b) => a - b), n = s.length;
  const med = n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
  return { n, medianMs: Math.round(med), p90Ms: Math.round(s[Math.min(n - 1, Math.ceil(0.9 * n) - 1)]) };
}
const partieDe = e => num(e.identity && e.identity.part);
const coupeDe = e => num(e.identity && e.identity.cut);
const tri = a => [...new Set(a.filter(v => v !== null))].sort((x, y) => x - y);
const classe = d => (d === 1 ? '+1' : d === 0 || d === -1 ? 'autre' : Math.abs(d) <= 10 ? '2-10' : Math.abs(d) <= 50 ? '11-50' : Math.abs(d) <= 200 ? '51-200' : '>200');
const hhmm = ms => new Date(ms).toISOString().slice(11, 16);

/* CH-088 : bilan à l'arrivée (voie potree) : sommes sur les bilans qui le portent. `parPrete` : part des nœuds qu'il a fallu (chargés à l'arrivée plus
 * chargés ensuite par Potree seul) déjà chargés à l'arrivée. */
const TYPES_VUE = ['orthographique', 'perspective', 'autre', 'absente'];
function arriveeDe(a) {
  const s = k => somme(a, k), prets = s('prets'), potreeLui = s('potreeLui');
  return { n: a.length, boite: s('boite'), prets, nousPrets: s('nousPrets'), nousEnVol: s('nousEnVol'), boiteFin: s('boiteFin'), potreeLui, nousApres: s('nousApres'), partPrete: prets + potreeLui ? arrondi(prets / (prets + potreeLui), 3) : null };
}
function loinDe(a) {
  const med = k => stats(a.map(e => num(e[k])).filter(v => v !== null)).medianMs;
  const arrives = a.filter(e => e.motif === 'arrivee');
  return { n: a.length, parMotif: compter(a, e => cle(e.motif)), lances: somme(a, 'lances'), charges: somme(a, 'charges'), echecs: somme(a, 'echecs'),
    capturesMediane: med('captures'), msAvantMediane: med('msAvant'), arrivee: arriveeDe(arrives.filter(e => num(e.boite) !== null)) };
}

/* ---------- le bilan ---------- */
function bilan(evs) {
  const par = t => evs.filter(e => e.type === t);
  const obs = k => evs.filter(e => e.type === 'esv-observation' && e.kind === k);
  const valides = evs.filter(e => e.type === 'validation-accepted' && e.action === 'VALIDATE');
  const differes = par('defer-intent');
  const abandons = par('capture-abandoned');
  const dates = evs.map(e => e._ms).filter(Number.isFinite);

  /* (1) lot */
  const parts = tri([...valides, ...differes, ...abandons, ...par('before-captured')].map(partieDe));
  const parPartie = parts.map(p => ({
    partie: p,
    valides: valides.filter(e => partieDe(e) === p).length,
    differes: differes.filter(e => partieDe(e) === p).length,
    capturesAbandonnees: abandons.filter(e => partieDe(e) === p).length,
  }));
  const seriesLot = {};
  for (const e of par('serie-captures-vides')) { const b = typeof e.batchId === 'string' ? e.batchId : ''; seriesLot[b] = Math.max(seriesLot[b] || 0, num(e.series) || 0); }
  const rust = par('rust').filter(e => e.action === 'capture' || e.action === undefined);
  const lot = {
    debut: dates.length ? new Date(Math.min(...dates)).toISOString() : null,
    fin: dates.length ? new Date(Math.max(...dates)).toISOString() : null,
    dureeMs: dates.length ? Math.max(...dates) - Math.min(...dates) : 0,
    parties: parts, parPartie,
    valides: valides.length, differes: differes.length,
    seriesCapturesVides: Object.values(seriesLot).reduce((a, b) => a + b, 0),
    capturesAbandonnees: abandons.length,
    abandonsParRaison: compter(abandons, e => cle(e.reason)),
    rust: { servi: rust.filter(e => e.servi === true).length, repli: rust.filter(e => e.repli === true).length, total: rust.length, raisons: compter(rust.filter(e => e.repli === true), e => cle(e.raison)) },
  };

  /* (2) temps */
  const vt = valides.map(e => e._ms).filter(Number.isFinite);
  const inter = [];
  for (let i = 1; i < vt.length; i++) { const d = vt[i] - vt[i - 1]; if (d >= 0 && d < SEUIL_CUT_MS) inter.push(d); }
  const prets = new Map(), classes = Object.fromEntries(CLASSES.map(c => [c, []]));
  let prec = null, sansCapture = 0;
  for (const e of evs) {
    if (e.type === 'adapter-progress' && e.action === 'capture' && e.lastStage === 'capture-ready' && num(e.elapsedMs) !== null) {
      prets.set(`${partieDe(e)}/${coupeDe(e)}`, { ms: e._ms, el: e.elapsedMs });
    } else if (e.type === 'before-captured') {
      const p = partieDe(e), c = coupeDe(e);
      if (c === null) continue;
      const pret = prets.get(`${p}/${c}`);
      if (prec && prec.p === p) {
        if (pret && e._ms - pret.ms >= 0 && e._ms - pret.ms <= 10000) classes[classe(c - prec.c)].push(pret.el); else sansCapture++;
      }
      prec = { p, c };
    }
  }
  const temps = { cut: { ...stats(inter), seuilMs: SEUIL_CUT_MS }, capture: Object.fromEntries(CLASSES.map(c => [c, stats(classes[c])])), cutsSansCapturePrete: sansCapture };

  /* (3) chargement d'ESV */
  const ress = obs('resource'), bloques = obs('diag-compteur-bloque');
  const statuts = {};
  const ajoutStatuts = (cible, e) => { for (const [k, v] of Object.entries(e.statuts || {})) if (/^\d{3}$/.test(k) && num(v) !== null) cible[k] = (cible[k] || 0) + v; };
  ress.forEach(e => ajoutStatuts(statuts, e));
  const tr = new Map();
  const tranche = ms => { const k = Math.floor(ms / TRANCHE_MS) * TRANCHE_MS; if (!tr.has(k)) tr.set(k, { debutUtc: hhmm(k), noeuds: 0, depuisCache: 0, octets: 0, echecs: 0, statuts: {}, compteurBloque: 0 }); return tr.get(k); };
  for (const e of ress) { if (!Number.isFinite(e._ms)) continue; const t = tranche(e._ms); t.noeuds += num(e.n) || 0; t.depuisCache += num(e.depuisCache) || 0; t.octets += num(e.bytes) || 0; t.echecs += num(e.echecs) || 0; ajoutStatuts(t.statuts, e); }
  for (const e of bloques) if (Number.isFinite(e._ms)) tranche(e._ms).compteurBloque++;
  const chargement = {
    noeuds: somme(ress, 'n'), depuisCache: somme(ress, 'depuisCache'), octets: somme(ress, 'bytes'),
    statuts, sansStatut: somme(ress, 'sansStatut'), echecs: somme(ress, 'echecs'),
    compteurBloque: bloques.length,
    tranches: [...tr.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v),
  };

  /* (4) préchauffage */
  const pre = obs('prechauffage'), bil = obs('prechauffage-bilan');
  const formes = {};
  for (const e of pre) if (num(e.formeNoeud) !== null) formes[e.formeNoeud] = (formes[e.formeNoeud] || 0) + 1;
  const prechauffage = {
    total: pre.length,
    parMotif: compter(pre, e => cle(e.motif)), parSource: compter(pre, e => cle(e.source)),
    actifs: pre.filter(e => (num(e.noeuds) || 0) > 0 || (num(e.hierarchies) || 0) > 0).length,
    annules: pre.filter(e => e.annule === true).length,
    noeuds: somme(pre, 'noeuds'), hierarchies: somme(pre, 'hierarchies'), octets: somme(pre, 'octets'),
    sansNom: somme(pre, 'sansNom'), sansAdresse: somme(pre, 'sansAdresse'), formeNoeud: formes,
    bilans: { n: bil.length, justes: bil.filter(e => e.juste === true).length, demandes: somme(bil, 'demandes'), potree: somme(bil, 'potree'), couverts: somme(bil, 'couverts'), servisCache: somme(bil, 'servisCache') },
    /* CH-088 : voie potree (plus aucune requête à nous) : load() lancés et chargés ; bilan à l'arrivée par l'arbre, dans la boîte de la coupe d'arrivée. */
    memoire: { lances: somme(pre, 'memLances'), charges: somme(pre, 'memCharges'), echecs: somme(pre, 'memEchecs') },
    arrivee: arriveeDe(bil.filter(e => num(e.boite) !== null)),
    loin: loinDe(obs('prechauffage-loin')),
    /* CH-088 : `prechauffage-vue` : jusqu'à CH-088, son champ `type` écrasait celui de l'enveloppe ; on le reconnaît aussi par son type de caméra. */
    vue: evs.filter(e => e.kind === 'prechauffage-vue' && (e.type === 'esv-observation' || TYPES_VUE.includes(e.type))).map(e => ({
      camera: TYPES_VUE.includes(e.camera) ? e.camera : TYPES_VUE.includes(e.type) ? e.type : null, pointBudget: num(e.pointBudget), limitePoints: num(e.limitePoints), maxLevel: num(e.maxLevel),
      fetchNatif: typeof e.fetchNatif === 'boolean' ? e.fetchNatif : null, enTetesXhr: num(e.enTetesXhr), credXhr: typeof e.credXhr === 'boolean' ? e.credXhr : null })),
  };

  /* (5) ombres de D-308 */
  const gardes = par('garde-voie-ombre'), serrages = par('serrage-lot-ombre');
  const ombres = {
    garde: {
      n: gardes.length, auraitPause: gardes.filter(e => e.auraitPause === true).length,
      pauses: gardes.filter(e => e.auraitPause === true).map(e => ({ partie: partieDe(e), cut: coupeDe(e), ecartMm: num(e.ecartMm), referenceMm: num(e.referenceMm), ecartAuVoisinageMm: num(e.ecartAuVoisinageMm) })),
    },
    serrage: {
      n: serrages.length,
      cuts: serrages.map(e => ({ partie: partieDe(e), cut: coupeDe(e), ecartAvantMm: num(e.ecartAvantMm), ecartApresMm: num(e.ecartApresMm) })),
    },
  };

  /* (6) relecture et passe des différés */
  const passeTypes = [...new Set(evs.map(e => e.type).filter(t => typeof t === 'string' && t.startsWith('passe-differes')))].sort();
  const ecr = par('passe-differes-ecriture');
  const relecture = {
    debuts: par('relecture-debut').length,
    fin: par('relecture-fin').map(e => ({ mode: cle(e.modeEffectif || e.mode), issue: cle(e.issue), faits: num(e.faits), total: num(e.total), corriges: num(e.corriges), refusees: num(e.refusees), vus: num(e.vus), dureeMs: num(e.dureeMs) })),
  };
  const passe = {
    evenements: Object.fromEntries(passeTypes.map(t => [t, par(t).length])),
    ombre: par('passe-differes-ombre').length,
    ombreParDecision: compter(par('passe-differes-ombre'), e => cle(e.decision)),
    ombreFin: par('passe-differes-ombre-fin').map(e => ({ mode: cle(e.mode), differes: num(e.differes), posees: num(e.posees) })),
    ecriture: ecr.length,
    ecritureParResultat: compter(ecr, e => cle(e.resultat)),
    ecritureFin: par('passe-differes-ecriture-fin').map(e => ({ issue: cle(e.issue), raison: propre(e.raison), ecrites: num(e.ecrites), demandees: num(e.demandees), decidees: num(e.decidees) })),
  };

  return { lot, temps, chargement, prechauffage, ombres, relecture, passe };
}

/* ---------- Markdown ---------- */
const nb = v => (v === null || v === undefined ? '—' : Number(v).toLocaleString('fr-FR').replace(/ | /g, ' '));
const dec = v => (v === null || v === undefined ? '—' : String(v).replace('.', ','));
const dur = ms => (ms === null || ms === undefined ? '—' : ms < 1000 ? `${nb(ms)} ms` : `${dec(arrondi(ms / 1000, 1))} s`);
const dico = o => { const e = Object.entries(o); return e.length ? e.sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} : ${nb(v)}`).join(' ; ') : 'aucun'; };
const pct = (a, b) => (b ? `${dec(arrondi(100 * a / b, 1))} %` : '—');

function markdown(b) {
  const L = [], { lot, temps, chargement: ch, prechauffage: p, ombres, relecture, passe } = b;
  L.push('# Bilan de lot', '');
  L.push('Qualification : chiffres lus au journal (ÉTABLI). Aucun identifiant, aucune adresse.', '');
  L.push('## 1. Lot', '');
  L.push(`- Période : du ${lot.debut || '—'} au ${lot.fin || '—'} (UTC), soit ${dur(lot.dureeMs)}.`);
  L.push(`- Partie(s) : ${lot.parties.length ? lot.parties.join(', ') : '—'}.`);
  L.push(`- Coupes validées : ${nb(lot.valides)} ; différées : ${nb(lot.differes)}.`);
  L.push(`- Séries de captures vides : ${nb(lot.seriesCapturesVides)} ; captures abandonnées : ${nb(lot.capturesAbandonnees)} (${dico(lot.abandonsParRaison)}).`);
  L.push(`- Lecture Rust : servie ${nb(lot.rust.servi)}, repli ${nb(lot.rust.repli)} sur ${nb(lot.rust.total)} lectures${lot.rust.repli ? ` (raisons : ${dico(lot.rust.raisons)})` : ''}.`);
  if (lot.parPartie.length > 1) { L.push('', '| Partie | Validées | Différées | Abandonnées |', '|---|---|---|---|'); for (const x of lot.parPartie) L.push(`| ${x.partie} | ${nb(x.valides)} | ${nb(x.differes)} | ${nb(x.capturesAbandonnees)} |`); }
  L.push('', '## 2. Temps', '');
  L.push(`- Cut (intervalle entre validations successives, moins de ${temps.cut.seuilMs / 1000} s) : ${nb(temps.cut.n)} intervalles ; médian ${dur(temps.cut.medianMs)} ; P90 ${dur(temps.cut.p90Ms)}.`);
  L.push('- Capture (elapsedMs de capture-ready), selon le saut depuis la coupe précédente :', '', '| Saut | Captures | Médiane | P90 |', '|---|---|---|---|');
  for (const c of CLASSES) { const s = temps.capture[c]; L.push(`| ${c} | ${nb(s.n)} | ${dur(s.medianMs)} | ${dur(s.p90Ms)} |`); }
  L.push('', `Captures sans coupe appariée dans l'ordre des before-captured : ${nb(temps.cutsSansCapturePrete)}.`);
  L.push('', '## 3. Chargement d\'ESV', '');
  L.push(`- Nœuds téléchargés : ${nb(ch.noeuds)}, dont servis par le cache : ${nb(ch.depuisCache)} (${pct(ch.depuisCache, ch.noeuds)}) ; octets : ${nb(ch.octets)}.`);
  L.push(`- Statuts de réponse : ${dico(ch.statuts)} ; sans statut : ${nb(ch.sansStatut)} ; échecs : ${nb(ch.echecs)}.`);
  L.push(`- Épisodes de compteur bloqué : ${nb(ch.compteurBloque)}.`);
  if (ch.tranches.length) {
    L.push('', '| Tranche de 10 min (UTC) | Nœuds | Cache | Octets | Échecs | Compteur bloqué | Statuts |', '|---|---|---|---|---|---|---|');
    for (const t of ch.tranches) L.push(`| ${t.debutUtc} | ${nb(t.noeuds)} | ${nb(t.depuisCache)} | ${nb(t.octets)} | ${nb(t.echecs)} | ${nb(t.compteurBloque)} | ${dico(t.statuts)} |`);
  }
  L.push('', '## 4. Préchauffage', '');
  L.push(`- Préchauffages : ${nb(p.total)} ; actifs (nœuds > 0 ou hiérarchies > 0) : ${nb(p.actifs)} ; annulés : ${nb(p.annules)}.`);
  L.push(`- Par motif : ${dico(p.parMotif)}.`, `- Par source : ${dico(p.parSource)}.`);
  L.push(`- Demandé : ${nb(p.noeuds)} nœuds, ${nb(p.hierarchies)} hiérarchies, ${nb(p.octets)} octets.`);
  L.push(`- sansNom : ${nb(p.sansNom)} ; sansAdresse : ${nb(p.sansAdresse)} ; formeNoeud (masque de bits → nombre) : ${dico(p.formeNoeud)}.`);
  const bl = p.bilans;
  L.push(bl.n ? `- Bilans : ${nb(bl.n)} ; prédiction juste ${nb(bl.justes)} (${pct(bl.justes, bl.n)}) ; demandés par Potree ${nb(bl.potree)}, couverts ${nb(bl.couverts)} (${pct(bl.couverts, bl.potree)}), servis par le cache ${nb(bl.servisCache)}.` : '- Bilans : aucun (pas d\'événement prechauffage-bilan dans ce lot).');
  /* CH-088 : voie potree */
  const ar = p.arrivee, lo = p.loin, mm = p.memoire;
  L.push(`- load() de Potree lancés par nous : ${nb(mm.lances)} ; chargés : ${nb(mm.charges)} ; en échec : ${nb(mm.echecs)}.`);
  L.push(ar.n ? `- Arrivée (voie potree, ${nb(ar.n)} bilans) : nœuds de la boîte ${nb(ar.boite)} à l'arrivée (${nb(ar.boiteFin)} après la capture) ; chargés à l'arrivée ${nb(ar.prets)}, dont par nous ${nb(ar.nousPrets)} (${nb(ar.nousEnVol)} encore en vol) ; chargés ensuite par Potree lui-même ${nb(ar.potreeLui)} ; part déjà chargée ${ar.partPrete === null ? '—' : pct(ar.partPrete, 1)}.` : '- Arrivée (voie potree) : aucun bilan par l\'arbre.');
  if (lo.n) {
    const la = lo.arrivee;
    L.push(`- Opérations lointaines : ${nb(lo.n)} (${dico(lo.parMotif)}) ; load() lancés ${nb(lo.lances)}, chargés avant l'arrivée ${nb(lo.charges)}, en échec ${nb(lo.echecs)} ; départ médian ${nb(lo.capturesMediane)} capture(s) et ${dur(lo.msAvantMediane)} avant l'arrivée.`);
    if (la.n) L.push(`  - À l'arrivée (${nb(la.n)}) : chargés ${nb(la.prets)} sur ${nb(la.boite)}, dont par nous ${nb(la.nousPrets)} ; Potree lui-même ensuite ${nb(la.potreeLui)} ; part déjà chargée ${la.partPrete === null ? '—' : pct(la.partPrete, 1)}.`);
  }
  for (const v of p.vue.slice(-1)) L.push(`- Vue de Potree (${nb(p.vue.length)} relevé(s), dernier) : caméra ${v.camera ?? '—'}, pointBudget ${nb(v.pointBudget)}, pointLoadLimit ${nb(v.limitePoints)}, maxLevel ${nb(v.maxLevel)} ; fetch natif ${v.fetchNatif ?? '—'}, en-têtes XHR ${nb(v.enTetesXhr)}, accréditations XHR ${v.credXhr ?? '—'}.`);
  if (!p.vue.length) L.push('- Vue de Potree : aucun relevé prechauffage-vue.');
  L.push('', '## 5. Ombres de D-308', '');
  L.push(`- Garde de voie : ${nb(ombres.garde.n)} évaluations, ${nb(ombres.garde.auraitPause)} pause(s) qu'elle aurait demandée(s).`);
  for (const x of ombres.garde.pauses) L.push(`  - partie ${x.partie}, cut ${x.cut} : écartement ${dec(x.ecartMm)} mm, référence ${dec(x.referenceMm)} mm, écart au voisinage ${dec(x.ecartAuVoisinageMm)} mm.`);
  const sv = ombres.serrage.cuts.filter(x => x.ecartAvantMm !== null && x.ecartApresMm !== null).map(x => ({ ...x, d: Math.abs(x.ecartApresMm - x.ecartAvantMm) })).sort((a, c) => c.d - a.d);
  L.push(`- Serrage du lot : ${nb(ombres.serrage.n)} cut(s).${sv.length ? ` Plus fortes corrections (${Math.min(10, sv.length)} sur ${sv.length}, liste complète avec --json) :` : ''}`);
  for (const x of sv.slice(0, 10)) L.push(`  - partie ${x.partie}, cut ${x.cut} : écartement ${dec(x.ecartAvantMm)} mm avant, ${dec(x.ecartApresMm)} mm après (${dec(arrondi(x.ecartApresMm - x.ecartAvantMm))} mm).`);
  L.push('', '## 6. Relecture et passe', '');
  if (relecture.fin.length) for (const r of relecture.fin) L.push(`- Relecture (${r.mode}, ${r.issue}) : ${nb(r.faits)} faits sur ${nb(r.total)}, ${nb(r.corriges)} corrigés, ${nb(r.refusees)} refusés, ${nb(r.vus)} vus, durée ${dur(r.dureeMs)}.`);
  else L.push('- Relecture : aucun événement relecture-fin.');
  L.push(`- Passe des différés : ${Object.keys(passe.evenements).length ? dico(passe.evenements) : 'aucun événement'}.`);
  if (passe.ombre) L.push(`  - Ombre par décision : ${dico(passe.ombreParDecision)}.`);
  for (const f of passe.ombreFin) L.push(`  - Fin d'ombre (${f.mode}) : ${nb(f.differes)} différés, ${nb(f.posees)} posés.`);
  if (passe.ecriture) L.push(`  - Écritures par résultat : ${dico(passe.ecritureParResultat)}.`);
  for (const f of passe.ecritureFin) L.push(`  - Fin d'écriture (${f.issue}${f.raison ? `, ${f.raison}` : ''}) : ${nb(f.ecrites)} écrites sur ${nb(f.demandees)} demandées (${nb(f.decidees)} décidées).`);
  return L.join('\n') + '\n';
}

/* Dernier filet : aucun motif d'UUID ni d'adresse ne sort, quelle que soit la source. */
const purger = s => s.replace(RE_UUID, '[id]').replace(RE_ADRESSE, '[adresse]');

function principal(argv) {
  const json = argv.includes('--json');
  const chemins = argv.filter(a => !a.startsWith('--'));
  if (!chemins.length) { process.stderr.write('Usage : node tools/bilan-lot.cjs <dossier ou zips d\'un export> [...] [--json]\n'); return 2; }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bilan-lot-zip-'));
  try {
    const fichiers = collecter(chemins, tmp);
    if (!fichiers.length) { process.stderr.write('Aucun journal (ariane-journal-v4-*.json) trouvé dans les chemins donnés.\n'); return 1; }
    const b = bilan(lireEvenements(fichiers));
    process.stdout.write(purger(json ? JSON.stringify(b, null, 2) + '\n' : markdown(b)));
    return 0;
  } catch (e) {
    process.stderr.write(`Erreur : ${e.message}\n`);
    return 1;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

if (require.main === module) process.exitCode = principal(process.argv.slice(2));
module.exports = { bilan, markdown, lireEvenements, collecter, stats, classe };
