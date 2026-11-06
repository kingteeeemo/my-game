/* 잿불 성역 — 플레이 기록 수집기 (Google Apps Script)
 * 설치: 구글 스프레드시트 새로 만들기 → 확장 프로그램 → Apps Script → 이 코드 붙여넣기 → 배포 → 새 배포 → 웹 앱
 *       (실행 사용자: 나 / 액세스 권한: 모든 사용자) → 나온 URL을 게임의 TELE_URL 에 넣기 */
const COLS=['t','time','pid','sid','v','slot','ev','act','cls','lv','ch','tier','mt','gold','ess','st','eq','hp','inf','duel','arena','c','g','es','from','ok'];
function doPost(e){
  const lock=LockService.getScriptLock();lock.waitLock(20000);
  try{
    const rows=JSON.parse(e.postData.contents);
    const sh=SpreadsheetApp.getActiveSpreadsheet().getSheetByName('events')||SpreadsheetApp.getActiveSpreadsheet().insertSheet('events');
    if(sh.getLastRow()===0)sh.appendRow(COLS);
    const out=rows.map(r=>COLS.map(c=>c==='time'?new Date(r.t):(r[c]===undefined?'':r[c])));
    sh.getRange(sh.getLastRow()+1,1,out.length,COLS.length).setValues(out);
  }finally{lock.releaseLock()}
  return ContentService.createTextOutput('ok');
}
function doGet(){return ContentService.createTextOutput('collector ok')}
