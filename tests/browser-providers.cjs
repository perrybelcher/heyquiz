const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const names={hubspot:'HubSpot',activecampaign:'ActiveCampaign',klaviyo:'Klaviyo',mailchimp:'Mailchimp',keap:'Keap / Infusionsoft',brevo:'Brevo',zoho:'Zoho CRM',freshsales:'Freshworks / Freshsales',salesforce:'Salesforce',twenty:'Twenty CRM'};
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:3130",id='qa-providers-'+Date.now();
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true}),c=await browser.newContext({viewport:{width:1280,height:1000}}),p=await c.newPage();let checks=0;const errors=[];p.on('pageerror',e=>errors.push(e.message));
try{
 await c.request.post(base+'/api/auth',{data:{local:true},headers:{Origin:base}});
 assert.equal((await c.request.post(base+'/api/forms',{data:{id,title:'QA provider catalog',mode:'survey',questions:[{id:'q',type:'short_answer',title:'Priority'}]},headers:{Origin:base}})).status(),201);
 const endpoint=base+'/api/forms/'+id+'/integrations';
 const anonymous=await browser.newContext();assert.equal((await anonymous.request.post(endpoint+'/connect',{data:{action:'start',provider:'twenty'}})).status(),401);await anonymous.close();checks++;
 assert.equal((await c.request.post(endpoint+'/connect',{data:{action:'start',provider:'twenty'},headers:{Origin:'https://unrelated.example'}})).status(),403);checks++;
 for(const provider of Object.keys(names)){
  assert.equal((await c.request.post(endpoint+'/connect',{data:{action:'start',provider},headers:{Origin:base}})).status(),503);checks++;
 }
 await p.goto(base+'/editor/'+id);await p.getByRole('button',{name:'Integrate',exact:true}).click();
 for(const name of Object.values(names))assert.equal(await p.getByRole('button',{name:'Connect '+name,exact:true}).isEnabled(),false);checks++;
 let pending=null,saved=null;
 await p.route('**/api/forms/'+id+'/integrations',async route=>{
  if(route.request().method()==='PUT'){saved=route.request().postDataJSON();return route.fulfill({json:{...saved,revision:2}});}
  return route.fulfill({json:{connections:[],deliveries:[],schedulerConfigured:true,schedulerCadence:'minute',deliveryAllowed:true,nangoConfigured:true,configuredProviders:Object.keys(names)}});
 });
 await p.route('**/api/forms/'+id+'/integrations/connect',async route=>{
  const data=route.request().postDataJSON();
  if(data.action==='start'){pending=data.provider;return route.fulfill({json:{attemptId:'00000000-0000-4000-a000-000000000001',connectLink:'https://connect.nango.dev/?session_token=test',expiresAt:Date.now()+1800000}});}
  assert.equal(data.provider,pending);return route.fulfill({json:{connected:true,connection:{id:'fixture-'+data.provider,provider:data.provider,name:names[data.provider],revision:1,enabled:false,consentOnly:true,locationId:'',tags:[],resultTag:false,mappings:[]}}});
 });
 await p.reload();await p.getByRole('button',{name:'Integrate',exact:true}).click();
 for(const [provider,name] of Object.entries(names).filter(([x])=>x!=='hubspot')){
  await p.getByRole('button',{name:'Connect '+name,exact:true}).click();
  assert.equal(await p.getByRole('link',{name:'Authorize '+name+' ↗',exact:true}).getAttribute('rel'),'noopener noreferrer');
  await p.getByRole('button',{name:'Check connection',exact:true}).click();
  await p.getByRole('heading',{name:'Edit '+name,exact:true}).waitFor();
  assert.equal(await p.getByLabel('Only send leads who opt in to marketing').isEnabled(),false);
  assert.equal(await p.getByLabel('Enable delivery for new leads').isChecked(),false);
  if(provider==='mailchimp')await p.getByLabel('Mailchimp audience ID').fill('audience-123');
  await p.getByRole('button',{name:'Save connection',exact:true}).click();await p.getByText('Connection saved and paused.',{exact:false}).waitFor();
  assert.equal(saved.provider,provider);if(provider==='mailchimp')assert.equal(saved.audienceId,'audience-123');checks++;
 }
 await p.setViewportSize({width:390,height:844});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);checks++;
 const dir=path.resolve('../../outputs/integrations');fs.mkdirSync(dir,{recursive:true});await p.screenshot({path:path.join(dir,'providers-mobile.png'),fullPage:true});
 await p.setViewportSize({width:1280,height:1000});await p.screenshot({path:path.join(dir,'providers-desktop.png'),fullPage:true});
 assert.deepEqual(errors,[]);console.log(`${checks} provider browser/API checks passed. Authorization responses mocked; real APIs tested for access control and missing setup.`);
}finally{await c.request.delete(base+'/api/forms/'+id,{headers:{Origin:base}});await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
