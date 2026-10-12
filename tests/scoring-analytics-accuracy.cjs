const assert = require('node:assert/strict');
const fs = require('node:fs'), ts = require('typescript');
require.extensions['.ts'] = (m,f) => m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const {evaluateMarketing,MarketingSchema}=require('../lib/marketing.ts');
const {gradeQuizSubmission:grade}=require('../lib/scoring.ts');
const {summarizeAnalytics}=require('../lib/analytics.ts');
const {FormSchema}=require('../lib/schema.ts');
let checks=0;
function test(name,fn){fn();checks++;console.log('PASS '+name);}
const question=(id,type='multiple_choice')=>({id,title:id,type,points:10,options:[{id:'zero',label:'Zero'},{id:'half',label:'Half'},{id:'full',label:'Full'}]});
const base={id:'accuracy',title:'Accuracy fixture',mode:'survey',settings:{},theme:{},outcomeTiers:[],questions:[question('q1'),question('q2')]};
const scorecard={...base,marketing:MarketingSchema.parse({kind:'scorecard',categories:[{id:'c',title:'Category',minAnswers:2}],rules:['q1','q2'].flatMap((questionId)=>['zero','half','full'].map((answerId,i)=>({id:questionId+answerId,questionId,answerId,targetId:'c',points:i*5})))})};
test('all nine weighted single-choice combinations match hand-calculated percentages',()=>{
 const ids=['zero','half','full']; const expected=[[0,25,50],[25,50,75],[50,75,100]];
 ids.forEach((a,i)=>ids.forEach((b,j)=>assert.equal(evaluateMarketing(scorecard,{q1:a,q2:b}).categories[0].score,expected[i][j])));
});
test('missing, unknown and zero-point answers remain distinct',()=>{
 for(const answers of [{q1:'full'},{q1:'full',q2:'unknown'},{q1:'full',q2:[]}]) assert.equal(evaluateMarketing(scorecard,answers).categories[0].score,null);
 assert.equal(evaluateMarketing(scorecard,{q1:'zero',q2:'zero'}).categories[0].answered,2);
});
test('all multiselect subsets score correctly and repeated IDs do not inflate points',()=>{
 const f=structuredClone(scorecard);f.questions=[question('q1','multiselect')];f.marketing.categories[0].minAnswers=1;f.marketing.rules=f.marketing.rules.filter(r=>r.questionId==='q1');
 const cases=[[[],null],[['zero'],0],[['half'],33],[['full'],67],[['half','full'],100],[['zero','half','full'],100],[['half','half'],33]];
 for(const [selected,expected] of cases) assert.equal(evaluateMarketing(f,{q1:selected}).categories[0].score,expected);
});
test('invalid negative, nonfinite and excessive marketing points are rejected',()=>{
 for(const points of [-1,NaN,Infinity,101]){const m=structuredClone(scorecard.marketing);m.rules[0].points=points;assert.equal(MarketingSchema.safeParse(m).success,false);}
 const f=structuredClone(base);f.questions[0].points=-1;assert.equal(FormSchema.safeParse(f).success,false);
});
test('product threshold is inclusive, ties follow declared order, exclusions override points',()=>{
 const f={...base,marketing:MarketingSchema.parse({kind:'product_finder',outcomes:[{id:'a',title:'A',minPoints:10},{id:'b',title:'B',minPoints:10}],rules:[{id:'a1',questionId:'q1',answerId:'full',targetId:'a',points:10},{id:'b1',questionId:'q1',answerId:'full',targetId:'b',points:10},{id:'exclude',questionId:'q2',answerId:'zero',targetId:'a',effect:'exclude'}]})};
 assert.equal(evaluateMarketing(f,{q1:'full'}).outcomeId,'a');assert.equal(evaluateMarketing(f,{q1:'full',q2:'zero'}).outcomeId,'b');f.marketing.outcomes.forEach(o=>o.minPoints=11);assert.equal(evaluateMarketing(f,{q1:'full'}).status,'no_match');
});
test('knowledge partial credit, penalties and threshold boundaries are exact',()=>{
 const f={...base,mode:'quiz',questions:[{...question('q1','multiselect'),options:[{id:'a',label:'A',isCorrect:true},{id:'b',label:'B',isCorrect:true},{id:'c',label:'C'}]}],settings:{passingScorePercentage:50},outcomeTiers:[{id:'low',title:'Low',minScorePercent:0,maxScorePercent:49},{id:'high',title:'High',minScorePercent:50,maxScorePercent:100}]};
 for(const [a,points] of [[[],0],[['a'],5],[['a','b'],10],[['a','c'],0],[['a','b','c'],5],[['a','a'],5]]){const r=grade(f,{q1:a});assert.equal(r.totalPointsEarned,points);assert.equal(r.passed,points>=5);assert.equal(r.matchedTier.id,points>=5?'high':'low');}
});
test('known funnel reconciles totals, rates, consent, median, clicks and question exits',()=>{
 const now=Date.parse('2026-10-09T12:00:00Z'),startedAt=now-7200000;
 const rows=Array.from({length:10},(_,i)=>({id:'a'+i,payload:{form:base,startedAt,preview:false,analyticsVersion:1,reached:i<8?['q1','q2']:['q1'],lastQuestionId:i<8?'q2':'q1',lastSeenAt:i===9?now:startedAt,completed:i<6,completedAt:i<6?startedAt+(i+1)*10000:undefined,resultViewedAt:i<5?now-1000:undefined,offerClickedAt:i<2?now:undefined}}));
 const subs=rows.slice(0,6).map((r,i)=>({id:r.id,formId:base.id,submittedAt:new Date(now).toISOString(),...(i<4?{contact:{email:'synthetic@example.test',marketingConsent:i<3}}:{}),marketing:{title:i<3?'A':'B'}}));
 rows.push({id:'preview',payload:{...rows[0].payload,preview:true}});
 const a=summarizeAnalytics(base,rows,subs,'7',now);
 for(const [key,value] of Object.entries({starts:10,completions:6,leads:4,consentedLeads:3,completionRate:60,leadRate:40,medianSeconds:35,resultViews:5,offerClicks:2,offerClickRate:40,quietSessions:3}))assert.equal(a[key],value,key);
 assert.deepEqual(a.questions.map(q=>[q.reached,q.completed,q.quiet,q.quietRate]),[[10,6,1,10],[8,6,2,25]]);
 assert.equal(a.days.reduce((n,d)=>n+d.starts,0),10);assert.equal(a.days.reduce((n,d)=>n+d.completions,0),6);assert.equal(a.days.reduce((n,d)=>n+d.leads,0),4);
 assert.equal(a.segments.reduce((n,s)=>n+s.completions,0),6);assert.equal(a.segments.reduce((n,s)=>n+s.clicks,0),2);assert.ok(!JSON.stringify(a).includes('synthetic@example.test'));
});
console.log(`${checks} extended scoring/analytics groups passed.`);
