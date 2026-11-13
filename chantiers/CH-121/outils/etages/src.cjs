'use strict';
/* CH-121 : l'étage tel que le patch le met dans src/gcv2-l1.js (`ajusterPoseFinale`), lu dans la copie désignée par CH121_CODE (copie de HEAD + patch). */
const path = require('node:path');
const G = require(path.join(process.env.CH121_CODE || path.join(__dirname, '../../../..'), 'src/gcv2-l1.js'));
module.exports = { ajuster: (capture, decal, R) => G.ajusterPoseFinale(capture, decal, R) };
