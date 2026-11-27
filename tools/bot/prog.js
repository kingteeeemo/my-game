#!/usr/bin/env node
/* 진행 시뮬레이션 봇: 위험도 1→20, 돈 벌어 강화하며 올라가는 흐름 (포탈 6개 규칙)
   사용: node prog.js --cls warrior:whirl,archer:multishot --wall 3000 --out prog1 */
const fs=require('fs'),path=require('path');
const req=m=>{for(const d of [__dirname,process.env.BOT_NODE_PATH||''].filter(Boolean)){try{return require(require.resolve(m,{paths:[d]}))}catch(_){}}return require(m)};
const pp=req('puppeteer-core');
const resolveMod=f=>{for(const d of [__dirname,process.env.BOT_NODE_PATH||''].filter(Boolean)){try{return require.resolve(f,{paths:[d]})}catch(_){}}throw new Error('없음: '+f)};
const A={cls:'warrior:whirl',wall:'3000',seed:'1',skill:'normal',enh0:'0',out:'',game:path.join(__dirname,'../../index.html')};
for(let i=2;i<process.argv.length;i++){const k=process.argv[i].replace(/^--/,'');A[k]=process.argv[++i]}
async function one(browser,cm){
  const [cls,main]=cm.split(':');const p=await browser.newPage();const errs=[];p.on('pageerror',e=>errs.push(String(e).slice(0,200)));
  await p.evaluateOnNewDocument(()=>{Object.defineProperty(document,'hidden',{get:()=>false});Object.defineProperty(document,'visibilityState',{get:()=>'visible'})});
  await p.evaluateOnNewDocument(seed=>{let a=seed>>>0;Math.random=function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296};try{localStorage.clear()}catch(_){}},+A.seed);
  await p.setRequestInterception(true);
  p.on('request',r=>{const u=r.url();
    if(u.includes('three.min.js'))return r.respond({contentType:'text/javascript',body:fs.readFileSync(resolveMod('three/build/three.min.js'))});
    if(u.includes('GLTFLoader'))return r.respond({contentType:'text/javascript',body:fs.readFileSync(resolveMod('three/examples/js/loaders/GLTFLoader.js'))});
    if(u.startsWith('http'))return r.respond({contentType:'text/plain',body:''});r.continue()});
  await p.goto('file://'+path.resolve(A.game),{waitUntil:'load',timeout:90000});await new Promise(r=>setTimeout(r,3000));
  await p.evaluate(()=>{window.requestAnimationFrame=()=>0});
  await p.addScriptTag({content:fs.readFileSync(path.join(__dirname,'bot-page.js'),'utf8')});
  const info=await p.evaluate(j=>{try{return BOT.progSetup(j)}catch(e){return {err:String(e.stack||e).slice(0,400)}}},{cls,main,skill:A.skill,enh0:+A.enh0,maxT:+A.maxT||144000,maxExh:+A.maxExh||12,farm:+A.farm||3});
  if(info.err){await p.close();return {cls,err:info.err}}
  const t0=Date.now();let seen=0,last;
  while(Date.now()-t0<+A.wall*1000){
    last=await p.evaluate(()=>{try{return BOT.progRun(45000)}catch(e){return {done:true,reason:'예외 '+String(e.stack||e).slice(0,300),log:BOT.PG.log}}});
    for(;seen<last.log.length;seen++){const r=last.log[seen];console.log(`${cls} d${r.d} ${r.res} | 강화 최저+${r.enhMin} 평균+${r.enhAvg} | 포탈 남음 ${r.portalLeft} | ${r.t}초 처치 ${r.kills} 골드 ${r.gold} | 최저 ${r.minHp}% | 누적 ${Math.round((Date.now()-t0)/1000)}초`)}
    if(last.done)break}
  last.wall=Math.round((Date.now()-t0)/1000);last.cls=cls;last.pageErr=errs.slice(0,3);await p.close();return last}
(async()=>{
  const browser=await pp.launch({protocolTimeout:900000,executablePath:process.env.CHROME||'/usr/bin/google-chrome',args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader','--allow-file-access-from-files']});
  const out=await Promise.all(A.cls.split(',').map(cm=>one(browser,cm).catch(e=>({cls:cm,err:String(e).slice(0,300)}))));
  await browser.close();const dir=path.join(__dirname,'out');fs.mkdirSync(dir,{recursive:true});
  const f=path.join(dir,(A.out||`prog_${Date.now()}`)+'.json');fs.writeFileSync(f,JSON.stringify(out,null,1));
  for(const r of out)console.log(r.cls,r.err?'오류 '+r.err:`종료: ${r.reason||'시간 제한'} · 위험도 ${r.d} · 시도 ${r.att} · 사망 ${r.deaths} · 강화 ${JSON.stringify(r.enh)} · 게임시간 ${r.tSim}초 · 실시간 ${r.wall}초`);
  console.log('저장:',f);
})();
