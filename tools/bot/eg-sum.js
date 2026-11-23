/* 엔드게임 결과 요약: node eg-sum.js out/eg_cls.json — 스킬 × 위험도별 평균(클리어 시간·관문 보스·최저 체력·사망) */
const fs=require('fs');const D=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const NAME={whirl:'회전 베기',quake:'대지 분쇄',smite:'심판의 검',volley:'다발 사격',rain:'화살비',boom:'폭발 사격',frost:'얼음 보주',chainl:'연쇄 번개',pillar:'사술 폭발',wave:'매화 검기'};
const ds=[...new Set(D.map(r=>r.d))].sort((a,b)=>a-b);const sk=[...new Set(D.map(r=>r.job.split(' ')[0]))];
const avg=a=>a.length?a.reduce((p,q)=>p+q,0)/a.length:NaN;
for(const [lab,f,u] of [['한 판 시간(초)',r=>r.t,0],['관문 보스(초)',r=>r.bossT,0],['최저 체력(%)',r=>r.minHp,0],['사망(판 평균)',r=>r.deaths,1]]){
  console.log(`\n## ${lab}`);console.log('| 스킬 | '+ds.map(d=>'위험도 '+d).join(' | ')+' |');console.log('|---|'+ds.map(()=>'---|').join(''));
  for(const s of sk){const row=ds.map(d=>{const rs=D.filter(r=>r.job.startsWith(s+' ')&&r.d===d);const ok=rs.filter(r=>r.clear);const v=avg((lab.includes('사망')||lab.includes('최저')?rs:ok).map(f).filter(x=>x!=null));return (isNaN(v)?'-':v.toFixed(u))+(ok.length<rs.length?` (${ok.length}/${rs.length})`:'')});console.log(`| ${NAME[s.split(':')[1]]} | ${row.join(' | ')} |`)}
}
