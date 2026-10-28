// Loaded only by the isolated browser test server. Never use with real Meta credentials.
if (process.env.META_TEST_TRANSPORT !== '1' || !process.env.META_TEST_CAPTURE) throw Error('Meta test transport requires an isolated capture file.');
const fs = require('node:fs'), original = global.fetch;
let conversions=[];
global.fetch=async(input,init={})=>{
 const url=new URL(typeof input==='string'?input:input.url||String(input));
 if(url.hostname!=='graph.facebook.com')return original(input,init);
 const p=init.method==='POST'?new URLSearchParams(init.body):url.searchParams;
 const path=url.pathname.replace(/^\/v\d+\.\d+\//,'');
 const json=body=>new Response(JSON.stringify(body),{headers:{'Content-Type':'application/json'}});
 if(path==='oauth/access_token')return json({access_token:'mock-business-token'});
 if(path==='debug_token')return json({data:{app_id:process.env.META_APP_ID,is_valid:true,scopes:['ads_management','business_management']}});
 if(path==='me')return json({client_business_id:'999999'});
 if(path==='999999')return json({id:'999999',name:'Synthetic business'});
 if(path==='999999/owned_ad_accounts')return json({data:[{id:'act_123456',name:'Synthetic ad account'}]});
 if(path==='999999/client_ad_accounts'||path==='999999/client_pixels')return json({data:[]});
 if(path==='999999/owned_pixels'||path==='act_123456/adspixels')return json({data:[{id:'123456789012345',name:'Synthetic dataset'}]});
 if(path==='act_123456/customconversions'){
  if(init.method==='POST'){const c={id:String(10000+conversions.length),name:p.get('name'),rule:p.get('rule'),pixel:{id:p.get('event_source_id')}};conversions.push(c);return json({id:c.id});}
  return json({data:conversions});
 }
 if(path==='123456789012345/events'){const events=JSON.parse(p.get('data'));for(const event of events)fs.appendFileSync(process.env.META_TEST_CAPTURE,JSON.stringify({event,testCode:p.get('test_event_code')})+'\n');return json({events_received:events.length});}
 throw Error('Unexpected mock Meta endpoint: '+path);
};
