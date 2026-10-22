/* Live savings view; the only mutations use the validated production actions. */
(function(){
'use strict';
const $=s=>document.querySelector(s),yen=n=>amountText(n),numberPlain=n=>Number(n).toLocaleString('id-ID',{maximumFractionDigits:2});
const reducedMotion=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const model={get goals(){return SAVINGS}};
const goalAmount=g=>g.current,savingPool=()=>getSavingsPools().actual;
const sumValues=(a,k)=>a.reduce((s,x)=>s+Number(x[k]||0),0);
const sectionTitle=(title,sub='',action='')=>`<div class="section-header"><div><h2>${title}</h2><p>${sub}</p></div>${action}</div>`;
let savingsChartOpen=true;
function savingsProgressData(){
  const goals=model.goals.map(g=>{const amount=goalAmount(g),target=Number(g.target);return {id:g.id,name:g.name,amount,target,filled:Math.min(amount,target),color:savingsAppearance(g).color,kind:'goal'}});
  const pool=savingPool(),allocated=sumValues(goals,'amount'),target=sumValues(goals,'target'),filled=sumValues(goals,'filled');
  const sorted=[...goals].sort((a,b)=>b.target-a.target),rest=sorted.slice(4);
  const segments=goals.length>5?[...sorted.slice(0,4),{id:'other',name:'Tujuan lainnya',amount:sumValues(rest,'amount'),target:sumValues(rest,'target'),filled:sumValues(rest,'filled'),color:'var(--savings-segment-other)',kind:'other',goals:rest}]:goals;
  const valid=[pool,allocated,target,filled].every(Number.isFinite)&&pool>=0&&goals.every(g=>Number.isFinite(g.amount)&&g.amount>=0&&Number.isFinite(g.target)&&g.target>0);
  return {goals,segments,pool,allocated,target,filled,remaining:target-filled,excess:allocated-filled,percent:target?filled/target*100:0,valid};
}
let savingsChartObserver=null,savingsWaveObserver=null,savingsWaveVisible=false,savingsWaterPaused=false,savingsMotionEpoch=0;
const savingsMotion=new Set();
function syncSavingsWaves(){
  const svg=$('.savings-donut'),water=svg?.querySelector('.savings-liquid-water');
  let button=$('[data-preview="pause-savings-water"]');
  if(!button&&$('.savings-chart-actions')){button=document.createElement('button');button.className='btn small';button.dataset.preview='pause-savings-water';button.setAttribute('aria-controls','savings-chart-body');$('.savings-chart-actions').prepend(button)}
  const unavailable=reducedMotion()||!water||Number(water.dataset.waterPercent)<=0;
  if(svg)svg.dataset.waves=unavailable||!savingsChartOpen?'off':savingsWaterPaused||!savingsWaveVisible||document.hidden?'paused':'running';
  if(button){button.disabled=unavailable;button.setAttribute('aria-pressed',String(savingsWaterPaused));button.textContent=reducedMotion()?'Gerakan dikurangi':savingsWaterPaused?'Gerakkan air':'Jeda air'}
}
function startSavingsWaves(svg){
  if('IntersectionObserver' in window){savingsWaveObserver=new IntersectionObserver(entries=>{savingsWaveVisible=entries.some(e=>e.isIntersecting);syncSavingsWaves()},{threshold:.1});savingsWaveObserver.observe(svg)}else savingsWaveVisible=true;
  syncSavingsWaves();
}
function stopSavingsProgress(){savingsMotionEpoch++;savingsChartObserver?.disconnect();savingsChartObserver=null;savingsWaveObserver?.disconnect();savingsWaveObserver=null;savingsWaveVisible=false;for(const a of savingsMotion)a.cancel();savingsMotion.clear();document.querySelectorAll('.savings-donut-fill').forEach(n=>n.style.removeProperty('stroke-dasharray'));document.querySelectorAll('.savings-liquid-water').forEach(n=>n.style.removeProperty('transform'));const svg=$('.savings-donut');if(svg){svg.dataset.animating='false';svg.dataset.waves='off'}}
function playSavingsProgress(){
  stopSavingsProgress();const svg=$('.savings-donut');if(!svg||$('#savings-chart-body')?.hidden)return;
  syncSavingsWaves();if(reducedMotion())return;
  startSavingsWaves(svg);
  const epoch=savingsMotionEpoch,arcs=[...svg.querySelectorAll('.savings-donut-fill')].filter(arc=>Number(arc.dataset.fillLength)>0);
  if(!arcs.length)return;svg.dataset.animating='true';
  for(const arc of arcs){const end=arc.getAttribute('stroke-dasharray'),a=arc.animate([{strokeDasharray:'0 100'},{strokeDasharray:end}],{duration:950,easing:'cubic-bezier(.22,.8,.25,1)'});savingsMotion.add(a);a.finished.then(()=>savingsMotion.delete(a),()=>savingsMotion.delete(a))}
  const water=svg.querySelector('.savings-liquid-water');if(water){const a=water.animate([{transform:`translateY(${water.dataset.waterStart}px)`},{transform:'translateY(0px)'}],{duration:950,easing:'cubic-bezier(.22,.8,.25,1)'});savingsMotion.add(a);a.finished.then(()=>savingsMotion.delete(a),()=>savingsMotion.delete(a))}
  Promise.allSettled([...savingsMotion].map(a=>a.finished)).then(()=>{if(epoch===savingsMotionEpoch&&svg.isConnected)svg.dataset.animating='false'});
}
function watchSavingsProgress(){
  stopSavingsProgress();syncSavingsWaves();const svg=$('.savings-donut');if(!svg||!savingsChartOpen||reducedMotion())return;
  if(!('IntersectionObserver' in window)){playSavingsProgress();return}
  svg.querySelectorAll('.savings-donut-fill').forEach(n=>n.style.strokeDasharray='0 100');
  const water=svg.querySelector('.savings-liquid-water');if(water)water.style.transform=`translateY(${water.dataset.waterStart}px)`;
  savingsChartObserver=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting))playSavingsProgress()},{threshold:.2});savingsChartObserver.observe(svg);
}
function savingsProgressChart(){
  const d=savingsProgressData();let offset=0;
  const arcs=d.segments.map(s=>{const span=d.target?s.target/d.target*100:0,fill=d.target?s.filled/d.target*100:0;const html=`<g><circle class="savings-donut-target" cx="120" cy="120" r="94" pathLength="100" stroke="${s.color}" stroke-dasharray="${span} ${100-span}" stroke-dashoffset="${-offset}" transform="rotate(-90 120 120)"/><circle class="savings-donut-fill" data-goal-id="${esc(s.id)}" data-fill-length="${fill}" cx="120" cy="120" r="94" pathLength="100" stroke="${s.color}" stroke-dasharray="${fill} ${100-fill}" stroke-dashoffset="${-offset}" transform="rotate(-90 120 120)"/></g>`;offset+=span;return html}).join('');
  let boundary=0;const dividers=d.segments.length>1?d.segments.map(s=>{const angle=(boundary/100*2*Math.PI)-Math.PI/2;boundary+=s.target/d.target*100;return `<line class="savings-donut-divider" x1="${120+82*Math.cos(angle)}" y1="${120+82*Math.sin(angle)}" x2="${120+106*Math.cos(angle)}" y2="${120+106*Math.sin(angle)}"/>`}).join(''):'';
  // A repeating 120-unit wave: the endpoints have matching height and slope.
  // Opposing layers move horizontally; the numerical water level never oscillates.
  const waterLevel=d.percent>=100?40:195-150*d.percent/100,waterWave=y=>`M-120 ${y} ${Array.from({length:6},(_,i)=>{const x=-120+i*120;return `C${x+20} ${y-4} ${x+40} ${y-4} ${x+60} ${y} C${x+80} ${y+4} ${x+100} ${y+4} ${x+120} ${y}`}).join(' ')} V260 H-120 Z`;
  const chart=d.valid?`<div class="savings-donut-wrap">
    <svg class="savings-donut" data-waves="off" viewBox="0 0 240 240" role="img" aria-labelledby="savings-donut-title savings-donut-desc">
      <title id="savings-donut-title">Dana untuk target ${yen(d.filled)} dari ${yen(d.target)}, target terisi ${numberPlain(d.percent)} persen</title>
      <desc id="savings-donut-desc">${esc(d.goals.map(s=>s.name+': '+yen(s.amount)+' dari target '+yen(s.target)).join('; '))}. Setiap bagian mengikuti besar target. Warna penuh dan tinggi air adalah progres dana untuk target, maksimal 100 persen per tujuan. Warna pudar adalah sisanya. Dana belum dialokasikan ${yen(d.pool)} tidak mengisi target.${d.excess>0?' Kelebihan dana '+yen(d.excess)+' tetap ada dan ditampilkan pada nominal tiap tujuan.':''}</desc>
      <defs><clipPath id="savings-water-clip"><circle cx="120" cy="120" r="75"/></clipPath>
        <linearGradient id="savings-water-gradient" x1="0" y1="0" x2="0" y2="1"><stop class="savings-water-light" offset="0"/><stop class="savings-water-deep" offset="1"/></linearGradient>
      </defs>
      <g clip-path="url(#savings-water-clip)" aria-hidden="true"><circle class="savings-liquid-base" cx="120" cy="120" r="75"/>
        <g class="savings-liquid-water" data-water-start="${205-waterLevel}" data-water-percent="${d.percent}" ${d.percent<=0?'opacity="0"':''}>
          <path class="savings-liquid-back savings-wave" d="${waterWave(waterLevel-3)}"/>
          <path class="savings-liquid-front savings-wave" d="${waterWave(waterLevel)}"/>
        </g>
      </g><circle class="savings-donut-track" cx="120" cy="120" r="94"/>${arcs}${dividers}
    </svg><div class="savings-donut-center savings-liquid-center" aria-hidden="true"><span>Dana untuk target</span><strong class="money" id="savings-donut-filled">${yen(d.filled)}</strong><small class="savings-donut-target-label">/ <b class="money" id="savings-donut-total">${yen(d.target)}</b></small><span class="savings-donut-percent" id="savings-donut-percent">${numberPlain(d.percent)}% terisi</span></div></div>`:'<p class="form-error" role="alert">Diagram belum dapat ditampilkan: ada target atau saldo tidak valid. Periksa tujuan dan alokasi terlebih dahulu.</p>';
  return `<section class="surface savings-distribution" id="savings-diagram">${sectionTitle('Progres tabungan.','Warna penuh = sudah terisi. Warna pudar = sisa target.',`<div class="savings-chart-actions"><button class="btn small" data-preview="replay-savings-chart" ${!d.valid||!d.target?'disabled':''}>${icon('reset')}Ulangi efek</button><button class="btn small" data-preview="toggle-savings-chart" aria-expanded="${savingsChartOpen}" aria-controls="savings-chart-body">${icon('report')}${savingsChartOpen?'Sembunyikan diagram':'Lihat diagram'}</button></div>`)}<div id="savings-chart-body" ${savingsChartOpen?'':'hidden'}><div class="savings-chart-layout">${chart}<div class="savings-chart-details"><h3>Selangkah lebih dekat ke tujuanmu.</h3><p class="savings-chart-caption">Setiap bagian mewakili target satu tujuan. Isinya bertambah sesuai dana yang sudah dialokasikan.</p><div class="savings-chart-key"><span><i class="key-filled"></i>Sudah terisi</span><span><i class="key-remaining"></i>Sisa target</span></div><ul class="savings-chart-legend">${d.valid?d.segments.map((s,i)=>`<li><button class="savings-chart-legend-button" data-preview="${s.kind==='goal'?'goal-detail':'other-savings'}" data-id="${esc(s.id)}"><span class="savings-chart-marker" style="--segment-color:${s.color}" aria-hidden="true">${i+1}</span><span class="savings-chart-name">${esc(s.name)}<small>${numberPlain(s.target?s.filled/s.target*100:0)}% terisi${s.filled===s.target?' · target tercapai':''}</small></span><span class="savings-chart-value"><strong class="money" data-segment-amount="${s.amount}">${yen(s.amount)}</strong><small>dari <span class="money">${yen(s.target)}</span></small></span>${icon('chevron')}</button></li>`).join(''):''}</ul>${d.valid&&!d.target?'<p class="empty">Belum ada tujuan tabungan. Buat tujuan untuk mulai melihat progres.</p>':''}<div class="savings-chart-pool"><button class="savings-chart-legend-button" data-preview="allocate" data-id="pool"><span class="savings-chart-name">Belum dialokasikan<small>Belum mengisi bagian target</small></span><strong class="money">${yen(d.pool)}</strong>${icon('chevron')}</button></div><p class="savings-chart-note">Rencana setoran tidak ikut dihitung.${d.excess>0?' Ada '+yen(d.excess)+' melebihi target; kelebihan satu tujuan tidak otomatis menutup kekurangan tujuan lain.':' Isi tiap tujuan dibatasi 100% pada diagram; nominal aslinya tetap ditampilkan.'}</p></div></div></div></section>`;
}

function renderSavings(el){
 stopSavingsProgress();const d=savingsProgressData(),pools=getSavingsPools();
 el.innerHTML=uiHead('Ruang untuk impianmu.','Sisihkan hari ini, nikmati tenangnya nanti.',uiButton('uiSavingForm()','Tujuan baru','plus','primary'),'TABUNGAN')+
 `<section class="savings-hero"><div><span class="eyebrow">TABUNGAN AKTUAL</span><div class="feature-amount money" id="savings-total">${yen(d.allocated+pools.actual)}</div><p>Terkumpul, termasuk dana yang belum dialokasikan.</p><div class="savings-hero-goal"><span>Target semua tujuan</span><strong class="money" id="savings-target-total">${yen(d.target)}</strong></div></div><div class="savings-hero-side"><span>Sudah berada pada tujuan</span><strong class="money">${yen(d.allocated)}</strong><span>${numberPlain(d.percent)}% target terisi · sisa ${yen(d.remaining)}</span></div></section>
 <div class="funds-grid"><section class="fund-pool"><div class="fund-icon">${icon('wallet')}</div><div><span class="eyebrow">SIAP DIALOKASIKAN</span><strong class="money">${yen(pools.actual)}</strong><p>Dari transaksi kategori Tabungan yang sudah aktual.</p></div>${uiButton('openAllocateModal()','Alokasikan','arrow','primary')}</section><section class="fund-forecast"><span class="tag plan">Estimasi · belum tersedia</span><strong class="money">${yen(pools.estimated)}</strong><p>Setoran bertanggal masa depan, belum dapat dialokasikan.</p></section></div>
 ${pools.deficit?'<p class="form-errors" role="alert">Alokasi lama melebihi dana aktual '+yen(pools.deficit)+'. Batalkan alokasi terkait sebelum mengurangi sumber dana.</p>':''}
 ${savingsProgressChart()}
 <div class="preview-section-heading"><div><h2>Setiap tujuan, satu langkah lebih dekat.</h2><p>Rincian, setoran, dan riwayat tetap tersedia.</p></div><span>${SAVINGS.length} tujuan</span></div>
 <div class="goal-grid">${SAVINGS.map(g=>{const pct=Math.min(100,g.current/g.target*100);return `<article class="surface goal-card" data-goal-id="${g.id}" style="${savingsColorStyle(g)}"><div class="goal-top"><span class="goal-icon">${icon(validPreviewIcon('savings',g.icon)?g.icon:'savings')}</span>${uiButton('uiSavingForm('+g.id+')','Edit','edit','quiet')}</div><h3>${esc(g.name)}</h3><p>${esc(g.caption||'Satu langkah untuk masa depan.')}</p><div class="goal-value"><strong class="money">${yen(g.current)}</strong><span>dari ${yen(g.target)}</span></div><div class="goal-progress" role="progressbar" aria-label="Progres ${esc(g.name)}" aria-valuenow="${Math.round(pct)}" aria-valuemin="0" aria-valuemax="100"><span style="width:${pct}%"></span></div><div class="goal-bottom"><span>${numberPlain(pct)}% terkumpul</span><span>Sisa ${yen(Math.max(0,g.target-g.current))}</span></div><div class="ui-actions">${uiButton('addToSaving('+g.id+')','Setor','plus')}${uiButton('withdrawSaving('+g.id+')','Tarik','wallet')}${uiButton('openHistoryModal('+g.id+')','Riwayat','list')}${uiButton('delSaving('+g.id+')','Hapus','close','danger-text')}</div></article>`}).join('')||'<p class="empty">Buat tujuan tabungan pertamamu.</p>'}</div>
 <p class="financial-explainer">Alokasi membagi dana tabungan, bukan pengeluaran kas kedua. Setor/tarik manual tidak otomatis mengubah saldo Dashboard.</p>
 <section class="surface allocation-history">${sectionTitle('Jejak langkah kecil.','Pilih tujuan untuk melihat atau membatalkan riwayat.')}<div class="activity-list">${SAVINGS.flatMap(g=>(g.history||[]).map((h,i)=>({g,h,i}))).sort((a,b)=>b.h.date.localeCompare(a.h.date)).slice(0,15).map(({g,h,i})=>`<div class="activity-row"><span class="activity-icon">${icon(h.type==='deposit'?'plus':'wallet')}</span><div><strong>${esc(g.name)}</strong><small>${esc(h.date)} · ${h.source==='pool'?'Alokasi':'Manual'} · ${esc(h.note||'')}</small></div><span class="money">${h.type==='deposit'?'+':'−'}${yen(h.amount)}</span>${uiButton('delSavingHistory('+g.id+','+i+')','Batalkan','reset','quiet')}</div>`).join('')||'<p class="empty">Belum ada riwayat.</p>'}</div></section>`;
 watchSavingsProgress();
}
document.addEventListener('click',e=>{
 const b=e.target.closest('[data-preview]');if(!b||view.page!=='tabungan')return;
 switch(b.dataset.preview){
 case 'pause-savings-water':savingsWaterPaused=!savingsWaterPaused;syncSavingsWaves();break;
 case 'replay-savings-chart':playSavingsProgress();break;
 case 'toggle-savings-chart':savingsChartOpen=!savingsChartOpen;$('#savings-chart-body').hidden=!savingsChartOpen;b.setAttribute('aria-expanded',String(savingsChartOpen));b.textContent=savingsChartOpen?'Sembunyikan diagram':'Lihat diagram';if(savingsChartOpen)watchSavingsProgress();else stopSavingsProgress();break;
 case 'goal-detail':openHistoryModal(Number(b.dataset.id));break;
 case 'allocate':openAllocateModal();break;
 case 'other-savings':uiSheet('Tujuan lainnya','<div class="activity-list">'+savingsProgressData().segments.find(s=>s.kind==='other').goals.map(g=>'<div class="activity-row"><div><strong>'+esc(g.name)+'</strong><small>'+yen(g.amount)+' / '+yen(g.target)+'</small></div></div>').join('')+'</div>');break;
 }
});
matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',e=>{if(e.matches){stopSavingsProgress();syncSavingsWaves()}else{const svg=$('.savings-donut');if(svg&&savingsChartOpen)startSavingsWaves(svg)}});
document.addEventListener('visibilitychange',syncSavingsWaves);
window.SavingsUI={render:renderSavings,stop:stopSavingsProgress};
})();

