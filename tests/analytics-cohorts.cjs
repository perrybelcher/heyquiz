const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(module,filename)=>module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,filename);
const {summarizeAnalytics}=require('../lib/analytics.ts');
const {analyticsDimensions,analyticsQuery,parseAnalyticsQuery,EMPTY_ANALYTICS_FILTERS,questionPerformanceCsv,AnalyticsQueryError}=require('../lib/analytics-filters.ts');
const now=Date.parse('2026-10-12T12:00:00.000Z'),day=86400000,v1='2026-10-01T08:30:00.000Z',v2='2026-10-08T09:45:00.001Z';
const choice=title=>({id:'choice',type:'multiple_choice',title,options:[{id:'a',label:'First'},{id:'b',label:'Second'}]});
const old={id:'quiz',publishedAt:v1,questions:[choice('Original question'),{id:'removed',type:'short_answer',title:'Removed historical question'}]};
const current={id:'quiz',publishedAt:v2,questions:[choice('Renamed question')]};
const row=(id,extra={})=>({id,payload:{form:old,startedAt:now-2*day,preview:false,reached:['choice'],analyticsVersion:1,lastSeenAt:now-day,lastQuestionId:'choice',attribution:{version:1,source:'newsletter',campaign:'Autumn'},...extra}});
const sub=(id,extra={})=>({id,formId:'quiz',submittedAt:new Date(now-day).toISOString(),answers:{choice:'a'},...extra});
const rows=[
 row('a',{completed:true,completedAt:now-2*day+120000,resultViewedAt:now-day,offerClickedAt:now-day}),
 row('b',{reached:['choice','removed'],lastQuestionId:'removed'}),
 row('c',{form:current,attribution:{version:1,source:'ads',campaign:'Autumn'},completed:true,completedAt:now-2*day+60000,resultViewedAt:now-day}),
 row('d',{form:current,attribution:{version:1,source:'ads',campaign:'Spring'},lastSeenAt:now-100}),
 row('legacy',{form:{...old,publishedAt:undefined},attribution:undefined,analyticsVersion:undefined,completed:true}),
 row('unknown',{attribution:{version:1}}),
 row('literal',{form:current,attribution:{version:1,source:'all',campaign:'unknown'},completed:true}),
 row('prior-match',{startedAt:now-9*day}),row('prior-other',{form:current,startedAt:now-9*day,attribution:{version:1,source:'ads',campaign:'Autumn'},completed:true}),
 row('preview',{preview:true,attribution:{version:1,source:'preview-only'}}),
 row('future',{startedAt:now+day,attribution:{version:1,source:'future-only'}}),
 row('foreign',{form:{...current,id:'foreign'},attribution:{version:1,source:'foreign-only'}})
];
const submissions=[sub('a',{contact:{email:'PRIVATE-CONTACT',marketingConsent:true},marketing:{title:'First result'}}),sub('c',{answers:{choice:'b'},marketing:{title:'Second result'}}),sub('legacy'),sub('literal'),sub('prior-other'),sub('preview'),sub('unlinked',{answers:{choice:'PRIVATE-ANSWER'}})];
const filters=extra=>({...EMPTY_ANALYTICS_FILTERS,...extra});
const summary=(f={},range='7')=>summarizeAnalytics(current,rows,submissions,range,now,[],filters(f));
let checks=0;function test(name,fn){fn();checks++;console.log('PASS '+name);}

test('typed IDs preserve literal reserved labels and referral-vs-UTM identity',()=>{
 for(const source of ['all','unknown','publisher.example'])assert.equal(analyticsDimensions({form:{},attribution:{version:1,source}}).source,'utm:'+source);
 assert.equal(analyticsDimensions({form:{},attribution:{version:1,referrerHost:'publisher.example'}}).source,'ref:publisher.example');
 const literal=summary({source:'utm:all',campaign:'value:unknown'});assert.equal(literal.starts,1);assert.equal(literal.completions,1);
 assert.equal(summary({campaign:'unknown'}).starts,2);
});
test('exact filter query round-trips Unicode spaces and typed publication IDs',()=>{
 const f=filters({source:'utm:Café launch',campaign:'value:all',version:'published:'+v2});assert.deepEqual(parseAnalyticsQuery(new URLSearchParams(analyticsQuery('7',f))),{range:'7',filters:f});
 assert.deepEqual(parseAnalyticsQuery(new URLSearchParams()),{range:'30',filters:filters()});
 for(const query of ['source=all','campaign=value%3A','source=utm%3Aprivate%40example.com','source=ref%3AEXAMPLE.COM','version=published%3A2026-02-30T00%3A00%3A00.000Z','range=5','range=7&range=30','source=unknown&source=','campaign=unknown&campaign=unknown','typo=unknown','source='+encodeURIComponent('utm:'+'x'.repeat(321))])assert.throws(()=>parseAnalyticsQuery(new URLSearchParams(query)),AnalyticsQueryError,query);
});
test('all metrics reconcile to one source/campaign/version cohort',()=>{
 const a=summary({source:'utm:newsletter',campaign:'value:Autumn',version:'published:'+v1});
 assert.equal(a.starts,2);assert.equal(a.completions,1);assert.equal(a.leads,1);assert.equal(a.consentedLeads,1);assert.equal(a.completionRate,50);assert.equal(a.leadRate,50);assert.equal(a.medianSeconds,120);assert.equal(a.timedCompletions,1);assert.equal(a.resultViews,1);assert.equal(a.offerClicks,1);assert.equal(a.offerClickRate,100);assert.equal(a.trackedCompletions,1);assert.equal(a.measuredSessions,2);assert.equal(a.quietSessions,1);
 assert.equal(a.days.reduce((n,d)=>n+d.starts,0),2);assert.equal(a.days.reduce((n,d)=>n+d.completions,0),1);assert.equal(a.days.reduce((n,d)=>n+d.leads,0),1);
 assert.deepEqual(a.segments,[{title:'First result',completions:1,leads:1,clicks:1}]);
 assert.equal(a.questions.find(q=>q.questionId==='choice').reached,2);assert.equal(a.questions.find(q=>q.questionId==='removed').quiet,1);
 assert.equal(a.answerDistributions.linkedCompletions,1);assert.equal(a.answerDistributions.withStoredAnswers,1);assert.equal(a.answerDistributions.questions.find(q=>!q.current).answered,1);
 assert.equal(a.attribution.sources.reduce((n,s)=>n+s.starts,0),2);assert.equal(a.attribution.campaigns.reduce((n,s)=>n+s.completions,0),1);
});
test('source, campaign and published-version partitions each sum to the same report',()=>{
 const all=summary();for(const dimension of ['source','campaign','version']){
  const parts=all.cohort.options[dimension].filter(option=>option.value).map(option=>summary({[dimension]:option.value}));
  for(const metric of ['starts','completions','leads','consentedLeads','resultViews','offerClicks','quietSessions','measuredSessions','trackedCompletions','timedCompletions'])assert.equal(parts.reduce((n,p)=>n+p[metric],0),all[metric],dimension+':'+metric);
 }
});
test('previous period uses identical cohort while all-time has no invented comparison',()=>{
 const a=summary({source:'utm:newsletter',version:'published:'+v1});assert.equal(a.previousStarts,1);assert.equal(a.completionChange,50);
 const other=summary({source:'utm:ads'});assert.equal(other.previousStarts,1);assert.equal(other.completionChange,-50);
 const allTime=summary({source:'utm:newsletter'},'all');assert.equal(allTime.starts,3);assert.equal(allTime.previousStarts,0);assert.equal(allTime.completionChange,null);
});
test('unknown publication never derives from current draft/revision and legacy coverage stays explicit',()=>{
 const unknown=summary({version:'unknown'});assert.equal(unknown.starts,1);assert.equal(unknown.attribution.legacyStarts,1);assert.equal(unknown.measuredSessions,0);assert.equal(unknown.resultViews,0);assert.equal(unknown.offerClickRate,null);
 for(const bad of [undefined,'all','unknown','2026-02-30T00:00:00.000Z'])assert.equal(analyticsDimensions({form:{publishedAt:bad,revision:99}}).version,'unknown');
 const changedDraft={...current,publishedAt:'2030-01-01T00:00:00.000Z',revision:999};const a=summarizeAnalytics(changedDraft,rows,submissions,'7',now,[],filters({version:'published:'+v1}));assert.equal(a.starts,3);
});
test('zero-match cohorts keep null denominators and do not fall back to unfiltered counts',()=>{
 const a=summary({source:'utm:newsletter',version:'published:'+v2});assert.equal(a.starts,0);assert.equal(a.completions,0);assert.equal(a.completionRate,null);assert.equal(a.offerClickRate,null);assert.equal(a.medianSeconds,null);assert.equal(a.answerDistributions.linkedCompletions,0);assert.equal(a.attribution.sources.length,0);assert.equal(a.days.reduce((n,d)=>n+d.starts,0),0);
});
test('previews, foreign quizzes and future starts cannot add metrics or filter options',()=>{
 const a=summary();assert.equal(a.starts,7);const json=JSON.stringify(a);for(const value of ['preview-only','future-only','foreign-only','PRIVATE-CONTACT','PRIVATE-ANSWER'])assert.ok(!json.includes(value),value);
});
test('unlinked responses are explicitly date-only and never inferred into the selected cohort',()=>{
 const a=summary({source:'utm:newsletter'});assert.equal(a.unlinkedSubmissions,1);assert.equal(a.cohort.unlinkedSubmissionsScope,'date-only-unassignable');assert.equal(a.completions,1);assert.equal(a.cohort.landingScope,'unfiltered');assert.equal(a.cohort.active,true);assert.equal(summary().cohort.active,false);
});
test('question performance and CSV preserve each historical wording and matching counts',()=>{
 const a=summary({version:'published:'+v1});const q=a.questions.find(q=>q.questionId==='choice');assert.equal(q.title,'Original question (earlier wording)');assert.equal(q.reached,3);assert.equal(q.completed,1);
 const both=summary();assert.equal(both.questions.filter(q=>q.questionId==='choice').length,2);assert.equal(both.questions.filter(q=>q.questionId==='choice').reduce((n,q)=>n+q.reached,0),7);
 const csv=questionPerformanceCsv(a);assert.ok(csv.includes('"Original question (earlier wording)","3","1"'));assert.ok(csv.includes(v1));assert.ok(!csv.includes('Renamed question'));assert.ok(csv.includes('All sources'));
 const dangerous=questionPerformanceCsv({...a,questions:[{title:'=DANGEROUS()',reached:1,completed:0,quiet:0,measured:1}]});assert.ok(dangerous.includes('"\'=DANGEROUS()"'));
});
test('real Unknown campaign labels do not combine with absent campaigns in attribution tables',()=>{
 const isolated=[row('real',{attribution:{version:1,source:'x',campaign:'Unknown campaign'}}),row('missing',{attribution:{version:1,source:'x'}})];
 const a=summarizeAnalytics(current,isolated,[],'7',now);assert.equal(a.attribution.campaignGroups,2);assert.notEqual(a.attribution.campaigns[0].id,a.attribution.campaigns[1].id);
});
console.log(`${checks} analytics cohort checks passed.`);
