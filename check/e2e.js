const {chromium,devices}=require('playwright');
(async()=>{const out=[];
for(const n of [1,2]){
 const b=await chromium.launch({args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--use-file-for-fake-audio-capture=/tmp/q'+n+'.wav%noloop','--autoplay-policy=no-user-gesture-required']});
 const ctx=await b.newContext({...devices['iPhone 13'],permissions:['microphone']});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 p.on('response',async r=>{if(r.url().includes('/ai-nghe-noi')){try{const j=await r.json();out.push('  STT '+r.status()+' '+JSON.stringify(j).slice(0,160))}catch(e){}}if(r.url().includes('/ai-doc-cau'))out.push('  TTS '+r.status());});
 await p.goto('https://nguyenhongphong1973-dot.github.io/logistics-ai-orchestrator/hps/?v='+Date.now()+'#tower',{waitUntil:'networkidle'});
 await p.waitForFunction(()=>typeof AIstate!=='undefined'&&AIstate!=='wait',null,{timeout:20000}).catch(()=>{});
 await p.evaluate(()=>{cur='tower';render()});
 out.push(`[mic test ${n}] AIstate=${await p.evaluate(()=>AIstate)} micMode=${await p.evaluate(()=>micMode)}`);
 await p.click('#micbtn');await p.waitForTimeout(9000);
 out.push('  hint: '+await p.evaluate(()=>document.getElementById('michint').textContent));
 await p.waitForFunction(()=>!aiBusy,null,{timeout:90000}).catch(()=>{});await p.waitForTimeout(3000);
 out.push('  chat: '+await p.evaluate(()=>[...document.querySelectorAll('#chat .msg')].slice(-2).map(x=>x.innerText.replace(/\n+/g,' | ')).join('  >>  ')));
 out.push('  errs='+JSON.stringify(errs));await b.close()}
require('fs').writeFileSync('check/e2e.txt',out.join('\n'));})();
