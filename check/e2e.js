const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1400,height:1000}});
const out=[];const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('https://nguyenhongphong1973-dot.github.io/logistics-ai-orchestrator/hps/#tower',{waitUntil:'networkidle'});
await p.waitForFunction(()=>typeof AIstate!=='undefined'&&AIstate!=='wait',null,{timeout:20000}).catch(()=>{});
out.push('AIstate='+await p.evaluate(()=>AIstate)+' tools='+await p.evaluate(()=>AItools));
await p.evaluate(()=>{cur='tower';render()});
for(const q of ['Xếp lại bãi theo phương án tối ưu thì tiết kiệm được bao nhiêu giờ công mỗi năm?','Xe Ford nào tồn quá 30 ngày? Liệt kê 3 xe.']){
 await p.fill('#chatq',q);await p.click('#chatf button');
 await p.waitForFunction(()=>!aiBusy,null,{timeout:120000}).catch(()=>{});
 out.push('Q: '+q+'\nA: '+await p.evaluate(()=>document.getElementById('chat').lastElementChild.innerText));}
await p.screenshot({path:'check/e2e.png'});
out.push('errs='+JSON.stringify(errs));require('fs').writeFileSync('check/e2e.txt',out.join('\n\n'));await b.close()})();
