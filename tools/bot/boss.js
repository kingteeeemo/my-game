#!/usr/bin/env node
/* 보스 봇: 검귀/아귀 일반·우버를 적정 장비로 잡아 처치 시간·등급·보상(굴림) 측정
   사용: node boss.js --cls warrior:whirl --bk kn,ku,mn,mu --d 10,15,20 --seeds 3 --par 4 --out boss1
   --d 는 장비 기준 위험도(eg.js와 같은 적정 장비 공식). 생략하면 보스 위험도(kn10·mn15·ku20·mu20) */
const fs=require('fs'),path=require('path');
const req=m=>{for(const d of [__dirname,process.env.BOT_NODE_PATH||''].filter(Boolean)){try{return require(require.resolve(m,{paths:[d]}))}catch(_){}}return require(m)};
const pp=req('puppeteer-core');
const resolveMod=f=>{for(const d of [__dirname,process.env.BOT_NODE_PATH||''].filter(Boolean)){try{return require.resolve(f,{paths:[d]})}catch(_){}}throw new Error('없음: '+f)};
const A={cls:'warrior:whirl',bk:'kn,ku,mn,mu',d:'',seeds:'3',seed0:'1',skill:'normal',max:'300',par:'4',out:'',q:'.5',game:path.join(__dirname,'../../index.html')};
for(let i=2;i<process.argv.length;i++){const k=process.argv[i].replace(/^--/,'');A[k]=process.argv[++i]}
const BD={kn:10,mn:15,ku:20,mu:20};
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
  const info=await p.evaluate(j=>{try{const i=BOT.egSetup(j);const b=j.bk[0]==='m'?'maw':'knight',m=j.bk[1];
      const D=duelCfg(m,b);S.duel={tier:D.tier,uber:m==='u',m,b};S.bclr={kn:1,ku:1,mn:1,mu:1};duelBonus=null;bossFailed.knight=bossFailed.maw=1;/* 등장 연출 건너뛰기(재도전과 같음) */
      inTown=false;noML=true;try{setMap(true);applyTheme();resetWorld()}finally{noML=false}
      refreshMax();P.hp=P.mhp;P.mp=P.mmp;nsPotInit(true);BOT.M.deaths=0;return i}catch(e){return {err:String(e.stack||e).slice(0,400)}}},job);
  let res;if(info.err)res={err:info.err};else{
    if(job.bk[0]==='k')await p.evaluate(()=>new Promise(r=>{let n=0;const w=()=>{if((typeof BKN!=='undefined'&&BKN&&BKN.root)||n++>100)r();else setTimeout(w,100)};w()}));
    if(process.env.DBG)console.log(await p.evaluate(()=>JSON.stringify({mk:mapKind,arena:inArena(),en:enemies.map(e=>[e.name,e.hp,e.duel,e.maw,e.aggro]),P:[P.pos.x,P.pos.z],dbg:BOT.M})).then(s=>s.slice(0,600)));let T=0;for(;;){T+=+(process.env.STEP||10);const st=await p.evaluate(t=>{try{BOT.step(t)}catch(e){BOT.M.err=String(e).slice(0,200)}return {win:!!duelBonus,dead:BOT.M.deaths>0||P.hp<=0,err:BOT.M.err}},T);
      if(process.env.DBG)console.log(T,await p.evaluate(()=>JSON.stringify({en:enemies.filter(e=>e.duel||e.maw).map(e=>[Math.round(e.hp),Math.round(e.mhp)]),hp:Math.round(P.hp),pp:[Math.round(P.pos.x),Math.round(P.pos.z)],ep:enemies.map(e=>[Math.round(e.pos.x),Math.round(e.pos.z),e.introT,e.holdT]),t:BOT.M.t})));if(st.win||st.dead||st.err||T>=job.max)break}
    res=await p.evaluate(()=>{const r=BOT.result();const b=duelBonus;let rw=null;
      if(b){rollBonus();rw={rr:0,seal:0,cata:0,cos:[]};for(const x of b.res){if(x.t==='rr')rw.rr+=x.n;if(x.t==='seal')rw.seal+=x.n;if(x.t==='cata')rw.cata+=x.n;if(x.t==='cos')rw.cos.push(x.k)}}
      return {win:!!b,sec:b?+b.sec.toFixed(1):null,g:b?b.g:null,rolls:b?b.rolls:0,rw,deaths:r.deaths,minHp:r.minHp,potHp:r.potHp,t:r.t,err:r.err}});
    res.info=info}
  res.job=job;res.pageErr=errs.slice(0,3);await p.close();return res;
}
(async()=>{
  const browser=await pp.launch({protocolTimeout:900000,executablePath:process.env.CHROME||'/usr/bin/google-chrome',args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader','--allow-file-access-from-files']});
  const jobs=[];for(const cm of A.cls.split(','))for(const bk of A.bk.split(','))for(const d of (A.d?A.d.split(',').map(Number):[BD[bk]]))for(let s=0;s<+A.seeds;s++){const [cls,main]=cm.split(':');jobs.push({cls,main,bk,d,...spec(d),q:+A.q,skill:A.skill,max:+A.max,seed:+A.seed0+s,mut:0})}
  const out=[];let k=0;
  await Promise.all(Array.from({length:Math.min(+A.par,jobs.length)},async()=>{while(k<jobs.length){const j=jobs[k++];const t0=Date.now();let r;try{r=await one(browser,j)}catch(e){r={err:String(e).slice(0,300),job:j}}r.wall=Math.round((Date.now()-t0)/1000);out.push(r);
    const w=r.rw;console.log(`${j.cls} ${j.bk} 장비d${j.d} s${j.seed} | ${r.win?`처치 ${r.sec}초 ${r.g}등급 (${r.rolls}굴림)`:r.deaths?'사망':'시간초과'} · 최저HP ${r.minHp}% · 물약 ${r.potHp}${w?` · 불씨 ${w.rr} 인장 ${w.seal} 촉매 ${w.cata}${w.cos.length?' 외형 '+w.cos.join('/'):''}`:''}${r.err?' · 오류 '+r.err:''}${r.pageErr&&r.pageErr.length?' · 페이지오류 '+r.pageErr[0]:''} (${r.wall}초)`)}}));
  await browser.close();const dir=path.join(__dirname,'out');fs.mkdirSync(dir,{recursive:true});
  const f=path.join(dir,(A.out||`boss_${Date.now()}`)+'.json');fs.writeFileSync(f,JSON.stringify(out,null,1));console.log('저장:',f);
})();
