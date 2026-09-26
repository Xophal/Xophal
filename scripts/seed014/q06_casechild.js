// Q28-Q31 case children + case parent 2
module.exports = [
{ code:'Q28', t:'mcq', topic:'types-of-reactions', sub:'decomposition-reactions', d:2, skill:'application', marks:1, neg:0.25, time:45, board:'CBSE', pyq:null, parent:'Q26',
stem:'(Case Q26) The gases evolved with the smell of burning sulphur are:',
opts:[['O2 and H2',0],['SO2 and SO3',1],['CO and CO2',0],['Cl2 and HCl',0]],
rub:'Sulphur oxides smell of burning sulphur.', expl:'Decomposition releases SO2 and SO3, both pungent sulphur oxides.', tags:['case-child','sulphur-oxides'] },
{ code:'Q29', t:'assertion_reason', topic:'types-of-reactions', sub:'decomposition-reactions', d:2, skill:'reasoning', marks:1, neg:0.25, time:60, board:'CBSE', pyq:null, parent:'Q26',
stem:'(Case Q26) A: Heating ferrous sulphate is a decomposition reaction. R: A single reactant breaks into two or more products.',
opts:[['Both true, R explains A',1],['Both true, unrelated',0],['A true, R false',0],['A false, R true',0]],
rub:'One reactant splitting defines decomposition.', expl:'One reactant FeSO4 gives three products, matching the decomposition definition.', tags:['case-child','assertion-reason'] },
{ code:'Q30', t:'case_based', topic:'corrosion', sub:'rusting-of-iron', d:2, skill:'application', marks:0, neg:0, time:30, board:'CBSE', pyq:null,
stem:'CASE STUDY: Two identical iron nails: nail A kept in dry air, nail B in a test tube with boiled distilled water plus oil layer and CaCl2 drying tube. After a week only one nail rusts. Answer Q31-Q33 below.',
opts:[], rub:'Parent passage carries no marks.', expl:'Rusting needs both air (oxygen) and moisture; excluding either stops rust.', tags:['case-study','rusting'] },
{ code:'Q31', t:'mcq', topic:'corrosion', sub:'rusting-of-iron', d:1, skill:'recall', marks:1, neg:0.25, time:45, board:'CBSE', pyq:null, parent:'Q30',
stem:'(Case Q30) Which nail rusts and why?',
opts:[['Nail A, dry air supplies both needs',0],['Neither rusts',0],['Nail kept with both air and moisture (control not listed rusts); set-up shows both are needed',1],['Nail B, oil causes rusting',0]],
rub:'Both oxygen and water are necessary.', expl:'Rust forms only with oxygen AND moisture; the controlled tubes isolate each factor, proving both are required.', tags:['case-child','rusting'] },
];
