/* prog 결과 요약: 위험도별 시도·사망·강화 단계·한 판 골드·소요 시간 */
const f=process.argv[2];const R=require('./out/'+f+'.json');
for(const r of R){console.log('==',r.cls,r.reason,'게임시간',Math.round(r.tSim/60)+'분','시도',r.att,'사망',r.deaths,'강화',JSON.stringify(r.enh),'봉인생략',JSON.stringify(r.sealSkip));
 const by={};for(const l of r.log){const o=by[l.d]=by[l.d]||{att:0,death:0,clear:0,t:0,gold:0,fullGold:0,enh0:l.enhMin,enhAvg0:l.enhAvg,enh1:l.enhMin};o.att++;if(l.res==='사망')o.death++;if(l.res==='클리어'){o.clear++;o.fullGold=Math.max(o.fullGold,l.gold)}o.t+=l.t;o.gold+=l.gold;o.enh1=l.enhMin}
 console.log('위험도 | 시도 | 사망 | 시간(분) | 번 골드(억) | 입장 시 강화(최저/평균) | 마지막 시도 강화');
 for(const d of Object.keys(by).map(Number).sort((a,b)=>a-b)){const o=by[d];console.log(String(d).padStart(3),'|',o.att,'|',o.death,'|',(o.t/60).toFixed(1),'|',(o.gold/1e8).toFixed(2),'|',o.enh0+'/'+o.enhAvg0,'|',o.enh1)}}
