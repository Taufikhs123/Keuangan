'use strict';
let tripEditorId=null,tripDraft=null;
const currencies=['¥','Rp','$','€','£','MYR','SGD','₩'];
const amountText=(n,c=CURRENCY)=>(n<0?'−':'')+c+Math.abs(n).toLocaleString('id-ID',{maximumFractionDigits:2});
const tripIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6h-4V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2ZM10 4h4v2h-4Zm10 16H4V8h16Z"/></svg>';
const navBase=buildNav;
buildNav=function(){navBase();const b=document.createElement('button');b.type='button';b.className='menu-item '+(view.page==='perjalanan'?'active':'');b.innerHTML=tripIcon+' Rencana Perjalanan';b.onclick=()=>go('perjalanan');document.getElementById('nav').insertBefore(b,document.getElementById('nav').lastElementChild)};
const renderBase=render;
render=function(){
  document.body.dataset.page=view.page;
  if(view.page==='perjalanan'){buildNav();document.getElementById('page-title').textContent='Rencana Perjalanan';renderTrips(document.getElementById('main'),document.getElementById('topbar-right'));updateGSStatus()}
  else renderBase();
  if(startupError)announce('Data lokal belum dimuat: '+startupError+'. Data asal dipertahankan; perubahan diblokir.',true);
};
function openTrip(id){tripEditorId=TRIPS.some(p=>p.id===id)?id:null;tripDraft=null;go('perjalanan');if(!tripEditorId)announce('Rencana asal sudah dihapus. Transaksi aktual tetap tersimpan.');}
function newTrip(){const day=Finance.today();tripEditorId='new';tripDraft={id:Finance.uid(),name:'',destination:'',start:day,end:day,defaultDate:day,currency:CURRENCY,baseCurrency:CURRENCY,rate:1,note:'',scheduled:false,items:[]};go('perjalanan')}
function tripTotal(p){return Finance.money(p.items.reduce((n,it)=>n+Finance.itemAmount(p,it),0))}
function renderTrips(el,tr){
  tr.innerHTML='';el.classList.add('workspace');
  if(tripEditorId){
    if(!tripDraft){const existing=TRIPS.find(p=>p.id===tripEditorId);if(!existing){tripEditorId=null;renderTrips(el,tr);return}tripDraft=Finance.clone(existing)}
    renderTripEditor(el,tripDraft);return;
  }
  const allPlanned=Finance.planned(stateSnapshot());
  el.innerHTML=`<div class="page-intro"><div><div class="eyebrow">RENCANAKAN DENGAN TENANG</div><h2>Perjalanan berikutnya</h2><p>Susun rincian, jadwalkan biaya, lalu catat saat benar-benar dibayar.</p></div><button class="btn btn-p" onclick="newTrip()">+ Rencana baru</button></div>
    <div class="summary-strip"><div><span>Rencana perjalanan</span><strong>${TRIPS.length}</strong></div><div><span>Rincian belum dibayar</span><strong>${allPlanned.length}</strong></div><div><span>Pengeluaran terencana</span><strong>${amountText(allPlanned.filter(x=>x.currency===CURRENCY).reduce((n,x)=>n+x.amount,0))}</strong><small>Belum mengurangi saldo aktual</small></div></div>
    <div class="trip-grid">${TRIPS.map(p=>{
      const paid=p.items.filter(i=>i.actualTxId).length;
      return `<article class="trip-card"><div class="trip-card-top"><span class="trip-mark">${tripIcon}</span><span class="state-tag">${p.scheduled?'Terjadwal':'Draf'}</span></div><h3>${esc(p.name)}</h3><p>${esc(p.destination||'Tujuan belum diisi')}</p><div class="fs tm">${esc(p.start)} — ${esc(p.end)}</div><div class="trip-amount">${amountText(p.items.reduce((n,it)=>n+it.units*it.unitCost,0),p.currency)}</div>${p.currency!==p.baseCurrency?`<div class="fs tm">≈ ${amountText(tripTotal(p),p.baseCurrency)} · kurs ${p.rate}</div>`:''}<div class="fs tm">${paid} dari ${p.items.length} rincian sudah dicatat</div><div class="actions"><button class="btn btn-p" onclick="openTrip('${p.id}')">Buka rencana</button><button class="btn btn-o" onclick="duplicateTrip('${p.id}')">Salin</button><button class="btn btn-o danger-text" onclick="deleteTrip('${p.id}')">Hapus</button></div></article>`;
    }).join('')||'<div class="empty-state"><h3>Mulai dari satu perjalanan</h3><p>Contohnya Liburan Osaka. Rencanakan hotel, transportasi, dan kebutuhan harian dalam satu tempat.</p><button class="btn btn-p" onclick="newTrip()">Buat rencana pertama</button></div>'}</div>`;
}
function labelInput(label,id,type,value,extra=''){return `<div class="fg"><label for="${id}">${label}</label><input id="${id}" type="${type}" value="${esc(value)}" ${extra}></div>`}
function renderTripEditor(el,p){
  const catOptions=selected=>CATEGORIES.filter(c=>c.type!=='income').map(c=>`<option value="${esc(c.id)}" ${c.id===selected?'selected':''}>${esc(c.label)}</option>`).join('');
  el.innerHTML=`<div class="page-intro"><div><button class="text-button" onclick="leaveTrip()">← Semua rencana</button><h2>${esc(p.name||'Rencana baru')}</h2><p>Biaya terencana tidak mengurangi saldo. Catat pengeluaran setelah dibayar.</p></div><button class="btn btn-p" onclick="saveTripForm()">Simpan rencana</button></div>
  <section class="surface"><div class="section-title"><h3>Detail perjalanan</h3><span class="state-tag">${p.scheduled?'Terjadwal':'Draf'}</span></div><div class="form-grid">
  ${labelInput('Nama rencana','tp-name','text',p.name,'required maxlength="160"')}${labelInput('Tujuan','tp-destination','text',p.destination||'','maxlength="160"')}
  ${labelInput('Tanggal mulai','tp-start','date',p.start,'required')}${labelInput('Tanggal selesai','tp-end','date',p.end,'required')}
  ${labelInput('Tanggal transaksi default','tp-default','date',p.defaultDate,'required')}
  <div class="fg"><label for="tp-currency">Mata uang perjalanan</label><select id="tp-currency" onchange="tripCurrencyChanged()">${currencies.map(c=>`<option ${c===p.currency?'selected':''} value="${esc(c)}">${esc(c)}</option>`).join('')}</select></div>
  ${labelInput('Kurs estimasi: 1 mata uang perjalanan = … '+p.baseCurrency,'tp-rate','number',p.rate,'min="0.00000001" step="any" required')}
  <div class="fg"><label for="tp-note">Catatan</label><textarea id="tp-note" rows="2">${esc(p.note||'')}</textarea></div></div><p class="helper">Mata uang pencatatan: ${esc(p.baseCurrency)}. Kurs disimpan bersama rencana. Tanggal tiap rincian boleh berbeda, termasuk lintas bulan atau tahun.</p></section>
  <section class="surface"><div class="section-title"><div><h3>Rincian biaya</h3><p class="helper">Kosongkan tanggal rincian untuk mengikuti tanggal default.</p></div><button class="btn btn-o" onclick="addTripLine()">+ Rincian</button></div><div id="trip-lines">
  ${p.items.map((it,index)=>`<article class="cost-line" data-item-id="${it.id}"><div class="section-title"><strong>Biaya ${index+1}</strong>${it.actualTxId?'<span class="state-tag paid">'+(it.actualDeleted?'Aktual telah dihapus':'Sudah dicatat')+'</span>':`<button class="text-button danger-text" onclick="removeTripLine('${it.id}')">Hapus rincian</button>`}</div><div class="form-grid">
    <div class="fg"><label for="tl-name-${it.id}">Nama biaya</label><input id="tl-name-${it.id}" data-field="name" value="${esc(it.name)}" required></div>
    <div class="fg"><label for="tl-cat-${it.id}">Kategori</label><select id="tl-cat-${it.id}" data-field="cat">${catOptions(it.cat)}</select></div>
    <div class="fg"><label for="tl-units-${it.id}">Jumlah unit</label><input id="tl-units-${it.id}" data-field="units" type="number" min="0.001" step="any" value="${it.units}" oninput="previewTripTotal()"></div>
    <div class="fg"><label for="tl-cost-${it.id}">Biaya per unit (${esc(p.currency)})</label><input id="tl-cost-${it.id}" data-field="unitCost" type="number" min="0.01" step="any" value="${it.unitCost}" oninput="previewTripTotal()"></div>
    <div class="fg"><label for="tl-date-${it.id}">Tanggal transaksi khusus</label><input id="tl-date-${it.id}" data-field="date" type="date" value="${esc(it.date||'')}"></div>
    <div class="line-total"><span>Subtotal estimasi</span><strong data-subtotal>${amountText(it.units*it.unitCost,p.currency)}</strong></div>
    </div>${p.scheduled&&!it.actualTxId?`<button class="btn btn-o" onclick="openConfirmTrip('${p.id}','${it.id}')">Catat sebagai pengeluaran</button>`:''}</article>`).join('')||'<p class="helper">Belum ada rincian. Tambahkan hotel, transportasi, atau biaya lainnya.</p>'}
  </div></section><section class="surface plan-footer"><div><span>Total estimasi perjalanan</span><strong id="trip-preview-total">${amountText(tripTotal(p),p.baseCurrency)}</strong><small id="trip-preview-original">${amountText(p.items.reduce((n,it)=>n+it.units*it.unitCost,0),p.currency)}</small></div><div class="actions"><button class="btn btn-o" onclick="saveTripForm()">Simpan draf/perubahan</button><button class="btn btn-p" onclick="saveTripForm(true)">${p.scheduled?'Perbarui jadwal':'Jadwalkan transaksi'}</button>${p.scheduled?'<button class="btn btn-o danger-text" onclick="unscheduleTrip()">Batalkan jadwal</button>':''}</div></section>`;
  document.getElementById('tp-rate').addEventListener('input',previewTripTotal);
}
function readTripForm(){
  const p=Finance.clone(tripDraft);p.name=field('tp-name').trim();p.destination=field('tp-destination').trim();p.start=field('tp-start');p.end=field('tp-end');p.defaultDate=field('tp-default');p.currency=field('tp-currency');p.rate=p.currency===p.baseCurrency?1:Number(field('tp-rate'));p.note=field('tp-note');
  p.items=[...document.querySelectorAll('#trip-lines .cost-line')].map(row=>{const id=row.dataset.itemId,old=p.items.find(x=>x.id===id)||{};const get=f=>row.querySelector('[data-field="'+f+'"]').value;return {...old,id,name:get('name').trim(),cat:get('cat'),units:Number(get('units')),unitCost:Number(get('unitCost')),date:get('date')}});return p;
}
function previewTripTotal(){try{const p=readTripForm();document.getElementById('trip-preview-total').textContent=amountText(tripTotal(p),p.baseCurrency);document.getElementById('trip-preview-original').textContent=amountText(p.items.reduce((n,it)=>n+it.units*it.unitCost,0),p.currency);[...document.querySelectorAll('[data-subtotal]')].forEach((el,i)=>el.textContent=amountText(p.items[i].units*p.items[i].unitCost,p.currency))}catch(_){document.getElementById('trip-preview-total').textContent='Periksa nominal/kurs'}}
function tripCurrencyChanged(){tripDraft=readTripForm();if(tripDraft.currency===tripDraft.baseCurrency)tripDraft.rate=1;else tripDraft.rate=0;render()}
function addTripLine(){tripDraft=readTripForm();tripDraft.items.push({id:Finance.uid(),name:'',cat:CATEGORIES.find(c=>c.type!=='income')?.id||'lainnya',units:1,unitCost:0,date:''});render();document.getElementById('tl-name-'+tripDraft.items.at(-1).id).focus()}
function removeTripLine(id){tripDraft=readTripForm();tripDraft.items=tripDraft.items.filter(x=>x.id!==id);render()}
function leaveTrip(){tripEditorId=null;tripDraft=null;render()}
async function saveTripForm(schedule=false){
  const p=readTripForm();if(schedule)p.scheduled=true;if(p.scheduled&&!p.items.length){showFormError('Tambahkan minimal satu rincian sebelum menjadwalkan.');return false}
  if(await mutate(s=>Finance.saveTrip(s,p))){tripEditorId=p.id;tripDraft=null;render();announce('Rencana disimpan'+(p.scheduled?' dan jadwal diperbarui.':'.'));return true}return false;
}
async function unscheduleTrip(){if(!confirm('Batalkan semua rincian terencana? Pengeluaran aktual tetap tersimpan.'))return;const p=readTripForm();p.scheduled=false;if(await mutate(s=>Finance.saveTrip(s,p))){tripDraft=null;render()}}
async function deleteTrip(id){if(confirm('Hapus rencana dan seluruh jadwalnya? Transaksi aktual tetap tersimpan di Dashboard.'))if(await mutate(s=>Finance.removeTrip(s,id))){tripEditorId=null;tripDraft=null;render()}}
async function duplicateTrip(id){if(await mutate(s=>Finance.copyTrip(s,id)))render()}
function openConfirmTrip(pid,iid){
  const p=TRIPS.find(p=>p.id===pid),it=p?.items.find(i=>i.id===iid);if(!p||!it)return;
  if(view.page==='perjalanan'&&tripEditorId===pid&&tripDraft&&JSON.stringify(readTripForm())!==JSON.stringify(p)){showFormError('Simpan perubahan rencana terlebih dahulu sebelum mencatat pengeluaran.');return}
  if(it.actualTxId){alert('Rincian sudah dicatat. Tidak dibuat transaksi kedua.');return}
  document.getElementById('mtitle').textContent='Catat sebagai pengeluaran';
  document.getElementById('mbody').innerHTML=`<p>${esc(it.name)} · ${esc(p.name)}</p><p class="helper">Nominal aktual dicatat dalam ${esc(CURRENCY)}. Estimasi tersimpan memakai kurs ${p.rate}.</p>${labelInput('Tanggal pembayaran','tc-date','date',it.date||p.defaultDate,'required')}${labelInput('Nominal aktual ('+CURRENCY+')','tc-amount','number',Finance.itemAmount(p,it),'min="0.01" step="any" required')}<div class="fg"><label for="tc-category">Kategori aktual</label><select id="tc-category">${CATEGORIES.filter(c=>c.type!=='income').map(c=>`<option value="${esc(c.id)}" ${c.id===it.cat?'selected':''}>${esc(c.label)}</option>`).join('')}</select></div><div class="fg"><label for="tc-account">Akun sumber</label><select id="tc-account">${ACCOUNTS.map(a=>`<option value="${a.id}">${esc(a.name)}</option>`).join('')}</select></div>`;
  document.getElementById('mfoot').innerHTML=`<button class="btn btn-o" onclick="closeModal()">Batal</button><button class="btn btn-p" onclick="confirmTripExpense('${pid}','${iid}')">Catat pengeluaran</button>`;
  document.getElementById('modal').classList.add('open');
}
async function confirmTripExpense(pid,iid){const options={date:field('tc-date'),amount:Number(field('tc-amount')),cat:field('tc-category'),acc:field('tc-account')};if(await mutate(s=>Finance.confirmItem(s,pid,iid,options))){tripDraft=null;redraw();announce('Pengeluaran aktual dicatat satu kali.')}}

// Dashboard shared design: focus on balances, keep mascot secondary, disclose every amount.
function ledgerDisclosure(name,category,contents){
  return `<details class="ledger-mobile-details"><summary><span class="ledger-summary-name">${esc(name)}</span><span class="ledger-summary-category">${category}</span></summary><div class="ledger-expanded">${contents}</div></details>`;
}
const dashBase=renderDash;
renderDash=function(el,tr){
  dashBase(el,tr);el.classList.add('workspace');
  const ent=monthViewEntries(selYear,selMonth),state=stateSnapshot(),ymPrefix=selYear+'-'+String(Finance.mi(selMonth)+1).padStart(2,'0');
  const plans=Finance.planned(state).filter(x=>x.date.startsWith(ymPrefix));
  const panel=el.querySelector('.tx-table')?.closest('.panel');
  if(panel){
    panel.closest('.row')?.classList.add('dashboard-ledger-row');
    const body=panel.querySelector('.panel-body');body.innerHTML=`<div class="ledger-list"><table class="ledger-table"><thead><tr><th scope="col">Tgl</th><th scope="col">Detail</th><th scope="col">Kategori / akun</th><th scope="col">Tipe</th><th scope="col" class="r">Jumlah</th><th scope="col" class="r">Saldo</th><th scope="col">Tindakan</th></tr></thead><tbody>
      ${ent.map((e,i)=>{
        const ua=isUA(e),xf=isXfer(e),future=!ua&&Finance.future(selYear,selMonth,e);
        const category=esc(ua?'Saldo awal':xf?'Transfer':getCatLabel(e.cat));
        const account=esc(accById(getAcc(e)).name);
        const type=`<span class="state-tag ${ua?'':e.d>0?'paid':''}">${ua?'Saldo':xf?'Transfer':e.d>0?'Masuk':'Keluar'}</span>`;
        const actions=`<div class="actions">${!ua&&!xf?`<button class="btn btn-o" onclick="openEditTx(${i})" aria-label="Edit ${esc(e.ket)}">Edit</button>`:''}${!ua?`<button class="btn btn-o danger-text" onclick="delTx(${i})" aria-label="Hapus ${esc(e.ket)}">Hapus</button>`:''}</div>`;
        const origin=e.tripId?`<button class="text-button origin-link" onclick="openTrip('${e.tripId}')">${TRIPS.some(p=>p.id===e.tripId)?'Buka rencana':'Rencana asal telah dihapus'}</button>`:'';
        return `<tr data-day="${e.tgl||99}" data-opening="${ua?1:0}"><td data-label="Tanggal">${e.tgl||'—'} ${future?'<span class="state-tag ledger-est-date">Est.</span>':''}</td><td data-label="Keterangan" class="ledger-name"><div class="ledger-desktop-description">${esc(e.ket)}${origin}</div>${ledgerDisclosure(e.ket,category,`<small>Akun: ${account}</small>${type}${future?'<small>Estimasi</small>':''}${origin}${actions}`)}</td><td data-label="Kategori / akun">${category}<small>${account}</small></td><td data-label="Tipe">${type}</td><td data-label="Jumlah" class="r mono ${e.d>0?'ts':'td'}">${amountText(e.d?e.d:-e.k)}</td><td data-label="Saldo" class="r mono ${e.s<0?'td':''}">${amountText(e.s||0)}</td><td data-label="Tindakan">${actions}</td></tr>`;
      }).join('')}
      ${plans.map(e=>{
        const action=`<button class="btn btn-p" onclick="openConfirmTrip('${e.tripId}','${e.itemId}')">Catat pengeluaran</button>`;
        const origin=`<button class="text-button origin-link" onclick="openTrip('${e.tripId}')">${esc(e.tripName)}</button>`;
        return `<tr class="planned-row" data-day="${Number(e.date.slice(-2))}" data-opening="0"><td data-label="Tanggal">${Number(e.date.slice(-2))}</td><td data-label="Keterangan" class="ledger-name"><div class="ledger-desktop-description">${esc(e.name)}${origin}</div>${ledgerDisclosure(e.name,esc(getCatLabel(e.cat)),`<span class="state-tag">Terencana</span><small>Belum mengurangi saldo. Akun dipilih saat pembayaran.</small>${origin}${action}`)}</td><td data-label="Kategori / akun">${esc(getCatLabel(e.cat))}<small>Akun dipilih saat pembayaran</small></td><td data-label="Tipe"><span class="state-tag">Terencana</span></td><td data-label="Jumlah" class="r mono">${amountText(e.amount,e.currency)}<small class="ledger-mobile-note">Terencana</small></td><td data-label="Saldo"><span class="ledger-desktop-note">Belum mengurangi saldo</span><span class="ledger-mobile-note" aria-label="Belum mengurangi saldo">—</span></td><td data-label="Tindakan">${action}</td></tr>`;
      }).join('')}
      ${!ent.length&&!plans.length?'<tr><td colspan="7" class="empty-state">Belum ada transaksi pada bulan ini.</td></tr>':''}</tbody></table></div>`;
  }
  const tbody=el.querySelector('.ledger-table tbody');if(tbody){const rows=[...tbody.querySelectorAll('tr[data-day]')];rows.sort((a,b)=>Number(b.dataset.opening)-Number(a.dataset.opening)||Number(a.dataset.day)-Number(b.dataset.day));rows.forEach(row=>tbody.append(row))}
  const plannedPanel=document.createElement('section');plannedPanel.className='planned-summary surface';plannedPanel.innerHTML=`<div><span class="eyebrow">PENGELUARAN TERENCANA</span><strong>${amountText(plans.filter(x=>x.currency===CURRENCY).reduce((n,x)=>n+x.amount,0))}</strong><p class="helper">${plans.length} rincian perjalanan · terpisah dari pengeluaran aktual dan saldo.</p></div><button class="btn btn-o" onclick="tripEditorId=null;go('perjalanan')">Lihat rencana</button>`;el.querySelector('.hero-saldo')?.after(plannedPanel);
  const mascot=el.querySelector('.mascot-card');if(mascot)el.querySelector('.hero-saldo')?.after(mascot);
};
