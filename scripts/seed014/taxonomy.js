// Shared taxonomy constants for the Phase-1 seed builder.
module.exports = {
TOPICS: [
 { code:'balancing-equations', name:'Chemical Equations and Balancing', slug:'balancing-equations', order:1, subs:[
  { code:'word-equations', name:'Word and Skeletal Equations', slug:'word-equations', order:1 },
  { code:'hit-and-trial', name:'Balancing by Hit and Trial', slug:'hit-and-trial', order:2 },
  { code:'state-symbols', name:'State Symbols and Conditions', slug:'state-symbols', order:3 } ] },
 { code:'types-of-reactions', name:'Types of Chemical Reactions', slug:'types-of-reactions', order:2, subs:[
  { code:'combination-reactions', name:'Combination Reactions', slug:'combination-reactions', order:1 },
  { code:'decomposition-reactions', name:'Decomposition Reactions', slug:'decomposition-reactions', order:2 },
  { code:'displacement-reactions', name:'Displacement Reactions', slug:'displacement-reactions', order:3 },
  { code:'double-displacement', name:'Double Displacement and Precipitation', slug:'double-displacement', order:4 } ] },
 { code:'redox-reactions', name:'Oxidation and Reduction (Redox)', slug:'redox-reactions', order:3, subs:[
  { code:'oxidation-reduction-defs', name:'Oxidation and Reduction Definitions', slug:'oxidation-reduction-defs', order:1 },
  { code:'oxidizing-reducing-agents', name:'Oxidising and Reducing Agents', slug:'oxidizing-reducing-agents', order:2 },
  { code:'electronic-concept', name:'Electronic Concept of Redox', slug:'electronic-concept', order:3 } ] },
 { code:'exothermic-endothermic', name:'Exothermic and Endothermic Reactions', slug:'exothermic-endothermic', order:4, subs:[
  { code:'respiration-combustion', name:'Respiration and Combustion', slug:'respiration-combustion', order:1 },
  { code:'thermal-decomposition-heat', name:'Heat in Decomposition', slug:'thermal-decomposition-heat', order:2 } ] },
 { code:'corrosion', name:'Corrosion of Metals', slug:'corrosion', order:5, subs:[
  { code:'rusting-of-iron', name:'Rusting of Iron', slug:'rusting-of-iron', order:1 },
  { code:'prevention-of-corrosion', name:'Prevention of Corrosion', slug:'prevention-of-corrosion', order:2 } ] },
 { code:'rancidity', name:'Rancidity of Fats and Oils', slug:'rancidity', order:6, subs:[
  { code:'causes-of-rancidity', name:'Causes of Rancidity', slug:'causes-of-rancidity', order:1 },
  { code:'prevention-rancidity', name:'Prevention of Rancidity', slug:'prevention-rancidity', order:2 } ] },
]};
