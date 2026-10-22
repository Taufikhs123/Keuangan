/* Integrity layer: atomic local snapshots, validated mutations, CAS sync, full backup. */
'use strict';
let TRIPS=[];
const SNAPSHOT_KEY='keuangan_snapshot_v3', META_KEY='keuangan_sync_meta_v3';
let localSeq=0, diskStamp='', tabConflict=false, syncBusy=false, syncRevision=null, syncSessionReady=false;
let syncMeta={};try{syncMeta=JSON.parse(localStorage.getItem(META_KEY)||'{}')}catch(_){}
let startupError='',localWriteFailed=false;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const field=id=>document.getElementById(id)?.value??'';
const numberField=id=>{const v=field(id);if(!String(v).trim())throw Error('Isi kolom angka yang diperlukan.');return Number(v)};
function stateSnapshot(){return Finance.clone({schemaVersion:3,DATA,CATEGORIES,SAVINGS,savIdCounter,STOCK,stockIdCounter,ACCOUNTS,accIdCounter,TRIPS,SETTINGS:getSyncedSettings()})}
function applyState(s){
  DATA=s.DATA;CATEGORIES=s.CATEGORIES;SAVINGS=s.SAVINGS;savIdCounter=s.savIdCounter;
  STOCK=s.STOCK;stockIdCounter=s.stockIdCounter;ACCOUNTS=s.ACCOUNTS;accIdCounter=s.accIdCounter;TRIPS=s.TRIPS||[];
  if(s.SETTINGS){const x=s.SETTINGS;CURRENCY=x.currency||'¥';MASCOT_ON=x.mascotOn!==false;MOOD_THRESHOLDS=x.moodThresholds||{...MOOD_DEFAULTS}}
}
let noticeTimer=null,noticeRemaining=0,noticeStarted=0,noticeReturnFocus=null;
const noticeHolds=new Set();
function pauseNotice(reason){
  noticeHolds.add(reason);
  if(noticeTimer!==null){clearTimeout(noticeTimer);noticeTimer=null;noticeRemaining=Math.max(0,noticeRemaining-(performance.now()-noticeStarted))}
}
function resumeNotice(reason){
  noticeHolds.delete(reason);
  if(noticeHolds.size||noticeTimer!==null||noticeRemaining<=0||document.getElementById('app-notice')?.hidden)return;
  noticeStarted=performance.now();noticeTimer=setTimeout(()=>dismissNotice(),noticeRemaining);
}
function dismissNotice(){
  clearTimeout(noticeTimer);noticeTimer=null;noticeRemaining=0;noticeHolds.clear();
  const n=document.getElementById('app-notice');if(!n)return;
  const restore=n.contains(document.activeElement);n.hidden=true;
  if(restore){const target=noticeReturnFocus?.isConnected?noticeReturnFocus:document.getElementById('main');if(target){if(!target.hasAttribute('tabindex')&&target.id==='main')target.tabIndex=-1;target.focus({preventScroll:true})}}
}
function announce(message,error=false,options={}){
  let n=document.getElementById('app-notice');
  if(!n){
    n=document.createElement('div');n.id='app-notice';n.hidden=true;
    const text=document.createElement('span');text.id='app-notice-message';text.setAttribute('aria-atomic','true');
    const close=document.createElement('button');close.type='button';close.className='app-notice-close';close.setAttribute('aria-label','Tutup notifikasi');close.textContent='×';close.addEventListener('click',dismissNotice);
    n.append(text,close);document.body.append(n);
    n.addEventListener('pointerenter',()=>pauseNotice('pointer'));n.addEventListener('pointerleave',()=>resumeNotice('pointer'));
    n.addEventListener('focusin',()=>pauseNotice('focus'));n.addEventListener('focusout',e=>{if(!n.contains(e.relatedTarget))resumeNotice('focus')});
    document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseNotice('background');else resumeNotice('background')});
  }
  clearTimeout(noticeTimer);noticeTimer=null;noticeHolds.clear();
  if(!n.contains(document.activeElement))noticeReturnFocus=document.activeElement;
  const text=n.querySelector('#app-notice-message');text.setAttribute('role',error?'alert':'status');text.setAttribute('aria-live',error?'assertive':'polite');text.textContent=message;
  const success=options.kind==='success';n.className='app-notice'+(error?' error':success?' success':'');n.hidden=false;
  // Errors stay until dismissed. Success/info pause while being read or focused.
  noticeRemaining=error||options.sticky?0:(success?4000:6000);
  if(document.hidden)noticeHolds.add('background');if(n.matches(':hover'))noticeHolds.add('pointer');if(n.contains(document.activeElement))noticeHolds.add('focus');resumeNotice('start');
}
function persistState(pending=true){
  const stamp=Finance.uid(),s=stateSnapshot();
  // One atomic setItem is the authoritative local state, including pending and revision.
  const record={state:s,pending,seq:++localSeq,stamp,meta:syncMeta};
  try{localStorage.setItem(SNAPSHOT_KEY,JSON.stringify(record));diskStamp=stamp;localWriteFailed=false;localStorage.setItem('keuangan_pending_local',pending?'1':'0');return true}
  catch(e){localWriteFailed=true;announce('Penyimpanan perangkat gagal: '+e.message+'. Data masih di layar; segera ekspor cadangan sebelum menutup aplikasi.',true);return false}
}
saveAll=function(){
  try{applyState(Finance.validate(stateSnapshot()))}
  catch(e){try{const old=JSON.parse(localStorage.getItem(SNAPSHOT_KEY)||'null');if(old)applyState(old.state)}catch(_){}announce('Perubahan dibatalkan: '+e.message,true);return false}
  const ok=persistState(true);scheduleAutoSave();if(ok)scheduleGSSync();return ok
};
function pendingLocal(){try{return JSON.parse(localStorage.getItem(SNAPSHOT_KEY)||'null')?.pending||localStorage.getItem('keuangan_pending_local')==='1'}catch(_){return true}}
loadAll=function(){
  try{
    const raw=localStorage.getItem(SNAPSHOT_KEY);
    if(raw){const r=JSON.parse(raw);applyState(Finance.validate(r.state));localSeq=r.seq||0;diskStamp=r.stamp;syncMeta=r.meta||syncMeta;return}
    const s=stateSnapshot();
    for(const [key,name]of Object.entries({data:'DATA',cats:'CATEGORIES',savings:'SAVINGS',savId:'savIdCounter',stock:'STOCK',stockId:'stockIdCounter',accounts:'ACCOUNTS',accId:'accIdCounter'})){
      const raw=localStorage.getItem(LS_KEYS[key]);if(raw!=null)s[name]=JSON.parse(raw);
    }
    // Preserve original keys. No cleared_v1 deletion migration.
    applyState(Finance.validate(s));persistState(localStorage.getItem('keuangan_pending_local')==='1');
  }catch(e){startupError=e.message;announce('Data lokal perlu diperiksa: '+e.message+'. Salinan lama dipertahankan; perubahan dan sync diblokir.',true)}
};
const ensureEditOriginal=ensureCanEdit;
ensureCanEdit=async function(){
  if(startupError||tabConflict){alert('Perubahan diblokir untuk melindungi data. '+(startupError||'Data berubah pada tab lain; muat ulang setelah menyimpan cadangan.'));return false}
  return ensureEditOriginal();
};
isSyncOk=()=>!!gsUrl&&syncSessionReady&&gsStatus==='connected';
let mutationBusy=false;
async function mutate(action){
  if(mutationBusy)return false;
  mutationBusy=true;const before=stateSnapshot();
  try{const next=Finance.clone(before);action(next);const valid=Finance.validate(next);
    if(!await ensureCanEdit())return false;
    if(JSON.stringify(stateSnapshot())!==JSON.stringify(before))throw Error('Data berubah saat konfirmasi. Silakan ulangi tindakan.');
    applyState(valid);saveAll();return true}
  catch(e){showFormError(e.message);return false}
  finally{mutationBusy=false}
}
function showFormError(message){
  const modal=document.getElementById('modal');
  const host=modal?.classList.contains('open')?document.getElementById('mbody'):document.getElementById('main');
  let n=host.querySelector('.form-errors');if(!n){n=document.createElement('div');n.className='form-errors';n.tabIndex=-1;n.setAttribute('role','alert');host.prepend(n)}
  host.querySelectorAll('.field-error').forEach(el=>el.remove());host.querySelectorAll('[aria-invalid]').forEach(el=>{el.removeAttribute('aria-invalid');el.removeAttribute('aria-describedby')});
  n.textContent=message;
  const invalid=[...host.querySelectorAll('input:invalid,select:invalid,textarea:invalid')];
  for(const input of invalid){if(!input.id)input.id='invalid-'+Finance.uid();const error=document.createElement('p');error.className='field-error helper danger-text';error.id=input.id+'-error';error.textContent=input.validationMessage;input.setAttribute('aria-invalid','true');input.setAttribute('aria-describedby',error.id);input.after(error);const link=document.createElement('a');link.href='#'+input.id;link.textContent=(host.querySelector('label[for="'+input.id+'"]')?.textContent||'Periksa kolom')+' ';link.onclick=e=>{e.preventDefault();input.focus()};n.append(document.createElement('br'),link)}
  n.focus();
}
function redraw(){closeModal();render()}
function monthViewEntries(y,m){return DATA[y]?.[m]||ACCOUNTS.map(a=>({kind:'opening',tgl:1,ket:'Uang awal',d:getPrevEndingByAcc(y,m,a.id),k:0,acc:a.id}));}
cascadeUpdateUangAwal=()=>{const s=stateSnapshot();Finance.recalc(s);applyState(s)};
calcM=ent=>Finance.calc(ent.filter(e=>!e.capital));
getSavingsPools=()=>Finance.pools(stateSnapshot());
getUnallocated=()=>getSavingsPools().actual;
addTx=async function(){
  const y=selYear,m=selMonth;
  if(await mutate(s=>Finance.tx(s,y,m,{tgl:numberField('af-tgl'),ket:field('af-ket').trim()||getCatLabel(field('af-cat')),cat:field('af-cat'),acc:field('af-acc')||'main',d:field('af-type')==='income'?Finance.positive(numberField('af-amt')):0,k:field('af-type')==='expense'?Finance.positive(numberField('af-amt')):0})))render();
};
saveEditTx=async function(i){const id=DATA[selYear]?.[selMonth]?.[i]?.id;if(!id)return;
  if(await mutate(s=>{
    const x=Finance.entries(s).find(x=>x.e.id===id),e=x.e;if(e.xfer)throw Error('Ubah transfer dengan membatalkan pasangan transfer terlebih dahulu.');
    Finance.dateISO(x.y,x.m,numberField('et-tgl'));e.tgl=numberField('et-tgl');
    if(isUA(e))throw Error('Saldo bawaan dihitung otomatis. Gunakan transaksi koreksi saldo yang dapat ditelusuri.');
    const amt=Finance.positive(numberField('et-amt'));e.k=field('et-type')==='expense'?amt:0;e.d=field('et-type')==='income'?amt:0;e.ket=field('et-ket').trim();e.cat=field('et-cat');e.acc=field('et-acc')||e.acc;Finance.ensurePool(s);
  }))redraw();
};
delTx=async function(i){const id=DATA[selYear]?.[selMonth]?.[i]?.id;if(id&&confirm('Hapus transaksi? Transfer akan dibatalkan sebagai satu pasangan.'))if(await mutate(s=>Finance.removeTx(s,id)))render()};
doTransfer=async function(){if(await mutate(s=>Finance.transfer(s,selYear,selMonth,field('tf-from'),field('tf-to'),numberField('tf-amt'),numberField('tf-tgl'),field('tf-note').trim())))redraw()};
doCopyMonth=async function(){const y=field('cm-year'),m=field('cm-month');if(await mutate(s=>Finance.copyMonth(s,selYear,selMonth,y,m,field('cm-mode')==='replace',document.getElementById('cm-zero').checked))){selYear=y;selMonth=m;redraw()}};
addAccount=async function(){if(await mutate(s=>{
  const name=field('ac-name').trim();if(!name)throw Error('Nama akun wajib diisi.');const bal=Finance.money(numberField('ac-bal')),id='acc'+(++s.accIdCounter);
  s.ACCOUNTS.push({id,name,icon:field('ac-icon'),color:field('ac-color')});s.DATA[selYear]??={};s.DATA[selYear][selMonth]??=[];
  s.DATA[selYear][selMonth].push({id:Finance.uid(),kind:'opening',tgl:1,ket:'Uang awal',acc:id,d:bal,k:0,openingSeed:bal});
}))redraw()};
saveEditAccount=async function(id){const name=field('ac-name').trim(),icon=field('ac-icon'),color=field('ac-color');if(await mutate(s=>{const a=s.ACCOUNTS.find(a=>a.id===id);if(!a||!name)throw Error('Nama akun wajib diisi.');Object.assign(a,{name,icon,color})}))redraw()};
addCategory=async function(){const id=field('nc-id').trim().toLowerCase(),label=field('nc-label').trim(),icon=field('nc-icon')||'📌',type=field('nc-type');if(await mutate(s=>{if(!label||!id)throw Error('ID dan nama kategori wajib diisi.');s.CATEGORIES.push({id,label,icon,...(type?{type}:{})})}))render()};
saveEditCat=async function(idx){const label=field('ec-label').trim(),icon=field('ec-icon')||'📌',type=field('ec-type');if(await mutate(s=>{if(!label)throw Error('Nama kategori wajib diisi.');Object.assign(s.CATEGORIES[idx],{label,icon,type})}))redraw()};
delAccount=async function(id){if(confirm('Pindahkan seluruh dana dan transaksi akun ke Akun Utama, lalu hapus akun ini?'))if(await mutate(s=>Finance.deleteAccount(s,id)))render()};
saveSaving=async function(){if(await mutate(s=>{
  const name=field('sf-name').trim(),target=Finance.positive(numberField('sf-target')),init=Finance.money(numberField('sf-init'));if(!name||init<0)throw Error('Nama dan saldo awal nonnegatif wajib diisi.');
  const g={id:s.savIdCounter++,name,target,current:0,color:field('sf-color'),history:[]};s.SAVINGS.push(g);if(init)Finance.savingsTx(s,g.id,'deposit',init,Finance.today(),'Saldo Awal');
}))redraw()};
updateSaving=async function(id){if(await mutate(s=>{
  const g=s.SAVINGS.find(g=>g.id===id);g.name=field('se-name').trim()||g.name;g.target=Finance.positive(numberField('se-target'));
  const next=Finance.money(numberField('se-cur'));if(next<0)throw Error('Saldo tidak boleh negatif.');const delta=Finance.money(next-g.current);
  if(delta)Finance.savingsTx(s,id,delta>0?'deposit':'withdraw',Math.abs(delta),Finance.today(),'Koreksi saldo melalui Edit');
}))redraw()};
saveSavingTx=async function(id,type){if(await mutate(s=>Finance.savingsTx(s,id,type,numberField('st-amt'),field('st-date'),field('st-note').trim())))redraw()};
delSavingHistory=async function(id,idx){if(confirm('Batalkan riwayat ini dan kembalikan perubahan saldonya?'))if(await mutate(s=>Finance.undoSavings(s,id,idx))){render();openHistoryModal(id)}};
doAllocate=async function(){if(await mutate(s=>Finance.savingsTx(s,Number(field('al-goal')),'deposit',numberField('al-amt'),Finance.today(),field('al-note').trim()||'Alokasi dari pool','pool')))redraw()};
delSaving=async function(id){if(confirm('Hapus tujuan tabungan ini?'))if(await mutate(s=>{const g=s.SAVINGS.find(g=>g.id===id);if(g.history?.length||g.current)throw Error('Batalkan riwayat dan kosongkan saldo sebelum menghapus tujuan, agar dana tidak terhitung dua kali.');s.SAVINGS=s.SAVINGS.filter(g=>g.id!==id)}))render()};
addStockItem=async function(){if(await mutate(s=>{const name=field('sk-name').trim(),qty=numberField('sk-qty'),min=numberField('sk-min');if(!name)throw Error('Nama barang wajib diisi.');s.STOCK.push({id:s.stockIdCounter++,name,icon:field('sk-icon')||'📦',qty,min,unit:field('sk-unit'),note:''})}))render()};
saveEditStock=async function(id){if(await mutate(s=>{const x=s.STOCK.find(x=>x.id===id);Object.assign(x,{name:field('ek-name').trim()||x.name,icon:field('ek-icon')||'📦',qty:numberField('ek-qty'),min:numberField('ek-min'),unit:field('ek-unit'),note:field('ek-note')});delete x.status}))redraw()};
adjustStock=async function(id,d){if(await mutate(s=>{const x=s.STOCK.find(x=>x.id===id);if(![-1,1].includes(d))throw Error('Perubahan stok tidak valid.');x.qty=Math.max(0,(x.qty||0)+d)}))render()};
quickAddStock=async function(name,icon){if(await mutate(s=>{if(s.STOCK.some(x=>x.name.toLowerCase()===name.toLowerCase()))throw Error('Barang sudah ada.');s.STOCK.push({id:s.stockIdCounter++,name,icon,qty:2,min:1,unit:'',note:''})}))render()};
confirmAddMonth=async function(){const y=field('nm-year'),m=field('nm-month');if(await mutate(s=>{Finance.dateISO(y,m,1);s.DATA[y]??={};s.DATA[y][m]??=[]})){selYear=y;selMonth=m;redraw()}};
setCurrency=function(c){if(c===CURRENCY)return;const has=Finance.entries(stateSnapshot()).length||SAVINGS.length||TRIPS.length;
  if(has){alert('Mata uang pencatatan tidak dapat diganti ketika data keuangan tersedia. Simpan cadangan lalu mulai data baru agar nominal berbeda mata uang tidak tercampur.');render();return}
  CURRENCY=c;saveAll();render();
};
setMoodThresholds=function(){const h=Number(field('mt-happy')),n=Number(field('mt-normal')),w=Number(field('mt-worried'));if(![h,n,w].every(Number.isFinite)||h<0||!(h<n&&n<w)){showFormError('Batas mood harus berupa angka menaik: sehat < normal < boros.');return}MOOD_THRESHOLDS={happy:h,normal:n,worried:w};saveAll();render()};
resetMoodThresholds=function(){MOOD_THRESHOLDS={...MOOD_DEFAULTS};saveAll();render()};
toggleMascot=function(on){MASCOT_ON=on;saveAll();render()};
resetToDefault=function(){if(!confirm('Reset data di perangkat ini? Cadangkan dahulu. Koneksi cloud akan diputus dan data cloud tidak dihapus.'))return;
  clearTimeout(gsSyncTimer);gsUrl='';for(const k of Object.values(LS_KEYS))localStorage.removeItem(k);for(const k of [SNAPSHOT_KEY,META_KEY,'keuangan_gs_url','keuangan_pending_local'])localStorage.removeItem(k);location.reload()};
window.addEventListener('storage',e=>{if(e.key===SNAPSHOT_KEY&&e.newValue){const r=JSON.parse(e.newValue);if(r.stamp!==diskStamp){tabConflict=true;clearTimeout(gsSyncTimer);announce('Data diubah pada tab lain. Ekspor cadangan lalu muat ulang sebelum melanjutkan.',true)}}});

// Full-fidelity workbook. Readable sheets are views; _Backup is the restore source.
const workbookReadable=buildWorkbook;
buildWorkbook=function(){
  if(typeof XLSX==='undefined')throw Error('Pustaka Excel belum termuat. Sambungkan internet dan muat ulang sebelum memakai cadangan Excel.');
  const wb=workbookReadable(),s=Finance.validate(stateSnapshot()),json=JSON.stringify(s),rows=[['CatatanBulananBackup',3],['Bagian','JSON']];
  for(let i=0;i<json.length;i+=20000)rows.push([i/20000,json.slice(i,i+20000)]);
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(rows),'_Backup');
  wb.Workbook??={};wb.Workbook.Sheets=wb.SheetNames.map(name=>({Hidden:name==='_Backup'?1:0}));
  const tripRows=[['ID','Nama','Tujuan','Mulai','Selesai','Mata uang','Mata uang pencatatan','Kurs','Default tanggal','Terjadwal','Catatan']];
  const itemRows=[['Rencana ID','Rincian ID','Nama','Kategori','Unit','Harga/unit','Tanggal','Subtotal asal','Subtotal pencatatan','Transaksi aktual ID']];
  for(const p of TRIPS){tripRows.push([p.id,p.name,p.destination,p.start,p.end,p.currency,p.baseCurrency,p.rate,p.defaultDate,p.scheduled?'Ya':'Tidak',p.note]);for(const it of p.items)itemRows.push([p.id,it.id,it.name,it.cat,it.units,it.unitCost,it.date||p.defaultDate,Finance.money(it.units*it.unitCost),Finance.itemAmount(p,it),it.actualTxId||''])}
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(tripRows),'Rencana Perjalanan');XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(itemRows),'Biaya Perjalanan');return wb;
};
exportExcel=function(){try{const wb=buildWorkbook();XLSX.writeFile(wb,'Keuangan_'+Finance.today()+'.xlsx');lastSavedInfo='Cadangan lengkap diekspor: '+new Date().toLocaleString('id-ID');updateAutoSaveStatus()}catch(e){showFormError('Ekspor gagal: '+e.message)}};
function stateFromWorkbook(wb){
  if(wb.Sheets._Backup){const rows=XLSX.utils.sheet_to_json(wb.Sheets._Backup,{header:1});if(rows[0]?.[0]!=='CatatanBulananBackup'||rows[0][1]!==3)throw Error('Versi cadangan tidak didukung.');
    const parts=rows.slice(2);parts.forEach((r,i)=>{if(r[0]!==i||typeof r[1]!=='string')throw Error('Bagian cadangan hilang/berubah.')});return Finance.validate(JSON.parse(parts.map(r=>r[1]).join('')))}
  // Legacy export is not lossless. Never guess missing transfer/account/allocation relationships.
  throw Error('File Excel lama tidak menyimpan identitas transfer/alokasi secara lengkap. Gunakan ekspor lengkap versi baru dari perangkat yang masih menyimpan data asli. File tidak diterapkan; data sekarang tetap utuh.');
}
importExcel=async function(evt){const file=evt.target.files[0];evt.target.value='';if(!file)return;
  try{const wb=XLSX.read(await file.arrayBuffer(),{type:'array'}),s=stateFromWorkbook(wb);
    if(!confirm('Pulihkan seluruh data dari '+file.name+'? Data perangkat sekarang akan diganti. Salinan pemulihan sebelumnya disimpan lokal.'))return;
    if(!await ensureCanEdit())return;
    localStorage.setItem('keuangan_before_restore',JSON.stringify(stateSnapshot()));applyState(s);saveAll();const l=getLastYM();selYear=l.y;selMonth=l.m;go('pengaturan');announce('Cadangan lengkap berhasil dipulihkan.');
  }catch(e){showFormError('Pemulihan dibatalkan: '+e.message)}
};

// Revision protocol v3. Never send a snapshot to an unverified legacy backend.
function syncToken(){return sessionStorage.getItem('keuangan_sync_token')||''}
function setSyncToken(){sessionStorage.setItem('keuangan_sync_token',field('sync-token'));announce('Kunci disimpan untuk sesi ini. Tekan Muat/Sync untuk menghubungkan.');}
function urlValid(s){try{const u=new URL(s);return u.protocol==='https:'&&u.hostname==='script.google.com'&&/^\/macros\/s\/[^/]+\/exec$/.test(u.pathname)}catch(_){return false}}
async function apiSync(action,extra={}){
  if(!urlValid(gsUrl))throw Error('URL Apps Script tidak valid.');
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
  try{
    const res=await fetch(gsUrl,{method:'POST',redirect:'follow',signal:controller.signal,body:JSON.stringify({protocol:3,action,token:syncToken(),...extra})});
    if(!res.ok)throw Error('HTTP '+res.status);const p=await res.json();
    if(p.protocol!==3||p.ok!==true){if(p.code==='conflict'){syncSessionReady=false;throw Error('Konflik perangkat: server lebih baru. Ekspor cadangan lokal, lalu muat data server. Tidak ada data yang ditimpa.')}throw Error(p.error||'Respons server tidak mengakui penyimpanan. Perbarui Apps Script dan kunci akses.')}
    if(!Number.isSafeInteger(p.revision)||p.revision<0)throw Error('Revisi server tidak valid.');return p;
  }finally{clearTimeout(timer)}
}
async function handshake(){
  const r=await fetch(gsUrl+'?action=hello&t='+Date.now(),{cache:'no-store'});if(!r.ok)throw Error('Gagal memeriksa versi server.');const p=await r.json();if(p.protocol!==3)throw Error('Backend lama terdeteksi. Perbarui deployment Apps Script sebelum sync. Data lokal tetap aman.');
}
function syncFailure(e){gsStatus='error';gsLastError=e.message;updateGSStatus();announce(e.message,true)}
gsSave=async function(){
  if(!gsUrl||syncBusy||startupError||tabConflict)return false;
  syncBusy=true;gsStatus='syncing';updateGSStatus();
  try{
    await handshake();
    if(syncRevision===null){const r=await apiSync('read');const bound=syncMeta.url===gsUrl&&Number.isSafeInteger(syncMeta.revision);
      if(bound)syncRevision=syncMeta.revision;
      else if(r.state===null&&r.revision===0)syncRevision=0;
      else throw Error('Server memiliki data. Muat data server lebih dahulu atau ekspor lokal untuk peninjauan konflik.');
    }
    const seq=localSeq,s=Finance.validate(stateSnapshot()),requestId=Finance.uid();
    const result=await apiSync('write',{baseRevision:syncRevision,state:s,requestId});
    if(result.requestId!==requestId||result.revision!==syncRevision+1)throw Error('Pengakuan snapshot tidak cocok. Pending tetap disimpan.');
    syncRevision=result.revision;syncMeta={url:gsUrl,revision:syncRevision};localStorage.setItem(META_KEY,JSON.stringify(syncMeta));
    syncSessionReady=true;gsStatus='connected';gsLastSync=new Date().toLocaleString('id-ID');
    persistState(localSeq!==seq);updateGSStatus();return true;
  }catch(e){syncFailure(e);return false}finally{syncBusy=false;if(pendingLocal()&&gsStatus==='connected')scheduleGSSync()}
};
gsLoad=async function(showAlerts,discard=false){
  if(!gsUrl||syncBusy||startupError||tabConflict)return false;
  if(pendingLocal()&&!discard){if(!confirm('Ada perubahan lokal belum terkirim. Ekspor cadangan sebelum mengganti dengan server. Lanjutkan mengambil server?'))return false;discard=true}
  syncBusy=true;const seq=localSeq;
  try{
    await handshake();const r=await apiSync('read');
    if(localSeq!==seq)throw Error('Ada perubahan selama pengambilan data. Snapshot server tidak diterapkan.');
    if(!r.state){syncRevision=r.revision;syncMeta={url:gsUrl,revision:r.revision};syncSessionReady=true;gsStatus='connected';announce('Server kosong. Data lokal belum diubah; gunakan Push untuk mengirim.');return true}
    const s=Finance.validate(r.state);if(pendingLocal())localStorage.setItem('keuangan_before_cloud_reload',JSON.stringify(stateSnapshot()));
    applyState(s);syncRevision=r.revision;syncMeta={url:gsUrl,revision:r.revision};localStorage.setItem(META_KEY,JSON.stringify(syncMeta));persistState(false);
    syncSessionReady=true;gsStatus='connected';gsLastSync=new Date().toLocaleString('id-ID');render();updateGSStatus();if(showAlerts)announce('Data berhasil diambil dari server.',false,{kind:'success'});return true;
  }catch(e){syncFailure(e);return false}finally{syncBusy=false}
};
scheduleGSSync=function(){if(!gsUrl||!syncSessionReady||tabConflict)return;clearTimeout(gsSyncTimer);gsSyncTimer=setTimeout(()=>gsSave(),1500)};
checkPendingOnInit=async function(){
  if(startupError||!gsUrl)return;if(!syncToken()){announce('Masukkan kunci sync di Pengaturan untuk sesi ini. Data lokal tersedia.');return}
  if(pendingLocal()){const r=await confirmAsync({title:'Perubahan lokal belum terkirim',message:'Pilih Upload untuk mengirim dengan pemeriksaan revisi. Jika server lebih baru, pengiriman ditolak dan data lokal tetap tersedia.',yesText:'Upload',noText:'Nanti'});if(r.ok)await gsSave()}
  else await gsLoad(false);
};
connectGS=async function(){const u=field('gs-url-input').trim();if(!urlValid(u)){showFormError('Gunakan URL https://script.google.com/macros/s/.../exec');return}gsUrl=u;localStorage.setItem('keuangan_gs_url',u);syncRevision=null;syncSessionReady=false;syncMeta={};render();announce('Masukkan kunci akses di Pengaturan, lalu pilih Muat atau Push.');};
disconnectGS=function(){clearTimeout(gsSyncTimer);gsUrl='';syncRevision=null;syncSessionReady=false;localStorage.removeItem('keuangan_gs_url');sessionStorage.removeItem('keuangan_sync_token');render()};

// Accessibility: labels, keyboard navigation, dialog focus trap, and safe error text.
let modalReturnFocus=null,modalResolve=null;
closeModal=function(){const pending=modalResolve;modalResolve=null;document.getElementById('modal').classList.remove('open');if(pending)pending({ok:false,dontRemind:false});modalReturnFocus?.focus?.()};
const confirmBase=confirmAsync;
confirmAsync=function(opts){return new Promise(resolve=>{modalResolve=resolve;confirmBase(opts).then(r=>{if(modalResolve===resolve)modalResolve=null;resolve(r)})})};
function enhanceAccessibility(){
  for(const label of document.querySelectorAll('.fg label')){const input=label.parentElement.querySelector('input,select,textarea');if(input){input.id||=('field-'+Finance.uid());label.htmlFor=input.id}}
  for(const b of document.querySelectorAll('button'))if(!b.hasAttribute('aria-label')&&(b.title||b.classList.contains('btn-x')))b.setAttribute('aria-label',b.title||(b.textContent.trim()==='×'?'Tutup':'Tindakan'));
  for(const n of document.querySelectorAll('.menu-item')){n.setAttribute('role','button');n.tabIndex=0;n.setAttribute('aria-current',n.classList.contains('active')?'page':'false');n.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();n.click()}}}
  const modal=document.getElementById('modal'),box=modal.querySelector('.modal');box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');box.setAttribute('aria-labelledby','mtitle');
  if(modal.classList.contains('open')&&!modal.dataset.focused){modalReturnFocus=document.activeElement;modal.dataset.focused='1';setTimeout(()=>modal.querySelector('input:not([disabled]),select,textarea,button')?.focus(),0)}
  if(!modal.classList.contains('open'))delete modal.dataset.focused;
  const sidebar=document.getElementById('sidebar'),burger=document.querySelector('.burger');
  if(burger){burger.setAttribute('aria-label','Buka/tutup menu');burger.setAttribute('aria-controls','sidebar');burger.setAttribute('aria-expanded',String(sidebar.classList.contains('open')))}
  sidebar.inert=matchMedia('(max-width:768px)').matches&&!sidebar.classList.contains('open');
  const chip=document.getElementById('sync-chip');chip.setAttribute('role','button');chip.tabIndex=0;chip.setAttribute('aria-label',chip.title);chip.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();chip.click()}};
}
window.addEventListener('resize',enhanceAccessibility);
document.addEventListener('keydown',e=>{if(e.key==='Escape')document.getElementById('sidebar').classList.remove('open')});
document.addEventListener('keydown',e=>{const modal=document.getElementById('modal');if(!modal.classList.contains('open'))return;if(e.key==='Escape'){e.preventDefault();closeModal()}if(e.key==='Tab'){const a=[...modal.querySelectorAll('button,input,select,textarea,[tabindex="0"]')].filter(n=>!n.disabled&&n.getClientRects().length);const first=a[0],last=a.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}});
new MutationObserver(()=>enhanceAccessibility()).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});

const settingsBase=renderSettings;
function downloadRecovery(){
  const raw={format:'CatatanBulananRawRecovery',snapshot:localStorage.getItem(SNAPSHOT_KEY),legacy:{}};
  for(const key of Object.values(LS_KEYS))raw.legacy[key]=localStorage.getItem(key);
  const a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify(raw,null,2)],{type:'application/json'}));a.href=url;a.download='CatatanBulanan-pemulihan-mentah.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
const savingsRenderBase=renderTabungan;
renderTabungan=function(el,tr){savingsRenderBase(el,tr);const deficit=getSavingsPools().deficit;if(deficit>0){const n=document.createElement('div');n.className='form-errors';n.setAttribute('role','alert');n.textContent='Alokasi lama melebihi dana aktual sebesar '+fmt(deficit)+'. Periksa riwayat dan batalkan alokasi yang belum didanai sebelum mengurangi sumber dana.';el.prepend(n)}};
renderSettings=function(el,tr){settingsBase(el,tr);const p=document.createElement('section');p.className='panel';p.innerHTML='<div class="panel-head"><h3>Keamanan & versi sync</h3></div><div class="panel-body"><p>Sync versi 3 memakai revisi server dan kunci akses. Salin Apps Script terbaru, set Script Property <code>SYNC_TOKEN</code>, lalu deploy versi baru.</p><div class="fg"><label for="sync-token">Kunci akses (sesi ini)</label><input id="sync-token" type="password" autocomplete="off"></div><button class="btn btn-p" onclick="setSyncToken()">Gunakan kunci</button><p class="fs tm">Kunci tidak disertakan di cadangan. Data dibaca/ditulis setelah pemeriksaan versi.</p><a href="AppsScript.gs" download>Unduh Apps Script terbaru</a><p><button class="btn btn-o" onclick="downloadRecovery()">Unduh data lokal mentah</button></p><p class="fs tm">Untuk penyelamatan bila validasi/migrasi gagal; bukan pengganti cadangan Excel lengkap.</p></div>';el.prepend(p);};
