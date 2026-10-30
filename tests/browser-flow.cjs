// Isolated local integration run only. Never point fixture creation at a hosted account.
const assert = require('node:assert/strict');require('node:fs').mkdirSync('output/flow-builder',{recursive:true});
const { chromium, firefox, webkit } = require('playwright');
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3194';
if (new URL(base).hostname !== '127.0.0.1' || !process.env.HEYQUIZ_DATA_DIR) throw Error('Explicit isolated local data directory required');
const name = process.env.QA_BROWSER || 'chromium';
const engine = { chromium, firefox, webkit, chrome:chromium, edge:chromium }[name];
if (!engine) throw Error('Use chromium, firefox, webkit, chrome or edge');
(async()=>{
 const browser = await engine.launch({ headless:true, ...(name==='chrome'?{channel:'chrome'}:name==='edge'?{channel:'msedge'}:{}) });
 const owner = await browser.newContext(); const visitor = await browser.newContext();
 const page = await owner.newPage(); const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')console.error('BROWSER CONSOLE',m.text())});
 const id=`flow-browser-${Date.now()}`;const headers={Origin:base};
 const q=(id,title)=>({id,title,type:'multiple_choice',required:true,options:[{id:'A',label:'A answer'},{id:'D',label:'D answer'}]});
 const tier=(id,title)=>({id,title,badge:'Result',message:title,minScorePercent:0,maxScorePercent:100});
 const data={id,title:'Browser flow fixture',mode:'survey',settings:{showReviewBeforeSubmit:false},questions:[q('start','Choose a route'),q('detail','D detail')],outcomeTiers:[tier('growth','Growth plan'),tier('launch','Launch plan')],routing:{version:1,entry:{kind:'question',id:'start'},routes:{start:{rules:[{id:'route-D',match:'all',conditions:[{questionId:'start',operator:'equals',value:'D'}],destination:{kind:'question',id:'detail'}}],default:{kind:'tier',id:'growth'}},detail:{rules:[],default:{kind:'tier',id:'launch'}}}},editorLayout:{version:1,positions:{start:{x:0,y:100},detail:{x:450,y:100}}}};
 try{
  let response=await owner.request.post(base+'/api/auth',{data:{local:true},headers});assert.equal(response.status(),200,await response.text());
  response=await owner.request.post(base+'/api/forms',{data,headers});assert.equal(response.status(),201,await response.text());
  await page.goto(base+'/editor/'+id);
  const flowEntry=page.getByRole('button',{name:'Flow (Beta)',exact:true});
  for (const width of [390,768,1280,1513]) {
   await page.setViewportSize({width,height:900});
   assert.equal(await flowEntry.evaluate(el=>!!el.closest('header')),true,'Flow belongs in the editor header');
   const bounds=await flowEntry.boundingBox();assert.ok(bounds&&bounds.x>=0&&bounds.x+bounds.width<=width,'Flow entry fits viewport');
  }
  await flowEntry.click();
  await page.getByText('Flow builder is in beta. Test each path before publishing.',{exact:true}).waitFor();

  const dialog=page.getByRole('dialog');await dialog.getByRole('button',{name:'Add question',exact:true}).waitFor();
  assert.ok(await dialog.getByText('Choose a route',{exact:true}).count());
  const nodeCount=await page.locator('.react-flow__node').count();assert.ok(nodeCount>=3);
  await dialog.getByRole('button',{name:'Add question',exact:true}).click();assert.ok(await page.locator('.react-flow__node').count()>nodeCount);
  await dialog.getByRole('button',{name:'Undo',exact:true}).click();assert.equal(await page.locator('.react-flow__node').count(),nodeCount);
  await dialog.getByRole('button',{name:/fit view/i}).click();
  await page.waitForTimeout(700); // Finish the initial fit animation before pointer coordinates are sampled.
  const startNode=page.locator('.react-flow__node[data-id="start"]');
  const source=await startNode.locator('.react-flow__handle.source[data-handleid="D"]').boundingBox();
  const target=await page.locator('.react-flow__node[data-id="tier:growth"] .react-flow__handle.target').boundingBox();
  assert.ok(source&&target);await page.mouse.move(source.x+source.width/2,source.y+source.height/2);await page.mouse.down();await page.mouse.move(target.x+target.width/2,target.y+target.height/2,{steps:16});await page.mouse.up();
  await dialog.getByRole('button',{name:/fit view/i}).click();await page.waitForTimeout(500);
  await startNode.getByRole('button',{name:'Edit Choose a route',exact:true}).click();
  assert.equal(await dialog.getByRole('combobox',{name:'Then go to',exact:true}).nth(1).inputValue(),'tier:growth');
  await dialog.getByRole('button',{name:'Close question editor',exact:true}).click();if(await dialog.getByRole('button',{name:'Dismiss notification',exact:true}).count())await dialog.getByRole('button',{name:'Dismiss notification',exact:true}).click();await dialog.getByRole('button',{name:'Undo',exact:true}).click();
  await startNode.getByRole('button',{name:'Connect D answer',exact:true}).click();await page.getByRole('dialog',{name:'Continue from D answer'}).getByRole('button',{name:'Show ending: Growth plan',exact:true}).click();
  await dialog.getByRole('button',{name:/fit view/i}).click();await page.waitForTimeout(500);
  await startNode.getByRole('button',{name:'Edit Choose a route',exact:true}).click();assert.equal(await dialog.getByRole('combobox',{name:'Then go to',exact:true}).nth(1).inputValue(),'tier:growth');
  await dialog.getByRole('combobox',{name:'Then go to',exact:true}).nth(1).selectOption('question:detail');assert.equal(await dialog.getByRole('combobox',{name:'Then go to',exact:true}).nth(1).inputValue(),'question:detail');
  await dialog.getByRole('button',{name:'Close question editor',exact:true}).click();
  await dialog.getByRole('button',{name:'Tidy up',exact:true}).click();await page.waitForTimeout(500);
  await page.screenshot({path:`output/flow-builder/${name}-canvas.png`,fullPage:true});
  for (const width of [390,768,1280,1513]){await page.setViewportSize({width,height:900});assert.ok(await dialog.getByRole('button',{name:'Add question',exact:true}).isVisible());assert.ok(await dialog.getByRole('button',{name:'Test quiz',exact:true}).isVisible());}
  // Wait for the existing autosave rather than competing with its revision.
  await page.waitForTimeout(1500);
  response=await owner.request.post(base+'/api/forms/'+id+'/publish',{data:{},headers});assert.equal(response.status(),200,await response.text());
  const p=await visitor.newPage();p.on('pageerror',e=>errors.push(e.message));
  await p.goto(base+'/play/'+id);await p.getByRole('button',{name:'Let’s begin',exact:true}).click();
  await p.getByRole('heading',{name:'Choose a route',exact:true}).waitFor();
  await p.getByRole('radio',{name:'D answer',exact:true}).check();await p.getByRole('heading',{name:'D detail',exact:true}).waitFor();
  await p.getByRole('radio',{name:'A answer',exact:true}).check();await p.getByRole('heading',{name:'Launch plan',exact:true}).waitFor();
  const blankId=id+'-blank';
  try {
   response=await owner.request.post(base+'/api/forms',{headers,data:{id:blankId,title:'Blank flow regression',mode:'survey',questions:[],routing:{version:1,entry:{kind:'automatic'},routes:{}}}});assert.equal(response.status(),201,await response.text());
   await page.goto(base+'/editor/'+blankId);await page.getByRole('button',{name:'Flow (Beta)',exact:true}).click();
   await page.getByRole('button',{name:'Add question',exact:true}).click();
   await page.getByText('Quiz settings',{exact:true}).click();const entry=await page.getByRole('combobox',{name:'Quiz entry',exact:true}).inputValue();assert.match(entry,/^question:/,'First block becomes the entry');
   await page.getByRole('button',{name:'Close question editor',exact:true}).click();await page.waitForTimeout(1500);
   response=await owner.request.get(base+'/api/forms/'+blankId);const first=await response.json();assert.equal(first.routing.entry.id,first.questions[0].id);assert.equal(first.routing.routes[first.questions[0].id].default.kind,'automatic');
   await page.getByRole('button',{name:'Builder',exact:true}).click();
   await page.getByRole('button',{name:'Advanced',exact:true}).click();
   for (const width of [390,768,1280,1513]) {
    await page.setViewportSize({width,height:900});
    const action=page.getByRole('button',{name:'Flow (Beta)',exact:true});
    await action.waitFor({state:'visible'});assert.equal(await action.evaluate(el=>!!el.closest('header')),true);
    const bounds=await action.boundingBox();assert.ok(bounds&&bounds.x>=0&&bounds.x+bounds.width<=width,'Advanced Flow header fits viewport');
   }
  } finally {await owner.request.delete(base+'/api/forms/'+blankId,{headers}).catch(()=>{});}
  assert.deepEqual(errors,[]);console.log(`PASS ${name} ${browser.version()}: real drag, tap, destination menu, add/undo/responsive controls; D route -> Launch plan; no page errors`);
 }catch(error){await page.screenshot({path:`/private/tmp/pippi-flow-${name}-failure.png`}).catch(()=>{});console.error('PAGE ERRORS',errors);throw error;}finally{await owner.request.delete(base+'/api/forms/'+id,{headers}).catch(()=>{});await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
