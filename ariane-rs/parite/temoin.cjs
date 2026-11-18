'use strict';
/* CH-064 : adaptateur TÉMOIN du banc de parité. Le « module JS » est l'identité (clone structuré) ; le « port » est la
 * fonction 0 du cœur (écho VBA). Il éprouve le banc lui-même : identité attendue sur tout, exceptions comprises.
 * Un second cas volontairement faux (rs altère −0) vérifie que le banc VOIT un écart (tools/ch064-essais.cjs). */
const CAS=[0,-0,NaN,'é',[1,,3],[[1,2,3],[4,5,6]],{a:undefined,b:[true,false]},{'2':1,'1':2,z:[]}];
module.exports={nom:'temoin',description:'identité, par l’écho du cœur',sources:[],
 *cas(){let i=0;for(const entree of CAS)yield {id:'synthetique-'+(i++),entree};yield {id:'refus',entree:new Date(0)};},
 js(entree){if(entree instanceof Date)throw new TypeError('VBA : objet non simple : Date');return structuredClone(entree);},
 rs(entree,coeur){return coeur.appeler(0,entree);}};
