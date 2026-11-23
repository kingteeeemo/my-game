#!/usr/bin/env node
/* 결과 요약: node report.js out/파일.json [out/다른.json ...] → 직업·스킬별 평균 표 (마크다운) */
const fs=require('fs');
const rows=[];for(const f of process.argv.slice(2))rows.push(...JSON.parse(fs.readFileSync(f,'utf8')));
const G={};for(const r of rows){if(r.err&&!r.t)continue;const k=r.job.split(' ').slice(0,2).join(' ');(G[k]=G[k]||[]).push(r)}
const avg=(a,f)=>{const v=a.map(f).filter(x=>x!=null&&!isNaN(x));return v.length?v.reduce((p,q)=>p+q,0)/v.length:null};
const fx=(v,d=1)=>v==null?'-':v.toFixed(d);
const NAME={whirl:'회전 베기',quake:'대지 분쇄',smite:'심판의 검',volley:'다발 사격',rain:'화살비',boom:'폭발 사격',frost:'얼음 보주',chainl:'연쇄 번개',pillar:'사술 폭발',wave:'매화 검기'};
console.log('| 스킬 | 판 | 클리어 | 클리어 시간 | 보스 | 사망 | 최저 체력 | 받은 피해 | 마나 물약 | 실제 DPS | 주요 피해 출처 |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|');
const out=Object.entries(G).map(([k,a])=>{const sk=k.split(' ')[0].split(':')[1];return {k,sk,a,t:avg(a.filter(r=>r.clear),r=>r.t)}}).sort((x,y)=>(x.t||1e9)-(y.t||1e9));
for(const {k,sk,a,t} of out){const src={};for(const r of a)for(const [n,p] of (r.src||[]))src[n]=(src[n]||0)+p/a.length;
  const top=Object.entries(src).sort((x,y)=>y[1]-x[1]).slice(0,2).map(([n,p])=>`${n} ${Math.round(p)}%`).join(', ');
  console.log(`| ${NAME[sk]||sk} (${k.split(' ')[1]}) | ${a.length} | ${a.filter(r=>r.clear).length}/${a.length} | ${fx(t)}초 | ${fx(avg(a,r=>r.bossT))}초 | ${fx(avg(a,r=>r.deaths),1)} | ${fx(avg(a,r=>r.minHp),0)}% | ${fx(avg(a,r=>r.dmgIn),0)} | ${fx(avg(a,r=>r.potMp),1)} | ${fx(avg(a,r=>r.dps),0)} | ${top||'-'} |`)}
