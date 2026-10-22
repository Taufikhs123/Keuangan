/* Deploy as Web App, execute as owner. Set Script Property SYNC_TOKEN to a long random secret.
 * Protocol 3: compare-and-swap revisions, auth, chunked snapshots, immutable commit pointer.
 * Do not use the old doPost handler alongside this file.
 */
const PROTOCOL=3;
function response_(p){return ContentService.createTextOutput(JSON.stringify(Object.assign({protocol:PROTOCOL},p))).setMimeType(ContentService.MimeType.JSON);}
function doGet(){return response_({ok:true,service:'CatatanBulanan',revision:0});}
function doPost(e){
  const lock=LockService.getScriptLock();
  try{
    const req=JSON.parse(e.postData.contents||'{}');
    const token=PropertiesService.getScriptProperties().getProperty('SYNC_TOKEN');
    if(!token||req.token!==token)return response_({ok:false,code:'auth',error:'Kunci akses salah atau belum disetel.'});
    if(req.protocol!==PROTOCOL)return response_({ok:false,error:'Versi klien tidak didukung.'});
    lock.waitLock(20000);
    const ss=SpreadsheetApp.getActiveSpreadsheet();
    let sh=ss.getSheetByName('_snapshots_v3');if(!sh)sh=ss.insertSheet('_snapshots_v3');
    // A1 contains an atomic pointer to a fully written immutable chunk range.
    let meta=JSON.parse(String(sh.getRange('A1').getValue()||'null'))||{revision:0,start:0,count:0};
    let state=null;
    if(meta.count){state=JSON.parse(sh.getRange(meta.start,1,meta.count,1).getValues().map(r=>meta.encoding==='json-chunks'?JSON.parse(r[0]):r[0]).join(''));}
    else{const old=ss.getSheetByName('_data');if(old){const raw=old.getRange('A1').getValue();if(raw&&raw!=='{}'){state=JSON.parse(String(raw));meta.revision=1;}}}
    if(req.action==='read')return response_({ok:true,revision:meta.revision,state:state});
    if(req.action!=='write')return response_({ok:false,error:'Aksi tidak dikenal.'});
    if(typeof req.requestId!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(req.requestId))throw Error('Request ID tidak valid.');
    if(meta.requestId===req.requestId)return response_({ok:true,revision:meta.revision,requestId:req.requestId});
    if(req.baseRevision!==meta.revision)return response_({ok:false,code:'conflict',revision:meta.revision,error:'Snapshot server telah berubah.'});
    const p=req.state;if(!p||p.schemaVersion!==3||!p.DATA||!Array.isArray(p.ACCOUNTS)||!Array.isArray(p.TRIPS))throw Error('Snapshot tidak valid.');
    const json=JSON.stringify(p);if(json.length>4000000)throw Error('Snapshot terlalu besar. Ekspor dan arsipkan data lama.');
    const chunks=[];for(let i=0;i<json.length;i+=12000)chunks.push([JSON.stringify(json.slice(i,i+12000))]);
    const start=Math.max(sh.getLastRow()+1,3);if(sh.getMaxRows()<start+chunks.length)sh.insertRowsAfter(sh.getMaxRows(),start+chunks.length-sh.getMaxRows());
    sh.getRange(start,1,chunks.length,1).setNumberFormat('@').setValues(chunks);SpreadsheetApp.flush();
    meta={revision:meta.revision+1,start:start,count:chunks.length,encoding:'json-chunks',requestId:req.requestId};
    sh.getRange('A1').setValue(JSON.stringify(meta));SpreadsheetApp.flush();
    try{sh.hideSheet();}catch(_){}
    let warning='';try{populateViews_(ss,p)}catch(err){warning='Snapshot aman; pembaruan tabel gagal: '+err.message;}
    return response_({ok:true,revision:meta.revision,requestId:req.requestId,warning:warning});
  }catch(err){return response_({ok:false,error:String(err.message||err)});}
  finally{try{lock.releaseLock()}catch(_){}}
}
function populateViews_(ss,p){
  // Treat all user strings as text, never spreadsheet formulas.
  const safe=v=>typeof v==='string'&&/^[=+\-@]/.test(v)?"'"+v:v;
  const write=(name,rows)=>{let sh=ss.getSheetByName(name)||ss.insertSheet(name);sh.clearContents();if(sh.getMaxRows()<rows.length)sh.insertRowsAfter(sh.getMaxRows(),rows.length-sh.getMaxRows());sh.getRange(1,1,rows.length,rows[0].length).setValues(rows.map(r=>r.map(v=>safe(v==null?'':v))));};
  const tx=[['ID','Tahun','Bulan','Tanggal','Keterangan','Kategori','Akun','Pemasukan','Pengeluaran','Transfer ID','Perjalanan ID','Rincian ID']];
  const sum=[['Tahun','Bulan','Pemasukan','Pengeluaran','Selisih']];
  for(const y in p.DATA)for(const m in p.DATA[y]){let i=0,o=0;for(const e of p.DATA[y][m]){tx.push([e.id,y,m,e.tgl,e.ket,e.cat,e.acc,e.d,e.k,e.xid,e.tripId,e.tripItemId]);if(e.kind!=='opening'&&!/^uang awal$/i.test(e.ket||'')&&!e.xfer&&!e.capital){i+=e.d||0;o+=e.k||0}}sum.push([y,m,i,o,i-o]);}
  write('Transaksi',tx);write('Ringkasan',sum);
  write('Akun',[['ID','Nama','Icon','Warna']].concat(p.ACCOUNTS.map(a=>[a.id,a.name,a.icon,a.color])));
  write('Kategori',[['ID','Nama','Icon','Tipe']].concat(p.CATEGORIES.map(c=>[c.id,c.label,c.icon,c.type||'expense'])));
  write('Tabungan',[['ID','Nama','Saldo','Target','Warna']].concat(p.SAVINGS.map(g=>[g.id,g.name,g.current,g.target,g.color])));
  const hist=[['Tabungan ID','Tanggal','Tipe','Jumlah','Catatan','Sumber']];for(const g of p.SAVINGS)for(const h of g.history||[])hist.push([g.id,h.date,h.type,h.amount,h.note,h.source]);write('Riwayat Tabungan',hist);
  write('Stok Belanja',[['ID','Nama','Stok','Minimum','Satuan','Catatan']].concat(p.STOCK.map(x=>[x.id,x.name,x.qty,x.min,x.unit,x.note])));
  const trips=[['ID','Nama','Tujuan','Mulai','Selesai','Mata Uang','Mata Uang Pencatatan','Kurs','Default Tanggal','Terjadwal','Catatan']];
  const items=[['Rencana ID','Rincian ID','Nama','Kategori','Unit','Harga/unit','Tanggal','Subtotal asal','Subtotal pencatatan','Transaksi aktual ID']];
  for(const t of p.TRIPS){trips.push([t.id,t.name,t.destination,t.start,t.end,t.currency,t.baseCurrency,t.rate,t.defaultDate,t.scheduled,t.note]);for(const it of t.items)items.push([t.id,it.id,it.name,it.cat,it.units,it.unitCost,it.date||t.defaultDate,it.units*it.unitCost,it.units*it.unitCost*t.rate,it.actualTxId]);}
  write('Rencana Perjalanan',trips);write('Biaya Perjalanan',items);
  write('Pengaturan',[['Pengaturan','Nilai'],['Mata Uang',p.SETTINGS.currency],['Maskot Aktif',p.SETTINGS.mascotOn],['Batas Mood',JSON.stringify(p.SETTINGS.moodThresholds)]]);
}
