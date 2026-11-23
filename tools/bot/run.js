#!/usr/bin/env node
/* 엠버 생텀 테스트 봇 러너
   사용: node run.js --cls warrior:whirl --ch 8 --lv 28 --tier 5 --enh 3 --seeds 3 --skill normal
   여러 개: --cls warrior:whirl,mage:chainl  (쉼표)
   결과: out/<이름>.json 과 표준 출력 요약 */
const fs=require('fs'),path=require('path');
const req=m=>{for(const d of [__dirname,path.join(__dirname,'../..'),process.env.BOT_NODE_PATH||''].filter(Boolean)){try{return require(require.resolve(m,{paths:[d]}))}catch(_){}}return require(m)};
const pp=req('puppeteer-core');
const resolveMod=f=>{for(const d of [__dirname,process.env.BOT_NODE_PATH||''].filter(Boolean)){try{return require.resolve(f,{paths:[d]})}catch(_){}}throw new Error('없음: '+f+' — tools/bot 에서 npm install')};

const A={cls:'warrior:whirl',ch:'8',lv:'',tier:'',enh:'',q:'.5',seeds:'3',seed0:'1',skill:'normal',max:'900',out:'',par:'3',game:path.join(__dirname,'../../index.html')};
for(let i=2;i<process.argv.length;i++){const k=process.argv[i].replace(/^--/,'');A[k]=process.argv[++i]}
/* 장별 기본 캐릭터 (레벨·장비 티어·강화) — 직접 플레이 기록에 맞춰 바꿀 수 있음 */
const SPEC={1:[5,6,0],2:[11,6,0],3:[16,5,0],4:[19,5,1],5:[21,5,2],6:[24,5,2],7:[27,5,3],8:[28,5,3],9:[30,5,4],10:[31,5,4]};

async function one(browser,job){
  const p=await browser.newPage();const errs=[];p.on('pageerror',e=>errs.push(String(e).slice(0,200)));
  await p.evaluateOnNewDocument(()=>{/* 여러 탭을 동시에 돌려도 '화면에 보이는 중'으로 */Object.defineProperty(document,'hidden',{get:()=>false});Object.defineProperty(document,'visibilityState',{get:()=>'visible'})});
  await p.evaluateOnNewDocument(seed=>{/* 시드 고정 난수 (mulberry32) */let a=seed>>>0;Math.random=function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296};
    try{localStorage.clear()}catch(_){}},job.seed);
  await p.setRequestInterception(true);
  p.on('request',r=>{const u=r.url();
    if(u.includes('three.min.js'))return r.respond({contentType:'text/javascript',body:fs.readFileSync(resolveMod('three/build/three.min.js'))});
    if(u.includes('GLTFLoader'))return r.respond({contentType:'text/javascript',body:fs.readFileSync(resolveMod('three/examples/js/loaders/GLTFLoader.js'))});
    if(u.startsWith('http'))return r.respond({contentType:'text/plain',body:''});r.continue()});
  await p.goto('file://'+path.resolve(A.game),{waitUntil:'load',timeout:90000});
  await new Promise(r=>setTimeout(r,3000));
  await p.evaluate(()=>{window.requestAnimationFrame=()=>0});
  await p.addScriptTag({content:fs.readFileSync(path.join(__dirname,'bot-page.js'),'utf8')});
  const info=await p.evaluate(j=>{try{BOT.debug=j.debug;return BOT.setup(j)}catch(e){return {err:String(e.stack||e).slice(0,400)}}},job);
  let res;if(info.err)res={err:info.err};else{
    /* 30초(게임 시간)씩 나눠 진행 — 한 번의 호출이 너무 길어지지 않게 */
    for(let T=30;;T+=30){const done=await p.evaluate(t=>{try{return BOT.step(t)}catch(e){BOT.M.err=String(e.stack||e).slice(0,300);return true}},Math.min(T,job.max));if(done||T>=job.max)break}
    res=Object.assign({info},await p.evaluate(()=>BOT.result()))}
  res.pageErr=errs.slice(0,3);res.seed=job.seed;res.job=`${job.cls}:${job.main} ${job.ch+1}장 Lv${job.lv} ${job.tier}티어+${job.enh}`;
  await p.close();return res;
}

(async()=>{
  const browser=await pp.launch({protocolTimeout:600000,executablePath:process.env.CHROME||'/usr/bin/google-chrome',args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader','--allow-file-access-from-files']});
  const jobs=[];const ch=+A.ch,sp=SPEC[ch]||[30,5,4];
  for(const cm of A.cls.split(',')){const [cls,main]=cm.split(':');
    for(let s=0;s<+A.seeds;s++)jobs.push({cls,main,ch:ch-1,lv:+(A.lv||sp[0]),tier:+(A.tier||sp[1]),enh:+(A.enh||sp[2]),q:+A.q,skill:A.skill,max:+A.max,seed:+A.seed0+s,debug:!!A.debug})}
  const out=[];let k=0;
  await Promise.all(Array.from({length:Math.min(+A.par,jobs.length)},async()=>{while(k<jobs.length){const j=jobs[k++];const t0=Date.now();let r;try{r=await one(browser,j)}catch(e){r={err:String(e).slice(0,300),job:j.cls+':'+j.main,seed:j.seed}}r.wall=Math.round((Date.now()-t0)/1000);out.push(r);
    console.log(`${r.job} 시드${r.seed} | ${r.clear?'클리어':'실패'} ${r.t}초 · 보스 ${r.bossT??'-'}초 · 사망 ${r.deaths} · 최저 체력 ${r.minHp}% · 물약 ${r.potHp}/${r.potMp} · 처치 ${r.kills} · 진행 ${r.prog}% · DPS ${r.dps}${r.err?' · 오류 '+r.err:''} (${r.wall}초)`)}}));
  await browser.close();
  const dir=path.join(__dirname,'out');fs.mkdirSync(dir,{recursive:true});
  const f=path.join(dir,(A.out||`ch${A.ch}_${Date.now()}`)+'.json');fs.writeFileSync(f,JSON.stringify(out,null,1));console.log('저장:',f);
})();
