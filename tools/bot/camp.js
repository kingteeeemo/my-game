#!/usr/bin/env node
/* 캠페인 봇: 1장(레벨 3, 시작 장비)부터 10장까지 이어서 진행.
   장이 끝날 때마다 마을에서 자동 장착 + 남은 골드로 강화. 진행 중에도 5초마다 더 좋은 장비면 자동 장착.
   사용: node camp.js --cls warrior:whirl,mage:chainl --seeds 1 --par 2 --out camp1 */
const fs=require('fs'),path=require('path');
const req=m=>{for(const d of [__dirname,process.env.BOT_NODE_PATH||''].filter(Boolean)){try{return require(require.resolve(m,{paths:[d]}))}catch(_){}}return require(m)};
const pp=req('puppeteer-core');
const resolveMod=f=>{for(const d of [__dirname,process.env.BOT_NODE_PATH||''].filter(Boolean)){try{return require.resolve(f,{paths:[d]})}catch(_){}}throw new Error('없음: '+f)};
const A={cls:'warrior:whirl',seeds:'1',seed0:'1',skill:'normal',chMax:'900',to:'10',par:'2',out:'',game:path.join(__dirname,'../../index.html')};
for(let i=2;i<process.argv.length;i++){const k=process.argv[i].replace(/^--/,'');A[k]=process.argv[++i]}

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
  const start=await p.evaluate(j=>{BOT.autoEq=true;BOT.debug=j.debug;return BOT.campStart(j)},job);
  const rows=[];
  for(let c=0;c<+A.to;c++){
    const s0=await p.evaluate(c=>BOT.campCh(c),c);
    for(let T=30;;T+=30){const done=await p.evaluate(t=>{try{return BOT.step(t)}catch(e){BOT.M.err=String(e.stack||e).slice(0,300);return true}},Math.min(T,+A.chMax));if(done||T>=+A.chMax)break}
    const r=await p.evaluate(()=>BOT.campEnd());const tw=await p.evaluate(()=>BOT.town());r.after=tw;r.ch=c+1;rows.push(r);
    console.log(`${job.cls}:${job.main} 시드${job.seed} ${c+1}장 | ${r.clear?'클리어':'실패'} ${r.t}초 · 보스 ${r.bossT??'-'}초 · 사망 ${r.deaths} · 최저 ${r.minHp}% · Lv ${r.s0.lv}→${r.s1.lv} · 골드 +${Math.round(r.goldIn)} · 강화 후 평균 +${tw.enh} · 티어 ${tw.tier} · DPS ${tw.dps} · EHP ${tw.ehp}${r.err?' · 오류 '+r.err:''}`);
    if(!r.clear)break}
  await p.close();return {job:`${job.cls}:${job.main}`,seed:job.seed,start,rows,pageErr:errs.slice(0,3)};
}
(async()=>{
  const browser=await pp.launch({protocolTimeout:600000,executablePath:process.env.CHROME||'/usr/bin/google-chrome',args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader','--allow-file-access-from-files']});
  const jobs=[];for(const cm of A.cls.split(',')){const [cls,main]=cm.split(':');for(let s=0;s<+A.seeds;s++)jobs.push({cls,main,skill:A.skill,seed:+A.seed0+s,debug:!!A.debug})}
  const out=[];let k=0;
  await Promise.all(Array.from({length:Math.min(+A.par,jobs.length)},async()=>{while(k<jobs.length){const j=jobs[k++];try{out.push(await one(browser,j))}catch(e){console.log('오류',j.cls,String(e).slice(0,200))}}}));
  await browser.close();const dir=path.join(__dirname,'out');fs.mkdirSync(dir,{recursive:true});
  const f=path.join(dir,(A.out||`camp_${Date.now()}`)+'.json');fs.writeFileSync(f,JSON.stringify(out,null,1));console.log('저장:',f);
})();
