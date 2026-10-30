// Writes disposable fixtures only to an explicitly isolated loopback server.
const assert=require('node:assert/strict');
const {chromium,webkit}=require('playwright');
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:3196';
if(new URL(base).hostname!=='127.0.0.1'||!process.env.HEYQUIZ_DATA_DIR)throw Error('Isolated loopback data directory required');
(async()=>{
 const engine=process.env.QA_BROWSER==='webkit'?webkit:chromium;
 const browser=await engine.launch();const context=await browser.newContext({reducedMotion:'reduce'});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const headers={Origin:base},id=`flow-ux-${Date.now()}`,ids=[id,id+'-pages'];
 const q=(id,title)=>({id,title,type:'multiple_choice',options:[{id:'a',label:'First answer'},{id:'d',label:'Branch answer'}]});
 const fixture={id,title:'Direct flow editing',mode:'survey',questions:[q('start','Start here'),q('next','Next question')],routing:{version:1,entry:{kind:'question',id:'start'},routes:{start:{rules:[{id:'branch',match:'all',conditions:[{questionId:'start',operator:'equals',value:'d'}],destination:{kind:'question',id:'next'}}],default:{kind:'automatic'}},next:{rules:[],default:{kind:'automatic'}}}},editorLayout:{version:1,positions:{start:{x:0,y:0},next:{x:500,y:0},automatic:{x:1000,y:0}}}};
 const save=async()=>{await page.waitForTimeout(1700);const r=await context.request.get(base+'/api/forms/'+id);assert.equal(r.status(),200);return r.json();};
 const close=()=>page.getByRole('button',{name:'Close question editor',exact:true}).click();
 const undo=()=>page.getByRole('button',{name:'Undo',exact:true}).click();
 const open=async(form)=>{let r=await context.request.post(base+'/api/forms',{headers,data:form});assert.equal(r.status(),201,await r.text());await page.goto(base+'/editor/'+form.id);await page.getByRole('button',{name:'Flow (Beta)',exact:true}).click();await page.locator('.react-flow__node[data-id="start"]').waitFor();};
 try{
  let r=await context.request.post(base+'/api/auth',{headers,data:{local:true}});assert.equal(r.status(),200);
  await page.setViewportSize({width:1513,height:1000});await open(fixture);
  const start=()=>page.locator('.react-flow__node[data-id="start"]');
  await start().getByRole('button',{name:'Connect Branch answer',exact:true}).click();
  await page.getByRole('dialog',{name:'Continue from Branch answer',exact:true}).getByRole('button',{name:'Short answer',exact:true}).click();
  await page.getByRole('textbox',{name:'Question',exact:true}).fill('Branch detail');await close();
  let draft=await save();const added=draft.questions.find(q=>q.title==='Branch detail');assert.ok(added);assert.equal(added.type,'short_answer');assert.equal(draft.routing.routes.start.rules[0].destination.id,added.id);assert.deepEqual(draft.editorLayout.positions.start,fixture.editorLayout.positions.start);assert.deepEqual(draft.editorLayout.positions.next,fixture.editorLayout.positions.next);
  await undo();await undo();assert.equal(await page.locator('.react-flow__node').count(),3);
  await page.getByRole('button',{name:/fit view/i}).click();
  // An insertion rewrites only the selected route and continues to its old target.
  await page.locator('.react-flow__edge[data-id="start:branch"]').click();
  await page.getByRole('button',{name:'+ Insert question',exact:true}).click();
  await page.getByRole('dialog',{name:'Insert question',exact:true}).getByRole('button',{name:'Multiple choice',exact:true}).click();await close();
  draft=await save();const inserted=draft.questions.find(q=>!['start','next'].includes(q.id));assert.ok(inserted);assert.equal(draft.routing.routes.start.rules[0].destination.id,inserted.id);assert.deepEqual(draft.routing.routes[inserted.id].default,{kind:'question',id:'next'});
  await undo();draft=await save();assert.equal(draft.questions.length,2);assert.equal(draft.routing.routes.start.rules[0].destination.id,'next');
  // Dropping a connector on empty canvas opens the same chooser without committing a route.
  await page.getByRole('button',{name:/fit view/i}).click();
  const source=await start().locator('.react-flow__handle.source[data-handleid="d"]').boundingBox();const pane=await page.locator('.flow-canvas').boundingBox();
  await page.mouse.move(source.x+source.width/2,source.y+source.height/2);await page.mouse.down();await page.mouse.move(pane.x+50,pane.y+pane.height-180,{steps:12});await page.mouse.up();
  await page.getByRole('dialog',{name:'Continue from Branch answer',exact:true}).waitFor();await page.keyboard.press('Escape');assert.equal(await page.locator('.react-flow__node').count(),3);
  // Plain title click opens editor; editor dismissal preserves viewport.
  await page.getByRole('button',{name:/fit view/i}).click();await start().getByRole('button',{name:'Edit Start here',exact:true}).click();
  const viewport=()=>page.locator('.react-flow__viewport').getAttribute('style');const before=await viewport();assert.equal(await page.getByRole('textbox',{name:'Question',exact:true}).inputValue(),'Start here');await close();assert.equal(await viewport(),before);
  // Destination chooser remains usable on phone and is dismissible by keyboard.
  await page.setViewportSize({width:390,height:844});await page.getByRole('combobox',{name:'Find question',exact:true}).selectOption('start');
  await start().getByRole('button',{name:'Connect Branch answer',exact:true}).click();
  const chooser=page.getByRole('dialog',{name:'Continue from Branch answer',exact:true});await chooser.getByRole('textbox',{name:'Search destinations',exact:true}).fill('Next');await chooser.getByRole('button',{name:'Next question',exact:true}).click();
  await start().getByRole('button',{name:'Connect Branch answer',exact:true}).click();await page.keyboard.press('Escape');await chooser.waitFor({state:'detached'});
  await page.screenshot({path:`output/flow-builder/${process.env.QA_BROWSER||'chromium'}-direct-editing-phone.png`});
  // Adding content to an existing page preserves ordered page routing.
  await page.setViewportSize({width:1280,height:900});const grouped={...fixture,id:ids[1],settings:{presentation:'page'},pages:[{id:'p1',title:'First page',questionIds:['start']},{id:'p2',title:'Second page',questionIds:['next']}],questions:[{...fixture.questions[0],pageId:'p1'},{...fixture.questions[1],pageId:'p2'}],routing:{version:1,entry:{kind:'page',id:'p1'},routes:{p1:{rules:[{...fixture.routing.routes.start.rules[0],destination:{kind:'page',id:'p2'}}],default:{kind:'automatic'}},p2:{rules:[],default:{kind:'automatic'}}}},editorLayout:undefined};await open(grouped);await page.getByRole('button',{name:'Add question',exact:true}).click();await close();await page.waitForTimeout(1700);r=await context.request.get(base+'/api/forms/'+ids[1]);draft=await r.json();assert.deepEqual(draft.routing.routes.p1,grouped.routing.routes.p1);assert.equal(draft.pages[0].questionIds.length,2);
  assert.deepEqual(errors,[]);console.log(`PASS ${process.env.QA_BROWSER||'chromium'} direct answer creation, edit, atomic undo, insertion continuation, stable positions, phone chooser, grouped route preservation`);
 }catch(e){await page.screenshot({path:'/private/tmp/flow-ux-failure.png'}).catch(()=>{});throw e;}finally{for(const id of ids)await context.request.delete(base+'/api/forms/'+id,{headers}).catch(()=>{});await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
