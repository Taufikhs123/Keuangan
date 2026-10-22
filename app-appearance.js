'use strict';
// Small, code-native vector set. Every symbol shares the existing 24px stroke grid.
const customIconPaths={
  wedding:'M10 12a5 5 0 1 0 0 6m4-6a5 5 0 1 1 0 6M7 7l3-4h4l3 4-5 5Zm0 0h10m-7-4 2 4 2-4',
  coins:'M16 7c0 2-3 3-6 3S4 9 4 7s3-3 6-3 6 1 6 3ZM4 7v5c0 2 3 3 6 3m-6-3v5c0 2 3 3 6 3m10-7c0 2-2 3-5 3s-5-1-5-3 2-3 5-3 5 1 5 3Zm-10 0v5c0 2 2 3 5 3s5-1 5-3v-5',
  gold:'m6 5-3 7h12l-3-7ZM4 15l-2 6h10l-2-6Zm10 0-2 6h10l-2-6ZM7 7l-1 2m10 8-1 2',
  growth:'M3 3v18h18M6 15l5-5 4 3 6-8m-5 0h5v5',
  car:'m5 9 2-5h10l2 5M4 10h16v8H4Zm2 8v3m12-3v3M7 13h2m6 0h2M2 9h3m14 0h3',
  education:'m2 8 10-5 10 5-10 5Zm4 3v6c4 3 8 3 12 0v-6m4-3v9',
  health:'M8 3h8v5h5v8h-5v5H8v-5H3V8h5Z',
  family:'M12 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM7 21v-5a5 5 0 0 1 10 0v5M5 6a2 2 0 1 0 0 4M19 6a2 2 0 1 1 0 4M2 20v-5a3 3 0 0 1 3-3m17 8v-5a3 3 0 0 0-3-3',
  business:'M3 8h18v13H3ZM8 8V4h8v4M3 12c6 3 12 3 18 0m-10 1v3h2v-3',
  laptop:'M5 4h14v12H5ZM3 16h18l2 4H1Zm7 0v2h4v-2',
  phone:'M7 2h10v20H7ZM10 5h4m-3 14h2',
  gift:'M3 8h18v4H3Zm2 4v9h14v-9M12 8v13m0-13C5 8 4 3 7 3c3 0 5 5 5 5Zm0 0c7 0 8-5 5-5-3 0-5 5-5 5Z',
  shield:'M12 2 3 6v6c0 5 9 10 9 10s9-5 9-10V6Zm-5 10 3 3 7-7',
  leaf:'M20 3C7 2 2 9 5 16s16 4 15-13ZM4 21l12-13M8 16v-5m3 2h5',
  chicken:'m11 6 2-2c4-4 11 3 7 7l-2 2c-2 2-5 2-7 0s-2-5 0-7Zm0 7-6 6m1-2c-3-3-6 1-3 3 2 3 6 0 3-3ZM15 7l2 2',
  fish:'M6 12c4-8 11-8 16 0-5 8-12 8-16 0Zm0 0-5-5v10Zm12-2h.01M12 6l-1-3 5 2m-4 13-1 3 5-2',
  egg:'M19 14c0 4-3 7-7 7s-7-3-7-7S9 2 12 2s7 8 7 12Zm-10 1c0 2 1 3 3 3',
  vegetable:'M16 7 4 20c-1 1-2-1-1-2L12 5Zm-3-2c-2-4 1-5 2-2 1-4 5-3 3 1 4-2 5 2 1 3M8 12l3 1m0-5 2 2M5 16l2 1',
  fruit:'M12 7C3 2 0 12 5 19c2 4 4 2 7 2s5 2 7-2c5-7 2-17-7-12Zm0 0c0-4 2-6 6-5 0 4-3 5-6 5Zm-1-3L9 2',
  rice:'M3 12h18c-1 6-4 9-9 9s-8-3-9-9ZM6 12V5m6 7V2m6 10V5M4 6l2 2 2-2m2-3 2 2 2-2m2 3 2 2 2-2',
  milk:'M7 2h8l3 5v15H6V7Zm0 0v5h11M6 7l5 4 7-4m-7 4v11M9 15h6v4H9Z',
  bread:'M5 10c-6-4 0-11 7-7 7-4 13 3 7 7v11H5Zm3 3v4m4-6v6m4-4v4',
  coffee:'M4 8h13v9c0 6-13 6-13 0Zm13 1h3c4 0 4 6-3 6M7 2v3m4-3v3m4-3v3M2 22h18',
  water:'M12 2C9 7 4 11 4 15a8 8 0 0 0 16 0c0-4-5-8-8-13ZM8 15c0 2 1 4 4 4',
  soap:'M7 8h10c6 0 6 13 0 13H7C1 21 1 8 7 8ZM7 12h8M8 4a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm9 1h.01M5 17h.01',
  shampoo:'M8 3h8v4H8Zm1 4-3 4v11h12V11l-3-4M9 14h6v5H9ZM10 1h4',
  spray:'M9 3h10v3h-6v4l4 4v8H5v-8l4-4V6Zm4 3 4 4m3-3 2 1m-2-4 2-1M8 15h6v4H8Z',
  laundry:'M3 2h18v20H3ZM3 7h18M6 4h.01m3 0h.01M12 10a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9Zm-4 5c2-2 6 2 8 0',
  tissue:'M3 11h18v11H3Zm0 0 5-5h9l4 5M9 11 7 3l5-2 3 6-1 4M7 16h10',
  toothbrush:'M6 22V9h3v13ZM6 9V2h6v7Zm3-7v7m6 13V11h5v11Zm0-7h5m-4-4V7h3v4',
  pet:'M6 11a2 3 0 1 0 0-6 2 3 0 0 0 0 6Zm12 0a2 3 0 1 0 0-6 2 3 0 0 0 0 6ZM10 7a2 3 0 1 0 0-6 2 3 0 0 0 0 6Zm4 0a2 3 0 1 0 0-6 2 3 0 0 0 0 6ZM7 14c-5 5 0 9 5 6 5 3 10-1 5-6-3-5-7-5-10 0Z'
};
const savingsIconChoices=[['wedding','Nikah'],['trip','Liburan'],['coins','Uang'],['gold','Emas'],['growth','Investasi'],['bank','Dana darurat'],['home','Rumah'],['car','Kendaraan'],['education','Pendidikan'],['health','Kesehatan'],['family','Keluarga'],['business','Usaha'],['laptop','Laptop'],['phone','Gawai'],['gift','Hadiah'],['shield','Proteksi'],['leaf','Masa depan'],['report','Aset'],['wallet','Dompet'],['savings','Umum']];
const shoppingIconChoices=[['chicken','Ayam'],['fish','Ikan'],['egg','Telur'],['vegetable','Sayur'],['fruit','Buah'],['rice','Beras'],['milk','Susu'],['bread','Roti'],['coffee','Kopi'],['water','Air'],['soap','Sabun'],['shampoo','Sampo'],['spray','Pembersih'],['laundry','Cucian'],['tissue','Tisu'],['toothbrush','Gigi'],['health','Obat'],['pet','Hewan'],['food','Makanan'],['stock','Umum']];
const coverPalettes=[['sage','Sage'],['sand','Pasir'],['sky','Langit'],['lavender','Lavender'],['peach','Persik'],['rose','Mawar'],['mint','Mint'],['slate','Batu']];
// Fixed, validated color keys; colors are presentation metadata, not money/status.
const savingsColorChoices=[
  {key:'emerald',label:'Zamrud',color:'#177a66',tint:'#e6f5ef'},
  {key:'teal',label:'Teal',color:'#167b89',tint:'#e5f4f6'},
  {key:'jade',label:'Jade',color:'#38804f',tint:'#edf6e9'},
  {key:'pine',label:'Pinus',color:'#226451',tint:'#e8f2ed'},
  {key:'lagoon',label:'Laguna',color:'#24799c',tint:'#e8f3fa'},
  {key:'blue',label:'Biru',color:'#366ead',tint:'#eaf1fa'},
  {key:'indigo',label:'Indigo',color:'#5d64a5',tint:'#efeff9'},
  {key:'lavender',label:'Lavender',color:'#8065a5',tint:'#f3edf9'},
  {key:'rose',label:'Mawar',color:'#a05e7e',tint:'#f9edf3'},
  {key:'coral',label:'Koral',color:'#aa6255',tint:'#faeee9'},
  {key:'gold',label:'Keemasan',color:'#8c7027',tint:'#f8f2df'},
  {key:'berry',label:'Beri',color:'#94619b',tint:'#f7eef7'}
];
function savingsAppearance(goal){
  const selected=savingsColorChoices.find(c=>c.key===goal.colorKey);if(selected)return selected;
  if(/^#[0-9a-f]{6}$/i.test(goal.color||'')){const match=savingsColorChoices.find(c=>c.color.toLowerCase()===goal.color.toLowerCase());return match||{key:'legacy',label:'Warna sebelumnya',color:goal.color,tint:'#edf4ef'}}
  let hash=0;for(const c of String(goal.id||''))hash=(hash*31+c.charCodeAt(0))>>>0;
  return savingsColorChoices[hash%savingsColorChoices.length];
}
function nextSavingsColor(){
  const counts=new Map(savingsColorChoices.map(c=>[c.key,0]));
  for(const g of SAVINGS){const key=savingsAppearance(g).key;if(counts.has(key))counts.set(key,counts.get(key)+1)}
  return [...savingsColorChoices].sort((a,b)=>counts.get(a.key)-counts.get(b.key))[0].key;
}
function savingsColorStyle(goal){const c=savingsAppearance(goal);return `--goal-color:${c.color};--goal-tint:${c.tint}`}
function savingsColorField(goal){const selected=savingsAppearance(goal),choices=selected.key==='legacy'?[selected,...savingsColorChoices]:savingsColorChoices;return `<fieldset class="appearance-field full"><legend>Warna tujuan</legend><details class="savings-color-picker"><summary><span class="savings-color-current" data-color-current><i style="--goal-color:${selected.color}" aria-hidden="true"></i><span>${selected.label}</span></span><span>Ganti warna ${icon('down')}</span></summary><p class="appearance-hint">Dipakai pada diagram, ikon, dan progres tujuan ini. Warna tidak mengubah nominal atau status.</p><div class="savings-color-grid">${choices.map(c=>`<label class="savings-color-choice" style="--goal-color:${c.color};--goal-tint:${c.tint}"><input type="radio" name="colorKey" value="${c.key}" ${selected.key===c.key?'checked':''}><span class="savings-color-swatch" aria-hidden="true">${icon('check')}</span><span>${c.label}</span></label>`).join('')}</div></details></fieldset>`}
document.addEventListener('change',event=>{const input=event.target;if(!input.matches('.savings-color-choice input'))return;const color=savingsColorChoices.find(c=>c.key===input.value);if(!color)return;const current=input.closest('.savings-color-picker').querySelector('[data-color-current]');current.querySelector('i').style.setProperty('--goal-color',color.color);current.querySelector('span').textContent=color.label});
function validPreviewIcon(kind,value){return (kind==='savings'?savingsIconChoices:shoppingIconChoices).some(([key])=>key===value)}
function iconChoiceField(kind,value){const choices=kind==='savings'?savingsIconChoices:shoppingIconChoices,selected=choices.find(([key])=>key===value)||choices.at(-1);return `<fieldset class="appearance-field full"><legend>Ikon ${kind==='savings'?'tujuan':'barang'}</legend><details class="icon-picker"><summary><span class="icon-picker-current" data-icon-current>${icon(selected[0])}<span>${selected[1]}</span></span><span>Ganti ikon ${icon('down')}</span></summary><div class="icon-choice-grid">${choices.map(([key,label])=>`<label class="icon-choice"><input class="sr-only" type="radio" name="icon" value="${key}" ${key===selected[0]?'checked':''}><span class="icon-option-art">${icon(key)}</span><span>${label}</span><span class="choice-tick" aria-hidden="true">${icon('check')}</span></label>`).join('')}</div></details></fieldset>`}
function coverKey(trip){if(coverPalettes.some(([key])=>key===trip.cover))return trip.cover;let hash=0;for(const c of trip.id)hash=(hash*31+c.charCodeAt(0))>>>0;return coverPalettes[hash%coverPalettes.length][0]}
function coverClass(trip){return 'trip-tone-'+coverKey(trip)}
function coverChoiceField(value){return `<fieldset class="appearance-field full"><legend>Warna sampul</legend><p class="appearance-hint">Hanya tampilan. Warna tidak menandakan status pembayaran.</p><div class="cover-choice-grid">${coverPalettes.map(([key,label])=>`<label class="cover-choice trip-tone-${key}"><input class="sr-only" type="radio" name="cover" value="${key}" ${key===value?'checked':''}><span class="cover-swatch" aria-hidden="true">${icon('trip')}<span class="choice-tick">${icon('check')}</span></span><span>${label}</span></label>`).join('')}</div></fieldset>`}
document.addEventListener('change',event=>{const input=event.target;if(!input.matches('.icon-choice input'))return;const picker=input.closest('.icon-picker'),choices=input.closest('#goal-form')?savingsIconChoices:shoppingIconChoices,label=choices.find(([key])=>key===input.value)?.[1]||'Umum';picker.querySelector('[data-icon-current]').innerHTML=icon(input.value)+`<span>${label}</span>`;/* Keep the group open for arrow-key navigation; selection is saved with the form. */});
