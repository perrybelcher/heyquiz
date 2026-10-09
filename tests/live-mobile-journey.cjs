const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const base='https://www.pippiapp.com';
if(!process.env.QA_ACCOUNTS_FILE)throw Error('Dedicated QA_ACCOUNTS_FILE required');
const account=JSON.parse(fs.readFileSync(process.env.QA_ACCOUNTS_FILE,'utf8'))[0];
if(!account.email.endsWith('@example.test'))throw Error('Synthetic account required');
(async()=>{const b=await chromium.launch({channel:'chrome'}),owner=await b.newContext({viewport:{width:390,height:844}}),visitor=await b.newContext({viewport:{width:390,height:844}}),p=await owner.newPage();let id;
p.setDefaultTimeout(15000);try{
 await p.goto(base+'/login');await p.getByLabel('Email').fill(account.email);await p.getByLabel('Password',{exact:true}).fill(account.password);await p.getByRole('button',{name:'Sign in',exact:true}).click();await p.waitForURL(base+'/');
 await p.goto(base+'/create');await p.getByLabel('Quiz name').fill('QA mobile full journey');await p.getByRole('button',{name:/^Recommend a product/}).click();await p.getByRole('button',{name:'Save my quiz',exact:true}).click();await p.waitForURL(/\/editor\//);id=new URL(p.url()).pathname.split('/').pop();console.log('PASS mobile sign-in and UI quiz creation');
 await p.getByRole('button',{name:'Share',exact:true}).click();await p.getByRole('button',{name:'Publish and enable sharing'}).click();await p.getByRole('dialog').getByRole('button',{name:'Publish now',exact:true}).click();await p.getByText('Published · Up to date',{exact:true}).waitFor();
 await p.getByRole('button',{name:'Done',exact:true}).click();
 await p.screenshot({path:'/tmp/pippi-live-mobile-editor.png',fullPage:true});
 const q=await visitor.newPage();await q.goto(base+'/play/'+id);await q.getByRole('button',{name:'Let’s begin',exact:true}).click();
 for(const [answer,next] of [['A few daily essentials','Continue'],['Keeping things light','Continue'],['No','Review answers']]){await q.getByRole('radio',{name:answer,exact:true}).check();await q.getByRole('button',{name:next,exact:true}).click();}
 // Simulate a lost submission response AFTER the server accepted it. Retrying
 // must recover the existing response instead of double counting a conversion.
 let intercepted=false;await q.route('**/api/forms/'+id+'/submit',async route=>{if(!intercepted){intercepted=true;await route.fetch();await route.abort('failed');}else await route.continue();});
 await q.getByRole('button',{name:'Submit response',exact:true}).click();await q.getByRole('alert').waitFor();await q.getByRole('button',{name:'Submit response',exact:true}).click();await q.getByRole('heading',{name:'The Everyday Sling',exact:true}).waitFor();
 assert.ok(await q.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await q.screenshot({path:'/tmp/pippi-live-mobile-result.png',fullPage:true});
 const rows=await(await owner.request.get(base+'/api/forms/'+id+'/submissions')).json();assert.equal(rows.submissions.length,1);assert.equal(rows.submissions[0].marketing.title,'The Everyday Sling');
 const stats=await(await owner.request.get(base+'/api/forms/'+id+'/analytics')).json();assert.equal(stats.completions,1);assert.equal(stats.starts,1);
 await p.getByRole('button',{name:'Results',exact:true}).click();await p.getByText('The Everyday Sling',{exact:false}).first().waitFor();
 console.log('PASS live mobile UI publication, anonymous completion, lost-response retry, one stored recommendation and exact start/completion analytics');
}finally{if(id)console.log('Fixture cleanup',(await owner.request.delete(base+'/api/forms/'+id,{headers:{Origin:base}})).status());await owner.request.delete(base+'/api/auth',{headers:{Origin:base}});await b.close();}})().catch(e=>{console.error(e.message);process.exitCode=1});
