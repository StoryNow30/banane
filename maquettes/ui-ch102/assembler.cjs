'use strict';
/* CH-102 : fabrique l'app.contract de chaque proposition = l'en-tête `use` de sa vue, le modèle commun, puis sa vue.
 *   node maquettes/ui-ch102/assembler.cjs [DOSSIER_DE_SORTIE]   (par défaut : à côté de chaque vue)
 * Une vue commence par ses lignes `use … from "exact:content"`, puis une ligne `// ---`, puis le reste. */
const fs = require('node:fs'), path = require('node:path');
const ICI = __dirname, SORTIE = process.argv[2] || ICI, modele = fs.readFileSync(path.join(ICI, 'modele.contract'), 'utf8');
for (const nom of ['fiche', 'carte', 'bandeau']) {
  const [tete, corps] = fs.readFileSync(path.join(ICI, nom, 'vue.contract'), 'utf8').split('// ---\n');
  fs.mkdirSync(path.join(SORTIE, nom), { recursive: true });
  fs.writeFileSync(path.join(SORTIE, nom, 'app.contract'), `${tete}\n${modele}\n${corps}`);
  console.log(path.join(SORTIE, nom, 'app.contract'));
}
