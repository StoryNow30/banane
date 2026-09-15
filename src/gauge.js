(function(root,factory){const api=factory();
 if(typeof module==='object')module.exports=api;else root.BananeGauge4=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const RULE=Object.freeze({version:'gauge-range-v1',minimumMm:1430,maximumMm:1470});
 const OPERATOR_RULES=Object.freeze([
   Object.freeze({id:'below-1410',minimumMm:null,maximumMm:1410,minimumInclusive:false,maximumInclusive:false,outcome:'SKIP'}),
   Object.freeze({id:'tolerance-1410-1430',minimumMm:1410,maximumMm:1430,minimumInclusive:true,maximumInclusive:false,outcome:'VALIDATE_WITH_TOLERANCE'}),
   Object.freeze({id:'nominal-1430-1470',minimumMm:1430,maximumMm:1470,minimumInclusive:true,maximumInclusive:true,outcome:'VALIDATE'}),
   Object.freeze({id:'above-1470',minimumMm:1470,maximumMm:null,minimumInclusive:false,maximumInclusive:false,outcome:'SKIP'})
 ]);
 function parse(rawText){
   if(typeof rawText!=='string'||!rawText.trim()||/^\s*[—-]\s*$/.test(rawText))return {status:'indeterminate',rawText,reason:'missing-value'};
   const normalized=rawText.replace(/[\u00a0\u202f]/g,' ').trim();
   const match=normalized.match(/^(\d{1,3}(?: \d{3})+|\d+)(?:[,.](\d+))?\s*mm$/i);
   if(!match)return {status:'indeterminate',rawText,reason:'unsupported-format-or-unit'};
   const integer=match[1].replace(/ /g,''),valueMm=Number(integer+(match[2]?'.'+match[2]:''));
   if(!Number.isFinite(valueMm)||valueMm<=0)return {status:'indeterminate',rawText,reason:'invalid-value'};
   return {status:'measured',rawText,valueMm,unit:'mm'};
 }
 function classify(measurement,rule=RULE){
   if(measurement?.status!=='measured'||!Number.isFinite(measurement.valueMm))return {status:'indeterminate',ruleVersion:rule.version,reason:measurement?.reason||'missing-measurement'};
   const valueMm=measurement.valueMm,status=valueMm<rule.minimumMm?'below-range':valueMm>rule.maximumMm?'above-range':'within-range';
   return {status,valueMm,minimumMm:rule.minimumMm,maximumMm:rule.maximumMm,ruleVersion:rule.version};
 }
 function assessOperatorPolicy(measurement,rules=OPERATOR_RULES){
   if(measurement?.status!=='measured'||!Number.isFinite(measurement.valueMm))return {status:'indeterminate',outcomes:[],reason:measurement?.reason||'missing-measurement'};
   const valueMm=measurement.valueMm,contains=(rule)=>
     (rule.minimumMm===null||(rule.minimumInclusive?valueMm>=rule.minimumMm:valueMm>rule.minimumMm))&&
     (rule.maximumMm===null||(rule.maximumInclusive?valueMm<=rule.maximumMm:valueMm<rule.maximumMm));
   const matches=rules.filter(contains),outcomes=[...new Set(matches.map(r=>r.outcome))];
   return {status:outcomes.length===1?'specified':outcomes.length>1?'ambiguous':'uncovered',valueMm,outcomes,ruleIds:matches.map(r=>r.id),
     automaticDecisionAllowed:false};
 }
 return {RULE,OPERATOR_RULES,parse,classify,assessOperatorPolicy};
});
