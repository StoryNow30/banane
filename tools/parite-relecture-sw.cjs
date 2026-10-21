#!/usr/bin/env node
'use strict';
/*
 * parite-relecture-sw.cjs — LA RELECTURE APRÈS LE LOT EST-ELLE LA MÊME QUE CELLE D'UNE AUTRE VERSION ? Cinq relectures (ombre, ombre avec le réglage de pause
 * écrit éteint, corriger, arrêt demandé au cut 109, F5 au cut 110) sont jouées dans le VRAI service worker (background.js en vm, tests/helpers/relecture-lot.cjs)
 * de chaque dépôt, contre un ESV simulé. Pour chacune : commandes envoyées à ESV, appels de l'adaptateur, journal, états de la relecture au panneau et clés
 * gardées dans le stockage, neutralisés (identifiants, heures, durées). Les clés de l'état de la pause (`pauseDemandee`, `pauseRaison`, `reprise`, `expire`,
 * `repriseReglage`) sont écartées : elles n'existent qu'avec la fonction.
 *
 *   node tools/parite-relecture-sw.cjs RACINE_DE_REFERENCE [RACINE=.]      compare les deux dépôts ; sortie 0 si identiques
 *   node tools/parite-relecture-sw.cjs --jouer RACINE SORTIE.json          joue les cinq relectures dans RACINE et écrit leur relevé
 *   (AB_ACTIF=1 : le réglage de pause est allumé dans les cinq relectures ; la comparaison doit alors montrer l'écart.)
 *
 * Aucune donnée de lot, aucun ESV : tout est fabriqué par les montages d'essai. */
const path = require('node:path'), fs = require('node:fs'), os = require('node:os'), crypto = require('node:crypto'), { spawnSync } = require('node:child_process');

const BRUIT = /(^|[a-z])(ms|Ms|MS)$|duration|elapsed|^t0$|startedEpoch|endedEpoch|receivedMs|timeOrigin|engineMs|^at$|Ago$|^debut$|^fin$|^timestamp$|^t$|operationId/;
const PAUSE = ['pauseDemandee', 'pauseRaison', 'reprise', 'expire'];

async function jouer(racine, sortie) {
  const H = require(path.join(racine, 'tests/helpers/relecture-lot.cjs')), { PERMISSIF } = require(path.join(racine, 'tests/helpers/relecture-essais.cjs'));
  const { memoire } = require(path.join(racine, 'tests/helpers/perf-production.cjs'));
  const nettoyer = x => JSON.parse(JSON.stringify(H.neutre(x), (k, v) => BRUIT.test(k) ? undefined : v));
  const sansPause = e => { const c = JSON.parse(JSON.stringify(e)); delete c.repriseReglage; if (c.passe) for (const k of PAUSE) delete c.passe[k]; return c; };
  const SCENARIOS = {
    'ombre': {},
    'ombre-reglage-eteint': { reglage: { actif: false, f5: 'pause' } },
    'corriger': { mode: 'corriger', decisions: { 109: 14, 110: 14 }, reglagesProposes: PERMISSIF },
    'arret-109': { esv: (a, b) => { let fait = false; a.surAller = async t => { if (t.cut === 109 && !fait) { fait = true; await b.api('relecture-arreter'); } }; } },
    'f5-110': { esv: a => { a.panneCapture.add(110); } },
  };
  const releves = {};
  for (const [nom, { reglage, ...options }] of Object.entries(SCENARIOS)) {
    const local = memoire(), allume = process.env.AB_ACTIF ? { actif: true, f5: 'pause' } : reglage;
    if (allume) local.m.banane51RelecturePauseReglage = allume;
    const x = await H.lotRelecture({ mode: 'ombre', ...options, local }), passe = await H.finPasse(x.b);
    await H.attendre(200);
    const etat = sansPause(await x.b.api('relecture-etat')), vue = await x.b.api('view');
    releves[nom] = { commandes: nettoyer(x.b.commands), allees: nettoyer(x.adapter.allees), majEspace: nettoyer(x.adapter.majEspace), applyArgs: nettoyer(x.adapter.applyArgs),
      evenements: nettoyer(x.b.store.events.filter(e => !['esv-observation', 'phase-timing'].includes(e.type))),
      passe: nettoyer({ etat: passe.etat, faits: passe.faits, corriges: passe.corriges, message: passe.message, vus: passe.vus }),
      etat: nettoyer(etat), vueRelecture: nettoyer(vue.relecture ?? null), stockage: Object.keys(local.m).sort() };
  }
  fs.writeFileSync(sortie, JSON.stringify(releves));
}

function comparer(racines) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'parite-relecture-')), fichiers = racines.map((r, i) => path.join(tmp, `releve-${i}.json`));
  racines.forEach((r, i) => { const p = spawnSync(process.execPath, ['--max-old-space-size=4500', __filename, '--jouer', r, fichiers[i]], { stdio: ['ignore', 'inherit', 'inherit'] }); if (p.status !== 0) throw Error('relevé impossible : ' + r); });
  const [a, b] = fichiers.map(f => JSON.parse(fs.readFileSync(f, 'utf8')));
  let identiques = true;
  for (const nom of Object.keys(a)) for (const champ of Object.keys(a[nom])) {
    const ok = JSON.stringify(a[nom][champ]) === JSON.stringify(b[nom][champ]);
    identiques &&= ok;
    console.log(`${ok ? 'identique' : 'DIFFÉRENT'}  ${nom} / ${champ}`);
  }
  const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
  console.log(identiques ? `relevés identiques (SHA-256 ${sha(fichiers[0])})` : 'relevés différents');
  fs.rmSync(tmp, { recursive: true, force: true });
  return identiques;
}

if (require.main === module) {
  const [a, b, c] = process.argv.slice(2);
  if (a === '--jouer') jouer(path.resolve(b), c).then(() => process.exit(0), e => { console.error(e); process.exit(1); });
  else if (a) process.exit(comparer([path.resolve(a), path.resolve(b || path.join(__dirname, '..'))]) ? 0 : 1);
  else { console.error('usage : parite-relecture-sw.cjs RACINE_DE_REFERENCE [RACINE] | --jouer RACINE SORTIE.json'); process.exit(2); }
}
