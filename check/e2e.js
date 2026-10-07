const {chromium}=require('playwright');
const VOICE=[['tê em vê còn bao nhiêu xe chờ pê đê i','tê em vê còn bao nhiêu xe chờ bê đê i'],['kho tám đang bị làm sao','kho tam đang bị làm sao']];
(async()=>{const b=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});const p=await b.newPage({viewport:{width:1400,height:1000}});
const out=[];const errs=[];p.on('pageerror',e=>errs.push(e.message));
p.on('response',async r=>{if(r.url().includes('/ai-doc-cau')){try{const j=await r.json();out.push('TTS '+r.status()+' ok='+j.ok+' giong='+j.giong+' mp3KB='+Math.round((j.mp3||'').length*0.75/1024))}catch(e){out.push('TTS parse err')}}});
await p.addInitScript((V)=>{window.__vi=0;window.SpeechRecognition=window.webkitSpeechRecognition=function(){const r=this;r.start=()=>{const alts=V[window.__vi++];setTimeout(()=>{const res=[alts.map(t=>({transcript:t}))];res[0].isFinal=true;r.onresult&&r.onresult({results:res});r.onend&&r.onend()},200)};r.stop=()=>{}};},VOICE);
await p.goto('https://nguyenhongphong1973-dot.github.io/logistics-ai-orchestrator/hps/?v='+Date.now()+'#tower',{waitUntil:'networkidle'});
await p.waitForFunction(()=>typeof AIstate!=='undefined'&&AIstate!=='wait',null,{timeout:20000}).catch(()=>{});
out.push('AIstate='+await p.evaluate(()=>AIstate)+' azure='+await p.evaluate(()=>typeof speakAzure));
await p.evaluate(()=>{cur='tower';render()});
for(let k=0;k<VOICE.length;k++){await p.click('#micbtn');await p.waitForTimeout(600);await p.waitForFunction(()=>!aiBusy,null,{timeout:120000}).catch(()=>{});await p.waitForTimeout(4000);
 const msgs=await p.evaluate(()=>[...document.querySelectorAll('#chat .msg')].slice(-2).map(x=>x.innerText));out.push('NÓI: '+VOICE[k][0]+'\nĐÁP: '+msgs[1]);}
out.push('audio src set='+await p.evaluate(()=>!!(azAudio&&String(azAudio.src).startsWith('data:audio/mp3'))));
out.push('errs='+JSON.stringify(errs));require('fs').writeFileSync('check/e2e.txt',out.join('\n\n'));await b.close()})();
