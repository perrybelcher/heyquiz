// Local component/CSS regression: no quiz writes, respondent starts or provider traffic.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), Module = require('node:module'), ts = require('typescript');
const React = require('react'), { renderToStaticMarkup } = require('react-dom/server'), { chromium } = require('playwright');
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function(request, parent, ...args) { return originalResolve.call(this, request.startsWith('@/') ? path.join(__dirname, '..', request.slice(2)) : request, parent, ...args); };
for (const ext of ['.ts', '.tsx']) require.extensions[ext] = (target, file) => target._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module:ts.ModuleKind.CommonJS, target:ts.ScriptTarget.ES2022, jsx:ts.JsxEmit.ReactJSX, esModuleInterop:true } }).outputText, file);
const MarketingResultCard = require('../components/MarketingResultCard.tsx').default;
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3173'; assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/);
const artifacts = path.resolve(process.env.ARTIFACT_DIR || '../pippi-overall-qa-2026-10-12/reporting/result-contrast'); fs.mkdirSync(artifacts,{recursive:true});
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true}); const page=await browser.newPage(); const external=[]; const observations=[];
 await page.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin!==base&&!['data:','about:'].includes(url.protocol)){external.push(url.origin);return route.abort();}return route.continue();});
 try {
  await page.goto(base+'/login'); await page.locator('h1').waitFor(); await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
  for (const kind of ['product_finder','segmentation']) for(const dark of [true,false]) for(const width of [320,390,1440]) {
   await page.setViewportSize({width,height:900});
   const result={kind,status:'matched',title:'A useful starting point',message:'Keep the parts that fit your situation.',reasons:['You prefer a manageable first step.','Your answers suggest a flexible routine.'],categories:[],ctaUrl:'',advice:'Try one small change and review what helps.'};
   const markup=renderToStaticMarkup(React.createElement(MarketingResultCard,{result}));
   await page.evaluate(({markup,dark})=>{document.body.innerHTML='<main class="hq-player" style="padding:24px;min-height:100vh"><div style="max-width:680px;margin:auto">'+markup+'</div></main>';const frame=document.querySelector('main');for(const [key,value] of Object.entries({'--hq-card':dark?'#161616':'#ffffff','--hq-text':dark?'#ffffff':'#111827','--hq-primary':dark?'#e8a0ab':'#922c40'}))frame.style.setProperty(key,value);frame.style.background=dark?'#111111':'#f8fafc';frame.style.color=dark?'#ffffff':'#111827';}, {markup,dark});
   const reading=await page.locator('[data-result-block="reasons"]').evaluate(section=>{
    const text=section.querySelector('li'),fg=getComputedStyle(text).color,bg=getComputedStyle(section).backgroundColor;
    const rgb=color=>{const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const ctx=canvas.getContext('2d');ctx.fillStyle=color;ctx.fillRect(0,0,1,1);return Array.from(ctx.getImageData(0,0,1,1).data).slice(0,3);};
    const luminance=color=>rgb(color).map(n=>n/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4).reduce((total,n,i)=>total+n*[.2126,.7152,.0722][i],0);const values=[luminance(fg),luminance(bg)].sort((a,b)=>a-b);
    return {foreground:fg,background:bg,contrast:(values[1]+.05)/(values[0]+.05),overflow:document.documentElement.scrollWidth>innerWidth+1};
   });
   const scan=await page.locator('[data-result-block="reasons"]').evaluate(element=>window.axe.run(element,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}}));
   observations.push({kind,dark,width,...reading,violations:scan.violations.map(v=>v.id),incomplete:scan.incomplete.map(v=>v.id)});
   await page.screenshot({path:path.join(artifacts,`${kind}-${dark?'dark':'light'}-${width}.png`)});
   fs.writeFileSync(path.join(artifacts,'observations.json'),JSON.stringify({scope:'Current source result component with compiled local stylesheet',observations,external,publicStarts:0},null,2));
   assert.ok(reading.contrast>=4.5,`${kind} ${dark?'dark':'light'} reasons contrast ${reading.contrast.toFixed(2)} < 4.5`);assert.equal(reading.overflow,false);assert.deepEqual(scan.violations,[]);
  }
  assert.deepEqual(external,[]);console.log('PASS 12 product/outcome light/dark result Reasons contrast, accessibility and reflow checks at320/390/1440; current component with compiled CSS; no writes/starts.');
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
