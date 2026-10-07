const {chromium}=require('playwright');
const VOICE=[
 ['tê em vê còn bao nhiêu xe chờ pê đê i','tê em vê còn bao nhiêu xe chờ bê đê i','tim vê còn bao nhiêu xe chờ pd'],
 ['xe phốt nào tồn quá ba mươi ngày','xe phố nào tồn quá 30 ngày','xe phót nào tồn quá ba mươi ngày'],
 ['kho tám đang bị làm sao','kho tam đang bị làm sao','khô tám đang bị làm sao'],
 ['hàng tê en tê ích nào sắp hết hạn tái xuất','hàng tê en tê ít nào sắp hết hạn tái xuất','hàng tiền tê ích nào sắp hết hạn'],
 ['bạn đang dùng trí tuệ nhân tạo của hãng nào','bạn dùng AI của hãng nào','bạn đang dùng tri tuệ nhân tạo của hàng nào']];
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1400,height:1000}});
const out=[];const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.addInitScript((V)=>{window.__vi=0;window.SpeechRecognition=window.webkitSpeechRecognition=function(){const r=this;r.start=()=>{const alts=V[window.__vi++];setTimeout(()=>{const res=[alts.map(t=>({transcript:t}))];res[0].isFinal=true;r.onresult&&r.onresult({results:res});r.onend&&r.onend()},200)};r.stop=()=>{}};},VOICE);
await p.goto('https://nguyenhongphong1973-dot.github.io/logistics-ai-orchestrator/hps/?v='+Date.now()+'#tower',{waitUntil:'networkidle'});
await p.waitForFunction(()=>typeof AIstate!=='undefined'&&AIstate!=='wait',null,{timeout:20000}).catch(()=>{});
out.push('AIstate='+await p.evaluate(()=>AIstate)+' mic='+await p.evaluate(()=>!!document.getElementById('micbtn')));
await p.evaluate(()=>{cur='tower';render()});
for(let k=0;k<VOICE.length;k++){await p.click('#micbtn');await p.waitForTimeout(600);
 await p.waitForFunction(()=>!aiBusy,null,{timeout:120000}).catch(()=>{});
 const msgs=await p.evaluate(()=>[...document.querySelectorAll('#chat .msg')].slice(-2).map(x=>x.innerText));
 out.push('NÓI: '+VOICE[k][0]+'\nHIỆN: '+msgs[0]+'\nĐÁP: '+msgs[1]);}
await p.screenshot({path:'check/e2e.png'});
out.push('errs='+JSON.stringify(errs));require('fs').writeFileSync('check/e2e.txt',out.join('\n\n'));await b.close()})();
