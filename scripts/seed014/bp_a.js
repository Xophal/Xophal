// Starter blueprints A (3 of 6). filter: {topic_slugs, types, dmin, dmax, skills, tags, pyq_only}
module.exports = [
{ slug:'ch1-balancing-topic-test', name:'Balancing Equations - Topic Test', kind:'topic',
  desc:'Focused practice on writing and balancing chemical equations.',
  duration:600, marks:10, marking:{ default_marks:1, default_neg_marks:0.25 },
  shuffleQ:true, shuffleO:true,
  sections:[
   { title:'Balancing practice', pos:0, count:10, mpq:1, neg:0.25, instr:'Choose the correctly balanced equation.',
     filter:{ topic_slugs:['balancing-equations'], types:['mcq','fill_blank','equation'], dmin:1, dmax:2, skills:['recall','application'], tags:['balancing'], pyq_only:false } },
  ] },
{ slug:'ch1-full-chapter-30', name:'Chemical Reactions - Full Chapter Test (30 Q)', kind:'full_chapter',
  desc:'Full-chapter sweep across all topics and question types.',
  duration:3600, marks:34, marking:{ default_marks:1, default_neg_marks:0.25 },
  shuffleQ:true, shuffleO:true,
  sections:[
   { title:'Objective sweep', pos:0, count:12, mpq:1, neg:0.25, instr:'Single-correct MCQs.',
     filter:{ topic_slugs:['balancing-equations','types-of-reactions','redox-reactions','exothermic-endothermic','corrosion','rancidity'], types:['mcq'], dmin:1, dmax:3, skills:['recall','application','reasoning'], tags:[], pyq_only:false } },
   { title:'Reasoning set', pos:1, count:8, mpq:1, neg:0.25, instr:'Assertion-reason, statements and match.',
     filter:{ topic_slugs:['balancing-equations','types-of-reactions','redox-reactions','exothermic-endothermic','corrosion','rancidity'], types:['assertion_reason','statement','match'], dmin:1, dmax:3, skills:['recall','application','reasoning'], tags:[], pyq_only:false } },
   { title:'Write and balance', pos:2, count:6, mpq:1, neg:0, instr:'Fill blanks and balance equations.',
     filter:{ topic_slugs:['balancing-equations','types-of-reactions','redox-reactions','exothermic-endothermic','rancidity'], types:['fill_blank','equation'], dmin:1, dmax:3, skills:['recall','application'], tags:[], pyq_only:false } },
   { title:'Short answers', pos:3, count:4, mpq:2, neg:0, instr:'Two-mark questions.',
     filter:{ topic_slugs:['types-of-reactions','redox-reactions','corrosion','rancidity','exothermic-endothermic','balancing-equations'], types:['short'], dmin:1, dmax:3, skills:['recall','application','reasoning'], tags:[], pyq_only:false } },
  ] },
{ slug:'ch1-assertion-reason-test', name:'Assertion-Reason Test - Chemical Reactions', kind:'custom',
  desc:'Eight assertion-reason questions across the chapter.',
  duration:900, marks:8, marking:{ default_marks:1, default_neg_marks:0.25 },
  shuffleQ:true, shuffleO:true,
  sections:[
   { title:'Assertion-Reason', pos:0, count:8, mpq:1, neg:0.25, instr:'Use the standard option codes.',
     filter:{ topic_slugs:['balancing-equations','types-of-reactions','redox-reactions','exothermic-endothermic','corrosion','rancidity'], types:['assertion_reason'], dmin:1, dmax:3, skills:['recall','application','reasoning'], tags:[], pyq_only:false } },
  ] },
];
