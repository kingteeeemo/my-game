#!/usr/bin/env node
/* 엔드게임 봇: 위험도 한 판(1,500마리 + 관문 보스)을 적정 장비로 돌려 시간·획득량 측정
   사용: node eg.js --cls warrior:whirl --d 1,5,10,15,20 --mut 0,1 --seeds 1 --par 4 --out eg1
   적정 장비: 레벨 31+4.4(d-1) · 장비 티어 4.3→1.1 · 강화 +4→+15 · 추가 강화 진행도 0→100% */
const fs=require('fs'),path=require('path');
const req=m=>{for(const d of [__dirname,process.env.BOT_NODE_PATH||''].filter(Boolean)){try{return require(require.resolve(m,{paths:[d]}))}catch(_){}}return require(m)};
const pp=req('puppeteer-core');
const resolveMod=f=>{for(const d of [__dirname,process.env.BOT_NODE_PATH||''].filter(Boolean)){try{return require.resolve(f,{paths:[d]})}catch(_){}}throw new Error('없음: '+f)};
const A={lv:'',cls:'warrior:whirl',d:'1,5,10,15,20',mut:'0',seeds:'1',seed0:'1',skill:'normal',aura:'',max:'2400',par:'4',out:'',q:'.5',xp:'',lo:'1',dOff:'0',enh:'',tier:'',g2:'',rnd:'',game:path.join(__dirname,'../../index.html')};
for(let i=2;i<process.argv.length;i++){const k=process.argv[i].replace(/^--/,'');A[k]=process.argv[++i]}
const spec=d=>({lv:Math.round(31+4.4*(d-1)),tier:Math.max(1,Math.min(6,Math.round(4.3-3.2*(d-1)/19))),enh:Math.round(4+11*(d-1)/19),g2:+((d-1)/19).toFixed(2)});
async function one(browser,job){
  const p=await browser.newPage();const errs=[];p.on('pageerror',e=>errs.push(String(e).slice(0,200)));
  await p.evaluateOnNewDocument(()=>{Object.defineProperty(document,'hidden',{get:()=>false});Object.defineProperty(document,'visibilityState',{get:()=>'visible'})});
  await p.evaluateOnNewDocument(seed=>{let a=seed>>>0;Math.random=function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296};try{localStorage.clear()}catch(_){}},job.seed);
  await p.setRequestInterception(true);
  p.on('request',r=>{const u=r.url();
    if(u.includes('three.min.js'))return r.respond({contentType:'text/javascript',body:fs.readFileSync(resolveMod('three/build/three.min.js'))});
    if(u.includes('GLTFLoader'))return r.respond({contentType:'text/javascript',body:fs.readFileSync(resolveMod('three/examples/js/loaders/GLTFLoader.js'))});
    if(u.startsWith('http'))return r.respond({contentType:'text/plain',body:''});r.continue()});
  await p.goto('file://'+path.resolve(A.game),{waitUntil:'load',timeout:90000});await new Promise(r=>setTimeout(r,3000));
  await p.evaluate(()=>{window.requestAnimationFrame=()=>0});
  await p.addScriptTag({content:fs.readFileSync(path.join(__dirname,'bot-page.js'),'utf8')});
  const info=await p.evaluate(j=>{try{BOT.debug=j.debug;return BOT.egSetup(j)}catch(e){return {err:String(e.stack||e).slice(0,400)}}},job);
  let res;if(info.err)res={err:info.err};else{
    for(let T=60;;T+=60){const done=await p.evaluate(t=>{try{return BOT.step(t)}catch(e){BOT.M.err=String(e.stack||e).slice(0,300);return true}},Math.min(T,job.max));if(done||T>=job.max)break}
    res=Object.assign({info},await p.evaluate(()=>BOT.egEnd()))}
  res.job=`${job.cls}:${job.main} 위험도${job.d} Lv${job.lv}${job.mut?' 변이':''}`;res.seed=job.seed;res.d=job.d;res.mut=job.mut;res.pageErr=errs.slice(0,3);
  await p.close();return res;
}
(async()=>{
  const browser=await pp.launch({protocolTimeout:900000,executablePath:process.env.CHROME||'/usr/bin/google-chrome',args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader','--allow-file-access-from-files']});
  const jobs=[];for(const cm of A.cls.split(',')){const [cls,main]=cm.split(':');for(const d of A.d.split(',').map(Number))for(const mut of A.mut.split(',').map(Number))for(const lv of (A.lv?A.lv.split(',').map(Number):[0]))for(let s=0;s<+A.seeds;s++){const sp=spec(d-(+A.dOff));if(lv)sp.lv=lv;if(A.enh)sp.enh=+A.enh;if(A.tier)sp.tier=+A.tier;if(A.g2)sp.g2=+A.g2;const xp=A.xp==='def3'?['dmg','crit',{warrior:'def',musa:'def',archer:'eva',mage:'es',priest:'es'}[cls]].join('+'):A.xp;const aura=A.aura==='auto'?(()=>{const L=Math.min(10,Math.round((d-(+A.dOff))/2));return L?`crit:${L}+area:${L}`:''})():A.aura;jobs.push({cls,main,d,mut,...sp,xp,lo:+A.lo,rnd:A.rnd?1:0,q:+A.q,skill:A.skill,aura,max:+A.max,seed:+A.seed0+s,debug:!!A.debug})}}
  const out=[];let k=0;
  await Promise.all(Array.from({length:Math.min(+A.par,jobs.length)},async()=>{while(k<jobs.length){const j=jobs[k++];const t0=Date.now();let r;try{r=await one(browser,j)}catch(e){r={err:String(e).slice(0,300),job:j.cls+' '+j.d}}r.wall=Math.round((Date.now()-t0)/1000);out.push(r);
    console.log(`${r.job}${A.xp?' 물약':''}${A.aura?' 오라':''}${+A.dOff?' 장비-'+A.dOff:''} | ${r.clear?'클리어':'실패'} ${r.t}초 · 관문 ${r.bossT??'-'}초 · 처치 ${r.kills} · 사망 ${r.deaths} · 최저 ${r.minHp}% · 장비 ${r.items} · 불씨 ${r.rr} · 인장 ${r.seal} · 정수 ${r.ess} · 골드 ${r.gold} · 물약 ${r.xpN||0}회 ${JSON.stringify(r.xpUp||{})}${r.err?' · 오류 '+r.err:''} (${r.wall}초)`)}}));
  await browser.close();const dir=path.join(__dirname,'out');fs.mkdirSync(dir,{recursive:true});
  const f=path.join(dir,(A.out||`eg_${Date.now()}`)+'.json');fs.writeFileSync(f,JSON.stringify(out,null,1));console.log('저장:',f);
})();
