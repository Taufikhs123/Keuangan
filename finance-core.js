/* Shared domain logic. No browser storage or network access. */
(function(root){
  'use strict';
  const months=['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','December'];
  const clone=x=>JSON.parse(JSON.stringify(x));
  const uid=()=>globalThis.crypto?.randomUUID?.()||('id'+Date.now().toString(36)+Math.random().toString(36).slice(2));
  const fail=m=>{throw new Error(m)};
  const money=n=>{n=Number(n);if(!Number.isFinite(n)||Math.abs(n)>1e14)fail('Nominal tidak valid atau terlalu besar.');return Math.round((n+Number.EPSILON)*100)/100};
  const positive=n=>{n=money(n);if(n<=0)fail('Jumlah harus lebih dari nol.');return n};
  const ratio=n=>{n=Number(n);if(!Number.isFinite(n)||n<=0||n>1e12)fail('Unit/kurs harus berupa angka positif yang valid.');return n};
  const mi=m=>months.indexOf(m==='Desember'?'December':m);
  const isUA=e=>e.kind==='opening'||(!e.kind&&/^uang awal$/i.test(String(e.ket||'').trim()));
  const dateISO=(y,m,d)=>{
    const year=Number(y),month=mi(m),day=Number(d);
    if(!Number.isInteger(year)||year<1900||year>2200||month<0||!Number.isInteger(day)||day<1||day>new Date(year,month+1,0).getDate())fail('Tanggal kalender tidak valid.');
    return `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  };
  const parseDate=s=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(s))fail('Tanggal wajib diisi (YYYY-MM-DD).');const [y,m,d]=s.split('-').map(Number);if(m<1||m>12)fail('Bulan tidak valid.');dateISO(y,months[m-1],d);return {y:String(y),m:months[m-1],d}};
  const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
  const future=(y,m,e,asOf=today())=>dateISO(y,m,e.tgl||1)>asOf;
  const entries=s=>Object.entries(s.DATA).flatMap(([y,ms])=>Object.entries(ms).flatMap(([m,es])=>es.map(e=>({y,m,e}))));
  const calc=es=>es.reduce((t,e)=>{if(!isUA(e)&&!e.xfer&&!e.capital){t.income+=e.d||0;t.expense+=e.k||0}t.bal=t.income-t.expense;return t},{income:0,expense:0,bal:0});
  const balance=(es,acc)=>money(es.reduce((n,e)=>n+((!acc||(e.acc||'main')===acc)?(e.d||0)-(e.k||0):0),0));
  function recalc(s){
    const list=Object.entries(s.DATA).flatMap(([y,ms])=>Object.keys(ms).map(m=>({y,m})) ).sort((a,b)=>Number(a.y)-Number(b.y)||mi(a.m)-mi(b.m));
    // Preserve initial capital even when an earlier, empty month is created later.
    // Migrated carry rows must never become new capital a second time.
    for(const a of s.ACCOUNTS){
      const openings=list.flatMap(({y,m})=>s.DATA[y][m].filter(e=>isUA(e)&&(e.acc||'main')===a.id));
      if(!openings.some(e=>Object.hasOwn(e,'openingSeed'))){const initial=openings.find(e=>!e.carried&&(e.d||e.k));if(initial){const origin=list.find(({y,m})=>s.DATA[y][m].includes(initial));initial.openingSeed=balance(s.DATA[origin.y][origin.m].filter(e=>isUA(e)),a.id);}}
    }
    const carried=new Map();
    for(const {y,m} of list){
      const es=s.DATA[y][m];
      for(const a of s.ACCOUNTS){
        const uas=es.filter(e=>isUA(e)&&(e.acc||'main')===a.id);
        let ua=uas[0];
        // Consolidate legacy duplicate opening rows without losing their value.
        if(uas.length>1){ua.d=balance(uas);ua.k=0;ua.openingSeed=money(uas.reduce((n,e)=>n+(e.openingSeed||0),0));for(const dupe of uas.slice(1))es.splice(es.indexOf(dupe),1)}
        if(!ua){ua={id:uid(),kind:'opening',tgl:1,ket:'Uang awal',d:0,k:0,acc:a.id,openingSeed:0,carried:true};es.unshift(ua)}
        ua.kind='opening';ua.acc=a.id;
        if(carried.has(a.id)){
          const seed=ua.openingSeed||0;
          ua.d=money(carried.get(a.id)+seed);ua.k=0;
        }
        carried.set(a.id,balance(es,a.id));
      }
      es.sort((a,b)=>Number(!isUA(a))-Number(!isUA(b))||(Number(a.tgl)||99)-(Number(b.tgl)||99));
      let n=0;for(const e of es){n=money(n+(e.d||0)-(e.k||0));e.s=n}
    }
    return s;
  }
  function pools(s,asOf=today()){
    let actual=0,estimated=0,allocated=0;
    for(const {y,m,e} of entries(s))if(!isUA(e)&&!e.xfer&&e.cat==='tabungan'&&e.k>0){if(future(y,m,e,asOf))estimated+=e.k;else actual+=e.k}
    for(const g of s.SAVINGS)for(const h of g.history||[])if(h.source==='pool')allocated+=h.amount;
    return {actual:money(Math.max(0,actual-allocated)),estimated:money(estimated),deficit:money(Math.max(0,allocated-actual)),allocated:money(allocated)};
  }
  function ensurePool(s){if(pools(s).deficit>0)fail('Dana tabungan sudah dialokasikan. Batalkan alokasi terkait sebelum mengurangi/menghapus sumber dana.');}
  function tx(s,y,m,input){
    dateISO(y,m,input.tgl);
    if(!s.ACCOUNTS.some(a=>a.id===input.acc))fail('Akun sumber tidak ditemukan.');
    const d=money(input.d||0),k=money(input.k||0);
    if(d<0||k<0||(d>0)===(k>0))fail('Transaksi harus memiliki satu nominal pemasukan atau pengeluaran positif.');
    const e={...input,id:input.id||uid(),d,k};
    s.DATA[y]??={};s.DATA[y][m]??=[];s.DATA[y][m].push(e);recalc(s);return e;
  }
  function transfer(s,y,m,from,to,amount,day,note=''){
    if(from===to||![from,to].every(id=>s.ACCOUNTS.some(a=>a.id===id)))fail('Pilih dua akun berbeda yang masih tersedia.');
    dateISO(y,m,day);amount=positive(amount);const xid=uid();
    tx(s,y,m,{tgl:day,ket:'Transfer ke '+s.ACCOUNTS.find(a=>a.id===to).name+(note?' · '+note:''),acc:from,d:0,k:amount,xfer:true,xid,cat:'_transfer'});
    tx(s,y,m,{tgl:day,ket:'Transfer dari '+s.ACCOUNTS.find(a=>a.id===from).name+(note?' · '+note:''),acc:to,d:amount,k:0,xfer:true,xid,cat:'_transfer'});return xid;
  }
  function removeTx(s,id){
    const found=entries(s).find(x=>x.e.id===id);if(!found||isUA(found.e))fail('Transaksi tidak dapat dihapus.');
    const {e}=found;
    for(const ms of Object.values(s.DATA))for(const m of Object.keys(ms))ms[m]=ms[m].filter(x=>e.xid?x.xid!==e.xid:x.id!==id);
    // Keep the confirmation link as a tombstone. Never silently recreate an actual expense.
    for(const p of s.TRIPS||[])for(const item of p.items)if(item.actualTxId===id)item.actualDeleted=true;
    ensurePool(s);recalc(s);
  }
  function deleteAccount(s,id){
    if(id==='main')fail('Akun utama tidak dapat dihapus.');
    // Preserve that account's initial capital at its first appearance, then recalculate merged ledger.
    const all=entries(s).filter(x=>(x.e.acc||'main')===id).sort((a,b)=>Number(a.y)-Number(b.y)||mi(a.m)-mi(b.m));
    const first=all.find(x=>isUA(x.e));
    const seeds=all.filter(x=>isUA(x.e)&&(x===first||x.e.openingSeed));
    for(const {y,m,e} of seeds){
      const v=e===first?.e?money(e.d-e.k):money(e.openingSeed||0);
      if(v)s.DATA[y][m].push({id:uid(),kind:'adjustment',tgl:1,ket:'Pemindahan modal akun '+id,d:v>0?v:0,k:v<0?-v:0,acc:'main',capital:true});
    }
    for(const ms of Object.values(s.DATA))for(const m of Object.keys(ms))ms[m]=ms[m].filter(e=>!(isUA(e)&&e.acc===id)).map(e=>e.acc===id?{...e,acc:'main'}:e);
    s.ACCOUNTS=s.ACCOUNTS.filter(a=>a.id!==id);recalc(s);
  }
  function savingsTx(s,id,type,amount,date,note,source){
    const g=s.SAVINGS.find(g=>g.id===id);if(!g)fail('Tabungan tidak ditemukan.');parseDate(date);amount=positive(amount);
    if(!['deposit','withdraw'].includes(type))fail('Tipe tabungan tidak valid.');
    if(type==='withdraw'&&amount>g.current)fail('Penarikan melebihi saldo tabungan.');
    if(source==='pool'&&(type!=='deposit'||amount>pools(s).actual))fail('Jumlah melebihi dana yang dapat dialokasikan.');
    const balanceBefore=g.current,appliedDelta=type==='deposit'?amount:-amount;
    g.current=money(g.current+appliedDelta);
    g.history??=[];g.history.push({id:uid(),date,type,amount,note,balanceBefore,appliedDelta, ...(source?{source}:{})});
  }
  function undoSavings(s,id,index){
    const g=s.SAVINGS.find(g=>g.id===id),h=g?.history?.[index];if(!h)fail('Riwayat tidak ditemukan.');
    if(h.type==='withdraw'&&!h.id&&g.current===0)fail('Riwayat penarikan lama tanpa bukti perubahan saldo tidak aman dibalik dari saldo nol. Periksa saldo sebenarnya dan lakukan koreksi; jangan menebak nominal yang dulu diterapkan.');
    const next=money(g.current+(h.type==='deposit'?-h.amount:h.amount));
    if(next<0)fail('Dana setoran sudah dipakai. Batalkan penarikan terkait lebih dahulu.');
    g.current=next;g.history.splice(index,1);
  }
  function copyMonth(s,sy,sm,ty,tm,replace=false,zero=false){
    if(sy===ty&&sm===tm)fail('Pilih bulan tujuan berbeda.');
    if(!s.DATA[sy]?.[sm])fail('Bulan sumber kosong.');
    const copied=s.DATA[sy][sm].filter(e=>!isUA(e)&&!e.capital),ids=new Map();
    const next=copied.map(e=>{const n={...clone(e),id:uid(),tgl:Math.min(e.tgl||1,new Date(Number(ty),mi(tm)+1,0).getDate()),d:zero?0:e.d,k:zero?0:e.k};delete n.s;delete n.tripId;delete n.tripItemId;if(n.xid){if(!ids.has(n.xid))ids.set(n.xid,uid());n.xid=ids.get(n.xid)}return n});
    s.DATA[ty]??={};const old=s.DATA[ty][tm]||[];
    if(replace&&old.some(e=>e.tripItemId))fail('Bulan berisi pengeluaran perjalanan aktual. Hapus/ubah secara individual agar hubungan tetap jelas.');
    s.DATA[ty][tm]=(replace?old.filter(isUA):old).concat(next);ensurePool(s);recalc(s);return next.length;
  }
  function validate(s){
    if(!s||typeof s!=='object'||!s.DATA||typeof s.DATA!=='object'||Array.isArray(s.DATA))fail('Cadangan tidak memiliki DATA yang valid.');
    for(const key of ['CATEGORIES','SAVINGS','STOCK','ACCOUNTS'])if(!Array.isArray(s[key]))fail('Data '+key+' tidak valid.');
    s=clone(s);s.TRIPS??=[];if(!Array.isArray(s.TRIPS))fail('TRIPS tidak valid.');
    s.SETTINGS??={currency:'¥',mascotOn:true,moodThresholds:{happy:60,normal:85,worried:100}};
    if(!['¥','Rp','$','€','£','MYR','SGD','₩'].includes(s.SETTINGS.currency))fail('Mata uang pencatatan tidak didukung.');
    const mt=s.SETTINGS.moodThresholds;if(!mt||![mt.happy,mt.normal,mt.worried].every(Number.isFinite)||mt.happy<0||!(mt.happy<mt.normal&&mt.normal<mt.worried))fail('Batas mood tidak valid.');
    const idOk=id=>typeof id==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(id);
    const unique=(a,label)=>{const ids=new Set();for(const x of a){if(ids.has(String(x.id)))fail('ID ganda: '+label);ids.add(String(x.id))}};
    if(!s.ACCOUNTS.some(a=>a.id==='main'))fail('Akun utama tidak tersedia.');
    for(const key of ['ACCOUNTS','CATEGORIES']){unique(s[key],key);for(const x of s[key]){if(!idOk(x.id))fail('ID tidak valid: '+key);if(x.color&&!/^#[0-9a-f]{6}$/i.test(x.color))fail('Warna tidak valid.')}}
    const txIds=new Set(),xf=new Map(),tripTx=new Set();
    for(const [y,ms] of Object.entries(s.DATA)){
      if(!/^\d{4}$/.test(y)||!ms||typeof ms!=='object'||Array.isArray(ms))fail('Struktur tahun tidak valid.');
      if(ms.Desember){if(ms.December)fail('Ada dua bulan Desember; gabungkan secara eksplisit.');ms.December=ms.Desember;delete ms.Desember}
      for(const [m,es] of Object.entries(ms)){
        if(mi(m)<0||!Array.isArray(es))fail('Struktur bulan tidak valid.');
        for(const e of es){
          if(!e||typeof e!=='object')fail('Transaksi tidak valid.');dateISO(y,m,e.tgl||1);
          e.id??=uid();if(!idOk(e.id)||txIds.has(e.id))fail('ID transaksi tidak valid/ganda.');txIds.add(e.id);
          e.acc??='main';if(!s.ACCOUNTS.some(a=>a.id===e.acc))fail('Transaksi merujuk akun yang tidak tersedia.');
          if(e.cat&&!idOk(e.cat))fail('ID kategori tidak valid.');
          e.d=money(e.d||0);e.k=money(e.k||0);
          if((e.d<0||e.k<0)&&!isUA(e))fail('Nominal transaksi negatif.');if(e.d>0&&e.k>0)fail('Dua nominal di satu transaksi.');
          if(e.xfer){if(!e.xid||!idOk(e.xid))fail('Transfer tanpa ID.');const group=xf.get(e.xid)||[];group.push({e,y,m});xf.set(e.xid,group)}
          if(e.tripId&&!idOk(e.tripId))fail('ID rencana tidak valid.');
          if(e.tripItemId){if(!idOk(e.tripItemId)||!idOk(e.tripId))fail('ID rincian tidak valid.');const key=e.tripId+':'+e.tripItemId;if(tripTx.has(key))fail('Pengeluaran perjalanan ganda.');tripTx.add(key)}
        }
      }
    }
    for(const g of xf.values())if(g.length!==2||money(g.reduce((a,x)=>a+x.e.d-x.e.k,0))!==0||g[0].y!==g[1].y||g[0].m!==g[1].m||g[0].e.tgl!==g[1].e.tgl)fail('Pasangan transfer tidak seimbang.');
    unique(s.SAVINGS,'SAVINGS');unique(s.STOCK,'STOCK');
    for(const g of s.SAVINGS){if(!Number.isSafeInteger(g.id)||g.id<1)fail('ID tabungan tidak valid.');g.current=money(g.current);g.target=positive(g.target);if(g.current<0)fail('Saldo tabungan negatif.');if(g.color&&!/^#[0-9a-f]{6}$/i.test(g.color))fail('Warna tidak valid.');g.history??=[];for(const h of g.history){parseDate(h.date);h.amount=positive(h.amount);if(!['deposit','withdraw'].includes(h.type))fail('Riwayat tidak valid.')}}
    for(const x of s.STOCK){if(!Number.isSafeInteger(x.id)||x.id<1)fail('ID stok tidak valid.');if(x.qty!=null&&(!Number.isFinite(x.qty)||x.qty<0))fail('Stok negatif/tidak valid.');if(x.min!=null&&(!Number.isFinite(x.min)||x.min<0))fail('Minimum stok tidak valid.');if(x.target!=null&&(!Number.isFinite(x.target)||x.target<=(x.min||0)))fail('Target stok harus lebih dari minimum.');if(x.price!=null&&(!Number.isFinite(x.price)||x.price<0))fail('Harga stok tidak valid.');if(x.history!=null){if(!Array.isArray(x.history))fail('Riwayat stok tidak valid.');for(const h of x.history){parseDate(h.date);if(!Number.isFinite(h.qty)||h.qty<=0)fail('Jumlah isi ulang tidak valid.')}}}
    unique(s.TRIPS,'TRIPS');
    for(const p of s.TRIPS){if(!idOk(p.id))fail('ID perjalanan tidak valid.');validateTrip(p,s.SETTINGS?.currency||'¥');unique(p.items,'rincian perjalanan');for(const it of p.items){
      if(!idOk(it.id))fail('ID rincian tidak valid.');
      const paired=entries(s).find(x=>x.e.tripId===p.id&&x.e.tripItemId===it.id);
      if(paired&&paired.e.id!==it.actualTxId)fail('Hubungan konfirmasi perjalanan hilang/tidak cocok.');
      if(it.actualTxId){const link=entries(s).find(x=>x.e.id===it.actualTxId);if(link&&(link.e.tripId!==p.id||link.e.tripItemId!==it.id))fail('Hubungan perjalanan tidak cocok.');if(!link&&!it.actualDeleted)fail('Transaksi aktual rencana hilang tanpa catatan pembatalan.');}
    }}
    s.savIdCounter=Math.max(Number(s.savIdCounter)||1,...s.SAVINGS.map(g=>g.id+1));
    s.stockIdCounter=Math.max(Number(s.stockIdCounter)||1,...s.STOCK.map(g=>g.id+1));
    s.accIdCounter=Math.max(Number(s.accIdCounter)||1,...s.ACCOUNTS.map(a=>Number(a.id.replace(/^acc/,''))||0));
    s.schemaVersion=3;return recalc(s);
  }
  function validateTrip(p,base){
    if(!String(p.name||'').trim())fail('Nama perjalanan wajib diisi.');parseDate(p.start);parseDate(p.end);parseDate(p.defaultDate);if(p.end<p.start)fail('Tanggal selesai harus sesudah tanggal mulai.');
    if(!p.currency||!p.baseCurrency)fail('Mata uang wajib diisi.');
    if(!['¥','Rp','$','€','£','MYR','SGD','₩'].includes(p.currency)||!['¥','Rp','$','€','£','MYR','SGD','₩'].includes(p.baseCurrency))fail('Mata uang perjalanan tidak didukung.');
    if(base&&base!==p.baseCurrency)fail('Mata uang pencatatan rencana berbeda. Cadangan tidak boleh mencampur mata uang tanpa konversi.');
    p.rate=ratio(p.rate);if(p.currency===p.baseCurrency&&p.rate!==1)fail('Kurs mata uang yang sama harus 1.');
    if(!Array.isArray(p.items))fail('Rincian tidak valid.');
    for(const it of p.items){if(!String(it.name||'').trim())fail('Nama rincian wajib diisi.');it.units=ratio(it.units);it.unitCost=positive(it.unitCost);money(it.units*it.unitCost*p.rate);if(it.date)parseDate(it.date)}
  }
  const itemAmount=(p,it)=>money(it.units*it.unitCost*p.rate);
  function planned(s){
    return s.TRIPS.flatMap(p=>p.scheduled?p.items.filter(it=>!it.actualTxId).map(it=>({id:'plan_'+it.id,tripId:p.id,itemId:it.id,name:it.name,tripName:p.name,date:it.date||p.defaultDate,cat:it.cat,amount:itemAmount(p,it),currency:p.baseCurrency})):[]).sort((a,b)=>a.date.localeCompare(b.date));
  }
  function saveTrip(s,p){validateTrip(p,s.SETTINGS?.currency);const idx=s.TRIPS.findIndex(t=>t.id===p.id);const old=s.TRIPS[idx];if(old){for(const it of old.items)if(it.actualTxId&&!p.items.some(n=>n.id===it.id))fail('Rincian yang sudah aktual tidak dapat dihapus; transaksi aktual tetap tersedia.');for(const it of p.items){const prev=old.items.find(x=>x.id===it.id);if(prev?.actualTxId){it.actualTxId=prev.actualTxId;it.actualDeleted=prev.actualDeleted||false}}s.TRIPS[idx]=clone(p)}else s.TRIPS.push(clone(p));}
  function confirmItem(s,pid,iid,opts){
    const p=s.TRIPS.find(p=>p.id===pid),it=p?.items.find(it=>it.id===iid);if(!p||!it||!p.scheduled)fail('Rincian terjadwal tidak ditemukan.');
    if(it.actualTxId)fail('Rincian ini sudah dicatat. Tidak dibuat transaksi kedua.');
    const existing=entries(s).find(x=>x.e.tripId===pid&&x.e.tripItemId===iid);if(existing)fail('Transaksi aktual sudah ada.');
    const {y,m,d}=parseDate(opts.date);const amount=positive(opts.amount);
    if(p.baseCurrency!==s.SETTINGS.currency)fail('Mata uang pencatatan telah berubah. Perbarui kurs rencana terlebih dahulu.');
    const e=tx(s,y,m,{tgl:d,ket:it.name+' · '+p.name,cat:opts.cat,acc:opts.acc,d:0,k:amount,tripId:pid,tripItemId:iid,tripName:p.name,tripCurrency:p.currency,estimateRate:p.rate});
    it.actualTxId=e.id;return e;
  }
  function removeTrip(s,id){s.TRIPS=s.TRIPS.filter(p=>p.id!==id)}
  function copyTrip(s,id){const found=s.TRIPS.find(p=>p.id===id);if(!found)fail('Rencana tidak ditemukan.');const p=clone(found);p.id=uid();p.name+=' (salinan)';p.scheduled=false;p.archived=false;for(const it of p.items){it.id=uid();delete it.actualTxId;delete it.actualDeleted}s.TRIPS.push(p);return p}
  const api={months,mi,uid,clone,money,positive,dateISO,parseDate,today,future,isUA,entries,calc,balance,recalc,pools,ensurePool,tx,transfer,removeTx,deleteAccount,savingsTx,undoSavings,copyMonth,validate,validateTrip,itemAmount,planned,saveTrip,confirmItem,removeTrip,copyTrip};
  if(typeof module!=='undefined')module.exports=api;else root.Finance=api;
})(globalThis);
