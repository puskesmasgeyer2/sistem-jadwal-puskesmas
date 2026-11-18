/* Sistem Bendahara UPTD Puskesmas Geyer 2
   Menggunakan Supabase anon/publishable key. Jangan pernah menaruh service-role key di frontend. */
const SUPABASE_URL='https://xqeuklqhkslfvhqrhyyr.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_2hvrRkMS3sZ9CvyHHNdgFA_vsKJj8Mn';
const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);
const $=id=>document.getElementById(id);
let sessionUser=null,profile=null,schedules=[],claims=[],places=[],staff=[],programs=[],fuelTypes=[],fuelPrices=[],rates=[];
const pages={dashboard:'Dashboard',pengajuan:'Pengajuan Transport',riwayat:'Riwayat Pengajuan',verifikasi:'Verifikasi Bendahara',bbm:'Jenis BBM & Harga',tempat:'Tempat & Jarak',petugas:'Petugas & Kendaraan',laporan:'Laporan & Rekap'};
const money=n=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(n||0));
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const isFinance=()=>['admin','bendahara'].includes(String(profile?.role||'').toLowerCase());
const today=()=>new Date().toISOString().slice(0,10);
function notice(t,error=false){$('appMessage').style.color=error?'#b42318':'#087f5b';$('appMessage').textContent=t||'';}
function statusLabel(s){return({draft:'Draft',submitted:'Menunggu verifikasi',approved:'Disetujui',rejected:'Ditolak',paid:'Dibayar'})[s]||s||'-';}
function statusClass(s){return s==='submitted'?'submitted':s==='rejected'?'rejected':s==='paid'?'paid':'';}
function fail(e){$('content').innerHTML=`<section class="panel"><h3>Data belum dapat dimuat</h3><p class="muted-note">${esc(e.message||e)}</p><p class="muted-note">Periksa koneksi, struktur tabel, dan kebijakan RLS Supabase.</p></section>`;}
async function loadProfile(user){const {data,error}=await db.from('profiles').select('id,full_name,role,staff_id,is_active').eq('id',user.id).maybeSingle();if(error)throw error;if(!data||!data.is_active)throw new Error('Profil belum tersedia atau akun tidak aktif. Hubungi administrator.');profile=data;sessionUser=user;$('userName').textContent=data.full_name||user.email;$('userRole').textContent=(data.role||'petugas').toUpperCase();$('roleBadge').textContent=(data.role||'PETUGAS').toUpperCase();document.querySelectorAll('.admin-only').forEach(x=>x.classList.toggle('hidden',!isFinance()));$('loginCard').classList.add('hidden');$('appShell').classList.remove('hidden');await navigate('dashboard');}
async function signOut(){await db.auth.signOut({scope:'local'});profile=null;sessionUser=null;$('appShell').classList.add('hidden');$('loginCard').classList.remove('hidden');}
$('loginForm').addEventListener('submit',async e=>{e.preventDefault();const b=$('loginButton');b.disabled=true;b.textContent='Memeriksa...';$('loginMessage').textContent='';try{const {data,error}=await db.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});if(error)throw error;await loadProfile(data.user);}catch(err){$('loginMessage').textContent='Login gagal: '+err.message;}finally{b.disabled=false;b.textContent='Masuk';}});
$('logoutButton').addEventListener('click',signOut);
db.auth.onAuthStateChange((_event,session)=>{if(!session){profile=null;sessionUser=null;$('appShell').classList.add('hidden');$('loginCard').classList.remove('hidden');}});
db.auth.getSession().then(({data,error})=>{if(!error&&data.session)loadProfile(data.session.user).catch(async e=>{await db.auth.signOut({scope:'local'});$('loginMessage').textContent=e.message;});});
$('nav').addEventListener('click',e=>{const b=e.target.closest('[data-page]');if(b)navigate(b.dataset.page);});
async function navigate(page){if(!pages[page])page='dashboard';if(['verifikasi','laporan','bbm','tempat','petugas'].includes(page)&&!isFinance()){notice('Menu ini hanya dapat diakses Bendahara atau Administrator.',true);return;}document.querySelectorAll('.nav').forEach(b=>b.classList.toggle('active',b.dataset.page===page));$('pageTitle').textContent=pages[page];$('content').innerHTML='<div class="loading">Memuat data...</div>';notice('');try{const fn={dashboard:renderDashboard,pengajuan:renderForm,riwayat:()=>renderClaims(false),verifikasi:()=>renderClaims(true),bbm:renderFuelAdmin,tempat:renderPlacesAdmin,petugas:renderStaffAdmin,laporan:renderReport}[page];await fn();}catch(e){fail(e);}}
async function loadMasters(){const queries=await Promise.all([
 db.from('schedules').select('id,activity_date,program_id,staff_id,place_id,notes,status').eq('status','valid').order('activity_date',{ascending:false}).limit(3000),
 db.from('places').select('id,place_name,is_active').order('place_name'),db.from('staff').select('id,full_name,employee_code,golongan,pangkat,ruang,nomor_kendaraan,is_active').order('full_name'),
 db.from('programs').select('id,program_code,program_name,is_active').order('program_name'),db.from('fuel_types').select('id,jenis_bbm,is_active').order('jenis_bbm'),
 db.from('fuel_price_history').select('*').eq('is_active',true).order('berlaku_mulai',{ascending:false}),db.from('transport_rates').select('*').eq('is_active',true)
 ]);for(const q of queries)if(q.error)throw q.error;const [s,p,st,pr,ft,fp,rt]=queries.map(q=>q.data||[]);schedules=s;places=p;staff=st;programs=pr;fuelTypes=ft;fuelPrices=fp;rates=rt;}
async function loadClaims(){const {data,error}=await db.from('transport_claims').select('*').order('created_at',{ascending:false}).limit(3000);if(error)throw error;claims=data||[];}
function rateFor(placeId,method){return rates.find(r=>r.place_id===placeId&&r.metode===method)||rates.find(r=>!r.place_id&&r.metode===method);}
function enrichSchedule(s){const p=places.find(x=>String(x.id)===String(s.place_id)),st=staff.find(x=>String(x.id)===String(s.staff_id)),pr=programs.find(x=>String(x.id)===String(s.program_id));return{...s,place_name:p?.place_name||'-',staff_name:st?.full_name||'-',employee_code:st?.employee_code||'-',golongan:st?.golongan||'-',nomor_kendaraan:String(st?.nomor_kendaraan||'').trim(),program_name:pr?.program_name||'-',program_code:pr?.program_code||'-'};}
function enrichClaim(c){const s=enrichSchedule(schedules.find(x=>x.id===c.schedule_id)||{});return{...c,...s,nomor_kendaraan:c.nomor_kendaraan||s.nomor_kendaraan,claim_id:c.id,nominal_bbm:Number(c.nominal_bbm||0),total_amount:Number(c.total_amount??(Number(c.transport_amount||0)+Number(c.nominal_bbm||0)))};}
function claimRows(finance){let rows=claims.map(enrichClaim);if(!finance&&profile.role==='petugas')rows=rows.filter(c=>c.staff_id===profile.staff_id||c.created_by===sessionUser.id);return rows;}
function claimsTable(rows,actions=false){if(!rows.length)return'<div class="empty">Tidak ada data untuk filter yang dipilih.</div>';return`<div class="table-wrap"><table class="data-table"><thead><tr><th>No</th><th>Nama / NIP</th><th>Gol.</th><th>Tanggal kegiatan</th><th>Program</th><th>Lokasi</th><th>Jenis pengajuan</th><th>Biaya transport</th><th>Jumlah hari</th><th>Jumlah penerimaan</th><th>Nama SPBU</th><th>No. Kendaraan</th><th>Status / Tindakan</th></tr></thead><tbody>${rows.map((c,i)=>`<tr><td>${i+1}</td><td><b>${esc(c.staff_name)}</b><br><small>${esc(c.employee_code)}</small></td><td>${esc(c.golongan)}</td><td>${esc(c.activity_date)}</td><td>${esc(c.program_name)}</td><td>${esc(c.place_name)}</td><td>${c.jenis_bbm?'BBM':'8 Jam'}</td><td class="money">${money(c.transport_amount)}</td><td>${Number(c.jumlah_hari||1)}</td><td class="money">${money(c.total_amount)}</td><td>${esc(c.nama_spbu||'-')}</td><td>${esc(c.nomor_kendaraan)}</td><td><span class="status ${statusClass(c.status)}">${esc(statusLabel(c.status))}</span>${actions&&['submitted','draft'].includes(c.status)?`<div class="table-actions"><button class="btn-sm" data-action="approve" data-id="${esc(c.claim_id)}">Setujui</button><button class="btn-sm btn-red" data-action="reject" data-id="${esc(c.claim_id)}">Tolak</button></div>`:''}</td></tr>`).join('')}</tbody></table></div>`;}
function filterPanel(){const now=new Date();return`<section class="panel"><h3>Filter daftar pengajuan</h3><div class="filters"><div><label for="filterMonth">Bulan</label><select id="filterMonth"><option value="">Semua bulan</option>${['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'].map((m,i)=>`<option value="${String(i+1).padStart(2,'0')}" ${i===now.getMonth()?'selected':''}>${m}</option>`).join('')}</select></div><div><label for="filterYear">Tahun</label><select id="filterYear"><option value="">Semua tahun</option>${Array.from({length:7},(_,i)=>now.getFullYear()-3+i).map(y=>`<option ${y===now.getFullYear()?'selected':''}>${y}</option>`).join('')}</select></div><div><label for="filterProgram">Nama program</label><select id="filterProgram"><option value="">Semua program</option>${programs.filter(p=>p.is_active).map(p=>`<option value="${esc(p.id)}">${esc(p.program_name)}</option>`).join('')}</select></div><button id="showFiltered">Tampilkan Data</button></div></section>`;}
function applyClaimFilter(rows){const m=$('filterMonth').value,y=$('filterYear').value,p=$('filterProgram').value;return rows.filter(c=>(!m||String(c.activity_date||'').slice(5,7)===m)&&(!y||String(c.activity_date||'').slice(0,4)===y)&&(!p||c.program_id===p));}
async function renderDashboard(){await loadMasters();await loadClaims();const rows=claimRows(true),pending=rows.filter(x=>x.status==='submitted'),approved=rows.filter(x=>['approved','paid'].includes(x.status)),total=rows.reduce((a,x)=>a+Number(x.total_amount||0),0);$('content').innerHTML=`<div class="cards"><div class="metric"><small>Jadwal valid</small><strong>${schedules.length}</strong></div><div class="metric"><small>Menunggu verifikasi</small><strong>${pending.length}</strong></div><div class="metric"><small>Disetujui / dibayar</small><strong>${approved.length}</strong></div><div class="metric"><small>Total pengajuan</small><strong style="font-size:19px">${money(total)}</strong></div></div><section class="panel"><div class="section-head"><h3>Pengajuan terbaru</h3><button id="dashHistory" class="btn-sm btn-light">Lihat daftar</button></div>${claimsTable(rows.slice(0,8))}</section>`;$('dashHistory').onclick=()=>navigate('riwayat');}
async function renderForm(){
 await loadMasters();
 await loadClaims();

 const mine=schedules.filter(s=>profile.role!=='petugas'||s.staff_id===profile.staff_id);
 const alreadySubmitted=new Set(claims.filter(c=>c.status!=='rejected').map(c=>c.schedule_id));
 const pendingSchedules=mine.filter(s=>!alreadySubmitted.has(s.id));
 const activeFuel=fuelTypes.filter(f=>f.is_active);
 const effectivePrice=name=>fuelPrices.find(x=>x.jenis_bbm===name&&x.is_active&&x.berlaku_mulai<=today()&&(!x.berlaku_sampai||x.berlaku_sampai>=today()));
 const TARIF_8_JAM=150000;

 const rows=pendingSchedules.map(s=>{
  const x=enrichSchedule(s),br=rateFor(s.place_id,'bbm');
  const km=Number(br?.jarak_km||0);
  const fuelOptions=activeFuel.map(f=>`<option value="${esc(f.jenis_bbm)}">${esc(f.jenis_bbm)}</option>`).join('');
  const vehicle=x.nomor_kendaraan==='-'?'':x.nomor_kendaraan;
  return `<tr data-row="${esc(s.id)}">
   <td>${esc(s.activity_date)}</td>
   <td><b>${esc(x.program_name)}</b><br><small>${esc(x.program_code)}</small></td>
   <td>${esc(x.staff_name)}<br><small>${esc(x.employee_code)}</small></td>
   <td>${esc(x.place_name)}</td>
   <td><select class="row-type" aria-label="Jenis pengajuan"><option value="">Pilih jenis</option><option value="bbm">BBM</option><option value="8_jam">8 Jam</option></select></td>
   <td class="money" data-distance>${km?esc(km)+' km':'—'}</td>
   <td><select class="row-fuel" aria-label="Jenis BBM" disabled><option value="">Pilih BBM</option>${fuelOptions}</select></td>
   <td class="money" data-price>—</td>
   <td class="money" data-litres>—</td>
   <td class="money" data-fuel-total>—</td>
   <td class="money" data-transport>—</td>
   <td><input class="row-vehicle" maxlength="30" value="${esc(vehicle)}" placeholder="${vehicle?'':'Belum ada di master petugas'}" aria-label="Plat kendaraan otomatis" readonly></td>
   <td><input class="row-spbu" maxlength="150" placeholder="Nama SPBU" aria-label="Nama SPBU" disabled></td>
   <td><input class="row-notes" maxlength="500" placeholder="Keterangan" aria-label="Keterangan"></td>
   <td><button class="btn-sm row-submit" data-submit-row="${esc(s.id)}" disabled>Ajukan</button></td>
  </tr>`;
 }).join('');

 $('content').innerHTML=`<section class="panel"><div class="section-head"><div><h3>Pengajuan transport berdasarkan jadwal</h3><p class="muted-note">Data tanggal, program, petugas, dan tempat diambil otomatis dari jadwal valid. Pilih jenis pengajuan pada setiap baris. Tarif 8 Jam ditetapkan sebesar Rp150.000.</p></div><button id="refreshScheduleClaims" class="btn-sm btn-light">Muat ulang jadwal</button></div>
 <div class="cards compact-cards"><div class="metric"><small>Jadwal belum diajukan</small><strong>${pendingSchedules.length}</strong></div><div class="metric"><small>Jenis BBM aktif</small><strong>${activeFuel.length}</strong></div></div>
 ${!pendingSchedules.length?'<div class="empty">Semua jadwal yang tersedia sudah memiliki pengajuan, atau belum ada jadwal valid.</div>':`<div class="table-wrap bulk-claim-wrap"><table class="data-table bulk-claim-table"><thead><tr><th>Tanggal</th><th>Program</th><th>Petugas / NIP</th><th>Tempat</th><th>Jenis Pengajuan</th><th>Jarak PP</th><th>Jenis BBM</th><th>Harga/liter</th><th>Liter</th><th>Nominal BBM</th><th>Transport</th><th>Plat kendaraan</th><th>Nama SPBU</th><th>Keterangan</th><th>Aksi</th></tr></thead><tbody>${rows}</tbody></table></div>`}
 <div class="notice">Mode BBM: kebutuhan dihitung 1 liter per 8 km (dibulatkan ke atas), harga mengikuti master harga BBM, dan plat kendaraan diambil dari master petugas. Mode 8 Jam: tarif tetap Rp150.000 tanpa pengisian BBM atau kendaraan.</div></section>`;

 $('refreshScheduleClaims').onclick=()=>renderForm();

 const updateRow=row=>{
  const type=row.querySelector('.row-type').value;
  const fuelSelect=row.querySelector('.row-fuel');
  const spbu=row.querySelector('.row-spbu');
  const vehicle=row.querySelector('.row-vehicle').value.trim();
  const km=Number((row.querySelector('[data-distance]')?.textContent||'').replace(/[^0-9.,]/g,'').replace(',','.'))||0;
  const btn=row.querySelector('.row-submit');
  const priceCell=row.querySelector('[data-price]');
  const litresCell=row.querySelector('[data-litres]');
  const totalCell=row.querySelector('[data-fuel-total]');
  const transportCell=row.querySelector('[data-transport]');

  if(type==='bbm'){
   fuelSelect.disabled=false;spbu.disabled=false;
   transportCell.textContent='—';
   const fuel=fuelSelect.value,priceRow=effectivePrice(fuel),price=Number(priceRow?.harga_per_liter||0);
   const litres=km>0?Math.ceil(km/8):0;
   priceCell.textContent=price?money(price):'—';
   litresCell.textContent=litres?`${litres} L`:'—';
   totalCell.textContent=price&&litres?money(price*litres):'—';
   btn.dataset.price=String(price);btn.dataset.litres=String(litres);
   btn.disabled=!(km>0&&fuel&&price>0&&litres>0&&vehicle);
   btn.dataset.mode='bbm';
  }else if(type==='8_jam'){
   fuelSelect.value='';fuelSelect.disabled=true;spbu.value='';spbu.disabled=true;
   priceCell.textContent='—';litresCell.textContent='—';totalCell.textContent='—';
   transportCell.textContent=money(TARIF_8_JAM);
   btn.dataset.price='0';btn.dataset.litres='0';btn.dataset.mode='8_jam';
   btn.disabled=false;
  }else{
   fuelSelect.value='';fuelSelect.disabled=true;spbu.value='';spbu.disabled=true;
   priceCell.textContent='—';litresCell.textContent='—';totalCell.textContent='—';transportCell.textContent='—';
   btn.dataset.price='0';btn.dataset.litres='0';btn.dataset.mode='';
   btn.disabled=true;
  }
 };

 $('content').addEventListener('change',e=>{
  if(e.target.matches('.row-type,.row-fuel'))updateRow(e.target.closest('tr'));
 });
 $('content').addEventListener('click',async e=>{
  const btn=e.target.closest('[data-submit-row]');if(!btn)return;
  const id=btn.dataset.submitRow,row=btn.closest('tr'),s=schedules.find(x=>x.id===id);if(!s)return;
  const mode=row.querySelector('.row-type').value;
  if(!mode){notice('Pilih Jenis Pengajuan terlebih dahulu.',true);return;}
  const notes=row.querySelector('.row-notes').value.trim();
  const vehicle=mode==='bbm'?row.querySelector('.row-vehicle').value.trim():null;
  const spbu=mode==='bbm'?row.querySelector('.row-spbu').value.trim():null;
  let fuel=null,price=0,litres=0,fuelCost=0,transport=0;

  if(mode==='bbm'){
   fuel=row.querySelector('.row-fuel').value;
   price=Number(btn.dataset.price||0);litres=Number(btn.dataset.litres||0);
   const km=Number((row.querySelector('[data-distance]')?.textContent||'').replace(/[^0-9.,]/g,'').replace(',','.'))||0;
   if(!fuel||!price||!litres||!km){notice('Pilih BBM dan pastikan harga serta jarak tersedia.',true);return;}
   if(!vehicle){notice('Nomor kendaraan belum diisi pada menu Petugas & Kendaraan.',true);return;}
   fuelCost=price*litres;
  }else{
   transport=TARIF_8_JAM;
  }

  btn.disabled=true;btn.textContent='Mengirim…';
  try{
   const payload={
    schedule_id:s.id,transport_amount:transport,jenis_bbm:fuel,
    kebutuhan_bbm_liter:litres,harga_per_liter:price,nominal_bbm:fuelCost,
    total_amount:transport+fuelCost,status:'submitted',catatan:notes||null,
    created_by:sessionUser.id,nama_spbu:spbu,jumlah_hari:1,
    nomor_kendaraan:vehicle
   };
   const {error}=await db.from('transport_claims').insert(payload);if(error)throw error;
   claims.push({id:`local-${s.id}`,schedule_id:s.id,...payload,created_at:new Date().toISOString()});
   row.remove();
   const body=$('content').querySelector('.bulk-claim-table tbody');
   if(body&&!body.querySelector('tr'))body.innerHTML='<tr><td colspan="15" class="empty">Semua jadwal sudah diajukan.</td></tr>';
   notice(`Pengajuan ${mode==='bbm'?'BBM':'8 Jam'} untuk ${enrichSchedule(s).staff_name} — ${enrichSchedule(s).program_name} berhasil dikirim.`);
  }catch(err){notice('Gagal menyimpan pengajuan: '+err.message,true);btn.disabled=false;btn.textContent='Ajukan';}
 });
}
async function renderClaims(finance){await loadMasters();await loadClaims();let rows=claimRows(finance);$('content').innerHTML=filterPanel()+`<section class="panel"><div class="section-head"><h3>${finance?'Daftar pengajuan untuk diverifikasi':'Riwayat pengajuan'}</h3><button id="refreshClaims" class="btn-sm btn-light">Muat ulang</button></div><div id="claimResult">${claimsTable(rows,finance)}</div></section>`;$('showFiltered').onclick=()=>{$('claimResult').innerHTML=claimsTable(applyClaimFilter(rows),finance);};$('refreshClaims').onclick=()=>renderClaims(finance);$('claimResult').addEventListener('click',async e=>{const b=e.target.closest('[data-action]');if(!b)return;const action=b.dataset.action,id=b.dataset.id;if(!confirm(action==='approve'?'Setujui pengajuan ini?':'Tolak pengajuan ini?'))return;const patch={status:action==='approve'?'approved':'rejected',updated_by:sessionUser.id,updated_at:new Date().toISOString()};const {error}=await db.from('transport_claims').update(patch).eq('id',id);if(error){notice('Gagal memperbarui status: '+error.message,true);return;}notice(action==='approve'?'Pengajuan disetujui.':'Pengajuan ditolak.');await renderClaims(finance);});}
async function renderFuelAdmin(){await loadMasters();const current=fuelTypes.map(f=>{const price=fuelPrices.find(p=>p.jenis_bbm===f.jenis_bbm&&p.berlaku_mulai<=today()&&(!p.berlaku_sampai||p.berlaku_sampai>=today()));return{...f,harga:price?.harga_per_liter??''};});$('content').innerHTML=`<section class="panel"><h3>Tambah jenis BBM / harga</h3><form id="fuelForm" class="form-inline"><div><label>Jenis BBM</label><input id="fuelName" required placeholder="Contoh: Pertamax"></div><div><label>Harga per liter (Rp)</label><input id="fuelPriceNew" type="number" min="1" required></div><div><label>Berlaku mulai</label><input id="fuelStart" type="date" value="${today()}" required></div><div><label>Keterangan</label><input id="fuelNote"></div><div class="span-all"><button type="submit">Simpan Jenis / Harga BBM</button></div></form></section><section class="panel"><h3>Daftar jenis BBM dan harga aktif</h3>${current.length?`<div class="table-wrap"><table class="data-table"><thead><tr><th>Jenis BBM</th><th>Harga / liter</th><th>Status</th><th>Aksi</th></tr></thead><tbody>${current.map(f=>`<tr><td>${esc(f.jenis_bbm)}</td><td>${money(f.harga)}</td><td>${f.is_active?'Aktif':'Nonaktif'}</td><td><button class="btn-sm btn-light" data-edit-fuel="${esc(f.id)}">Ubah harga</button> <button class="btn-sm btn-red" data-disable-fuel="${esc(f.id)}">Nonaktifkan</button></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">Belum ada jenis BBM.</div>'}</section>`;
$('fuelForm').onsubmit=async e=>{e.preventDefault();try{const name=$('fuelName').value.trim(),price=Number($('fuelPriceNew').value),start=$('fuelStart').value;if(!fuelTypes.some(f=>f.jenis_bbm.toLowerCase()===name.toLowerCase())){const {error}=await db.from('fuel_types').insert({jenis_bbm:name,is_active:true});if(error)throw error;}const {error:oldErr}=await db.from('fuel_price_history').update({berlaku_sampai:new Date(new Date(start+'T00:00:00').getTime()-86400000).toISOString().slice(0,10),is_active:false}).eq('jenis_bbm',name).eq('is_active',true).is('berlaku_sampai',null);if(oldErr)throw oldErr;const {error}=await db.from('fuel_price_history').insert({jenis_bbm:name,harga_per_liter:price,berlaku_mulai:start,is_active:true,keterangan:$('fuelNote').value.trim()||null});if(error)throw error;notice('Jenis BBM dan harga berhasil disimpan.');await renderFuelAdmin();}catch(err){notice('Gagal menyimpan BBM: '+err.message,true);}};
$('content').onclick=async e=>{const edit=e.target.closest('[data-edit-fuel]'),del=e.target.closest('[data-disable-fuel]');if(edit){const f=fuelTypes.find(x=>x.id===edit.dataset.editFuel);const p=prompt(`Masukkan harga baru per liter untuk ${f.jenis_bbm}:`);if(p===null)return;const price=Number(p);if(!(price>0))return notice('Harga harus lebih dari nol.',true);$('fuelName').value=f.jenis_bbm;$('fuelPriceNew').value=price;$('fuelStart').focus();notice('Isi tanggal berlaku dan klik Simpan Jenis / Harga BBM.');}if(del&&confirm('Nonaktifkan jenis BBM ini? Riwayat harga tidak dihapus.')){const f=fuelTypes.find(x=>x.id===del.dataset.disableFuel);const {error}=await db.from('fuel_types').update({is_active:false}).eq('id',f.id);if(error)notice(error.message,true);else{notice('Jenis BBM dinonaktifkan.');await renderFuelAdmin();}}};}
async function renderPlacesAdmin(){await loadMasters();const active=places.filter(p=>p.is_active);$('content').innerHTML=`<section class="panel"><h3>Tambah tempat dan jarak</h3><form id="placeForm" class="form-inline"><div><label>Nama tempat</label><input id="placeName" required placeholder="Nama lokasi kegiatan"></div><div><label>Jarak pulang-pergi (km)</label><input id="placeKm" type="number" min="0.1" step="0.01" required></div><div class="span-all"><button type="submit">Simpan Tempat & Jarak</button></div></form></section><section class="panel"><h3>Daftar tempat dan jarak</h3><div class="table-wrap"><table class="data-table"><thead><tr><th>Nama tempat</th><th>Jarak PP (km)</th><th>Tarif 8 Jam (baku)</th><th>Aksi</th></tr></thead><tbody>${active.map(p=>{const r=rateFor(p.id,'bbm');return`<tr><td>${esc(p.place_name)}</td><td>${esc(r?.jarak_km??'-')}</td><td>${money(150000)}</td><td><button class="btn-sm btn-light" data-edit-place="${esc(p.id)}">Edit</button> <button class="btn-sm btn-red" data-del-place="${esc(p.id)}">Nonaktifkan</button></td></tr>`}).join('')}</tbody></table></div></section>`;
$('placeForm').onsubmit=async e=>{e.preventDefault();try{const name=$('placeName').value.trim(),km=Number($('placeKm').value);let p=places.find(x=>x.place_name.toLowerCase()===name.toLowerCase());if(!p){const {data,error}=await db.from('places').insert({place_name:name,is_active:true}).select().single();if(error)throw error;p=data;}let r=rateFor(p.id,'bbm');if(r){const {error}=await db.from('transport_rates').update({jarak_km:km,is_active:true,updated_at:new Date().toISOString()}).eq('id',r.id);if(error)throw error;}else{const {error}=await db.from('transport_rates').insert({place_id:p.id,metode:'bbm',jarak_km:km,satuan_tarif:'per_perjalanan',tarif:0,is_active:true,keterangan:`Jarak pulang-pergi dalam km - ${name}`});if(error)throw error;}notice('Tempat dan jarak berhasil disimpan.');await renderPlacesAdmin();}catch(err){notice('Gagal menyimpan tempat: '+err.message,true);}};
$('content').onclick=async e=>{const edit=e.target.closest('[data-edit-place]'),del=e.target.closest('[data-del-place]');if(edit){const p=places.find(x=>x.id===edit.dataset.editPlace),r=rateFor(p.id,'bbm'),name=prompt('Nama tempat:',p.place_name);if(name===null)return;const km=prompt('Jarak pulang-pergi (km):',r?.jarak_km??'');if(km===null)return;try{const {error:e1}=await db.from('places').update({place_name:name.trim()}).eq('id',p.id);if(e1)throw e1;if(r){const {error}=await db.from('transport_rates').update({jarak_km:Number(km),updated_at:new Date().toISOString()}).eq('id',r.id);if(error)throw error;}else{const {error}=await db.from('transport_rates').insert({place_id:p.id,metode:'bbm',jarak_km:Number(km),satuan_tarif:'per_perjalanan',tarif:0,is_active:true});if(error)throw error;}notice('Data tempat diperbarui.');await renderPlacesAdmin();}catch(err){notice(err.message,true);}}if(del&&confirm('Nonaktifkan tempat ini?')){const {error}=await db.from('places').update({is_active:false}).eq('id',del.dataset.delPlace);if(error)notice(error.message,true);else{notice('Tempat dinonaktifkan.');await renderPlacesAdmin();}}};}
async function renderStaffAdmin(){await loadMasters();$('content').innerHTML=`<section class="panel"><h3>Tambah petugas</h3><form id="staffForm" class="form-inline"><div><label>Nama petugas</label><input id="staffName" required></div><div><label>NIP</label><input id="staffNip"></div><div><label>Golongan</label><input id="staffGol"></div><div><label>Nomor kendaraan</label><input id="staffVehicle" placeholder="Contoh: K 1234 XX"></div><div class="span-all"><button type="submit">Simpan Petugas</button></div></form></section><section class="panel"><h3>Daftar petugas dan kendaraan</h3><div class="table-wrap"><table class="data-table"><thead><tr><th>Nama</th><th>NIP</th><th>Golongan</th><th>Nomor kendaraan</th><th>Aksi</th></tr></thead><tbody>${staff.filter(s=>s.is_active).map(s=>`<tr><td>${esc(s.full_name)}</td><td>${esc(s.employee_code||'-')}</td><td>${esc(s.golongan||'-')}</td><td>${esc(s.nomor_kendaraan||'-')}</td><td><button class="btn-sm btn-light" data-edit-staff="${esc(s.id)}">Edit</button> <button class="btn-sm btn-red" data-del-staff="${esc(s.id)}">Hapus</button></td></tr>`).join('')}</tbody></table></div></section>`;
$('staffForm').onsubmit=async e=>{e.preventDefault();try{const {error}=await db.from('staff').insert({full_name:$('staffName').value.trim(),employee_code:$('staffNip').value.trim()||null,golongan:$('staffGol').value.trim()||null,nomor_kendaraan:$('staffVehicle').value.trim()||null,is_active:true});if(error)throw error;notice('Petugas berhasil ditambahkan.');await renderStaffAdmin();}catch(err){notice('Gagal menambah petugas: '+err.message,true);}};
$('content').onclick=async e=>{const edit=e.target.closest('[data-edit-staff]'),del=e.target.closest('[data-del-staff]');if(edit){const s=staff.find(x=>x.id===edit.dataset.editStaff);const name=prompt('Nama petugas:',s.full_name);if(name===null)return;const nip=prompt('NIP:',s.employee_code||'');if(nip===null)return;const gol=prompt('Golongan:',s.golongan||'');if(gol===null)return;const vehicle=prompt('Nomor kendaraan:',s.nomor_kendaraan||'');if(vehicle===null)return;const {error}=await db.from('staff').update({full_name:name.trim(),employee_code:nip.trim()||null,golongan:gol.trim()||null,nomor_kendaraan:vehicle.trim()||null}).eq('id',s.id);if(error)notice(error.message,true);else{notice('Data petugas diperbarui.');await renderStaffAdmin();}}if(del&&confirm('Hapus/nonaktifkan petugas ini? Data lama tetap dipertahankan untuk riwayat.')){const {error}=await db.from('staff').update({is_active:false}).eq('id',del.dataset.delStaff);if(error)notice(error.message,true);else{notice('Petugas dinonaktifkan.');await renderStaffAdmin();}}};}
async function renderReport(){await loadMasters();await loadClaims();const rows=claimRows(true).filter(c=>['approved','paid'].includes(c.status));const total=rows.reduce((a,c)=>a+Number(c.total_amount||0),0);$('content').innerHTML=`<section class="panel"><div class="section-head"><h3>Rekap pertanggungjawaban transport</h3><button id="exportCsv">Unduh CSV</button></div><div class="cards"><div class="metric"><small>Disetujui / dibayar</small><strong>${rows.length}</strong></div><div class="metric"><small>Total penerimaan</small><strong style="font-size:20px">${money(total)}</strong></div></div>${claimsTable(rows)}</section>`;$('exportCsv').onclick=()=>exportCsv(rows);}
function exportCsv(rows){const keys=['activity_date','program_name','staff_name','employee_code','golongan','place_name','transport_amount','jumlah_hari','total_amount','nama_spbu','nomor_kendaraan','jenis_bbm','kebutuhan_bbm_liter','harga_per_liter','nominal_bbm','status'];const csv=[keys.join(','),...rows.map(r=>keys.map(k=>'"'+String(r[k]??'').replace(/"/g,'""')+'"').join(','))].join('\r\n');const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='rekap-bendahara.csv';a.click();URL.revokeObjectURL(a.href);}
