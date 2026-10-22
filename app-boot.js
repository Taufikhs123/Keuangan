'use strict';
// Test preview must be served from its own origin. No production cloud reads/writes.
const TEST_MODE=['localhost','127.0.0.1'].includes(location.hostname)&&new URLSearchParams(location.search).get('test')==='1';
if(TEST_MODE){gsUrl='';gsStatus='';sessionStorage.setItem('keuangan_dont_remind_offline','1')}
else loadAll();
if(autoSaveEnabled&&!fileHandle){autoSaveEnabled=false;lastSavedInfo='Hubungkan ulang file Excel untuk mengaktifkan Auto-Save pada sesi ini.';}
const initialMonth=getLastYM();selYear=initialMonth.y;selMonth=initialMonth.m;
APPS_SCRIPT_CODE='Unduh AppsScript.gs melalui tautan di Pengaturan. Versi 3 diperlukan untuk sync yang aman.';
fetch('AppsScript.gs',{cache:'no-store'}).then(r=>r.ok?r.text():Promise.reject(Error('File AppsScript.gs tidak tersedia'))).then(code=>{APPS_SCRIPT_CODE=code;const box=document.getElementById('apps-script-code');if(box)box.value=code}).catch(()=>{});
render();updateGSStatus();enhanceAccessibility();
if(!TEST_MODE&&!startupError){
  setTimeout(checkPendingOnInit,500);
  if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(console.warn));
}
