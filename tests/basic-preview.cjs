const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), ts = require('typescript'), Module = require('node:module');
for (const extension of ['.ts', '.tsx']) require.extensions[extension] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, f);
const resolve = Module._resolveFilename;
Module._resolveFilename = function(name, ...args) { return resolve.call(this, name.startsWith('@/') ? path.resolve(__dirname, '..', name.slice(2)) : name, ...args); };
const React = require('react'), { renderToStaticMarkup } = require('react-dom/server');
const { FormSchema } = require('../lib/schema.ts');
const { appearanceResult, default: Preview } = require('../components/basic/BasicVisitorPreview.tsx');
const QuizSettings = require('../components/basic/BasicQuizSettings.tsx').default;
const PublishSettings = require('../components/basic/BasicPublishSettings.tsx').default;
const fixture = () => FormSchema.parse({ id: 'preview-fixture', title: 'Synthetic preview', mode: 'survey', quizType: 'personality', questions: Array.from({length:30}, (_, index) => ({id:`q${index + 1}`,title:`Question ${index + 1}`,type:'multiple_choice',options:[{id:'a',label:'First answer'},{id:'b',label:'Second answer'}]})), marketing:{kind:'segmentation',outcomes:[{id:'planner',title:'Planner',description:'Plans first',advice:'Try a checklist'},{id:'explorer',title:'Explorer',description:'Experiments first',advice:'Try a prototype',ctaLabel:'Next step',ctaUrl:'https://example.test/next'}],rules:[],resultSections:[{id:'common',type:'text',title:'Shared',body:'Shared details'},{id:'planner-only',type:'text',title:'Planner details',body:'Plan details',condition:{type:'outcome',outcomeId:'planner'}},{id:'explorer-only',type:'text',title:'Explorer details',body:'Explore details',condition:{type:'outcome',outcomeId:'explorer'}}]} });
const render = (component, props) => renderToStaticMarkup(React.createElement(component,props));
let requests = 0; const oldFetch = global.fetch; global.fetch = () => { requests++; throw Error('Preview made a request'); };
try {
  const form = fixture(), before = JSON.stringify(form);
  const selected = appearanceResult(form,'explorer');
  assert.equal(selected.title,'Explorer'); assert.equal(selected.message,'Experiments first'); assert.equal(selected.advice,'Try a prototype');
  assert.deepEqual(selected.reasons,[]); assert.deepEqual(selected.resultSections.map(item=>item.id),['common','explorer-only']);
  assert.equal(selected.overallScore,undefined); assert.equal(JSON.stringify(form),before);
  const resultHtml=render(Preview,{form,step:2,resultId:'explorer'});
  assert.ok(resultHtml.includes('Appearance preview')); assert.ok(resultHtml.includes('Explorer')); assert.ok(!resultHtml.includes('Planner details'));
  assert.ok(!resultHtml.includes('Overall score'));
  const lastHtml=render(Preview,{form,step:1,questionId:'q30'});
  assert.ok(lastHtml.includes('Question 30 of 30')); assert.ok(lastHtml.includes('First answer'));
  const styled=structuredClone(form);styled.theme.primaryColor='#123456';
  assert.deepEqual(appearanceResult(styled,'explorer'),selected,'Theme edits must not change projected result content');
  const attachmentModule=require('../components/AttachmentField.tsx'), challengeModule=require('../components/Challenge.tsx');
  const savedAttachment=attachmentModule.default, savedChallenge=challengeModule.default;
  attachmentModule.default=()=>{throw Error('AttachmentField must not mount in appearance preview');};
  challengeModule.default=()=>{throw Error('Challenge must not mount in appearance preview');};
  try {
    for(const type of ['file_upload','image_upload','audio_recorder','captcha','video_embed']) {
      const variant=structuredClone(form);variant.questions[0].type=type;variant.questions[0].videoUrl='https://www.youtube.com/watch?v=example';
      const html=render(Preview,{form:variant,step:1,questionId:'q1'});
      assert.ok(html.includes(type==='captcha'?'No challenge request is made here':type==='audio_recorder'?'microphone access and uploads are disabled here':type==='video_embed'?'external video player is not loaded here':'Uploads are disabled here'),type);
      assert.ok(!html.includes('type="file"'),type+' must not expose an upload input');
      assert.ok(!html.includes('Start recording'),type+' must not request microphone access');
      assert.ok(!html.includes('<iframe'),type+' must not load an external player');
    }
  }finally{attachmentModule.default=savedAttachment;challengeModule.default=savedChallenge;}
  const score=structuredClone(form);score.quizType='scorecard';score.marketing.kind='scorecard';score.marketing.outcomes=[];score.marketing.categories=[{id:'followup',title:'Follow-up',description:'Responding to enquiries',minAnswers:2}];score.marketing.scorecard={title:'Health check',message:'From your answers',bands:[{id:'steady',title:'Steady foundation',advice:'Improve follow-up',min:40,max:69,ctaLabel:'Learn',ctaUrl:''}]};
  const scorePreview=appearanceResult(score,'steady');assert.equal(scorePreview.title,'Steady foundation');assert.equal(scorePreview.overallScore,null);assert.equal(scorePreview.categories[0].score,null);assert.equal(scorePreview.categories[0].answered,0);
  const knowledge=structuredClone(form);knowledge.mode='quiz';knowledge.quizType='knowledge';delete knowledge.marketing;knowledge.outcomeTiers=[{id:'low',minScorePercent:0,maxScorePercent:49,title:'Keep practicing',message:'Review the examples',badge:''},{id:'high',minScorePercent:50,maxScorePercent:100,title:'Good understanding',message:'Keep checking',badge:''}];
  const knowledgeHtml=render(Preview,{form:knowledge,step:2,resultId:'high'});assert.ok(knowledgeHtml.includes('Good understanding'));assert.ok(knowledgeHtml.includes('50–100%'));assert.ok(!knowledgeHtml.includes('Keep practicing'));
  const settingsHtml=render(QuizSettings,{form:knowledge,onChange:()=>{},onChooseImage:()=>{}});for(const label of ['Quiz title','Introduction','Welcome screen','Show questions','Progress indicator','Review answers before submitting','Show answer feedback'])assert.ok(settingsHtml.includes(label),label);
  const publishHtml=render(PublishSettings,{form,published:true,publicationLabel:'Published with changes',publicationUncertain:false,hasUnpublishedChanges:true,publicationBusy:false,onChange:()=>{},onSave:()=>{},onPreview:()=>{},onPublish:()=>{},onShare:()=>{},onPause:()=>{}});for(const label of ['Published with changes','previous published version','Share &amp; embed','Pause publication'])assert.ok(publishHtml.includes(label),label);
  assert.equal(requests,0);assert.equal(JSON.stringify(form),before);
}finally{global.fetch=oldFetch;}
console.log('PASS Basic appearance previews: exact result content, conditional sections, question 30, honest score coverage, knowledge tiers, theme isolation, safe remote fields, settings and publish controls');
