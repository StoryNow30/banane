'use strict';
/*
 * relecture-maquette.cjs — RÈGLE LA MAQUETTE ESV DU BANC DE LA RELECTURE (fiches/RELECTURE_OMBRE.md § 7), hors du dépôt.
 *
 * La maquette (tests/esv-maquette de la branche claude/esv-locale-audit, extraite hors du dépôt par `git archive`) prend Maj+Espace
 * pour « valider et aller au prochain cut non validé » (supposé). Le banc a besoin de trois réglages, appliqués ici à la copie extraite
 * par de simples remplacements de texte (chaque ancre doit se trouver une seule fois ; une copie déjà réglée est laissée telle quelle) :
 *   - `majEspace=surplace` (D-179, Mic) : Maj+Espace sur un cut VERT valide SUR PLACE, ESV reste sur le même cut ; sur un cut rouge, il
 *     garde le comportement d'origine (valider et aller au prochain non validé). `majEspace=plus1` : l'ancienne supposition de la
 *     branche (valider puis charger le cut + 1), gardée pour mémoire ; sans paramètre : la maquette d'origine ;
 *   - `vu=1` : ESV écrit {SeenByOperator:true} 1 s après le premier affichage d'un cut jamais vu ;
 *   - `rouges=A-B` : seuls les cuts A à B sont rouges, les autres sont des verts d'ESV jamais traités ni vus, comme autour d'un lot.
 * Aucun code ni contenu d'ESV : la maquette est celle du dépôt de l'audit ; ce module n'y ajoute que ces trois options.
 *
 *   node tools/relecture-maquette.cjs <DOSSIER>/tests/esv-maquette        (le banc le fait seul avant de démarrer)
 */
const fs = require('node:fs'), path = require('node:path');
const MARQUE = 'Copie locale (relecture, D-175, D-179)';  // les copies plus anciennes portent « Copie locale (relecture, revue D-175) »

/* [fichier, ancre (texte exact de la maquette d'origine), remplacement]. */
const REMPLACEMENTS = [
  ['esv-maquette.js',
    "source:q.get('source')||'synthetique',valides:num('valides',0)};",
    "source:q.get('source')||'synthetique',valides:num('valides',0),\n" +
    "   /* " + MARQUE + " : `majEspace=surplace` : Maj+Espace valide SUR PLACE un cut vert, sans changer de cut (Mic, D-179) ; `majEspace=plus1` :\n" +
    "    * valide puis charge le cut + 1 (ancienne supposition) ; `vu=1` : ESV écrit {SeenByOperator:true} 1 s après le premier affichage d'un cut. */\n" +
    "   majEspace:q.get('majEspace')||'non-valide',vu:num('vu',0)===1};"],
  ['esv-maquette.js',
    "majCompteur();log('cut-charge',{cut:c.cut,part:etat.partie.part,raison,status:c.status});",
    "majCompteur();log('cut-charge',{cut:c.cut,part:etat.partie.part,raison,status:c.status});marquerVu(c,generation);"],
  ['esv-maquette.js',
    " function passer(){if(!rails.left)return;void ecrire('skipped');invalideSuivant();}",
    " function validerEtPlusUn(){if(!rails.left)return;void ecrire('valid');const i=etat.index+1;\n" +
    "  if(i<etat.partie.cuts.length)return chargerCut(i,'maj-espace-plus-un');\n" +
    "  const suivante=etat.scenario.parties[etat.scenario.parties.indexOf(etat.partie)+1];if(suivante){etat.partie=suivante;chargerCut(0,'partie-suivante');}else log('valider-dernier-sans-suite');}\n" +
    " /* D-179 : sur un vert valide, Maj+Espace valide sur place ; sur un cut rouge, comme la maquette d'origine. */\n" +
    " function majEspaceSurPlace(){if(cutCourant().status==='valid')return validerSurPlace();return validerEtSuivant();}\n" +
    " const vusMaquette=new Set();\n" +
    " function marquerVu(c,generation){if(!options.vu||vusMaquette.has(`${etat.partie.part}|${c.cut}`))return;vusMaquette.add(`${etat.partie.part}|${c.cut}`);\n" +
    "  if(liste()[c.cut]?.SeenByOperator===true)return; /* déjà vu : ESV n'écrit rien */\n" +
    "  etat.minuteries.push(setTimeout(()=>{if(etat.generation!==generation)return;const rk=`${etat.partie.part}-${c.cut}`;\n" +
    "   xhr('PUT',`/rails/${etat.partie.table}/${rk}`,{SeenByOperator:true}).then(r=>log('vu',{cut:c.cut,http:r.status}),()=>{});},1000));}\n" +
    " function passer(){if(!rails.left)return;void ecrire('skipped');invalideSuivant();}"],
  ['esv-maquette.js',
    "if(e.shiftKey&&!e.ctrlKey&&(which===32||e.key===' '||e.code==='Space'))return validerEtSuivant();",
    "if(e.shiftKey&&!e.ctrlKey&&(which===32||e.key===' '||e.code==='Space'))return options.majEspace==='surplace'?majEspaceSurPlace():options.majEspace==='plus1'?validerEtPlusUn():validerEtSuivant();"],
  ['esv-maquette.js',
    "&part=${options.part}`);",
    "&part=${options.part}${q.has('rouges')?'&rouges='+encodeURIComponent(q.get('rouges')):''}`);"],
  ['scenario.cjs',
    "  const statut=i=>i%5===4?'valid':i%7===6?'skipped':'invalid';",
    "  /* " + MARQUE + " : `rouges=A-B` : seuls les cuts A à B sont rouges ; les autres sont des verts d'ESV (validés par l'extraction, jamais\n" +
    "   * traités ni vus par un opérateur), comme autour d'un lot sur le terrain. */\n" +
    "  const rg=typeof options.rouges==='string'&&/^\\d+-\\d+$/.test(options.rouges)?options.rouges.split('-').map(Number):null;\n" +
    "  const statut=rg?(k=>{const c=debut+k;return c>=rg[0]&&c<=rg[1]?'invalid':'valid';}):(i=>i%5===4?'valid':i%7===6?'skipped':'invalid');"],
  ['scenario.cjs',
    "return {part:numero,table:`maquette-${numero}`,cuts};",
    "return {part:numero,table:`maquette-${numero}`,cuts,vertsEsv:!!rg};"],
  ['scenario.cjs',
    "TreatedByOperator:c.status!=='invalid',SeenByOperator:c.status!=='invalid',",
    "TreatedByOperator:partie.vertsEsv?false:c.status!=='invalid',SeenByOperator:partie.vertsEsv?false:c.status!=='invalid',"],
  ['serveur.cjs',
    "garder(JSON.stringify([q.cuts,q.debut,q.part,q.partie2]),",
    "garder(JSON.stringify([q.cuts,q.debut,q.part,q.partie2,q.rouges]),"],
];

/* Une copie déjà réglée porte la marque de ces réglages (celle de l'auteur précédent comprise) : on n'y touche pas. */
const DEJA = { 'esv-maquette.js': 'Copie locale (relecture', 'scenario.cjs': 'Copie locale (relecture', 'serveur.cjs': 'q.partie2,q.rouges' };

/* Règle la copie de la maquette de `dossier` ; rend la liste des fichiers modifiés. Lève si une ancre manque ou se répète. */
function regler(dossier) {
  const modifies = [];
  for (const f of Object.keys(DEJA)) {
    const chemin = path.join(dossier, f);
    let t = fs.readFileSync(chemin, 'utf8');
    if (t.includes(DEJA[f])) continue;
    for (const [fichier, ancre, nouveau] of REMPLACEMENTS) {
      if (fichier !== f) continue;
      const n = t.split(ancre).length - 1;
      if (n !== 1) throw Error(`Maquette inattendue : ${f} (${n} fois l'ancre « ${ancre.slice(0, 60)}… »). Extrais-la de nouveau de la branche claude/esv-locale-audit.`);
      t = t.replace(ancre, () => nouveau);
    }
    fs.writeFileSync(chemin, t); modifies.push(f);
  }
  // Une copie réglée par l'auteur précédent (majEspace=plus1, sans `surplace`) est complétée, pas refaite.
  const maq = path.join(dossier, 'esv-maquette.js');
  let m = fs.readFileSync(maq, 'utf8');
  if (m.includes("options.majEspace==='plus1'?validerEtPlusUn():validerEtSuivant()") && !m.includes("majEspace==='surplace'")) {
    m = m.replace("options.majEspace==='plus1'?validerEtPlusUn():validerEtSuivant()", "options.majEspace==='surplace'?majEspaceSurPlace():options.majEspace==='plus1'?validerEtPlusUn():validerEtSuivant()");
    m = m.replace(' function validerEtPlusUn(){', " function majEspaceSurPlace(){if(cutCourant().status==='valid')return validerSurPlace();return validerEtSuivant();}\n function validerEtPlusUn(){");
    fs.writeFileSync(maq, m); if (!modifies.includes('esv-maquette.js')) modifies.push('esv-maquette.js');
  }
  return modifies;
}
module.exports = { regler, REMPLACEMENTS };
if (require.main === module) {
  const d = process.argv[2];
  if (!d) { console.error('usage : node tools/relecture-maquette.cjs <DOSSIER>/tests/esv-maquette'); process.exit(2); }
  try { const m = regler(path.resolve(d)); console.log(m.length ? 'réglée : ' + m.join(', ') : 'déjà réglée'); } catch (e) { console.error(e.message); process.exit(1); }
}
