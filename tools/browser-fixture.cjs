const fs=require('node:fs'),path=require('node:path');const root=path.resolve(__dirname,'..');
let html=fs.readFileSync(path.join(root,'panel.html'),'utf8');
html=html.replace('<head>','<head><base href="../../">').replace('<body>','<body><aside style="padding:10px;background:#ffe4cd;border-bottom:2px solid #9b5b27"><strong id="fixture-cut">SIMULATION ESV</strong> — APIs Chrome simulées, IndexedDB du navigateur réel. <button id="fixture-next">Simulation : cut suivant</button> <button id="fixture-reset">Réinitialiser la simulation</button></aside>');
const files=['vendor/capture-core.js','src/core.js','src/geometry.js','src/engine.js','src/storage.js','tests/browser/harness.js','background.js'];
html=html.replace('<script src="panel.js">',files.map(f=>`<script src="${f}"></script>`).join('\n')+'\n<script src="panel.js">');
fs.writeFileSync(path.join(root,'tests/browser/panel.html'),html);
console.log('Fixture web écrite : tests/browser/panel.html. Ce fichier ne charge pas une extension.');
