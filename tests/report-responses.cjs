const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {filterResponses,responseFilterError,responsePage,responsesCsv}=require('../lib/report-responses.ts');
const row=(id,date,extra={})=>({id,formId:'quiz',submittedAt:date,totalPointsPossible:0,totalPointsEarned:0,percentageScore:100,passed:true,grading:[{questionId:'q',questionTitle:'Preference',userAnswer:'Bread'}],...extra});
const rows=[row('before','2026-10-24T23:59:59.999Z'),row('start','2026-10-25T00:00:00Z'),row('offset','2026-10-25T23:30:00-01:00'),row('end','2026-10-25T23:59:59.999Z'),row('next','2026-10-26T00:00:00Z'),row('unknown','invalid')];
assert.deepEqual(filterResponses(rows,{query:'',from:'2026-10-25',to:'2026-10-25'}).map(r=>r.id),['start','end']);
assert.equal(filterResponses(rows,{query:'',from:'',to:''}).length,6);
assert.deepEqual(filterResponses(rows,{query:'',from:'2026-10-26',to:''}).map(r=>r.id),['offset','next']);
for(const filters of [{from:'2026-02-30',to:''},{from:'not-date',to:''},{from:'2026-10-26',to:'2026-10-25'}]){assert.ok(responseFilterError({...filters,query:''}));assert.deepEqual(filterResponses(rows,{...filters,query:''}),[])}
const identity=row('name','2026-10-25',{contact:{name:'Alex Example',email:'alex@example.test'}});
assert.deepEqual(filterResponses([identity],{query:' ALEX@EXAMPLE.TEST ',from:'2026-10-25',to:'2026-10-25'}),[identity]);
const many=Array.from({length:51},(_,i)=>row(String(i),'2026-10-25'));
assert.equal(responsePage(many,1).rows.length,25);assert.equal(responsePage(many,2).rows.length,25);assert.equal(responsePage(many,3).rows.length,1);assert.equal(responsePage(many,99).page,3);assert.equal(responsePage(many.slice(0,2),3).page,1);assert.equal(responsePage([],3).start,0);
// RFC-style parser checks actual CSV cells, including quoted line breaks and commas.
function parse(csv){const result=[],current=[];let value='',quoted=false;for(let i=0;i<csv.length;i++){const c=csv[i];if(c==='"'){if(quoted&&csv[i+1]==='"'){value+='"';i++}else quoted=!quoted}else if(c===','&&!quoted){current.push(value);value=''}else if(c==='\r'&&csv[i+1]==='\n'&&!quoted){current.push(value);result.push([...current]);current.length=0;value='';i++}else value+=c}current.push(value);result.push(current);return result}
const risky=row('=unsafe','2026-10-25T00:00:00Z',{contact:{name:'  =HYPERLINK("x")',email:'+email@example.test',phone:'-123',marketingConsent:false},grading:[{questionId:'q',questionTitle:'=Question, "old"',userAnswer:'Line one, "quoted"\nLine two'}],marketing:{title:'@Outcome',categories:[{title:'Category',score:null}]}});
const renamed=row('two','2026-10-26',{grading:[{questionId:'q',questionTitle:'New wording',userAnswer:'Another answer'}]});
const legacy=row('legacy','invalid',{grading:undefined,answers:{deleted:['a','b'],object:{value:'stored'}}});
const csv=parse(responsesCsv([risky,renamed,legacy]));const headers=csv[0];assert.equal(csv.length,4);assert.equal(headers.length,csv[1].length);
assert.equal(csv[1][0],"'=unsafe");assert.equal(csv[1][2],"'  =HYPERLINK(\"x\")");assert.equal(csv[1][3],"'+email@example.test");assert.equal(csv[1][5],'Not opted in');assert.equal(csv[1][6],'','Marketing grading default is not a percentage score');
const old=headers.findIndex(h=>h.includes('Question,'));const latest=headers.indexOf('New wording [q]');assert.notEqual(old,latest);assert.equal(csv[1][old],'Line one, "quoted"\nLine two');assert.equal(csv[2][old],'');assert.equal(csv[2][latest],'Another answer');assert.equal(csv[3][headers.indexOf('Answer [deleted] (saved wording unavailable)')],'a; b');assert.equal(csv[3][headers.indexOf('Answer [object] (saved wording unavailable)')],'{"value":"stored"}');
assert.equal(parse(responsesCsv([rows[2]]))[1][1],'2026-10-26T00:30:00.000Z','CSV UTC heading matches normalized timestamp');
const structured=row('structured','2026-10-25',{grading:[],answers:{files:[{name:'example.txt',size:12}]}});assert.equal(parse(responsesCsv([structured]))[1].at(-1),'{"name":"example.txt","size":12}');
assert.equal(parse(responsesCsv(many)).length,52,'Export includes all matching pages');
console.log('PASS report responses: inclusive UTC/DST boundaries, malformed/reversed ranges, name/email search, pagination/clamping, all-page CSV, historical/legacy answers, honest scores and formula/quote/newline escaping.');
