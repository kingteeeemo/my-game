/* 캠페인 요약(스킬별 평균): node camp-sum.js out/a.json [out/b.json] */
const fs=require('fs');const NAME={whirl:'회전 베기',quake:'대지 분쇄',smite:'심판의 검',volley:'다발 사격',rain:'화살비',boom:'폭발 사격',frost:'얼음 보주',chainl:'연쇄 번개',pillar:'사술 폭발',wave:'매화 검기'};
for(const f of process.argv.slice(2)){const D=JSON.parse(fs.readFileSync(f,'utf8'));const G={};for(const r of D)(G[r.job]=G[r.job]||[]).push(r);
 console.log('\n# '+f);console.log('| 스킬 | 완주 | 합계 시간 | 1~3장 | 4~7장 | 8~10장 | 보스 평균(1~7 / 8~10) | 10장 끝 강화 |');console.log('|---|---|---|---|---|---|---|---|');
 const avg=a=>a.length?a.reduce((p,q)=>p+q,0)/a.length:NaN;
 for(const [j,a] of Object.entries(G)){const full=a.filter(r=>r.rows.length===10&&r.rows[9].clear);const rs=a.flatMap(r=>r.rows.filter(x=>x.clear));
  const seg=(lo,hi)=>avg(rs.filter(x=>x.ch>=lo&&x.ch<=hi).map(x=>x.t));const bs=(lo,hi)=>avg(rs.filter(x=>x.ch>=lo&&x.ch<=hi&&x.bossT!=null).map(x=>x.bossT));
  console.log(`| ${NAME[j.split(':')[1]]} | ${full.length}/${a.length} | ${full.length?Math.round(avg(full.map(r=>r.rows.reduce((p,x)=>p+x.t,0)))/60)+'분':'-'} | ${seg(1,3).toFixed(0)}초 | ${seg(4,7).toFixed(0)}초 | ${seg(8,10).toFixed(0)}초 | ${bs(1,7).toFixed(0)} / ${bs(8,10).toFixed(0)}초 | ${full.length?'+'+avg(full.map(r=>r.rows[9].after.enh)).toFixed(1):'-'} |`)}
 const gold=[];for(let c=0;c<10;c++){const v=D.map(r=>r.rows[c]).filter(Boolean);gold.push(avg(v.map(x=>x.goldIn)))}
 let cum=0;console.log('\n장별 골드: '+gold.map((g,i)=>`${i+1}장 ${Math.round(g)}`).join(' · ')+` · 누적 ${Math.round(gold.reduce((a,b)=>a+(b||0),0))}`);}
