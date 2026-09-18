'use strict';
// Sauvegarde la composition runtime V4.6 juste avant que la copie scientifique
// de Geometry Candidate V1 n'utilise temporairement le nom global BananeGeometry3.
// gcv1-shadow.js restaure ensuite BananeGeometry3 sous forme d'un wrapper qui
// rend toujours la décision runtime V4.6 et ne fait qu'observer GCV1.
globalThis.BananeGeometryRuntimeV46=globalThis.BananeGeometry3;
