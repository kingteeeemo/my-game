/* 엠버 생텀 테스트 봇 — 게임 페이지 안에서 실행됨.
   게임 코드는 바꾸지 않고, 입력(input.x/z, input.held)만 넣어 사람처럼 조작한다.
   진행: 고정 dt로 update()를 직접 돌린다(화면 그리기 생략). */
(function(){
const BOT=window.BOT={};BOT.navNext=(x,z,a)=>navNext(x,z,a);
const DT=1/30;

/* ---------- 실력 프리셋 ---------- */
BOT.PRESETS={
  good:{react:.12,dodge:.9,rollUse:.8,potHp:.45,potMp:.2,retreatHp:.25,kiteMin:3.5,engage:11},
  normal:{react:.22,dodge:.6,rollUse:.5,potHp:.4,potMp:.15,retreatHp:.2,kiteMin:3,engage:10},
  poor:{react:.4,dodge:.3,rollUse:.2,potHp:.3,potMp:.1,retreatHp:.12,kiteMin:2.5,engage:9}
};
/* 근접: 적에게 붙어서 싸움 / 원거리: 거리를 둠 */
const MELEE={whirl:1,smite:1,quake:1,wave:1,purge:1};
const KEEP={purge:1.6,whirl:1.6,smite:2.2,quake:3,wave:3,volley:7,rain:6,boom:7,frost:7,chainl:7,pillar:6};

/* ---------- 시드 고정 난수(로드 전에 Math.random 교체는 runner가 함) ---------- */

/* ---------- 지표 ---------- */
function newMetrics(){return {t:0,deaths:0,minHp:1,potHp:0,potMp:0,rolls:0,dmgIn:{},dmgInTot:0,hits:0,dmgOut:0,dmgBoss:0,kills:0,bossT:null,bossEngage:null,clear:false,stuck:0,gold0:0,xp0:0,lv0:0,events:[],hpTrace:[]}}
BOT.M=newMetrics();

/* 피해 출처: 호출 스택에서 바깥 함수 이름을 뽑음 */
function srcName(){const st=(new Error().stack||'').split('\n').slice(3,9).map(l=>(l.match(/at (?:Object\.)?([\w$.]+)/)||[])[1]).filter(n=>n&&!/^(hurtPlayer|nsHurt|hurtPct|hurtPctRaw|nsHurtPct|wrap|Array|eval)$/.test(n));return st[0]||'?'}
function wrap(name,fn){const o=window[name];if(typeof o!=='function')return;window[name]=function(){try{fn.apply(this,arguments)}catch(_){}return o.apply(this,arguments)}}
function hookOnce(){if(BOT._hooked)return;BOT._hooked=1;
  const hpBefore=()=>P.hp+(P.es||0);
  for(const n of ['hurtPlayer','hurtPct','hurtPctRaw','nsHurtPct']){const o=window[n];if(typeof o!=='function')continue;
    window[n]=function(){const h0=hpBefore();const r=o.apply(this,arguments);const d=h0-hpBefore();if(d>0&&BOT.on){const k=srcName();BOT.M.dmgIn[k]=(BOT.M.dmgIn[k]||0)+d;BOT.M.dmgInTot+=d;BOT.M.hits++}return r}}
  const oh=window.hurt;window.hurt=function(e,amt){const h0=e.hp;const r=oh.apply(this,arguments);const d=Math.max(0,h0-Math.max(0,e.hp));if(BOT.on){BOT.M.dmgOut+=d;if(e.chBoss||e.gate)BOT.M.dmgBoss+=d}return r};
  const opk=window.nsPotKill;if(opk)window.nsPotKill=function(e){if(BOT.on&&!(e.duel||e.boss)){BOT.M.kp=(BOT.M.kp||0)+(e.rank>=2?10:e.rank===1?3:1);BOT.M.kr=BOT.M.kr||[0,0,0];BOT.M.kr[Math.min(2,e.rank||0)]++}return opk.apply(this,arguments)};
  const ok=window.kill;window.kill=function(e){if(BOT.on&&!e.boss)BOT.M.kills++;return ok.apply(this,arguments)};
  const od=window.die;window.die=function(){if(BOT.on){BOT.M.deaths++;BOT.M.events.push([+BOT.M.t.toFixed(1),'사망',Math.round(W2L(P.pos.x,P.pos.z).z)])}return od.apply(this,arguments)};
  const op=window.nsPotUse;if(op)window.nsPotUse=function(k){const n0=P.pch&&P.pch[k];const r=op.apply(this,arguments);if(BOT.on&&P.pch&&P.pch[k]<n0){if(k==='hp')BOT.M.potHp++;else BOT.M.potMp++}return r};
  const ot=window.telegraph;window.telegraph=function(p,r){if(BOT.on)BOT.zones.push({x:p.x,z:p.z,r:r+.6,t:BOT.M.t,end:BOT.M.t+(typeof TELE_S!=='undefined'?TELE_S*1.4:2)});return ot.apply(this,arguments)};
  const ogx=window.gainXp;window.gainXp=function(n){if(BOT.on&&BOT.EG&&n>0)BOT.EG.xp=(BOT.EG.xp||0)+n;return ogx.apply(this,arguments)};
  const omk=window.makeItem;window.makeItem=function(){const it=omk.apply(this,arguments);if(BOT.on&&BOT.EG&&it){BOT.EG.items++;if(it.tier)BOT.EG.tiers[it.tier]++}return it};
  /* 테스트 중에는 서버 기록을 보내지 않음 · 강화 컷신 생략 */
  window.tele=function(){};window.enhCine=function(k,l,ok,cb){try{cb&&cb()}catch(_){}};window.enhFx=function(){};window.renderSmith=function(){};
  const oe=window.equipBest;window.equipBest=function(){const n0=S.inv.length;try{identifyAll()}catch(_){}/* v926: 봇은 장착 전에 모두 감정 */const r=oe.apply(this,arguments);return r};
}
BOT.zones=[];

/* ---------- 멈춤 화면 처리 ---------- */
function clearPause(){
  if(typeof TALK!=='undefined'&&TALK){let n=0;while(TALK&&n++<60)talkNext()}
  if(typeof CHC!=='undefined'&&CHC.on)chCineEnd();
  for(const id of ['guide','notice','bossAsk','resume','riftRes','hmenu','cine','pause','title','slots','classSel','nick'])if($(id)&&!$(id).hidden)$(id).hidden=true;
  if(!$('lvl').hidden){try{autoPickNow()}catch(_){$('lvl').hidden=true}}
  try{cinePause=0}catch(_){}
  window.CL_PAUSE=false;if(window.PRO)PRO.on=false;
}

/* ---------- 감지 ---------- */
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
function alive(){return enemies.filter(e=>e.hp>0&&!e.air&&!(e.boss&&!e.aggro&&!e.chBoss&&!e.gate&&mapKind==='story')&&!(e._botBan>BOT.M.t)&&!(typeof barBlock==='function'&&barBlock(e)))}/* 벽(바리케이드 등) 너머의 적은 때릴 수 없으므로 무시 */
function threat(){/* 다가오는 적 투사체: 0.6초 안에 내 몸 1m 안으로 지나가면 위험 */
  let best=null;for(const o of (window.nsShots||[])){const px=o.m.position.x-P.pos.x,pz=o.m.position.z-P.pos.z,v2=o.vx*o.vx+o.vz*o.vz||1,t=-(px*o.vx+pz*o.vz)/v2;if(t<0||t>.6)continue;const cx=px+o.vx*t,cz=pz+o.vz*t,d=Math.hypot(cx,cz);if(d<1.1&&(!best||t<best.t))best={t,vx:o.vx,vz:o.vz}}return best}
function inZone(x,z){for(const q of BOT.zones)if(BOT.M.t<q.end&&Math.hypot(x-q.x,z-q.z)<q.r)return q;return null}

/* ---------- 길찾기: 스토리 맵을 0.5m 격자로 나눠 BFS (게임의 reachRun과 같은 판정) ---------- */
const NAV={};
function navBuild(){
  const st=.5,X0=-30,NX=121,NZ=Math.ceil(2*STORY_L/st)+1,r=BOT.navR||.45;
  const lx=(i,j)=>pathC(STORY_L-j*st)+X0+i*st,lz=j=>STORY_L-j*st;
  const inn=(x,z)=>sOutL(x,z)<=0&&sOutL(x+.3,z)<=0&&sOutL(x-.3,z)<=0&&sOutL(x,z+.3)<=0&&sOutL(x,z-.3)<=0;
  const ok=new Uint8Array(NX*NZ);const B=new Map();
  for(const c of colliders){const k=Math.floor(c.x/4)+','+Math.floor(c.z/4);(B.get(k)||B.set(k,[]).get(k)).push(c)}
  for(let j=0;j<NZ;j++)for(let i=0;i<NX;i++){const x=lx(i,j),z=lz(j);if(!inn(x,z))continue;const w=L2W(x,z),ix=Math.floor(w.x/4),iz=Math.floor(w.z/4);let f=1;
    for(let a=-1;a<=1&&f;a++)for(let b=-1;b<=1&&f;b++){const L=B.get((ix+a)+','+(iz+b));if(L)for(const c of L)if(Math.hypot(w.x-c.x,w.z-c.z)<c.r+r){f=0;break}}ok[j*NX+i]=f}
  Object.assign(NAV,{st,X0,NX,NZ,lx,lz,ok,nCol:colliders.length,nBar:colliders.filter(c=>c.bar).length});
}
function navCell(x,z){const L=W2L(x,z),j=Math.round((STORY_L-L.z)/NAV.st);if(j<0||j>=NAV.NZ)return null;const i=Math.round((L.x-pathC(L.z)-NAV.X0)/NAV.st);if(i<0||i>=NAV.NX)return null;return [i,j]}
function navNearOk(c){if(!c)return null;const [i0,j0]=c;for(let R=0;R<16;R++)for(let a=-R;a<=R;a++)for(let b=-R;b<=R;b++){if(Math.max(Math.abs(a),Math.abs(b))!==R)continue;const i=i0+a,j=j0+b;if(i>=0&&j>=0&&i<NAV.NX&&j<NAV.NZ&&NAV.ok[j*NAV.NX+i])return [i,j]}return null}
/* 출발점→목표 최단 경로에서 몇 m 앞의 점(월드 좌표). 길이 없으면 null */
function navNext(tx,tz,ahead){
  if(mapKind!=='story')return null;
  if(!NAV.ok||NAV.nCol!==colliders.length)navBuild();
  const s=navNearOk(navCell(P.pos.x,P.pos.z)),g=navNearOk(navCell(tx,tz));if(!s||!g)return null;
  const {NX,NZ,ok}=NAV,prev=new Int32Array(NX*NZ).fill(-1),S0=s[1]*NX+s[0],G=g[1]*NX+g[0];prev[S0]=S0;let q=[S0],found=S0===G;
  while(q.length&&!found){const n=[];for(const k of q){const i=k%NX,j=(k/NX)|0;for(const [a,b] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){const I=i+a,J=j+b;if(I<0||J<0||I>=NX||J>=NZ)continue;const K=J*NX+I;if(prev[K]>=0||!ok[K])continue;if(a&&b&&(!ok[j*NX+I]||!ok[J*NX+i]))continue;prev[K]=k;if(K===G){found=true;break}n.push(K)}if(found)break}q=n}
  if(!found)return null;
  const path=[];for(let k=G;k!==S0;k=prev[k])path.push(k);path.reverse();
  const steps=Math.max(1,Math.min(path.length,Math.round((ahead||3)/NAV.st)));const k=path[steps-1],i=k%NX,j=(k/NX)|0,x=NAV.lx(i,j),z=NAV.lz(j);
  return Object.assign(L2W(x,z),{len:path.length*NAV.st});
}

/* ---------- 목표 고르기 (스토리) ---------- */
/* 다음 벽(바리케이드·철문·쇠창살·봉인) 앞쪽에서 해야 할 일 → 없으면 길 끝 제단 */
function nextWallZ(pl){let best=-1e9;for(const c of colliders){if(!c.bar)continue;const z=W2L(c.x,c.z).z;if(z<pl.z+1&&z>best)best=z}return best}
function taskGoal(){
  if(mapKind!=='story'){/* 엔드게임: 가장 가까운 적(관문 보스 우선), 없으면 맵 가운데 */const es=enemies.filter(e=>e.hp>0&&!e.air);const g=es.find(e=>e.gate);if(g)return {x:g.pos.x,z:g.pos.z,why:'관문 보스'};let b=null,bd=1e9;for(const e of es){const d=Math.hypot(e.pos.x-P.pos.x,e.pos.z-P.pos.z);if(d<bd){bd=d;b=e}}if(mapKind==='route'){const W=BOT.W=BOT.W||{k:-1,t:0};if(S.tierKills!==W.k){W.k=S.tierKills;W.t=BOT.M.t}const idle=BOT.M.t-W.t;
      if(idle>25){/* 처치가 25초 넘게 멈추면 길을 따라 앞으로 (뒤에 남은 몹은 길 끝에서 몰려옴) — 90초 넘으면 앞쪽으로 10m 옮겨 줌(봇 전용) */const pl=W2L(P.pos.x,P.pos.z),z=Math.max(-STORY_L+31,pl.z-25);if(idle>90&&(W.j||0)<BOT.M.t-20){W.j=BOT.M.t;const z2=Math.max(-STORY_L+31,pl.z-10),p2=L2W(pathC(z2),z2);P.pos.x=p2.x;P.pos.z=p2.z;BOT.M.jump=(BOT.M.jump||0)+1}return Object.assign(L2W(pathC(z),z),{why:'길 따라'})}}
    if(b)return {x:b.pos.x,z:b.pos.z,why:'몹 찾기'};if(mapKind==='route'){const pl=W2L(P.pos.x,P.pos.z),z=Math.max(-STORY_L+31,pl.z-25);return Object.assign(L2W(pathC(z),z),{why:'길 따라'})}return {x:0,z:0,why:'가운데'}}
  const pl=W2L(P.pos.x,P.pos.z),wz=nextWallZ(pl),T=[];
  const add=(w,why,o)=>{const L=W2L(w.x,w.z);if(L.z<wz-1)return;T.push(Object.assign({x:w.x,z:w.z,why,d:Math.hypot(w.x-P.pos.x,w.z-P.pos.z)},o||{}))};
  if(typeof CHZS!=='undefined'&&CHZS){
    if(CHZS.ice&&CHZS.beacons)for(const B of CHZS.beacons)if(!B.lit)add(B.w,'봉화·도르래',{stay:2.2});
    if(CHZS.sg&&CHZS.tw)for(const t of CHZS.tw)if(!t.done)add(t.w,'수호자',{});
    for(const E of CHZS.ev2||[]){if(E.done)continue;const k=E.v.k;
      if(k==='hold')add(E.w,'자리 지키기',{stay:2.6});
      if(k==='nest')for(const N of E.nests)if(!N.dead)add(N.w,'둥지',{});
      if(k==='carry')add(E.on?E.wb:E.wa,E.on?'불씨 옮기기':'불씨 들기',{});}
    const G=CHZS.gate;if(G&&!G.sp){const w=L2W(pathC(G.z+4),G.z+4);add(w,'바리케이드',{})}
    const KG=CHZS.kg;if(KG&&!KG.sp){const w=L2W(pathC(KG.z+8),KG.z+8);add(w,'철문',{})}
  }
  const kb=enemies.find(e=>e.hp>0&&(e.kb||e.flee));if(kb)T.push({x:kb.pos.x,z:kb.pos.z,why:'열쇠지기',d:0});
  const B=BOT.ban||{};const T2=T.filter(t=>!(B[Math.round(t.x)+','+Math.round(t.z)]>BOT.M.t));const TT=T2.length?T2:T;
  if(TT.length){TT.sort((a,b)=>a.d-b.d);return TT[0]}
  const e=endPtL();return Object.assign(L2W(e.x,e.z),{why:'제단'});
}
/* ---------- 결정 (react초마다) ---------- */
let D={mx:0,mz:0,s1:false,atk:false,roll:false},decT=0,lastZ=null,stuckT=0,stuckDir=1;
function decide(){
  const C=BOT.C,sk=C.skills,main=sk,melee=!!MELEE[main];let keep=KEEP[main]||5;
  /* 근접 스킬도 사거리가 있으면 그만큼 떨어져서 씀 (회전 베기 반경·균열 길이·검기 길이) — 보스 몸통 공격 범위(몸 반경+1m) 밖을 유지 */
  let reach=keep+2.5;if(melee){try{const st=skillStats(main);reach=main==='whirl'?st.radius:main==='quake'?st.len*.55:main==='wave'?st.len*.5:main==='smite'?(st.r||4)+3:main==='purge'?st.r:reach}catch(_){}}
  const es=alive(),pos=P.pos;let tgt=null,td=1e9;
  for(const e of es){const d=dist(e.pos,pos)-(e.r||0);if(d<td){td=d;tgt=e}}
  const near=es.filter(e=>dist(e.pos,pos)<BOT.cfg.engage);
  const hpR=P.hp/P.mhp,mpR=P.mmp>0?P.mp/P.mmp:1;
  let wx=0,wz=0,why='';
  /* 1) 장판·투사체 회피 */
  const z=inZone(pos.x,pos.z);
  if(z&&Math.random()<BOT.cfg.dodge){const a=Math.atan2(pos.x-z.x,pos.z-z.z);wx=Math.sin(a);wz=Math.cos(a);why='장판 회피'}
  const th=threat();
  if(!why&&th&&Math.random()<BOT.cfg.dodge){const v=Math.hypot(th.vx,th.vz)||1;wx=-th.vz/v*stuckDir;wz=th.vx/v*stuckDir;why='투사체 회피';if(P.cd.mv<=0&&Math.random()<BOT.cfg.rollUse&&th.t<.35)D.roll=true}
  /* 2) 후퇴 (체력 낮고 물약 없음) */
  const potLeft=P.pch?P.pch.hp:1;
  if(!why&&hpR<BOT.cfg.retreatHp&&!(potLeft>0)&&near.length){let ax=0,az=0;for(const e of near){const d=dist(e.pos,pos)||1;ax+=(pos.x-e.pos.x)/d;az+=(pos.z-e.pos.z)/d}const l=Math.hypot(ax,az)||1;wx=ax/l;wz=az/l;why='후퇴'}
  if(melee&&tgt){const safe=tgt.boss||tgt.rank>=2?(tgt.r||1)+1.7:0;keep=Math.min(reach*.8,Math.max(keep,Math.min(reach*.6,5),safe))}
  /* 3) 전투 */
  if(!why&&tgt&&(near.length||tgt.gev||tgt.kb||tgt.chBoss&&td<BOT.cfg.engage+6)){
    const want=melee?keep:keep,dx=tgt.pos.x-pos.x,dz=tgt.pos.z-pos.z,d=Math.hypot(dx,dz)||1;
    if(d>want+.8){const n=d>4?navNext(tgt.pos.x,tgt.pos.z,2.5):null;const nx=n?n.x-pos.x:dx,nz=n?n.z-pos.z:dz,nd=Math.hypot(nx,nz)||1;wx=nx/nd;wz=nz/nd;why='접근';
      /* 다가가도 거리가 줄지 않으면(벽 너머 등) 그 적은 잠시 무시 */
      if(tgt._botD!==undefined&&d>tgt._botD-.2){tgt._botN=(tgt._botN||0)+BOT.cfg.react;if(tgt._botN>2.5){tgt._botBan=BOT.M.t+12;tgt._botN=0}}else tgt._botN=0;tgt._botD=d;
      /* 다가가는 데 모두 합쳐 6초를 써도 체력이 그대로면(닿지 않는 곳) 15초 무시 */
      if(tgt._botHp0===undefined)tgt._botHp0=tgt.hp;tgt._botAp=(tgt._botAp||0)+BOT.cfg.react;if(tgt._botAp>6){if(tgt.hp>=tgt._botHp0)tgt._botBan=BOT.M.t+15;tgt._botAp=0;tgt._botHp0=tgt.hp}}
    else if(!melee&&d<BOT.cfg.kiteMin){wx=-dx/d;wz=-dz/d;why='거리 벌리기'}
    else why='공격';
  }
  /* 4) 진행 */
  const g=BOT.goal=taskGoal();const gd=Math.hypot(g.x-pos.x,g.z-pos.z);
  /* 머물러야 하는 목표(봉화·자리 지키기) 안에 있으면 싸우더라도 자리를 지킴 */
  if(g.stay&&gd<g.stay&&(why==='접근'||why==='거리 벌리기'||why==='공격'||!why)){wx=0;wz=0;why=g.why+'(머묾)'}
  if(!why){let n0=navNext(g.x,g.z,3);BOT._navNull=!n0;
    /* 길을 못 찾으면(샛길·구석에 낀 경우) 먼저 지금 위치의 길 한가운데로 나옴 */
    if(!n0&&mapKind!=='story')n0=g;
    if(!n0){const pl0=W2L(pos.x,pos.z),c=L2W(pathC(pl0.z),pl0.z);
      /* 이미 길 가운데면 목표로 곧장 가 보고, 길을 못 찾는 상태가 10초 넘으면 그 목표를 30초 미룸 */
      if(Math.abs(pl0.x-pathC(pl0.z))<1.2)n0=g;else n0=navNext(c.x,c.z,3)||c;
      BOT._nn=(BOT._nn||0)+BOT.cfg.react;if(BOT._nn>10){(BOT.ban=BOT.ban||{})[Math.round(g.x)+','+Math.round(g.z)]=BOT.M.t+30;BOT._nn=0}}else BOT._nn=0
    const n=n0;const dx=n.x-pos.x,dz=n.z-pos.z,d=Math.hypot(dx,dz)||1;if(gd>.6){wx=dx/d;wz=dz/d}why=g.why}
  /* 막힘: 진행 중인데 앞으로 못 가면 옆으로 비켜 감 */
  const pl=W2L(pos.x,pos.z);
  if(BOT.goal&&why===BOT.goal.why){const gd2=Math.hypot(BOT.goal.x-pos.x,BOT.goal.z-pos.z);if(lastZ!==null&&gd2>lastZ-.15&&gd2>1)stuckT+=BOT.cfg.react;else stuckT=0;lastZ=gd2;
    if(stuckT>3){const a=Math.atan2(wx,wz)+stuckDir*1.2;wx=Math.sin(a);wz=Math.cos(a);if(stuckT>6){stuckDir=-stuckDir;stuckT=0;BOT.M.stuck++}}}
  else lastZ=null;
  /* 장판 안으로 들어가는 이동은 하지 않음 (옆으로 비킴) */
  if(why!=='장판 회피'&&Math.hypot(wx,wz)>.3){const nx=pos.x+wx*1.6,nz=pos.z+wz*1.6,q=inZone(nx,nz);if(q&&!inZone(pos.x,pos.z)){const a=Math.atan2(nx-q.x,nz-q.z);wx=Math.sin(a);wz=Math.cos(a);if(!inZone(pos.x+wx*1.6,pos.z+wz*1.6)){}else{wx=0;wz=0}}}
  /* 계산이 어긋나 방향이 숫자가 아니면 목표로 곧장 (그래도 안 되면 아무 방향) */
  if(!isFinite(wx)||!isFinite(wz)){BOT.M.nan=(BOT.M.nan||0)+1;NAV.ok=null;const g2=BOT.goal;let dx=g2?g2.x-pos.x:0,dz=g2?g2.z-pos.z:0;if(!isFinite(dx)||!isFinite(dz)||Math.hypot(dx,dz)<.01){const a=Math.random()*6.283;dx=Math.sin(a);dz=Math.cos(a)}const l=Math.hypot(dx,dz);wx=dx/l;wz=dz/l}
  /* 목표에 8초 동안 1m도 가까워지지 못하면: 길찾기 여유를 넓혀 다시 만들고 잠시 빠져나옴 */
  if(BOT.goal&&why===BOT.goal.why){const P8=BOT._p8=BOT._p8||{t:0,d:1e9};const gdN=Math.hypot(BOT.goal.x-pos.x,BOT.goal.z-pos.z);P8.t+=BOT.cfg.react;if(gdN<P8.d-1){P8.d=gdN;P8.t=0}else if(P8.t>8){P8.t=0;P8.d=gdN;BOT.navR=Math.min(.75,(BOT.navR||.45)+.15);NAV.ok=null;const U0=BOT._u=BOT._u||{t:0,x:pos.x,z:pos.z,esc:0,n:0};const a=Math.random()*6.283;U0.ex=Math.sin(a);U0.ez=Math.cos(a);U0.esc=1.5;BOT.M.stuck++}}
  else if(BOT._p8){BOT._p8.t=0;BOT._p8.d=1e9}
  /* 몸이 끼임: 움직이려는데 4초 동안 0.4m도 못 움직이면 1.2초간 아무 방향으로 빠져나옴 (3번 연속이면 그 목표를 20초 미룸) */
  const U=BOT._u=BOT._u||{t:0,x:pos.x,z:pos.z,esc:0,n:0};
  if(U.esc>0){U.esc-=BOT.cfg.react;wx=U.ex;wz=U.ez;why='빠져나오기'}
  else if(Math.hypot(wx,wz)>.3){U.t+=BOT.cfg.react;if(U.t>=4){if(Math.hypot(pos.x-U.x,pos.z-U.z)<.4){const a=Math.random()*6.283;U.ex=Math.sin(a);U.ez=Math.cos(a);U.esc=1.2;U.n++;BOT.M.stuck++;if(U.n>=3&&BOT.goal){(BOT.ban=BOT.ban||{})[Math.round(BOT.goal.x)+','+Math.round(BOT.goal.z)]=BOT.M.t+20;U.n=0}}else U.n=0;U.t=0;U.x=pos.x;U.z=pos.z}}
  else{U.t=0;U.x=pos.x;U.z=pos.z}
  D.mx=wx;D.mz=wz;D.why=why;
  /* 스킬: 사거리 안에 적이 있으면 누르고 있음, 마나 없으면 기본 공격 */
  const rng=melee?Math.max(keep+1.5,reach*.9):14;
  const canSk=P.mp>=(skillStats(main).mp||0);
  D.s1=!!(tgt&&td<rng&&canSk);D.atk=!!(tgt&&td<rng&&!canSk);
  /* 정화의 빛(켜고 끄는 오라): 오라 반경+2m 안에 적이 있고 마나가 있으면 켜 둠, 아니면 끔 — 상태가 다를 때만 버튼을 한 번 누름 */
  if(SK[main]&&SK[main].kind==='purge'){const want=!!(tgt&&td<reach+2&&P.mp>(skillStats(main).mp||0)*.1);D.pg=want;D.s1=false;D.atk=!!(tgt&&td<14&&!want)}
  /* 물약 */
  D.php=hpR<BOT.cfg.potHp&&P.cd.pot<=0&&P.pch&&P.pch.hp>0;
  D.pmp=!D.php&&mpR<BOT.cfg.potMp&&P.cd.pot<=0&&P.pch&&P.pch.mp>0&&!!tgt;
  /* 특수 물약: 싸우는 중이고 효과가 꺼져 있으면 충전된 것부터 사용 */
  D.xp=-1;if(!D.php&&!D.pmp&&tgt&&td<14&&P.cd.pot<=0&&typeof xpS==='function'){const x=xpS();for(let i=0;i<3;i++){const id=x.eq[i];if(id&&x.own[id]&&!(P.xb&&P.xb[id]>0)&&P.xch&&P.xch[id]>=1){D.xp=i;break}}}
}

/* ---------- 입력 넣기 ---------- */
function apply(){
  let mx=D.mx,mz=D.mz;
  if(typeof camYaw!=='undefined'&&camYaw){const c=Math.cos(camYaw),n=Math.sin(camYaw);const x=mx*c-mz*n,z=mx*n+mz*c;mx=x;mz=z}/* 게임이 camYaw만큼 돌리므로 반대로 */
  input.x=mx;input.z=mz;
  input.held.s1=D.s1;input.held.atk=D.atk;
  if(D.pg!==undefined&&SK[BOT.C.skills]&&SK[BOT.C.skills].kind==='purge'){input.held.s1=D.pg!==!!P.purgeOn&&!input._pgDown;input._pgDown=input.held.s1;if(P.purgeOn)BOT.M.pgT=(BOT.M.pgT||0)+DT}
  if(D.php){input.held.php=true;D.php=false}
  if(D.pmp){input.held.pmp=true;D.pmp=false}
  if(D.roll){input.held.mv=true;D.roll=false;BOT.M.rolls++}
  if(D.xp>=0){try{xpUse(D.xp);BOT.M.xpN=(BOT.M.xpN||0)+1}catch(_){}D.xp=-1}
  if(P.xb&&typeof xpS==='function'){const x=xpS();for(const id of x.eq)if(id&&P.xb[id]>0){BOT.M.xpT=BOT.M.xpT||{};BOT.M.xpT[id]=(BOT.M.xpT[id]||0)+DT}}
}

/* ---------- 한 판 준비 ---------- */
BOT.setup=function(o){
  hookOnce();
  BOT.cfg=Object.assign({},BOT.PRESETS[o.skill||'normal']);
  const [cls,main]=[o.cls,o.main];
  testPick=false;startGame(cls,main);S.test=false;S.tutor=false;S.demo=false;S.skipStart=1;S.autoGem='bal';
  S.lv=o.lv;S.xp=0;S.pending=o.lv-1;S.sk={};try{autoSpend('bal')}catch(_){}S.pending=0;
  S.enh={};for(const k of EQS)S.enh[k]=o.enh||0;
  gearSet(o.tier,cls,o.q==null?.5:o.q);
  S.ch=o.ch;S.phase=0;S.kills=0;S.chk=null;S.chev={};inTown=false;
  /* 장 시작 연출·안내 생략 */
  try{chevSet('intro')}catch(_){}
  noML=true;try{setMap(true);applyTheme();resetWorld()}finally{noML=false}
  refreshMax();P.hp=P.mhp;P.mp=P.mmp;P.pch=null;nsPotInit(true);
  try{pcMode=false}catch(_){}
  BOT.C={skills:C().skills[0]};
  NAV.ok=null;BOT._u=null;BOT.ban={};BOT.M=newMetrics();BOT.M.gold0=S.gold||0;BOT.M.lv0=S.lv;BOT.M.xp0=S.xp;BOT.zones=[];
  D={mx:0,mz:0,s1:false,atk:false,roll:false};decT=0;lastZ=null;stuckT=0;
  BOT.on=true;return {ch:S.ch+1,lv:S.lv,hp:Math.round(P.mhp),mp:Math.round(P.mmp),dps:Math.round(skillDps(BOT.C.skills).main)};
};


/* ================= 캠페인: 1장부터 이어서 진행 ================= */
const CAMP=BOT.CAMP={};
function snap(){const pw=pwParts();const eqs=EQS.map(k=>S.eq[k]).filter(Boolean);
  return {lv:S.lv,gold:S.gold||0,dps:Math.round(pw.d),ehp:Math.round(pw.e),hp:Math.round(heroMax()),enh:+(EQS.reduce((a,k)=>a+enhL(k),0)/EQS.length).toFixed(1),
    tier:eqs.length?+(eqs.reduce((a,it)=>a+(it.tier||6),0)/eqs.length).toFixed(1):0,nEq:eqs.length,enhMap:Object.fromEntries(EQS.map(k=>[k,enhL(k)]))}}
BOT.campStart=function(o){
  hookOnce();
  BOT.cfg=Object.assign({},BOT.PRESETS[o.skill||'normal']);
  testPick=false;startGame(o.cls,o.main);S.test=false;S.tutor=false;S.demo=false;S.noGuide=1;S.autoGem='bal';
  /* 튜토리얼(레벨 3까지)을 마친 상태로 시작 */
  const lv0=o.startLv||3;while(S.lv<lv0){S.xp=needXp();gainXp(0)}try{autoSpend('bal')}catch(_){}S.pending=0;
  BOT.C={skills:C().skills[0]};
  CAMP.rows=[];CAMP.spent=0;CAMP.tries=0;CAMP.ok=0;CAMP.sold=0;
  const ss=window.smithTry;window.smithTry=function(a){const g0=S.gold,L0=enhL(smithSel);const r=ss.apply(this,arguments);if(S.gold<g0){CAMP.spent+=g0-S.gold;CAMP.tries++;if(enhL(smithSel)>L0)CAMP.ok++}return r};
  return snap();
};
BOT.campCh=function(c){
  S.ch=c;S.phase=0;S.kills=0;S.chk=null;inTown=false;
  try{chevSet('intro')}catch(_){}
  noML=true;try{setMap(true);applyTheme();resetWorld()}finally{noML=false}
  refreshMax();P.hp=P.mhp;P.mp=P.mmp;P.pch=null;nsPotInit(true);try{pcMode=false}catch(_){}
  NAV.ok=null;BOT.navR=.45;BOT._p8=null;BOT._u=null;BOT.ban={};BOT.W=null;BOT.M=newMetrics();BOT.zones=[];D={mx:0,mz:0,s1:false,atk:false,roll:false};decT=0;lastZ=null;stuckT=0;BOT.on=true;
  CAMP.s0=snap();CAMP.spent0=CAMP.spent;CAMP.eqT=0;
  return {ch:c+1,...CAMP.s0};
};
/* 마을: 자동 장착 → 남은 골드로 강화(가장 낮은 부위부터, 같으면 무기 먼저) */
BOT.town=function(){
  const sp0=CAMP.spent,t0=CAMP.tries,o0=CAMP.ok;inTown=false;try{equipBest()}catch(_){}
  let n=0;const order=['weapon',...EQS.filter(k=>k!=='weapon')];
  while(n++<2000){let best=null;for(const k of order){if(!S.eq[k])continue;const L=enhL(k);if(L>=enhMax())continue;if(!best||L<enhL(best))best=k}
    if(!best)break;const c=enhCost(enhL(best),best);if((S.gold||0)<c)break;smithSel=best;try{smithTry(true)}catch(_){break}}
  smithSel=null;refreshMax();
  return Object.assign(snap(),{spent:CAMP.spent-sp0,tries:CAMP.tries-t0,ok:CAMP.ok-o0});
};
BOT.campEnd=function(){
  const r=BOT.result(),s1=snap(),s0=CAMP.s0,spent=CAMP.spent-CAMP.spent0;
  return Object.assign(r,{s0,s1,goldIn:s1.gold-s0.gold+spent,spent,tries:CAMP.tries,ok:CAMP.ok});
};


/* ================= 엔드게임: 위험도 한 판 (1,500마리 + 관문 보스) ================= */
BOT.egSetup=function(o){
  hookOnce();BOT.cfg=Object.assign({},BOT.PRESETS[o.skill||'normal']);
  testPick=false;startGame(o.cls,o.main);S.test=false;S.tutor=false;S.demo=false;S.noGuide=1;S.autoGem='bal';
  S.lv=o.lv;S.xp=0;S.pending=o.lv-1;S.sk={};try{autoSpend('bal')}catch(_){}S.pending=0;
  S.enh={};for(const k of EQS)S.enh[k]=o.enh||0;gearSet(o.tier,o.cls,o.q==null?.5:o.q,o.lo,o.rnd);
  /* 추가 강화(2차): 위험도에 따라 진행도 비율만큼 */
  const id=C().skills[0];S.sk2={};for(const g of (typeof gems2For==='function'?gems2For(id):[]))S.sk2[g]=Math.round(g2Max(g)*(o.g2||0));
  if(o.aura){S.aura={};S.auraOn={};for(const q of String(o.aura).split('+')){const [k,l]=q.split(':');S.aura[k]=+l||10;S.auraOn[k]=true}}/* --aura area:10+haste:10 */
  S.ch=NCH;S.tier=o.d;S.maxTier=o.d;S.tierKills=0;S.egSp=0;S.egK=0;S.runClr=0;S.autoUp=false;S.duel=null;
  S.mut={};if(o.mut)for(const k in MUT)S.mut[k]=1;S.mutRun=Object.assign({},S.mut);
  S.gold=0;S.rr=0;S.seal=0;S.ess=0;S.lumi=0;S.inv=[];
  /* 특수 물약: --xp dmg,crit,def → 소유·장착(옵션은 시드 난수로 굴림) */
  S.xpt={own:{},eq:[null,null,null],opt:{}};if(o.xp){const ids=String(o.xp).split('+').filter(Boolean).slice(0,3);ids.forEach((id,i)=>{S.xpt.own[id]=1;S.xpt.eq[i]=id})}
  inTown=false;noML=true;try{setMap(true);applyTheme();resetWorld()}finally{noML=false}
  refreshMax();P.hp=P.mhp;P.mp=P.mmp;P.pch=null;nsPotInit(true);P.xch={};P.xb={};try{xpInit(true)}catch(_){}try{pcMode=false}catch(_){}
  BOT.C={skills:id};NAV.ok=null;BOT._u=null;BOT._p8=null;BOT.ban={};BOT.W=null;BOT.M=newMetrics();BOT.zones=[];D={mx:0,mz:0,s1:false,atk:false,roll:false};decT=0;lastZ=null;stuckT=0;BOT.on=true;
  BOT.EG={items:0,tiers:[0,0,0,0,0,0,0]};
  return {d:o.d,lv:S.lv,tier:o.tier,enh:o.enh,g2:o.g2,mut:mutPts(S.mutRun),dps:Math.round(pwParts().d),ehp:Math.round(pwParts().e),hp:Math.round(P.mhp),map:mapKind};
};
BOT.egEnd=function(){
  const r=BOT.result();
  if(BOT.M.gateT!=null&&r.clear)r.bossT=+(r.t-BOT.M.gateT).toFixed(1);
  const xo=typeof xpS==='function'?xpS():null;r.xpN=BOT.M.xpN||0;r.kp=BOT.M.kp||0;r.kr=BOT.M.kr;r.xpUp=xo?Object.fromEntries(xo.eq.filter(Boolean).map(id=>[id+':'+(xo.opt&&xo.opt[id]),Math.round((BOT.M.xpT&&BOT.M.xpT[id]||0)/Math.max(1,BOT.M.t)*100)])):{};
  return Object.assign(r,{kills:S.tierKills,spawned:S.egSp,gateT:BOT.M.gateT==null?null:+BOT.M.gateT.toFixed(1),gold:S.gold||0,rr:S.rr||0,seal:S.seal||0,ess:S.ess||0,lumi:S.lumi||0,xp:Math.round(BOT.EG.xp||0),items:BOT.EG.items,itemTiers:BOT.EG.tiers.slice(1),bag:S.inv.length,lvEnd:S.lv});
};

/* 장비: 레벨/장에 맞는 평균 장비 (옵션 구성은 직업별 주력 옵션) */
function gearSet(t,c,q,lo,rnd){const bt={warrior:'def',archer:'eva',mage:'es'}[bc(c)]||'def',dp=bt+'p',sp=bc(c)==='mage'?'cspd':'aspd',cd=NS_CDMG[c],lt=Math.min(6,t+(lo==null?1:lo));
  const L={weapon:{o:['cc','cdm',sp],x:['area','killH']},helm:{o:[dp,'hp','dr'],x:['mp','regen']},armor:{o:[dp,'hp','dr'],x:['mp','regen']},gloves:{o:['cc','cdm','inc'],x:['killM','mcr']},
   boots:{o:[dp,'hp','dr'],x:['mspd','regen']},amulet:{o:['cc','cdm',sp],x:['mcr','res']},ring:{o:['cdm','cc','cdr'],x:['mcr','res']},ring2:{o:['cdm','cc','cdr'],x:['mcr','res']},belt:{o:[dp,'hp','dr'],x:['mp','mreg']}};/* v903 옵션 구성(기본 3 + 특수 2)에 맞춤 */
  for(const k of EQS)S.eq[k]=rnd?nsMakeItem(kSlot(k),t,{q,bt,wc:bc(c)}):nsMakeItem(kSlot(k),t,{...L[k],q,bt,wc:bc(c),lt})}

/* ---------- 진행 ---------- */
const SRCN={update:'근접 공격','window.hurtPct':'맵 사건(불길 벽 등)','window.hurtPlayer':'기타',nsShotStep:'적 투사체',chzTickX:'맵 사건(불길 벽 등)','window.':'맵 사건(불길 벽 등)',telegraph:'장판',end:'보스 기술(폭발 등)',evTick:'맵 사건(함정 등)'};
/* 진행: untilT초(게임 시간)까지 돌리고, 끝났으면 true */
BOT.step=function(untilT){
  const M=BOT.M;
  while(M.t<untilT){
    clearPause();
    if(BOT.pendTown){const f=BOT.pendTown;BOT.pendTown=null;try{f()}catch(e){M.err=String(e&&e.stack||e).slice(0,300)}return true}/* 진행 시뮬레이션: 죽어서 마을로 돌아감 */
    if(mapKind==='story'?S.phase>=2:S.runClr){M.clear=true;return true}
    if(mapKind!=='story'&&M.gateT==null&&enemies.some(e=>e.gate&&e.hp>0))M.gateT=M.t;
    if((decT-=DT)<=0){decide();decT=BOT.cfg.react}
    apply();
    try{hero.position.copy(P.pos);update(DT);if(typeof updDmg==='function')updDmg(DT);frameCam(DT);scene.updateMatrixWorld(true)}catch(err){M.err=String(err&&err.stack||err).slice(0,300);return true}
    for(let i=BOT.zones.length-1;i>=0;i--)if(M.t>BOT.zones[i].end)BOT.zones.splice(i,1);
    M.t+=DT;
    if(BOT.autoEq&&(CAMP.eqT=(CAMP.eqT||0)+DT)>=5){CAMP.eqT=0;try{identifyAll();if(upgrades().length)equipBest()}catch(_){}}
    const r=P.hp/P.mhp;if(r<M.minHp)M.minHp=r;
    const b=enemies.find(e=>e.chBoss&&e.hp>0);if(b&&b.aggro&&M.bossEngage===null)M.bossEngage=M.t;
    if((M._hpT=(M._hpT||0)+DT)>=1){M._hpT=0;M.hpTrace.push(Math.round(r*100));if(BOT.debug&&mapKind==='story'&&Math.round(M.t)%3===0){const pl=W2L(P.pos.x,P.pos.z);M.dbg=M.dbg||[];M.dbg.push([Math.round(M.t),D.why,Math.round(pl.z),+(pl.x-pathC(pl.z)).toFixed(1),+pathW(pl.z).toFixed(1),alive().length,D.s1?1:0,+input.x.toFixed(2),+input.z.toFixed(2),paused()?1:0,BOT.goal?(()=>{const g=W2L(BOT.goal.x,BOT.goal.z);return [Math.round(g.x-pathC(g.z)),Math.round(g.z)]})():null,BOT._navNull?1:0,(()=>{const c=navCell(P.pos.x,P.pos.z);return c&&NAV.ok?NAV.ok[c[1]*NAV.NX+c[0]]:-1})()])}}
  }
  return false;
};
BOT.result=function(){
  const M=BOT.M;
  input.x=input.z=0;input.held.s1=input.held.atk=false;BOT.on=false;
  if(M.clear&&M.bossEngage!==null)M.bossT=M.t-M.bossEngage;
  const agg={};for(const [k,v] of Object.entries(M.dmgIn)){const n=SRCN[k]||k;agg[n]=(agg[n]||0)+v}
  const top=Object.entries(agg).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([k,v])=>[k,Math.round(v/Math.max(1,M.dmgInTot)*100)]);
  const pl=W2L(P.pos.x,P.pos.z);
  return {clear:M.clear,t:+M.t.toFixed(1),bossT:M.bossT==null?null:+M.bossT.toFixed(1),deaths:M.deaths,minHp:Math.round(M.minHp*100),potHp:M.potHp,potMp:M.potMp,rolls:M.rolls,
    kills:M.kills,pgOn:M.pgT?Math.round(M.pgT/Math.max(1,M.t)*100):null,dmgOut:Math.round(M.dmgOut),dps:Math.round(M.dmgOut/Math.max(1,M.t)),dmgIn:Math.round(M.dmgInTot),hits:M.hits,src:top,stuck:M.stuck,
    gold:(S.gold||0)-M.gold0,lv:[M.lv0,S.lv],prog:mapKind==='story'?Math.round(100*(STORY_L-8-pl.z)/(2*STORY_L-20)):S.tierKills,events:M.events.slice(0,20),err:M.err||null,hpTrace:M.hpTrace,dbg:M.dbg,goal:BOT.goal&&BOT.goal.why};
};

/* ================= 진행 시뮬레이션: 돈벌기 → 강화 → 다음 위험도 (포탈 6개) =================
   위험도 1부터 순서대로: 들어가서(포탈 1개 소모) 깨면 번 골드로 강화(가장 낮은 부위부터) → 다음 위험도. 죽으면 마을 → 강화 → 다시 입장.
   포탈 6개를 다 쓰고도 못 깨면 다시 열기(변이 없음 = 무료)를 반복, 2회 소진되면 한 단계 아래 위험도를 한 판 돌아 골드를 벌고 돌아옴, 4회 소진이면 막힘으로 종료.
   장비 기본 사양(레벨·티어·2차 강화·오라)은 위험도별 표준(eg.js와 같음), 강화 단계만 번 골드로 올림. */
const PG={};
BOT.PG=PG;
const progSpec=d=>({lv:Math.round(31+4.4*(d-1)),tier:Math.max(1,Math.min(6,Math.round(4.3-3.2*(d-1)/19))),g2:+((d-1)/19).toFixed(2)});
function progGear(d){const o=PG.o,sp=progSpec(d);
  S.lv=sp.lv;S.xp=0;S.pending=sp.lv-1;S.sk={};try{autoSpend('bal')}catch(_){}S.pending=0;
  gearSet(sp.tier,o.cls,.5,1,0);
  const id=C().skills[0];S.sk2={};for(const g of (typeof gems2For==='function'?gems2For(id):[]))S.sk2[g]=Math.round(g2Max(g)*sp.g2);
  const L=Math.min(10,Math.round(d/2));S.aura={};S.auraOn={};if(L){S.aura.crit=L;S.aura.area=L;S.auraOn.crit=true;S.auraOn.area=true}
  refreshMax();PG.gearD=d}
function progEnh(){let n=0;for(;;){let kk=null,lo=99;for(const k of EQS){const L=enhL(k);if(L<NS_ENH_MAX&&L<lo){lo=L;kk=k}}if(!kk)break;const c=enhCost(lo,kk);if(S.gold<c)break;smithSel=kk;const g0=S.gold;smithTry(true);PG.spent+=g0-S.gold;if(++n>200000)break}return n}
const progEnhStat=()=>{const a=EQS.map(k=>enhL(k));return {min:Math.min(...a),avg:+(a.reduce((x,y)=>x+y,0)/a.length).toFixed(1),max:Math.max(...a)}};
function botReset(){const id=C().skills[0];BOT.C={skills:id};NAV.ok=null;BOT._u=null;BOT._p8=null;BOT.ban={};BOT.W=null;BOT.M=newMetrics();BOT.zones=[];D={mx:0,mz:0,s1:false,atk:false,roll:false};decT=0;lastZ=null;stuckT=0;BOT.on=true;BOT.EG={items:0,tiers:[0,0,0,0,0,0,0]};BOT.M.gold0=S.gold||0}
BOT.reset=()=>botReset();
BOT.progSetup=function(o){
  hookOnce();BOT.cfg=Object.assign({},BOT.PRESETS[o.skill||'normal']);
  window.defeatCine=function(sub,fn){BOT.pendTown=fn};window.ptDeathBanner=function(t,l,loss,fn){BOT.pendTown=fn};/* 연출 생략 — 다음 프레임 맨 앞에서 마을로 */
  testPick=false;startGame(o.cls,o.main);S.test=false;S.tutor=false;S.demo=false;S.noGuide=1;S.autoGem='bal';
  S.ch=NCH;S.gates=[];S.pt=null;S.enh={};for(const k of EQS)S.enh[k]=o.enh0||0;
  S.mut={};S.mutRun={};S.gold=0;S.rr=0;S.seal=0;S.ess=0;S.lumi=0;S.inv=[];S.autoUp=false;S.duel=null;S.xpt={own:{},eq:[null,null,null],opt:{}};
  Object.assign(PG,{o,d:1,cur:1,log:[],spent:0,att:0,deaths:0,exh:{},done:false,reason:'',tSim:0,sealSkip:[],clears:{}});
  S.tier=1;S.maxTier=1;S.tierKills=0;S.egSp=0;S.egK=0;S.runClr=0;S.fld=null;
  progGear(1);inTown=true;noML=true;try{setMap(true);applyTheme();resetWorld()}catch(e){return {err:String(e.stack||e).slice(0,300)}}
  return {ok:1,map:mapKind,inTown};
};
function progEnter(){
  if(PG.gearD!==PG.d)progGear(PG.d);
  const t=PG.cur,pt0=ptLeft(t);
  const st=progEnhStat();PG.attStart={d:t,enh:st,gold:S.gold||0,portal:pt0,t:PG.tSim};
  townEnter(t,true);
  if(inTown){PG.done=true;PG.reason='입장 실패 d'+t;return false}
  refreshMax();P.hp=P.mhp;P.mp=P.mmp;P.pch=null;nsPotInit(true);P.xch={};P.xb={};try{xpInit(true)}catch(_){}
  botReset();PG.att++;return true}
function progEnd(res){const M=BOT.M,a=PG.attStart;PG.tSim+=M.t;const rec={d:a.d,res,portalLeft:ptLeft(a.d),enhMin:a.enh.min,enhAvg:a.enh.avg,t:+M.t.toFixed(0),kills:S.tierKills,gold:Math.round((S.gold||0)-a.gold),minHp:Math.round(M.minHp*100),deaths:M.deaths};PG.log.push(rec);BOT.on=false;return rec}
function progTick(){
  if(PG.done)return;
  if(inTown){
    progEnh();
    if(!progEnter())return;
    return}
  const M=BOT.M;let r=BOT.step(M.t+20);
  if(inTown&&!M.clear){/* 죽어서 마을로 돌아옴 */M.err=null;const d=PG.cur;PG.deaths++;progEnd('사망');
    if(ptLeft(d)===0){PG.exh[d]=(PG.exh[d]||0)+1;
      if(PG.exh[d]>=(PG.o.maxExh||12)){PG.done=true;PG.reason='막힘 d'+d+` (포탈 ${PG.exh[d]*6}개 소진)`;return}
      if(PG.cur===PG.d&&PG.d>1){PG.cur=PG.d-1;PG.farmN=PG.o.farm||3}/* 6개를 다 쓰면 한 단계 아래 위험도를 몇 판 돌아 골드를 번 뒤 돌아옴 */}
    return}
  if(r&&M.clear){const d=PG.cur,rec=progEnd('클리어');PG.clears[d]=(PG.clears[d]||0)+1;
    if(d<PG.d&&PG.farmN>1){PG.farmN--;try{goTown()}catch(e){PG.done=true;PG.reason='goTown '+e}return}/* 골드 벌이 중 */
    if(d>=PG.d){if(!(S.maxTier>=d+1)&&d<D_MAX){S.maxTier=d+1;PG.sealSkip.push(d)}if(d>=D_MAX){PG.done=true;PG.reason='위험도 20 클리어';try{goTown()}catch(_){}return}PG.d=d+1;PG.cur=PG.d}else{PG.cur=PG.d}
    try{goTown()}catch(e){PG.done=true;PG.reason='goTown '+e}return}
  if(r&&M.err){PG.done=true;PG.reason='오류 '+M.err;return}
  if(PG.tSim+M.t>(PG.o.maxT||144000)){PG.done=true;PG.reason='시간 제한(게임 시간 '+Math.round((PG.tSim+M.t)/3600)+'시간)';return}
  if(M.t>=900){/* 한 판 15분(게임 시간) 넘으면 포기하고 마을로 */const dbg={n:enemies.length,alive:enemies.filter(e=>e.hp>0).length,boss:enemies.filter(e=>e.boss).map(e=>[e.name,e.gate,e.hp>0,e.aggro,Math.round(e.hp/e.mhp*100)]),egSp:S.egSp,tk:S.tierKills,goal:tkFor(S.tier),runClr:S.runClr,gp:gatePending(),pos:[Math.round(P.pos.x),Math.round(P.pos.z)],mapKind,hp:P.hp>0,wp:typeof paused==='function'?paused():null,spawnT:typeof spawnT!=='undefined'?spawnT:null,eglim:egLim(),room:typeof egRoom==='function'?egRoom():null};const rr0=progEnd('시간초과');rr0.dbg=dbg;try{goTown()}catch(e){PG.done=true;PG.reason='goTown '+e}}
}
BOT.progRun=function(wallMs){const t0=Date.now();while(!PG.done&&Date.now()-t0<wallMs)progTick();return BOT.progInfo()};
BOT.progInfo=function(){return {done:PG.done,reason:PG.reason,d:PG.d,cur:PG.cur,att:PG.att,deaths:PG.deaths,spent:Math.round(PG.spent),gold:S.gold||0,tSim:Math.round(PG.tSim+(BOT.on?BOT.M.t:0)),enh:progEnhStat(),inTown,pt:S.pt,sealSkip:PG.sealSkip,log:PG.log}};
})();
