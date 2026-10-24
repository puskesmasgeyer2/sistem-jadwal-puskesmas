const SUPABASE_URL="https://xqeuklqhkslfvhqrhyyr.supabase.co";
const SUPABASE_PUBLISHABLE_KEY="sb_publishable_2hvrRkMS3sZ9CvyHHNdgFA_vsKJj8Mn";
const client=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);
const $=id=>document.getElementById(id);let currentProfile=null,currentUser=null,currentPage=sessionStorage.getItem('jadwalCurrentPage')||'home',allSchedules=[],currentPageNumber=1,pageSize=10,masterCache={programs:[],staff:[],places:[]},masterType='programs';
const SESSION_IDLE_LIMIT = 30 * 60 * 1000;
const SESSION_MAX_AGE = 8 * 60 * 60 * 1000;
const SESSION_CHECK_INTERVAL = 5 * 1000;

let sessionGuardTimer = null;
let sessionStartedAt = 0;
let sessionEnding = false;

function sessionKey(userId, name) {
  return `jadwal_${name}_${userId}`;
}

function stopSessionGuard() {
  if (sessionGuardTimer) {
    clearInterval(sessionGuardTimer);
    sessionGuardTimer = null;
  }
  sessionStartedAt = 0;
}

function recordSessionActivity() {
  if (!currentUser?.id || sessionEnding) return;
  localStorage.setItem(
    sessionKey(currentUser.id, 'last_activity'),
    String(Date.now())
  );
}

async function endSession(reason) {
  if (sessionEnding) return;
  sessionEnding = true;
  stopSessionGuard();

  await client.auth.signOut({ scope: 'local' });
  await showSession(null);

  $('message').textContent = reason;
}

function startSessionGuard(userId, resetSession = false) {
  if (sessionGuardTimer) clearInterval(sessionGuardTimer);

  const startKey = sessionKey(userId, 'started_at');
  const activityKey = sessionKey(userId, 'last_activity');

  if (resetSession || !localStorage.getItem(startKey)) {
    localStorage.setItem(startKey, String(Date.now()));
  }

  sessionStartedAt = Number(localStorage.getItem(startKey));
  if (!localStorage.getItem(activityKey) || resetSession) {
    localStorage.setItem(activityKey, String(Date.now()));
  }

  recordSessionActivity();

  sessionGuardTimer = setInterval(async () => {
    if (!currentUser || currentUser.id !== userId || sessionEnding) return;

    const now = Date.now();
    const lastActivity = Number(localStorage.getItem(activityKey) || 0);

    if (now - sessionStartedAt >= SESSION_MAX_AGE) {
      await endSession('Sesi berakhir setelah 8 jam. Silakan login kembali.');
      return;
    }

    if (now - lastActivity >= SESSION_IDLE_LIMIT) {
      await endSession('Sesi berakhir karena tidak aktif selama 30 menit. Silakan login kembali.');
      return;
    }

    const { data, error } = await client
      .from('profiles')
      .select('is_active, password_reset_at')
      .eq('id', userId)
      .maybeSingle();

    if (error) return;

    if (!data || !data.is_active) {
      await endSession('Akun tidak aktif atau sesi tidak berlaku. Silakan login kembali.');
      return;
    }

    const markerKey = sessionKey(userId, 'password_reset_at');
    const savedMarker = localStorage.getItem(markerKey);
    const currentMarker = data.password_reset_at || '';

    if (savedMarker !== null && savedMarker !== currentMarker) {
      await endSession('Password akun telah direset. Silakan login kembali menggunakan password terbaru.');
    } else if (savedMarker === null) {
      localStorage.setItem(markerKey, currentMarker);
    }
  }, SESSION_CHECK_INTERVAL);
}

['pointerdown', 'keydown', 'touchstart', 'scroll'].forEach(eventName => {
  document.addEventListener(eventName, recordSessionActivity, { passive: true });
});
const pageInfo={home:['Beranda','Ringkasan dan daftar jadwal kegiatan'],input:['Input Jadwal','Tambahkan jadwal kegiatan baru'],import: ['Import Excel', 'Impor jadwal kegiatan dari file Excel'],program:['Program','Daftar program kegiatan'],staff:['Staff / Petugas','Daftar petugas terdaftar'],places:['Tempat','Daftar tempat kegiatan'],calendar:['Kalender','Kalender kerja dan kebijakan tanggal'],accounts:['Pengelolaan Akun', 'Kelola akun operator dan petugas'],settings:['Pengaturan','Pengaturan akun dan akses pengguna']};
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

function ensureAccountNav(isAdmin) {
  const sidebar = $('sidebar');
  const settingsButton = sidebar.querySelector(
    '.nav-btn[data-page="settings"]'
  );
  let button = sidebar.querySelector(
    '.nav-btn[data-page="accounts"]'
  );

  if (!isAdmin) {
    button?.remove();
    return;
  }

  if (!button) {
    button = document.createElement('button');
    button.type = 'button';
    button.className = 'nav-btn';
    button.dataset.page = 'accounts';
    button.textContent = '♙ Pengelolaan Akun';
    button.addEventListener('click', () => setPage('accounts'));

    if (settingsButton) {
      sidebar.insertBefore(button, settingsButton);
    } else {
      sidebar.appendChild(button);
    }
  }
}

function fallbackLogo(){const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M50 3 91 26v48L50 97 9 74V26Z" fill="#fff" stroke="#075c43" stroke-width="5"/><path d="M40 19h20v21h21v20H60v21H40V60H19V40h21Z" fill="#087f5b"/><circle cx="58" cy="49" r="8" fill="none" stroke="#fff" stroke-width="2"/><circle cx="70" cy="49" r="8" fill="none" stroke="#fff" stroke-width="2"/></svg>';$('headerLogo').src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg)}
$('headerLogo').addEventListener('error',fallbackLogo);$('togglePassword').addEventListener('click',()=>{const p=$('password');p.type=p.type==='password'?'text':'password';$('togglePassword').textContent=p.type==='password'?'Lihat':'Sembunyikan'});

async function showSession(session, freshLogin = false) {
  if (!session) {
    stopSessionGuard();
    currentProfile = null;
    currentUser = null;
    $('loginCard').classList.remove('hidden');
    $('dashboardCard').classList.add('hidden');
    return;
  }

  if (
  !freshLogin &&
  currentUser?.id === session.user.id &&
  !$('dashboardCard').classList.contains('hidden')
) {
  currentUser = session.user;
  return;
}

  currentUser = session.user;

  const { data, error } = await client
    .from('profiles')
    .select('full_name,role,staff_id,is_active,password_reset_at')
    .eq('id', session.user.id)
    .maybeSingle();

  if (error || !data || !data.is_active) {
    stopSessionGuard();
    await client.auth.signOut();
    currentProfile = null;
    currentUser = null;
    $('loginCard').classList.remove('hidden');
    $('dashboardCard').classList.add('hidden');
    $('message').textContent =
      'Profil belum tersedia atau akun belum aktif. Hubungi administrator.';
    return;
  }

  const markerKey = sessionKey(session.user.id, 'password_reset_at');

  if (freshLogin || localStorage.getItem(markerKey) === null) {
    localStorage.setItem(markerKey, data.password_reset_at || '');
  }

  currentProfile = data;

  $('loginCard').classList.add('hidden');
  $('dashboardCard').classList.remove('hidden');
  $('sideProfile').innerHTML =
    esc(data.full_name || 'Pengguna') +
    '<small id="sideRole">' + esc(data.role || 'petugas') + '</small>';
  $('roleChip').textContent = (data.role || 'petugas').toUpperCase();

  ensureAccountNav(data.role === 'admin');
  startSessionGuard(session.user.id, freshLogin);

  const savedPage = sessionStorage.getItem('jadwalCurrentPage') || 'home';
  setPage(pageInfo[savedPage] ? savedPage : 'home');
}

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

async function renderHome(){const c=$('dashboardContent');c.innerHTML='<div class="loading">Memuat jadwal...</div>';try{await loadMasters();allSchedules=await getScheduleData();const now=new Date();const month=String(now.getMonth()+1).padStart(2,'0');const prefix=now.getFullYear()+'-'+month;const thisMonth=allSchedules.filter(x=>x.activity_date.startsWith(prefix)).length;const staffCount=masterCache.staff.length;const programCount=masterCache.programs.length;c.innerHTML=`<div class="welcome-row"><div><h3>Selamat datang, ${esc(currentProfile?.full_name||'Pengguna')} 👋</h3><p>Kelola jadwal kegiatan Puskesmas dalam satu tempat.</p></div><button type="button" id="quickAdd">＋ Input Jadwal</button></div><div class="stats"><div class="stat"><div><div class="stat-top">Total jadwal valid</div><strong>${allSchedules.length}</strong></div><span class="stat-icon">▤</span></div><div class="stat"><div><div class="stat-top">Jadwal bulan ini</div><strong>${thisMonth}</strong></div><span class="stat-icon">▦</span></div><div class="stat"><div><div class="stat-top">Petugas aktif</div><strong>${staffCount}</strong></div><span class="stat-icon">♙</span></div></div><section class="panel"><div class="panel-head"><h3>Daftar Jadwal Kegiatan</h3><span class="badge">${programCount} program aktif</span></div>${monthYearFilters()}<div id="homeTable"></div><div class="pagination" id="homePagination"></div></section><div class="page-foot">Sistem Jadwal UPTD Puskesmas Geyer 2</div>`;$('quickAdd').addEventListener('click',()=>setPage('input'));$('applyFilters').addEventListener('click',()=>{currentPageNumber=1;drawHomeTable()});['filterMonth','filterYear'].forEach(id=>$(id).addEventListener('change',()=>{currentPageNumber=1;drawHomeTable()}));$('filterSearch').addEventListener('input',()=>{currentPageNumber=1;drawHomeTable()});drawHomeTable()}catch(e){c.innerHTML=`<div class="panel"><h3>Jadwal belum dapat dimuat</h3><p class="muted">Periksa izin baca tabel schedules dan tabel data master di Supabase.</p><div class="notice warn">Detail: ${esc(e.message||'Kesalahan tidak diketahui')}</div><button id="retryHome">Coba lagi</button></div>`;$('retryHome').addEventListener('click',renderHome)}}

function openScheduleEditor(item) {
  const c = $('dashboardContent');

  const options = (items, selectedId, label, value = 'id') =>
    items.map(x => `
      <option value="${esc(x[value])}"
        ${x[value] === selectedId ? 'selected' : ''}>
        ${esc(label(x))}
      </option>
    `).join('');

  c.insertAdjacentHTML('afterbegin', `
    <section class="panel" id="scheduleEditor">
      <h3>Edit Jadwal Kegiatan</h3>
      <form id="editScheduleForm">
        <label for="editDate">Tanggal kegiatan</label>
        <input id="editDate" type="date"
          value="${esc(item.activity_date)}" required>

        <label for="editProgram">Program</label>
        <select id="editProgram" required>
          ${options(masterCache.programs, item.program_id, x => x.program_name)}
        </select>

        <label for="editStaff">Petugas</label>
        <select id="editStaff" required>
          ${options(masterCache.staff, item.staff_id, x => x.full_name)}
        </select>

        <label for="editPlace">Tempat</label>
        <select id="editPlace" required>
          ${options(masterCache.places, item.place_id, x => x.place_name)}
        </select>

        <label for="editNotes">Catatan</label>
        <textarea id="editNotes" maxlength="500">${esc(item.notes || '')}</textarea>

        <div id="editScheduleMessage" role="status"></div>

        <div class="form-actions">
          <button type="button" class="secondary" id="cancelScheduleEdit">Batal</button>
          <button type="submit" id="updateScheduleButton">Simpan Perubahan</button>
        </div>
      </form>
    </section>
  `);

  $('cancelScheduleEdit').addEventListener('click', () => {
    $('scheduleEditor').remove();
  });

  $('editScheduleForm').addEventListener('submit', async e => {
    e.preventDefault();

    const btn = $('updateScheduleButton');
    const m = $('editScheduleMessage');
    const date = $('editDate').value;

    if (new Date(date + 'T12:00:00').getDay() === 0) {
      m.textContent = 'Jadwal tidak dapat dibuat pada hari Minggu.';
      return;
    }

    if (!confirm('Simpan perubahan jadwal ini?')) return;

    btn.disabled = true;
    m.textContent = 'Menyimpan perubahan...';

    const { error } = await client
      .from('schedules')
      .update({
        activity_date: date,
        program_id: $('editProgram').value,
        staff_id: $('editStaff').value,
        place_id: $('editPlace').value,
        notes: $('editNotes').value.trim() || null
      })
      .eq('id', item.id);

    if (error) {
      m.textContent = 'Perubahan gagal disimpan: ' + error.message;
      btn.disabled = false;
      return;
    }

    await renderHome();
    msg('Jadwal berhasil diperbarui.');
  });
}

function drawHomeTable() {
  const month = $('filterMonth')?.value || 'all';
  const year = $('filterYear')?.value || String(new Date().getFullYear());
  const q = ($('filterSearch')?.value || '').trim().toLowerCase();

  const rows = allSchedules.filter(x =>
    (month === 'all' || Number(x.activity_date.slice(5, 7)) === Number(month)) &&
    (year === 'all' || x.activity_date.startsWith(year)) &&
    [x.program_name, x.staff_name, x.place_name, x.notes]
      .some(v => String(v || '').toLowerCase().includes(q))
  );

  const isAdmin = currentProfile?.role === 'admin';
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  currentPageNumber = Math.min(currentPageNumber, pages);

  const start = (currentPageNumber - 1) * pageSize;
  const pageRows = rows.slice(start, start + pageSize);

  $('homeTable').innerHTML = pageRows.length
    ? `<div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>Program</th>
              <th>Petugas</th>
              <th>Tempat</th>
              <th>Catatan</th>
              <th>Status</th>
              ${isAdmin ? '<th>Aksi</th>' : ''}
            </tr>
          </thead>
          <tbody>
            ${pageRows.map(x => `
              <tr>
                <td>${esc(x.activity_date)}</td>
                <td>${esc(x.program_name)}</td>
                <td>${esc(x.staff_name)}</td>
                <td>${esc(x.place_name)}</td>
                <td>${esc(x.notes || '-')}</td>
                <td><span class="badge">Valid</span></td>
                ${isAdmin ? `
                  <td>
                    <div class="row-actions">
                      <button type="button" class="small-btn"
                        data-edit-schedule="${esc(x.id)}">Edit</button>
                      <button type="button" class="small-btn danger-btn"
                        data-delete-schedule="${esc(x.id)}">Hapus</button>
                    </div>
                  </td>` : ''}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>`
    : '<div class="empty">Tidak ada jadwal sesuai filter.</div>';

  $('homePagination').innerHTML = `
    <span>Menampilkan ${rows.length ? start + 1 : 0}–${Math.min(start + pageSize, rows.length)} dari ${rows.length} jadwal</span>
    <div class="pagination-actions">
      <button id="prevPage" ${currentPageNumber <= 1 ? 'disabled' : ''}>Sebelumnya</button>
      <span style="padding:8px">Halaman ${currentPageNumber}/${pages}</span>
      <button id="nextPage" ${currentPageNumber >= pages ? 'disabled' : ''}>Berikutnya</button>
    </div>`;

  $('prevPage').addEventListener('click', () => {
    currentPageNumber--;
    drawHomeTable();
  });

  $('nextPage').addEventListener('click', () => {
    currentPageNumber++;
    drawHomeTable();
  });

  document.querySelectorAll('[data-edit-schedule]').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = allSchedules.find(x => x.id === btn.dataset.editSchedule);
      if (item) openScheduleEditor(item);
    });
  });

  document.querySelectorAll('[data-delete-schedule]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.deleteSchedule;
      const item = allSchedules.find(x => x.id === id);
      if (!item) return;

      if (!confirm(
        `Hapus jadwal ${item.activity_date} untuk ${item.staff_name}?\nTindakan ini tidak dapat dibatalkan.`
      )) return;

      btn.disabled = true;

      const { error } = await client
        .from('schedules')
        .delete()
        .eq('id', id);

      if (error) {
        alert('Jadwal gagal dihapus: ' + error.message);
        btn.disabled = false;
        return;
      }

      await renderHome();
      msg('Jadwal berhasil dihapus.');
    });
  });
}

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
async function renderAccounts() {
  const c = $('dashboardContent');

  if (currentProfile?.role !== 'admin') {
    c.innerHTML = '<section class="panel">Akses khusus administrator.</section>';
    return;
  }

  c.innerHTML = '<div class="loading">Memuat akun...</div>';

  try {
    await loadMasters();

    const result = await client.functions.invoke('admin-manage-user', {
      body: { action: 'list' }
    });

    if (result.error) {
      throw new Error(
        result.data?.error || result.error.message ||
        'Gagal menghubungi fungsi pengelolaan akun.'
      );
    }

    if (!result.data?.success) {
      throw new Error(result.data?.error || 'Gagal memuat akun.');
    }

    const accounts = result.data.accounts || [];

    c.innerHTML = `
      <section class="panel">
        <div class="panel-head">
          <h3>Daftar Akun</h3>
          <button type="button" id="showCreateAccount">
            + Tambah Akun
          </button>
        </div>

        <div id="accountMessage" role="status" aria-live="polite"></div>
        <div id="accountEditor"></div>

        <div class="master-toolbar">
          <div>
            <label for="accountSearch">Cari akun</label>
            <input id="accountSearch" type="search"
              placeholder="Nama, email, role, atau petugas">
          </div>
        </div>

        <div id="accountTable"></div>
      </section>
    `;

    const editor = $('accountEditor');
    const message = $('accountMessage');
    const table = $('accountTable');

    function drawAccounts() {
      const q = $('accountSearch').value.trim().toLowerCase();

      const rows = accounts.filter(a =>
        [
          a.full_name,
          a.email,
          a.role,
          a.staff_name
        ].some(v => String(v || '').toLowerCase().includes(q))
      );

      table.innerHTML = rows.length
        ? `<div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Nama</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Petugas</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                ${rows.map(a => `
                  <tr>
                    <td>${esc(a.full_name || '-')}</td>
                    <td>${esc(a.email || '-')}</td>
                    <td>${esc(a.role || '-')}</td>
                    <td>${esc(a.staff_name || '-')}</td>
                    <td><span class="badge ${a.is_active ? '' : 'danger-btn'}">${a.is_active ? 'Aktif' : 'Nonaktif'}</span></td>
                    <td>
                      <div class="row-actions">
                        ${a.id === currentUser.id
                          ? '<span class="muted">Akun Anda</span>'
                          : `<button type="button"
                              class="small-btn ${a.is_active ? 'danger-btn' : ''}"
                              data-account-id="${esc(a.id)}"
                              data-active="${a.is_active ? 'true' : 'false'}">
                              ${a.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                            </button>`
                        }
                        ${['operator', 'petugas'].includes(a.role)
                          ? `<button type="button" class="small-btn"
                              data-reset-account-id="${esc(a.id)}">Reset Password</button>`
                          : ''}
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>`
        : '<div class="empty">Tidak ada akun yang cocok.</div>';

      table.querySelectorAll('[data-account-id]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.accountId;
          const nextActive = btn.dataset.active !== 'true';
          const account = accounts.find(a => a.id === id);

          if (!account) return;

          const actionText = nextActive ? 'mengaktifkan' : 'menonaktifkan';

          if (!confirm(
            `Yakin ingin ${actionText} akun ${account.full_name}?`
          )) return;

          btn.disabled = true;
          message.textContent = 'Memproses perubahan status...';

          try {
            const response = await client.functions.invoke(
              'admin-manage-user',
              {
                body: {
                  action: 'set_active',
                  user_id: id,
                  is_active: nextActive
                }
              }
            );

            if (response.error) {
              throw new Error(
                response.data?.error || response.error.message
              );
            }

            if (!response.data?.success) {
              throw new Error(
                response.data?.error || 'Status akun gagal diubah.'
              );
            }

            await renderAccounts();
            msg('Status akun berhasil diperbarui.');
            return;
          } catch (err) {
            message.style.color = '#b42318';
            message.textContent =
              'Gagal mengubah status: ' + (err.message || 'Kesalahan');
            btn.disabled = false;
          }
        });
      });

      table.querySelectorAll('[data-reset-account-id]').forEach(btn => {
        btn.addEventListener('click', () => {
          const account = accounts.find(a => a.id === btn.dataset.resetAccountId);
          if (account) showResetPasswordForm(account, editor, message);
        });
      });
    }

function showResetPasswordForm(account, editor, message) {
  editor.innerHTML = `
    <section class="master-editor">
      <h3>Reset Password Akun</h3>
      <p>
        Akun: <strong>${esc(account.full_name)}</strong><br>
        Email: ${esc(account.email || '-')}<br>
        Role: ${esc(account.role)}
      </p>

      <form id="resetPasswordForm">
        <div class="form-grid">
          <div>
            <label for="resetPassword">Password baru *</label>
            <input
              id="resetPassword"
              type="password"
              minlength="12"
              maxlength="128"
              autocomplete="new-password"
              required
            >
            <small>Minimal 12 karakter.</small>
          </div>

          <div>
            <label for="resetPasswordConfirm">
              Konfirmasi password baru *
            </label>
            <input
              id="resetPasswordConfirm"
              type="password"
              minlength="12"
              maxlength="128"
              autocomplete="new-password"
              required
            >
          </div>
        </div>

        <div class="form-actions">
          <button type="button" class="secondary"
            id="cancelResetPassword">Batal</button>
          <button type="submit" id="submitResetPassword">
            Simpan Password Baru
          </button>
        </div>
      </form>
    </section>
  `;

  $('cancelResetPassword').addEventListener('click', () => {
    editor.innerHTML = '';
  });

  $('resetPasswordForm').addEventListener('submit', async e => {
    e.preventDefault();

    const password = $('resetPassword').value;
    const confirmation = $('resetPasswordConfirm').value;
    const button = $('submitResetPassword');

    if (password.length < 12) {
      message.style.color = '#b42318';
      message.textContent = 'Password minimal 12 karakter.';
      return;
    }

    if (password !== confirmation) {
      message.style.color = '#b42318';
      message.textContent =
        'Konfirmasi password tidak sama.';
      return;
    }

    if (!confirm(
      `Reset password akun ${account.full_name}?`
    )) return;

    button.disabled = true;
    button.textContent = 'Memproses...';
    message.textContent = '';

    try {
      const response = await client.functions.invoke(
        'admin-manage-user',
        {
          body: {
            action: 'reset_password',
            user_id: account.id,
            password
          }
        }
      );

      if (response.error) {
        throw new Error(
          response.data?.error || response.error.message
        );
      }

      if (!response.data?.success) {
        throw new Error(
          response.data?.error || 'Reset password gagal.'
        );
      }

      editor.innerHTML = '';
      message.style.color = '#087f5b';
      message.textContent =
        `Password akun ${account.full_name} berhasil direset.`;

    } catch (err) {
      message.style.color = '#b42318';
      message.textContent =
        'Reset password gagal: ' +
        (err.message || 'Kesalahan tidak diketahui');

      button.disabled = false;
      button.textContent = 'Simpan Password Baru';
    }
  });
}
    function showCreateForm() {
      editor.innerHTML = `
        <section class="master-editor">
          <h3>Tambah Akun Baru</h3>
          <form id="createAccountForm">
            <div class="form-grid">
              <div>
                <label for="accountName">Nama lengkap *</label>
                <input id="accountName" required maxlength="160">
              </div>
              <div>
                <label for="accountEmail">Email login *</label>
                <input id="accountEmail" type="email" required
                  autocomplete="off">
              </div>
              <div>
                <label for="accountPassword">Password awal *</label>
                <input id="accountPassword" type="password"
                  minlength="12" required autocomplete="new-password">
                <small>Minimal 12 karakter.</small>
              </div>
              <div>
                <label for="accountRole">Role *</label>
                <select id="accountRole" required>
                  <option value="operator">Operator</option>
                  <option value="petugas">Petugas</option>
                </select>
              </div>
              <div id="staffSelectWrap" style="display:none">
                <label for="accountStaff">Hubungkan ke petugas *</label>
                <select id="accountStaff">
                  <option value="">Pilih petugas</option>
                  ${masterCache.staff.map(s => `
                    <option value="${esc(s.id)}">
                      ${esc(s.full_name)}${s.employee_code
                        ? ' — ' + esc(s.employee_code) : ''}
                    </option>
                  `).join('')}
                </select>
              </div>
            </div>
            <div class="form-actions">
              <button type="button" class="secondary" id="cancelCreateAccount">
                Batal
              </button>
              <button type="submit" id="saveAccountButton">
                Buat Akun
              </button>
            </div>
          </form>
        </section>
      `;

      const role = $('accountRole');
      const staffWrap = $('staffSelectWrap');
      const staffSelect = $('accountStaff');

      function updateStaffField() {
        const isPetugas = role.value === 'petugas';
        staffWrap.style.display = isPetugas ? '' : 'none';
        staffSelect.required = isPetugas;
        if (!isPetugas) staffSelect.value = '';
      }

      role.addEventListener('change', updateStaffField);
      updateStaffField();

      $('cancelCreateAccount').addEventListener('click', () => {
        editor.innerHTML = '';
      });

      $('createAccountForm').addEventListener('submit', async e => {
        e.preventDefault();

        const btn = $('saveAccountButton');
        const password = $('accountPassword').value;

        if (password.length < 12) {
          message.style.color = '#b42318';
          message.textContent = 'Password minimal 12 karakter.';
          return;
        }

        btn.disabled = true;
        btn.textContent = 'Membuat akun...';
        message.textContent = '';

        try {
          const response = await client.functions.invoke(
            'admin-manage-user',
            {
              body: {
                action: 'create',
                full_name: $('accountName').value.trim(),
                email: $('accountEmail').value.trim(),
                password,
                role: role.value,
                staff_id: role.value === 'petugas'
                  ? staffSelect.value : null
              }
            }
          );

          if (response.error) {
            throw new Error(
              response.data?.error || response.error.message
            );
          }

          if (!response.data?.success) {
            throw new Error(
              response.data?.error || 'Akun gagal dibuat.'
            );
          }

          await renderAccounts();
          msg('Akun baru berhasil dibuat.');
        } catch (err) {
          message.style.color = '#b42318';
          message.textContent =
            'Akun belum dibuat: ' + (err.message || 'Kesalahan');
          btn.disabled = false;
          btn.textContent = 'Buat Akun';
        }
      });
    }

    $('accountSearch').addEventListener('input', drawAccounts);
    $('showCreateAccount').addEventListener('click', showCreateForm);

    drawAccounts();
  } catch (err) {
    c.innerHTML = `
      <section class="panel">
        <h3>Daftar akun gagal dimuat</h3>
        <div class="notice warn">${esc(err.message || 'Kesalahan tidak diketahui')}</div>
        <button type="button" id="retryAccounts">Coba Lagi</button>
      </section>
    `;

    $('retryAccounts').addEventListener('click', renderAccounts);
  }
}

function renderImport() {
  const c = $('dashboardContent');

  c.innerHTML = `
    <div class="welcome-row">
      <div>
        <h3>Import Jadwal dari Excel</h3>
        <p>Unggah file .xlsx untuk menambahkan banyak jadwal sekaligus.</p>
      </div>
    </div>

    <section class="panel">
      <div class="notice">
        Format kolom: Tanggal, Nama Program, Nama Petugas,
        Nama Tempat, Catatan. Nama harus sesuai dengan data master aktif.
      </div>

      <p>
        <a href="template_import_jadwal_puskesmas.xlsx"
           download="template_import_jadwal_puskesmas.xlsx">
          Unduh Template Excel
        </a>
      </p>

      <label for="importFile">Pilih file Excel (.xlsx)</label>
      <input id="importFile" type="file"
             accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet">

      <div class="form-actions">
        <button type="button" id="checkImport">Periksa File</button>
      </div>

      <div id="importMessage" role="status" aria-live="polite"></div>
      <div id="importPreview"></div>
    </section>
  `;

  let preparedRows = [];

  const message = (text, error = false) => {
    const el = $('importMessage');
    el.style.color = error ? '#b42318' : '#087f5b';
    el.textContent = text;
  };

  const normalize = value =>
    String(value ?? '').trim().toLocaleLowerCase('id-ID');

  
function parseImportDate(value) {
  // Jika Excel memberikan objek Date, ambil tanggal lokal.
  if (value instanceof Date && !isNaN(value)) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  // Jika Excel memberikan angka serial tanggal.
  if (typeof value === 'number' && Number.isFinite(value)) {
    const date = XLSX.SSF.parse_date_code(value);

    if (!date) return null;

    const year = date.y;
    const month = String(date.m).padStart(2, '0');
    const day = String(date.d).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  const s = String(value ?? '').trim();

  // Format YYYY-MM-DD.
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) {
    const d = new Date(+m[1], +m[2] - 1, +m[3]);

    if (
      d.getFullYear() === +m[1] &&
      d.getMonth() === +m[2] - 1 &&
      d.getDate() === +m[3]
    ) {
      return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
    }
  }

  // Format DD/MM/YYYY.
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const d = new Date(+m[3], +m[2] - 1, +m[1]);

    if (
      d.getFullYear() === +m[3] &&
      d.getMonth() === +m[2] - 1 &&
      d.getDate() === +m[1]
    ) {
      return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    }
  }

  return null;
}


  $('checkImport').addEventListener('click', async () => {
    preparedRows = [];
    $('importPreview').innerHTML = '';

    const file = $('importFile').files[0];

    if (!file) {
      message('Pilih file Excel terlebih dahulu.', true);
      return;
    }

    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      message('Gunakan file Excel berformat .xlsx.', true);
      return;
    }

    if (typeof XLSX === 'undefined') {
      message('Pustaka Excel belum termuat. Periksa koneksi internet dan script XLSX di index.html.', true);
      return;
    }

    const btn = $('checkImport');
    btn.disabled = true;

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, {
        type: 'array',
        cellDates: false
        });

      const sheet = workbook.Sheets['Jadwal'];

      if (!sheet) {
        throw new Error('Sheet bernama "Jadwal" tidak ditemukan.');
      }

      const data = XLSX.utils.sheet_to_json(sheet, {
        defval: '',
        raw: true
      });

      if (!data.length) {
        throw new Error('Sheet Jadwal belum berisi data.');
      }

      const requiredHeaders = [
        'Tanggal',
        'Nama Program',
        'Nama Petugas',
        'Nama Tempat',
        'Catatan'
      ];

      const actualHeaders = Object.keys(data[0]);

      const missing = requiredHeaders.filter(
        h => !actualHeaders.includes(h)
      );

      if (missing.length) {
        throw new Error('Kolom tidak sesuai template. Kolom yang tidak ditemukan: ' + missing.join(', '));
      }

      await loadMasters();

      const programs = new Map(
        masterCache.programs.map(x => [normalize(x.program_name), x])
      );

      const staff = new Map(
        masterCache.staff.map(x => [normalize(x.full_name), x])
      );

      const places = new Map(
        masterCache.places.map(x => [normalize(x.place_name), x])
      );

      const errors = [];
      const warnings = [];
      const seen = new Set();

      data.forEach((row, index) => {
        const excelRow = index + 2;
        const rawValues = requiredHeaders.map(h => String(row[h] ?? '').trim());

        // Lewati baris kosong.
        if (rawValues.every(v => !v)) return;

        // Baris contoh template harus dihapus; dilewati agar tidak masuk jadwal.
        if (rawValues.some(v => v.toUpperCase().startsWith('CONTOH:'))) {
          return;
        }

        const date = parseImportDate(row['Tanggal']);
        const program = programs.get(normalize(row['Nama Program']));
        const person = staff.get(normalize(row['Nama Petugas']));
        const place = places.get(normalize(row['Nama Tempat']));
        const notes = String(row['Catatan'] ?? '').trim();

        const rowErrors = [];

        if (!date) rowErrors.push('Tanggal tidak valid');
        if (!program) rowErrors.push('Nama program tidak ditemukan atau tidak aktif');
        if (!person) rowErrors.push('Nama petugas tidak ditemukan atau tidak aktif');
        if (!place) rowErrors.push('Nama tempat tidak ditemukan atau tidak aktif');
        if (notes.length > 500) rowErrors.push('Catatan melebihi 500 karakter');

        if (date && new Date(date + 'T12:00:00').getDay() === 0) {
          rowErrors.push('Hari Minggu tidak diperbolehkan');
        }

        if (
          currentProfile?.role === 'petugas' &&
          person &&
          person.id !== currentProfile.staff_id
        ) {
          rowErrors.push('Petugas hanya boleh mengimpor jadwal untuk dirinya sendiri');
        }

        if (date && person) {
          const key = `${date}|${person.id}`;

          if (seen.has(key)) {
            rowErrors.push('Petugas yang sama muncul lebih dari sekali pada tanggal ini di file');
          }

          seen.add(key);
        }

        if (rowErrors.length) {
          errors.push(`Baris ${excelRow}: ${rowErrors.join('; ')}`);
          return;
        }

        preparedRows.push({
          excelRow,
          activity_date: date,
          program_id: program.id,
          staff_id: person.id,
          place_id: place.id,
          notes: notes || null,
          status: 'valid'
        });
      });

      if (!preparedRows.length) {
        message(
          'Tidak ada baris jadwal yang siap diimpor. Pastikan baris contoh sudah dihapus dan data terisi.',
          true
        );
        $('importPreview').innerHTML = errors.length
          ? `<div class="notice warn">${errors.map(esc).join('<br>')}</div>`
          : '';
        return;
      }

      // Periksa kalender dan jadwal yang sudah ada sebelum menyimpan.
      const checkedRows = [];

      for (const row of preparedRows) {
        const { data: day, error: dayError } = await client
          .from('calendar_days')
          .select('day_description,schedule_policy')
          .eq('calendar_date', row.activity_date)
          .maybeSingle();

        if (dayError) throw dayError;

        if (!day) {
          errors.push(`Baris ${row.excelRow}: tanggal tidak ditemukan di kalender`);
          continue;
        }

        if (day.schedule_policy === 'block') {
          errors.push(`Baris ${row.excelRow}: tanggal diblokir (${day.day_description || row.activity_date})`);
          continue;
        }

        const { data: duplicate, error: duplicateError } = await client
          .from('schedules')
          .select('id')
          .eq('activity_date', row.activity_date)
          .eq('staff_id', row.staff_id)
          .limit(1);

        if (duplicateError) throw duplicateError;

        if (duplicate?.length) {
          errors.push(`Baris ${row.excelRow}: petugas sudah memiliki jadwal pada tanggal tersebut`);
          continue;
        }

        const dow = new Date(row.activity_date + 'T12:00:00').getDay();

        if (dow === 6 || day.schedule_policy === 'warning') {
          warnings.push(
            `Baris ${row.excelRow}: ${row.activity_date} memerlukan konfirmasi`
          );
        }

        checkedRows.push(row);
      }

      preparedRows = checkedRows;

      $('importPreview').innerHTML = `
        <div class="notice">
          <strong>Ringkasan pemeriksaan</strong><br>
          Siap diimpor: ${preparedRows.length} baris<br>
          Baris bermasalah: ${errors.length}<br>
          Perlu konfirmasi tanggal: ${warnings.length}
        </div>
        ${errors.length
          ? `<div class="notice warn"><strong>Perbaiki baris berikut:</strong><br>${errors.map(esc).join('<br>')}</div>`
          : ''}
        ${warnings.length
          ? `<div class="notice warn">${warnings.map(esc).join('<br>')}</div>`
          : ''}
        <button type="button" id="executeImport" ${preparedRows.length ? '' : 'disabled'}>
          Simpan ${preparedRows.length} Jadwal
        </button>
      `;

      message('Pemeriksaan selesai. Periksa ringkasan sebelum menyimpan.');

      $('executeImport').addEventListener('click', async () => {
        if (!preparedRows.length) return;

        if (errors.length) {
          message('Ada baris bermasalah. Perbaiki file dan periksa ulang sebelum mengimpor.', true);
          return;
        }

        if (warnings.length && !confirm(
          'Ada jadwal pada hari Sabtu atau tanggal peringatan. Tetap lanjutkan impor?'
        )) return;

        if (!confirm(`Simpan ${preparedRows.length} jadwal ke aplikasi?`)) return;

        const saveBtn = $('executeImport');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Menyimpan...';

        let success = 0;
        const failures = [];

        for (const row of preparedRows) {
          const { excelRow, ...payload } = row;

          const { error } = await client
            .from('schedules')
            .insert(payload);

          if (error) {
            let detail = error.message || 'Kesalahan tidak diketahui';

            if (/duplicate key|unique constraint/i.test(detail)) {
              detail = 'Petugas sudah memiliki jadwal pada tanggal tersebut';
            } else if (/row-level security|permission denied/i.test(detail)) {
              detail = 'Akun tidak memiliki izin menyimpan jadwal ini';
            }

            failures.push(`Baris ${excelRow}: ${detail}`);
          } else {
            success++;
          }
        }

        $('importPreview').innerHTML = `
          <div class="notice">
            Impor selesai. Berhasil disimpan: ${success}.
            Gagal disimpan: ${failures.length}.
          </div>
          ${failures.length
            ? `<div class="notice warn">${failures.map(esc).join('<br>')}</div>`
            : ''}
          <button type="button" id="backToSchedule">Lihat Jadwal</button>
        `;

        message('Proses impor selesai.');

        $('backToSchedule').addEventListener('click', () => setPage('home'));
      });

    } catch (err) {
      message('File belum dapat diperiksa: ' + (err.message || 'Kesalahan tidak diketahui'), true);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Periksa File';
    }
  });
}

function renderPage(page){if(page==='home')return renderHome();if(page==='input')return renderInput();if (page === 'import') return renderImport();if(page==='program')return renderMaster('programs');if(page==='staff')return renderMaster('staff');if(page==='places')return renderMaster('places');if(page==='calendar')return renderCalendar();if (page === 'accounts') return renderAccounts();if(page==='settings')return renderSettings()}
client.auth.onAuthStateChange((_event,session)=>{showSession(session)});client.auth.getSession().then(({data,error})=>{if(error){$('message').textContent='Sesi tidak dapat diperiksa. Muat ulang halaman.';return}showSession(data.session)});
