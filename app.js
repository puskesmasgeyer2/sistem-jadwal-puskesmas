const SUPABASE_URL="https://xqeuklqhkslfvhqrhyyr.supabase.co";
const SUPABASE_PUBLISHABLE_KEY="sb_publishable_2hvrRkMS3sZ9CvyHHNdgFA_vsKJj8Mn";
const client=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);
const $=id=>document.getElementById(id);let currentProfile=null,currentUser=null,currentPage=sessionStorage.getItem('jadwalCurrentPage')||'home',allSchedules=[],currentPageNumber=1,pageSize=10,masterCache={programs:[],staff:[],places:[]},masterType='programs';
const pageInfo={home:['Beranda','Ringkasan dan daftar jadwal kegiatan'],input:['Input Jadwal','Tambahkan jadwal kegiatan baru'],program:['Program','Daftar program kegiatan'],staff:['Staff / Petugas','Daftar petugas terdaftar'],places:['Tempat','Daftar tempat kegiatan'],calendar:['Kalender','Kalender kerja dan kebijakan tanggal'],settings:['Pengaturan','Pengaturan akun dan akses pengguna']};
function esc(v){return String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;')}
function msg(t,error=false){$('dashboardMessage').textContent=t||'';$('dashboardMessage').style.color=error?'#b42318':'#087f5b'}
function setPage(page){
  if(!pageInfo[page]) page='home';

  currentPage=page;
  sessionStorage.setItem('jadwalCurrentPage',page);
  currentPageNumber=1;

  document.querySelectorAll('.nav-btn[data-page]')
    .forEach(b=>b.classList.toggle('active',b.dataset.page===page));

  $('pageTitle').textContent=pageInfo[page][0];
  $('pageSubtitle').textContent=pageInfo[page][1];
  $('sidebar').classList.remove('open');
  msg('');
  renderPage(page);
}
function fallbackLogo(){const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M50 3 91 26v48L50 97 9 74V26Z" fill="#fff" stroke="#075c43" stroke-width="5"/><path d="M40 19h20v21h21v20H60v21H40V60H19V40h21Z" fill="#087f5b"/><circle cx="58" cy="49" r="8" fill="none" stroke="#fff" stroke-width="2"/><circle cx="70" cy="49" r="8" fill="none" stroke="#fff" stroke-width="2"/></svg>';$('headerLogo').src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg)}
$('headerLogo').addEventListener('error',fallbackLogo);$('togglePassword').addEventListener('click',()=>{const p=$('password');p.type=p.type==='password'?'text':'password';$('togglePassword').textContent=p.type==='password'?'Lihat':'Sembunyikan'});
async function showSession(session){
  if(!session){
    currentProfile=null;
    currentUser=null;
    $('loginCard').classList.remove('hidden');
    $('dashboardCard').classList.add('hidden');
    return;
  }

  // Jangan render ulang halaman jika hanya sesi login yang diperbarui.
  if(
    currentUser?.id===session.user.id &&
    !$('dashboardCard').classList.contains('hidden')
  ){
    currentUser=session.user;
    return;
  }

  currentUser=session.user;
const {data,error}=await client.from('profiles').select('full_name,role,staff_id,is_active').eq('id',session.user.id).maybeSingle();if(error||!data||!data.is_active){await client.auth.signOut();$('message').textContent='Profil belum tersedia atau akun belum aktif. Hubungi administrator.';return}currentProfile=data;$('loginCard').classList.add('hidden');$('dashboardCard').classList.remove('hidden');$('sideProfile').innerHTML=esc(data.full_name||'Pengguna')+'<small id="sideRole">'+esc(data.role||'petugas')+'</small>';$('roleChip').textContent=(data.role||'petugas').toUpperCase();const savedPage=sessionStorage.getItem('jadwalCurrentPage')||'home';
setPage(pageInfo[savedPage]?savedPage:'home');}
$('loginForm').addEventListener('submit',async e=>{e.preventDefault();$('loginButton').disabled=true;$('loginButton').textContent='Memeriksa akun...';$('message').textContent='';try{const {data,error}=await client.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});if(error)throw error;await showSession(data.session)}catch(e){$('message').textContent='Login gagal. Periksa email, password, dan koneksi.'}finally{$('loginButton').disabled=false;$('loginButton').textContent='Masuk'}});
$('logoutButton').addEventListener('click',async()=>{const {error}=await client.auth.signOut();if(error){msg('Gagal keluar. Silakan coba lagi.',true);return}msg('');$('message').textContent='';await showSession(null)});$('mobileMenu').addEventListener('click',()=>$('sidebar').classList.toggle('open'));document.querySelectorAll('.nav-btn[data-page]').forEach(b=>b.addEventListener('click',()=>setPage(b.dataset.page)));
async function fetchMaster(table,columns,order){const {data,error}=await client.from(table).select(columns).eq('is_active',true).order(order,{ascending:true}).limit(1000);if(error)throw error;return data||[]}
async function loadMasters(){const [programs,staff,places]=await Promise.all([fetchMaster('programs','id,program_code,program_name,is_active','program_name'),fetchMaster('staff','id,employee_code,full_name,is_active','full_name'),fetchMaster('places','id,place_name,is_active','place_name')]);masterCache={programs,staff,places};return masterCache}
function monthYearFilters(){const now=new Date();const years=[];for(let y=2026;y<=Math.max(2032,now.getFullYear()+2);y++)years.push(y);return `<div class="filters"><div><label for="filterMonth">Bulan</label><select id="filterMonth"><option value="all">Semua bulan</option>${['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'].map((m,i)=>`<option value="${i+1}" ${i+1===now.getMonth()+1?'selected':''}>${m}</option>`).join('')}</select></div><div><label for="filterYear">Tahun</label><select id="filterYear">${years.map(y=>`<option value="${y}" ${y===now.getFullYear()?'selected':''}>${y}</option>`).join('')}<option value="all">Semua tahun</option></select></div><div class="filter-search"><label for="filterSearch">Cari jadwal</label><input id="filterSearch" placeholder="Program, petugas, tempat..."></div><button id="applyFilters" type="button">Terapkan</button></div>`}

async function getScheduleData() {
  // Ambil jadwal yang masih berstatus valid
  const { data, error } = await client
    .from('schedules')
    .select(`
      id,
      activity_date,
      program_id,
      staff_id,
      place_id,
      notes,
      status
    `)
    .eq('status', 'valid')
    .order('activity_date', { ascending: false })
    .limit(2000);

  if (error) throw error;

  // Ambil SEMUA data master, termasuk yang sudah nonaktif.
  // Tujuannya agar nama pada jadwal lama tetap bisa ditampilkan.
  const [programResult, staffResult, placeResult] =
    await Promise.all([
      client
        .from('programs')
        .select('id, program_name'),

      client
        .from('staff')
        .select('id, full_name'),

      client
        .from('places')
        .select('id, place_name')
    ]);

  if (programResult.error) throw programResult.error;
  if (staffResult.error) throw staffResult.error;
  if (placeResult.error) throw placeResult.error;

  const programMap = Object.fromEntries(
    (programResult.data || []).map(item => [
      item.id,
      item.program_name
    ])
  );

  const staffMap = Object.fromEntries(
    (staffResult.data || []).map(item => [
      item.id,
      item.full_name
    ])
  );

  const placeMap = Object.fromEntries(
    (placeResult.data || []).map(item => [
      item.id,
      item.place_name
    ])
  );

  // Gabungkan jadwal dengan nama master berdasarkan ID.
  return (data || []).map(item => ({
    ...item,
    program_name:
      programMap[item.program_id] || 'Program tidak ditemukan',
    staff_name:
      staffMap[item.staff_id] || 'Petugas tidak ditemukan',
    place_name:
      placeMap[item.place_id] || 'Tempat tidak ditemukan'
  }));
}

async function renderHome(){const c=$('dashboardContent');c.innerHTML='<div class="loading">Memuat jadwal...</div>';try{allSchedules=await getScheduleData();const now=new Date();const month=String(now.getMonth()+1).padStart(2,'0');const prefix=now.getFullYear()+'-'+month;const thisMonth=allSchedules.filter(x=>x.activity_date.startsWith(prefix)).length;const staffCount=masterCache.staff.length;const programCount=masterCache.programs.length;c.innerHTML=`<div class="welcome-row"><div><h3>Selamat datang, ${esc(currentProfile?.full_name||'Pengguna')} 👋</h3><p>Kelola jadwal kegiatan Puskesmas dalam satu tempat.</p></div><button type="button" id="quickAdd">＋ Input Jadwal</button></div><div class="stats"><div class="stat"><div><div class="stat-top">Total jadwal valid</div><strong>${allSchedules.length}</strong></div><span class="stat-icon">▤</span></div><div class="stat"><div><div class="stat-top">Jadwal bulan ini</div><strong>${thisMonth}</strong></div><span class="stat-icon">▦</span></div><div class="stat"><div><div class="stat-top">Petugas aktif</div><strong>${staffCount}</strong></div><span class="stat-icon">♙</span></div></div><section class="panel"><div class="panel-head"><h3>Daftar Jadwal Kegiatan</h3><span class="badge">${programCount} program aktif</span></div>${monthYearFilters()}<div id="homeTable"></div><div class="pagination" id="homePagination"></div></section><div class="page-foot">Sistem Jadwal UPTD Puskesmas Geyer 2</div>`;$('quickAdd').addEventListener('click',()=>setPage('input'));$('applyFilters').addEventListener('click',()=>{currentPageNumber=1;drawHomeTable()});['filterMonth','filterYear'].forEach(id=>$(id).addEventListener('change',()=>{currentPageNumber=1;drawHomeTable()}));$('filterSearch').addEventListener('input',()=>{currentPageNumber=1;drawHomeTable()});drawHomeTable()}catch(e){c.innerHTML=`<div class="panel"><h3>Jadwal belum dapat dimuat</h3><p class="muted">Periksa izin baca tabel schedules dan tabel data master di Supabase.</p><div class="notice warn">Detail: ${esc(e.message||'Kesalahan tidak diketahui')}</div><button id="retryHome">Coba lagi</button></div>`;$('retryHome').addEventListener('click',renderHome)}}
function drawHomeTable(){const month=$('filterMonth')?.value||'all',year=$('filterYear')?.value||String(new Date().getFullYear()),q=($('filterSearch')?.value||'').trim().toLowerCase();let rows=allSchedules.filter(x=>(month==='all'||Number(x.activity_date.slice(5,7))===Number(month))&&(year==='all'||x.activity_date.startsWith(year))&&[x.program_name,x.staff_name,x.place_name,x.notes].some(v=>String(v||'').toLowerCase().includes(q)));const pages=Math.max(1,Math.ceil(rows.length/pageSize));currentPageNumber=Math.min(currentPageNumber,pages);const start=(currentPageNumber-1)*pageSize;const pageRows=rows.slice(start,start+pageSize);$('homeTable').innerHTML=pageRows.length?`<div class="table-wrap"><table class="data-table"><thead><tr><th>Tanggal</th><th>Program</th><th>Petugas</th><th>Tempat</th><th>Catatan</th><th>Status</th></tr></thead><tbody>${pageRows.map(x=>`<tr><td>${esc(x.activity_date)}</td><td>${esc(x.program_name)}</td><td>${esc(x.staff_name)}</td><td>${esc(x.place_name)}</td><td>${esc(x.notes||'-')}</td><td><span class="badge">Valid</span></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">Tidak ada jadwal sesuai filter.</div>';$('homePagination').innerHTML=`<span>Menampilkan ${rows.length?start+1:0}–${Math.min(start+pageSize,rows.length)} dari ${rows.length} jadwal</span><div class="pagination-actions"><button id="prevPage" ${currentPageNumber<=1?'disabled':''}>Sebelumnya</button><span style="padding:8px">Halaman ${currentPageNumber}/${pages}</span><button id="nextPage" ${currentPageNumber>=pages?'disabled':''}>Berikutnya</button></div>`;$('prevPage').addEventListener('click',()=>{currentPageNumber--;drawHomeTable()});$('nextPage').addEventListener('click',()=>{currentPageNumber++;drawHomeTable()})}
async function renderInput(){const c=$('dashboardContent');c.innerHTML='<div class="loading">Memuat pilihan formulir...</div>';try{await loadMasters();const isPetugas=currentProfile?.role==='petugas';if(isPetugas&&!currentProfile.staff_id){c.innerHTML='<div class="panel"><h3>Akun belum terhubung ke petugas</h3><p class="muted">Hubungi administrator untuk mengisi staff_id pada profil akun.</p></div>';return}const opt=(arr,label,value,extra=()=> '')=>arr.map(x=>`<option value="${esc(x[value])}">${esc(label(x))}${extra(x)}</option>`).join('');c.innerHTML=`<div class="welcome-row"><div><h3>Input Jadwal Kegiatan</h3><p>Lengkapi informasi kegiatan. Sistem akan memeriksa kebijakan kalender dan bentrok petugas.</p></div></div><section class="panel"><form id="scheduleForm"><div class="form-grid"><div><label for="activityDate">Tanggal kegiatan *</label><input id="activityDate" type="date" required></div><div><label for="programId">Program kegiatan *</label><select id="programId" required><option value="">Pilih program</option>${opt(masterCache.programs,x=>x.program_name,'id',x=>x.program_code?' — '+x.program_code:'')}</select></div><div><label for="staffId">Nama petugas *</label><select id="staffId" required ${isPetugas?'disabled':''}><option value="">Pilih petugas</option>${opt(masterCache.staff.filter(x=>!isPetugas||x.id===currentProfile.staff_id),x=>x.full_name,'id',x=>x.employee_code?' — '+x.employee_code:'')}</select></div><div><label for="placeId">Tempat kegiatan *</label><select id="placeId" required><option value="">Pilih tempat</option>${opt(masterCache.places,x=>x.place_name,'id')}</select></div><div class="full"><label for="scheduleNotes">Catatan (opsional)</label><textarea id="scheduleNotes" rows="3" maxlength="500" placeholder="Keterangan tambahan"></textarea></div></div><div class="notice warn">Hari Minggu dan tanggal dengan kebijakan blokir tidak dapat dipilih. Hari Sabtu atau tanggal peringatan memerlukan konfirmasi.</div><div id="scheduleFormMessage" role="status" aria-live="polite"></div><div class="form-actions"><button type="button" class="secondary" id="cancelInput">Batal</button><button type="submit" id="saveScheduleButton">Simpan Jadwal</button></div></form></section>`;if(isPetugas)$('staffId').value=currentProfile.staff_id;$('cancelInput').addEventListener('click',()=>setPage('home'));$('scheduleForm').addEventListener('submit',saveSchedule)}catch(e){c.innerHTML=`<div class="panel"><h3>Formulir belum dapat dimuat</h3><div class="notice warn">${esc(e.message||'Periksa izin data master.')}</div></div>`}}
async function saveSchedule(e){e.preventDefault();const btn=$('saveScheduleButton'),m=$('scheduleFormMessage');m.style.color='#b42318';m.textContent='';const date=$('activityDate').value,program=$('programId').value,staff=$('staffId').value,place=$('placeId').value,notes=$('scheduleNotes').value.trim();if(!date||!program||!staff||!place){m.textContent='Tanggal, program, petugas, dan tempat wajib diisi.';return}const dow=new Date(date+'T12:00:00').getDay();if(dow===0){m.textContent='Jadwal tidak dapat dibuat pada hari Minggu.';return}try{const {data:day,error:ce}=await client.from('calendar_days').select('day_description,day_type,schedule_policy').eq('calendar_date',date).maybeSingle();if(ce)throw ce;if(!day){m.textContent='Tanggal belum tersedia di kalender. Hubungi administrator.';return}if(day.schedule_policy==='block'){m.textContent='Tanggal diblokir: '+(day.day_description||date);return}if(dow===6||day.schedule_policy==='warning'){if(!confirm('Perhatian: tanggal ini memiliki kebijakan peringatan'+(day.day_description?' ('+day.day_description+')':'')+'. Tetap simpan jadwal?'))return}btn.disabled=true;btn.textContent='Menyimpan...';const {error}=await client.from('schedules').insert({activity_date:date,program_id:program,staff_id:staff,place_id:place,notes:notes||null,status:'valid'});if(error){let t=error.message||'Kesalahan';if(/duplicate key|schedules_staff_date_unique|unique constraint/i.test(t))t='Petugas tersebut sudah memiliki jadwal pada tanggal itu.';if(/row-level security|permission denied/i.test(t))t='Akun Anda tidak memiliki izin menyimpan jadwal ini.';m.textContent='Jadwal belum tersimpan: '+t;return}m.style.color='#087f5b';m.textContent='Jadwal berhasil disimpan.';setTimeout(()=>setPage('home'),700)}catch(err){m.textContent='Jadwal belum tersimpan: '+(err.message||'Periksa koneksi.')}finally{btn.disabled=false;btn.textContent='Simpan Jadwal'}}
async function renderMaster(type, query='', page=1){
  masterType=type;
  const c=$('dashboardContent');
  c.innerHTML='<div class="loading">Memuat data master...</div>';
  try{
    await loadMasters();
    const cfg={
      programs:{title:'Program',singular:'Program',headers:['Kode Program','Nama Program'],search:['program_code','program_name'],fields:[['program_code','Kode Program','text'],['program_name','Nama Program','text']],values:x=>[x.program_code,x.program_name]},
      staff:{title:'Staff / Petugas',singular:'Petugas',headers:['Kode Petugas','Nama Petugas'],search:['employee_code','full_name'],fields:[['employee_code','Kode Petugas / NIP','text'],['full_name','Nama Petugas','text']],values:x=>[x.employee_code,x.full_name]},
      places:{title:'Tempat',singular:'Tempat',headers:['Nama Tempat'],search:['place_name'],fields:[['place_name','Nama Tempat','text']],values:x=>[x.place_name]}
    }[type];
    if(!cfg) throw new Error('Jenis data master tidak dikenal.');
    const all=masterCache[type]||[];
    const q=String(query||'').trim().toLowerCase();
    const filtered=all.filter(x=>cfg.search.some(k=>String(x[k]||'').toLowerCase().includes(q)));
    const size=10, pages=Math.max(1,Math.ceil(filtered.length/size));
    page=Math.max(1,Math.min(Number(page)||1,pages));
    const rows=filtered.slice((page-1)*size,page*size);
    const isAdmin=currentProfile?.role==='admin';
    const actions=isAdmin?'<th>Aksi</th>':'';
    c.innerHTML=`<div class="welcome-row"><div><h3>${cfg.title}</h3><p>Daftar ${cfg.title.toLowerCase()} aktif yang tersimpan di Supabase.</p></div><span class="badge">${filtered.length} dari ${all.length} data</span></div>
    <section class="panel"><div class="panel-head"><h3>Data ${cfg.title}</h3>${isAdmin?'<button type="button" id="addMasterBtn">＋ Tambah '+cfg.singular+'</button>':''}</div>
    <div class="master-toolbar"><div><label for="masterSearch">Cari ${cfg.title.toLowerCase()}</label><input id="masterSearch" type="search" value="${esc(query)}" placeholder="Ketik kode atau nama..."></div><button type="button" class="secondary" id="clearMasterSearch">Reset</button></div>
    <div id="masterEditor"></div>
    <div class="table-wrap"><table class="data-table"><thead><tr>${cfg.headers.map(h=>`<th>${h}</th>`).join('')}${actions}</tr></thead><tbody>${rows.map(x=>`<tr>${cfg.values(x).map(v=>`<td>${esc(v||'-')}</td>`).join('')}${isAdmin?`<td><div class="row-actions"><button type="button" class="small-btn" data-edit-master="${esc(x.id)}">Edit</button><button type="button" class="small-btn danger-btn" data-deactivate-master="${esc(x.id)}">Nonaktifkan</button></div></td>`:''}</tr>`).join('')||`<tr><td colspan="${cfg.headers.length+(isAdmin?1:0)}" class="empty-cell">Tidak ada data yang cocok.</td></tr>`}</tbody></table></div>
    <div class="pagination"><span>Menampilkan ${filtered.length?((page-1)*size+1):0}–${Math.min(page*size,filtered.length)} dari ${filtered.length} data</span><div class="pagination-actions"><button type="button" class="secondary" id="masterPrev" ${page<=1?'disabled':''}>Sebelumnya</button><span class="page-count">Halaman ${page}/${pages}</span><button type="button" class="secondary" id="masterNext" ${page>=pages?'disabled':''}>Berikutnya</button></div></div>
    <div class="notice">Penonaktifan menyembunyikan data dari pilihan input baru, tetapi tidak menghapus riwayat jadwal yang sudah tersimpan.</div></section>`;
    $('masterSearch').addEventListener('input',e=>renderMaster(type,e.target.value,1));
    $('clearMasterSearch').addEventListener('click',()=>renderMaster(type,'',1));
    $('masterPrev').addEventListener('click',()=>renderMaster(type,$('masterSearch').value,page-1));
    $('masterNext').addEventListener('click',()=>renderMaster(type,$('masterSearch').value,page+1));
    if(isAdmin){
      $('addMasterBtn').addEventListener('click',()=>showMasterEditor(type,null));
      c.querySelectorAll('[data-edit-master]').forEach(b=>b.addEventListener('click',()=>{const item=all.find(x=>x.id===b.dataset.editMaster);if(item)showMasterEditor(type,item)}));
      c.querySelectorAll('[data-deactivate-master]').forEach(b=>b.addEventListener('click',async()=>{
        const item=all.find(x=>x.id===b.dataset.deactivateMaster);if(!item)return;
        const label=cfg.values(item).filter(Boolean).join(' — ');
        if(!confirm(`Nonaktifkan data "${label}"? Data tidak dihapus dan jadwal lama tetap dipertahankan.`))return;
        try{const {error}=await client.from(type).update({is_active:false}).eq('id',item.id);if(error)throw error;await loadMasters();await renderMaster(type,query,page);msg('Data berhasil dinonaktifkan.')}catch(err){alert('Gagal menonaktifkan data: '+(err.message||'Periksa izin database.'))}
      }));
    }
  }catch(e){c.innerHTML=`<section class="panel"><h3>Data master gagal dimuat</h3><div class="notice warn">${esc(e.message||'Periksa izin akses tabel.')}</div></section>`}
}
function showMasterEditor(type,item){
  const editor=$('masterEditor');
  const cfg={programs:{title:'Program',fields:[['program_code','Kode Program'],['program_name','Nama Program']]},staff:{title:'Petugas',fields:[['employee_code','Kode Petugas / NIP'],['full_name','Nama Petugas']]},places:{title:'Tempat',fields:[['place_name','Nama Tempat']]}}[type];
  if(!editor||!cfg)return;
  editor.innerHTML=`<section class="master-editor"><div class="panel-head"><h3>${item?'Ubah':'Tambah'} ${cfg.title}</h3></div><form id="masterForm"><div class="form-grid">${cfg.fields.map(([key,label])=>`<div><label for="mf_${key}">${label} *</label><input id="mf_${key}" name="${key}" required maxlength="160" value="${esc(item?.[key]||'')}" autocomplete="off"></div>`).join('')}</div><div id="masterFormMessage" role="status" aria-live="polite"></div><div class="form-actions"><button type="button" class="secondary" id="cancelMasterEdit">Batal</button><button type="submit" id="saveMasterBtn">${item?'Simpan Perubahan':'Simpan Data'}</button></div></form></section>`;
  $('cancelMasterEdit').addEventListener('click',()=>{editor.innerHTML=''});
  $('masterForm').addEventListener('submit',async e=>{
    e.preventDefault();const btn=$('saveMasterBtn'),m=$('masterFormMessage');btn.disabled=true;btn.textContent='Menyimpan...';m.textContent='';m.style.color='#b42318';
    const payload={};for(const [key] of cfg.fields)payload[key]=$(('mf_'+key)).value.trim();payload.is_active=true;
    if(Object.values(payload).some(v=>typeof v==='string'&&!v)){m.textContent='Semua kolom wajib diisi.';btn.disabled=false;btn.textContent=item?'Simpan Perubahan':'Simpan Data';return}
    try{let result;if(item)result=await client.from(type).update(payload).eq('id',item.id);else result=await client.from(type).insert(payload);if(result.error)throw result.error;await loadMasters();await renderMaster(type,'',1);msg(item?'Perubahan data berhasil disimpan.':'Data baru berhasil ditambahkan.')}catch(err){let detail=err.message||'Periksa koneksi dan izin database.';if(/duplicate key|unique constraint/i.test(detail))detail='Kode atau nama tersebut sudah digunakan.';m.textContent='Data belum tersimpan: '+detail;btn.disabled=false;btn.textContent=item?'Simpan Perubahan':'Simpan Data'}
  });
}
async function renderCalendar(){const c=$('dashboardContent');c.innerHTML='<div class="loading">Memuat kalender...</div>';const year=new Date().getFullYear();try{const {data,error}=await client.from('calendar_days').select('calendar_date,day_description,day_type,schedule_policy,verification_status').gte('calendar_date',year+'-01-01').lt('calendar_date',(year+1)+'-01-01').order('calendar_date').limit(400);if(error)throw error;c.innerHTML=`<div class="welcome-row"><div><h3>Kalender ${year}</h3><p>Jadwal mengikuti kebijakan tanggal yang tersimpan di database.</p></div></div><section class="panel"><div class="table-wrap"><table class="data-table"><thead><tr><th>Tanggal</th><th>Hari</th><th>Keterangan</th><th>Jenis hari</th><th>Kebijakan</th><th>Verifikasi</th></tr></thead><tbody>${(data||[]).map(d=>`<tr><td>${esc(d.calendar_date)}</td><td>${new Date(d.calendar_date+'T12:00:00').toLocaleDateString('id-ID',{weekday:'long',timeZone:'Asia/Jakarta'})}</td><td>${esc(d.day_description||'-')}</td><td>${esc(d.day_type)}</td><td><span class="badge ${d.schedule_policy==='block'?'block':d.schedule_policy==='warning'?'warning':''}">${esc(d.schedule_policy)}</span></td><td>${esc(d.verification_status)}</td></tr>`).join('')||'<tr><td colspan="6">Belum ada data kalender.</td></tr>'}</tbody></table></div></section>`}catch(e){c.innerHTML=`<section class="panel"><h3>Kalender gagal dimuat</h3><div class="notice warn">${esc(e.message||'Periksa izin tabel calendar_days.')}</div></section>`}}
function renderSettings(){const c=$('dashboardContent');c.innerHTML=`<div class="welcome-row"><div><h3>Pengaturan</h3><p>Pengaturan akun yang dapat dilakukan dengan aman dari aplikasi.</p></div></div><div class="settings-grid"><section class="setting-card"><h3>Ubah password</h3><p>Gunakan password baru yang kuat dan tidak dipakai di layanan lain.</p><form id="passwordForm"><label for="newPassword">Password baru</label><input id="newPassword" type="password" minlength="8" autocomplete="new-password" required placeholder="Minimal 8 karakter"><label for="confirmPassword">Ulangi password</label><input id="confirmPassword" type="password" minlength="8" autocomplete="new-password" required placeholder="Ulangi password baru"><button type="submit">Ubah Password</button><div id="passwordMessage" role="status"></div></form></section><section class="setting-card"><h3>Profil dan role akses</h3><p>Nama: <strong>${esc(currentProfile?.full_name||'-')}</strong><br>Role: <strong>${esc(currentProfile?.role||'-')}</strong><br>Email: <strong>${esc(currentUser?.email||'-')}</strong></p><div class="notice warn">Perubahan role dan pengelolaan akun pengguna belum dibuka dari antarmuka ini. Role harus diubah melalui proses admin yang tervalidasi di Supabase, bukan langsung dari browser.</div></section><section class="setting-card"><h3>Aturan jadwal</h3><p>Minggu dan tanggal berkebijakan <em>block</em> ditolak. Sabtu atau tanggal berkebijakan <em>warning</em> memerlukan konfirmasi.</p><button type="button" id="settingsCalendar">Lihat Kalender</button></section><section class="setting-card"><h3>Sesi login</h3><p>Jika menggunakan komputer bersama, keluar setelah selesai mengelola jadwal.</p><button type="button" class="secondary" id="settingsLogout">Keluar dari akun</button></section></div>`;$('passwordForm').addEventListener('submit',async e=>{e.preventDefault();const a=$('newPassword').value,b=$('confirmPassword').value,m=$('passwordMessage');m.style.color='#b42318';if(a.length<8){m.textContent='Password minimal 8 karakter.';return}if(a!==b){m.textContent='Password baru dan konfirmasi tidak sama.';return}const {error}=await client.auth.updateUser({password:a});if(error){m.textContent='Password gagal diubah: '+error.message;return}m.style.color='#087f5b';m.textContent='Password berhasil diubah.';$('passwordForm').reset()});$('settingsCalendar').addEventListener('click',()=>setPage('calendar'));$('settingsLogout').addEventListener('click',()=>$('logoutButton').click())}
function renderPage(page){if(page==='home')return renderHome();if(page==='input')return renderInput();if(page==='program')return renderMaster('programs');if(page==='staff')return renderMaster('staff');if(page==='places')return renderMaster('places');if(page==='calendar')return renderCalendar();if(page==='settings')return renderSettings()}
client.auth.onAuthStateChange((_event,session)=>{showSession(session)});client.auth.getSession().then(({data,error})=>{if(error){$('message').textContent='Sesi tidak dapat diperiksa. Muat ulang halaman.';return}showSession(data.session)});
