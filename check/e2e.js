const {chromium,devices}=require('playwright');
(async()=>{const b=await chromium.launch();const out=[];
for(const [name,ctxOpt] of [['desktop',{viewport:{width:1400,height:1000}}],['iPhone',devices['iPhone 13']],['Zalo-Android',{...devices['Pixel 7'],userAgent:devices['Pixel 7'].userAgent+' Zalo android/12110614 ZaloTheme/light ZaloLanguage/vn'}]]){
 const ctx=await b.newContext(ctxOpt);const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 const t0=Date.now();await p.goto('https://nguyenhongphong1973-dot.github.io/logistics-ai-orchestrator/hps/?v='+Date.now()+'#tower',{waitUntil:'domcontentloaded'});
 await p.evaluate(()=>{cur='tower';render()}).catch(()=>{});
 // ask immediately (worst case: before AI connects)
 await p.evaluate(()=>{voiceTurn=true;ask('Xếp lại bãi tiết kiệm được bao nhiêu?')});
 await p.waitForTimeout(1500);await p.waitForFunction(()=>!aiBusy,null,{timeout:90000}).catch(()=>{});
 const st=await p.evaluate(()=>[AIstate,document.querySelector('[data-aibadge]')&&document.querySelector('[data-aibadge]').textContent,!!document.getElementById('micbtn')&&getComputedStyle(document.getElementById('micbtn')).display]);
 const a=await p.evaluate(()=>document.getElementById('chat').lastElementChild.innerText.replace(/\n+/g,' | '));
 out.push(`[${name}] state=${st[0]} badge="${st[1]}" mic=${st[2]} t=${((Date.now()-t0)/1000).toFixed(1)}s\n  A: ${a}\n  errs=${JSON.stringify(errs)}`);await ctx.close()}
require('fs').writeFileSync('check/e2e.txt',out.join('\n\n'));await b.close()})();
