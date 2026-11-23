#!/usr/bin/env node
/* 캠페인 결과 요약: node camp-report.js out/camp_all.json */
const fs=require('fs');const D=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const NAME={whirl:'회전 베기',quake:'대지 분쇄',smite:'심판의 검',volley:'다발 사격',rain:'화살비',boom:'폭발 사격',frost:'얼음 보주',chainl:'연쇄 번개',pillar:'사술 폭발',wave:'매화 검기'};
const nm=j=>NAME[j.split(':')[1]]||j;
console.log('## 장별 클리어 시간(초) · 사망');
console.log('| 스킬 | '+[...Array(10)].map((_,i)=>`${i+1}장`).join(' | ')+' | 합계 |');console.log('|---|'+'---|'.repeat(11));
for(const r of D){const c=r.rows.map(x=>x.clear?`${Math.round(x.t)}${x.deaths?` (💀${x.deaths})`:''}`:'실패');while(c.length<10)c.push('-');console.log(`| ${nm(r.job)} | ${c.join(' | ')} | ${Math.round(r.rows.reduce((a,x)=>a+x.t,0)/60)}분 |`)}
console.log('\n## 장 보스 처치 시간(초)');
console.log('| 스킬 | '+[...Array(10)].map((_,i)=>`${i+1}장`).join(' | ')+' |');console.log('|---|'+'---|'.repeat(10));
for(const r of D){const c=r.rows.map(x=>x.bossT==null?'-':Math.round(x.bossT));while(c.length<10)c.push('-');console.log(`| ${nm(r.job)} | ${c.join(' | ')} |`)}
console.log('\n## 장 끝 상태 (레벨 · 평균 강화 · 평균 티어)');
console.log('| 스킬 | '+[...Array(10)].map((_,i)=>`${i+1}장`).join(' | ')+' |');console.log('|---|'+'---|'.repeat(10));
for(const r of D){const c=r.rows.map(x=>`${x.after.lv} · +${x.after.enh} · ${x.after.tier}T`);while(c.length<10)c.push('-');console.log(`| ${nm(r.job)} | ${c.join(' | ')} |`)}
console.log('\n## 장별 골드 수입 (처치·줍기·판매) — 스킬 평균');
const n=D.length,avg=c=>{const v=D.map(r=>r.rows[c]).filter(Boolean);return v.length?v.reduce((a,x)=>a+x.goldIn,0)/v.length:null};
let cum=0;console.log('| 장 | 수입 | 누적 | 강화에 쓴 골드 |');console.log('|---|---|---|---|');
for(let c=0;c<10;c++){const g=avg(c);if(g==null)break;cum+=g;const v=D.map(r=>r.rows[c]).filter(Boolean),sp=v.reduce((a,x)=>a+(x.after.spent||0),0)/v.length;console.log(`| ${c+1}장 | ${Math.round(g).toLocaleString()} | ${Math.round(cum).toLocaleString()} | ${Math.round(sp).toLocaleString()} |`)}
console.log('\n## 최저 체력(%)');
console.log('| 스킬 | '+[...Array(10)].map((_,i)=>`${i+1}장`).join(' | ')+' |');console.log('|---|'+'---|'.repeat(10));
for(const r of D){const c=r.rows.map(x=>x.minHp);while(c.length<10)c.push('-');console.log(`| ${nm(r.job)} | ${c.join(' | ')} |`)}
