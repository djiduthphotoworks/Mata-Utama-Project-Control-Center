/* ==========================================================================
   Project Control Center — HQ Jakarta  (MOCKUP FRONTEND)

   - Tidak terhubung ke Firebase/Firestore atau backend apa pun.
   - Semua data adalah DATA DEMO yang disimpan di localStorage browser ini.
   - Tidak ada autentikasi: peran "Admin HQ (Demo)" hanyalah label tampilan.

   Peta isi file:
     1. Konstanta & utilitas        6. Notifikasi (data)
     2. Penyimpanan lokal & tema    7. Chat (ChatStore — sumber data)
     3. Data demo (seed)            8. UI: toast, modal, form, router, chart
     4. Store (state proyek)        9. Halaman (views)
     5. Perhitungan progres & stat 10. Aksi & inisialisasi
   ========================================================================== */

'use strict';

(function () {

  /* ==========================================================================
     1. KONSTANTA & UTILITAS
     ========================================================================== */
  const KEYS = { state: 'pcc.state.v1', theme: 'pcc.theme' };
  const STATE_VERSION = 1;
  const ADMIN = { id: 'u-admin', name: 'Admin HQ (Demo)', role: 'Admin Kantor Pusat' };
  const STATUSES = ['Perencanaan', 'Berjalan', 'Selesai', 'Terlambat'];
  const STATUS_CLS = { Perencanaan: 'plan', Berjalan: 'run', Selesai: 'done', Terlambat: 'late' };
  const STATUS_COLOR = { Perencanaan: 'var(--c-plan)', Berjalan: 'var(--c-run)', Selesai: 'var(--c-done)', Terlambat: 'var(--c-late)' };
  const ROLES = ['Admin Kantor Pusat', 'Project Manager', 'Kepala Divisi', 'Supervisor Proyek', 'Tim Lapangan'];
  const NOTIF_TYPES = {
    progress: { label: 'Update Progres', icon: 'trend', tone: 'tone-blue' },
    status: { label: 'Perubahan Status', icon: 'flag', tone: 'tone-violet' },
    late: { label: 'Pekerjaan Terlambat', icon: 'alert', tone: 'tone-red' },
    message: { label: 'Pesan Baru', icon: 'chat', tone: 'tone-green' },
    instruction: { label: 'Instruksi Admin HQ', icon: 'send', tone: 'tone-amber' },
    activity: { label: 'Aktivitas Penting', icon: 'checkcircle', tone: 'tone-blue' },
    announcement: { label: 'Pengumuman', icon: 'flag', tone: 'tone-amber' },
    direct: { label: 'Pesan Langsung', icon: 'chat', tone: 'tone-green' }
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = prefix => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
  const round = (n, d = 1) => { const f = 10 ** d; return Math.round((n + Number.EPSILON) * f) / f; };
  const pad = n => String(n).padStart(2, '0');
  const toISODate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const addDays = (n, base = new Date()) => { const d = new Date(base); d.setDate(d.getDate() + n); return d; };
  const parseDate = s => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s || '')) return null;
    const [y, m, d] = s.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.getMonth() === m - 1 && dt.getDate() === d ? dt : null;
  };
  const fmtDate = s => { const d = parseDate(s); return d ? d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'; };
  const fmtDateTime = iso => new Date(iso).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  const fmtTime = iso => new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  const fmtNum = n => Number(n).toLocaleString('id-ID', { maximumFractionDigits: 1 });
  const fmtRp = n => 'Rp ' + Math.round(n).toLocaleString('id-ID');
  const initials = name => String(name).replace(/\(.*?\)/g, '').trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase();
  const icon = (name, cls = '') => `<svg class="icon ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const fmtRel = iso => {
    const diff = Date.now() - new Date(iso).getTime();
    const min = Math.round(diff / 60000);
    if (min < 1) return 'baru saja';
    if (min < 60) return `${min} mnt lalu`;
    const h = Math.round(min / 60);
    if (h < 24) return `${h} jam lalu`;
    const d = Math.round(h / 24);
    return d === 1 ? 'kemarin' : `${d} hari lalu`;
  };
  const dayLabel = iso => {
    const d = new Date(iso); const today = new Date();
    const same = (a, b) => a.toDateString() === b.toDateString();
    if (same(d, today)) return 'Hari ini';
    if (same(d, addDays(-1))) return 'Kemarin';
    return d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });
  };

  /* ==========================================================================
     2. PENYIMPANAN LOKAL & TEMA
     ========================================================================== */
  const LocalStore = {
    available: true,
    read(key, fallback) {
      try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
      catch (e) { this.available = false; return fallback; }
    },
    write(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); return true; }
      catch (e) { this.available = false; return false; }
    },
    readRaw(key) { try { return localStorage.getItem(key); } catch (e) { return null; } },
    writeRaw(key, value) { try { localStorage.setItem(key, value); } catch (e) { /* diabaikan */ } },
    remove(key) { try { localStorage.removeItem(key); } catch (e) { /* diabaikan */ } }
  };

  const Theme = {
    current() { return document.documentElement.dataset.theme; },
    init() {
      let t = LocalStore.readRaw(KEYS.theme);
      if (t !== 'dark' && t !== 'light') t = window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      this.apply(t);
    },
    apply(t) {
      document.documentElement.dataset.theme = t;
      const meta = $('meta[name="theme-color"]');
      if (meta) meta.content = t === 'dark' ? '#0a1120' : '#f4f6fa';
      const use = $('#themeIcon');
      if (use) use.setAttribute('href', t === 'dark' ? '#i-sun' : '#i-moon');
      const btn = $('#themeBtn');
      if (btn) {
        btn.setAttribute('aria-label', t === 'dark' ? 'Ganti ke mode terang' : 'Ganti ke mode gelap');
        btn.title = t === 'dark' ? 'Ganti ke mode terang' : 'Ganti ke mode gelap';
      }
      $$('input[name="theme"]').forEach(r => { r.checked = r.value === t; });
    },
    set(t) { this.apply(t); LocalStore.writeRaw(KEYS.theme, t); },
    toggle() { this.set(this.current() === 'dark' ? 'light' : 'dark'); }
  };

  /* ==========================================================================
     3. DATA DEMO (SEED) — seluruhnya fiktif dan ditandai demo
     ========================================================================== */
  function buildSeed() {
    const now = Date.now();
    const hrs = h => new Date(now - h * 3600e3).toISOString();
    const year = new Date().getFullYear();
    const sc = (name, weight, actual, note = '') => ({ id: uid('s'), name, weight, actual, note });
    const konstruksi = (a, b, c) => [sc('Pekerjaan Struktur', 40, a), sc('Pekerjaan Arsitektur', 35, b), sc('Pekerjaan MEP', 25, c)];

    const defs = [
      { name: 'Gedung Serbaguna Tahap 2', client: 'PT Nusa Sejahtera', city: 'Makassar', address: 'Jl. Contoh Raya No. 12, Makassar, Sulawesi Selatan', lat: -5.1477, lng: 119.4327, pm: 'Andi Setiawan', sup: 'Rahmat Hidayat', s: -120, e: 60, status: 'Berjalan', budget: 8500000000, desc: 'Pembangunan gedung serbaguna dua lantai beserta fasilitas pendukung.', scope: konstruksi(75, 40, 20) },
      { name: 'Interior Kantor Regional Jakarta', client: 'PT Maju Bersama', city: 'Jakarta', address: 'Jl. Contoh Sudirman Kav. 5, Jakarta Selatan', lat: -6.2615, lng: 106.8106, pm: 'Citra Dewi', sup: 'Budi Santoso', s: -75, e: 45, status: 'Berjalan', budget: 2400000000, desc: 'Fit-out interior lantai 8 untuk kantor regional.', scope: [sc('Partisi', 25, 100), sc('Plafon', 25, 80), sc('Furnitur', 30, 45, 'Menunggu kedatangan kursi kerja'), sc('Finishing', 20, 10)] },
      { name: 'Renovasi Gerai Bandung', client: 'CV Karya Mandiri', city: 'Bandung', address: 'Jl. Contoh Asia Afrika No. 8, Bandung, Jawa Barat', lat: -6.9175, lng: 107.6191, pm: 'Dedi Kurniawan', sup: 'Rina Marlina', s: -150, e: -20, status: 'Selesai', budget: 950000000, desc: 'Renovasi total gerai ritel, termasuk interior dan elektrikal.', scope: [sc('Pembongkaran', 15, 100), sc('Interior', 45, 100), sc('Elektrikal', 25, 100), sc('Finishing', 15, 100)] },
      { name: 'Fit-out Pusat Perbelanjaan Surabaya', client: 'PT Retail Prima', city: 'Surabaya', address: 'Jl. Contoh Basuki Rahmat No. 21, Surabaya, Jawa Timur', lat: -7.2575, lng: 112.7521, pm: 'Eka Prasetya', sup: 'Yoga Pratama', s: -140, e: -12, status: 'Terlambat', budget: 5200000000, desc: 'Fit-out unit tenant utama pada pusat perbelanjaan.', scope: [sc('Struktur Ringan', 20, 90), sc('Plafon', 20, 55), sc('Lantai', 25, 40, 'Material lantai mundur dari pemasok'), sc('MEP', 25, 30), sc('Finishing', 10, 0)] },
      { name: 'Gudang Distribusi Medan', client: 'PT Logistik Utama', city: 'Medan', address: 'Jl. Contoh Industri No. 3, Medan, Sumatera Utara', lat: 3.5952, lng: 98.6722, pm: 'Fajar Rahman', sup: 'Hendra Lubis', s: -90, e: 75, status: 'Berjalan', budget: 6700000000, desc: 'Gudang distribusi struktur baja dengan area bongkar muat.', scope: [sc('Pondasi', 30, 100), sc('Struktur Baja', 40, 70), sc('Atap', 20, 30), sc('Lantai & Utilitas', 10, 0)] },
      { name: 'Renovasi Kantor Cabang Semarang', client: 'PT Cakra Digital', city: 'Semarang', address: 'Jl. Contoh Pemuda No. 40, Semarang, Jawa Tengah', lat: -6.9667, lng: 110.4167, pm: 'Galih Permana', sup: 'Wulan Sari', s: -110, e: -5, status: 'Terlambat', budget: 3100000000, desc: 'Renovasi kantor cabang dua lantai.', scope: [sc('Pekerjaan Arsitektur', 50, 60), sc('Pekerjaan MEP', 30, 40), sc('Finishing', 20, 10)] },
      { name: 'Interior Showroom Palembang', client: 'PT Otomotif Sentosa', city: 'Palembang', address: '', lat: null, lng: null, pm: 'Hendra Wijaya', sup: 'Dimas Anggara', s: 10, e: 150, status: 'Perencanaan', budget: 1800000000, desc: 'Perencanaan interior showroom. Bobot scope masih dibahas (total belum 100%).', scope: [sc('Partisi', 30, 0), sc('Furnitur', 40, 0), sc('Finishing', 20, 0, 'Bobot belum disepakati')] },
      { name: 'Ruko Tiga Lantai Denpasar', client: 'PT Bali Properti', city: 'Denpasar', address: 'Jl. Contoh Sunset No. 17, Denpasar, Bali', lat: -8.6705, lng: 115.2126, pm: 'Citra Dewi', sup: 'Komang Adi', s: -60, e: 90, status: 'Berjalan', budget: 4300000000, desc: 'Pembangunan ruko tiga lantai.', scope: konstruksi(85, 60, 50) }
    ];

    const projects = defs.map((d, i) => {
      const id = `p${i + 1}`;
      const start = toISODate(addDays(d.s));
      const lows = d.scope.filter(x => x.actual < 100).sort((a, b) => a.actual - b.actual);
      const acts = [
        { type: 'progress', user: d.sup, text: `Progres “${d.scope[0].name}” diperbarui menjadi ${d.scope[0].actual}%`, h: 2 + i * 3 },
        { type: 'foto', user: d.sup, text: 'Foto bukti progres ditambahkan (placeholder demo)', h: 8 + i * 4 },
        { type: 'catatan', user: d.pm, text: `Rapat koordinasi mingguan dengan ${d.client} dilaksanakan`, h: 30 + i * 6 }
      ];
      if (d.status === 'Terlambat' && lows[0]) acts.unshift({ type: 'late', user: d.pm, text: `Pekerjaan “${lows[0].name}” tertinggal dari rencana`, h: 1 + i });
      if (d.status === 'Selesai') acts.unshift({ type: 'status', user: d.pm, text: 'Status proyek diubah menjadi Selesai', h: 24 * 20 });
      const progressNow = d.scope.reduce((s, x) => s + x.weight * x.actual / 100, 0);
      return {
        id, code: `PCC-${year}-${pad(i + 1).padStart(3, '0')}`, name: d.name, client: d.client, description: d.desc,
        location: d.address, lat: d.lat, lng: d.lng, pm: d.pm, supervisor: d.sup,
        startDate: start, endDate: toISODate(addDays(d.e)), budget: d.budget, status: d.status, notes: '',
        createdAt: new Date(addDays(d.s).setHours(9, 0, 0, 0)).toISOString(), demo: true, certified: null,
        scope: d.scope,
        milestones: [
          { id: uid('ms'), text: 'Mobilisasi & survei lokasi', date: start, done: d.status !== 'Perencanaan' },
          { id: uid('ms'), text: 'Capaian progres 50%', date: toISODate(addDays(Math.round((d.s + d.e) / 2))), done: progressNow >= 50 },
          { id: uid('ms'), text: 'Serah terima pekerjaan', date: toISODate(addDays(d.e)), done: d.status === 'Selesai' }
        ],
        activities: acts.map(a => ({ id: uid('a'), at: hrs(a.h), user: a.user, type: a.type, text: a.text })),
        locationLog: []
      };
    });

    /* Pengguna demo */
    const mkUser = (id, name, role, projectIds, active = true) => ({
      id, name, email: name.toLowerCase().replace(/\(.*?\)/g, '').trim().replace(/[^a-z\s]/g, '').replace(/\s+/g, '.') + '@example.com',
      role, projects: projectIds, active, demo: true
    });
    const users = [
      mkUser(ADMIN.id, ADMIN.name, 'Admin Kantor Pusat', projects.map(p => p.id)),
      mkUser('u-kadiv', 'Bambang Hartono (Demo)', 'Kepala Divisi', projects.map(p => p.id)),
      ...projects.map(p => mkUser(`u-sup-${p.id}`, p.supervisor, 'Supervisor Proyek', [p.id])),
      mkUser('u-tim-1', 'Joko Susilo (Tim)', 'Tim Lapangan', ['p1']),
      mkUser('u-tim-2', 'Siti Aminah (Tim)', 'Tim Lapangan', ['p4', 'p6'], false)
    ];

    /* Chat demo: [dariSupervisor, teks, jamLalu, sudahDibacaAdmin] — p7 sengaja kosong */
    const chatDefs = {
      p1: [[1, 'Selamat pagi, pengecoran pelat lantai 2 selesai kemarin sore.', 26, 1], [0, 'Terima kasih. Mohon kirim foto bukti dan hasil uji slump.', 25, 1], [1, 'Baik, foto bukti kami unggah hari ini.', 22, 1], [1, 'Update: perakitan besi kolom lantai 3 dimulai besok pagi.', 3, 0]],
      p2: [[1, 'Partisi lantai 8 sudah 100%, plafon lanjut hari ini.', 20, 1], [0, 'Baik. Bagaimana status kedatangan furnitur?', 19, 1], [1, 'Pemasok menjanjikan pengiriman minggu depan.', 18, 1]],
      p3: [[1, 'Serah terima gerai sudah ditandatangani klien.', 480, 1], [0, 'Terima kasih, mohon arsipkan berita acaranya.', 478, 1]],
      p4: [[1, 'Material lantai dari pemasok mundur 5 hari.', 30, 1], [0, 'Mohon kirim jadwal baru tertulis beserta dampaknya ke target.', 28, 1], [1, 'Jadwal baru sudah kami kirim lewat email, mohon dicek.', 4, 0], [1, 'Kami juga butuh keputusan soal tambahan tim finishing.', 2, 0]],
      p5: [[1, 'Struktur baja bentang utama terpasang 70%.', 12, 1], [0, 'Baik, jaga keselamatan kerja di ketinggian.', 11, 1]],
      p6: [[1, 'Pekerjaan MEP tertahan menunggu keputusan layout panel.', 40, 1], [0, 'Instruksi: layout panel mengikuti gambar revisi terakhir.', 38, 1], [1, 'Siap, kami lanjutkan sesuai gambar revisi.', 5, 0]],
      p8: [[1, 'Pekerjaan struktur lantai 3 sedang berjalan.', 9, 1], [0, 'Baik, mohon laporkan bila ada kendala cuaca.', 8, 1]]
    };
    const messages = [];
    Object.entries(chatDefs).forEach(([pid, rows]) => {
      const p = projects.find(x => x.id === pid);
      const supId = `u-sup-${pid}`;
      rows.forEach(([fromSup, text, h, readAdmin]) => {
        const lastAdminAfter = rows.some(r => !r[0] && r[2] < h); // pesan admin yang lebih baru
        messages.push(fromSup ? {
          id: uid('m'), projectId: pid, senderId: supId, senderName: p.supervisor, senderRole: 'Supervisor Proyek',
          message: text, createdAt: hrs(h), readBy: readAdmin ? [supId, ADMIN.id] : [supId], attachmentUrl: null, kind: 'message', demo: true
        } : {
          id: uid('m'), projectId: pid, senderId: ADMIN.id, senderName: ADMIN.name, senderRole: ADMIN.role,
          message: text, createdAt: hrs(h), readBy: lastAdminAfter || h > 0 ? [ADMIN.id, supId] : [ADMIN.id], attachmentUrl: null,
          kind: /^Instruksi/.test(text) ? 'instruction' : 'message', demo: true
        });
      });
    });

    /* Notifikasi demo */
    const n = (type, pid, title, text, h, read) => ({ id: uid('n'), type, projectId: pid, title, text, at: hrs(h), read, demo: true });
    const byId = id => projects.find(p => p.id === id);
    const notifications = [
      n('late', 'p4', 'Pekerjaan terlambat: Lantai', `${byId('p4').name} melewati target selesai. Pekerjaan “Lantai” baru 40%.`, 1, false),
      n('message', 'p4', `Pesan baru dari ${byId('p4').supervisor}`, 'Kami juga butuh keputusan soal tambahan tim finishing.', 2, false),
      n('progress', 'p1', 'Update progres proyek', `${byId('p1').name}: progres Struktur diperbarui oleh supervisor.`, 3, false),
      n('message', 'p1', `Pesan baru dari ${byId('p1').supervisor}`, 'Update: perakitan besi kolom lantai 3 dimulai besok pagi.', 3, false),
      n('message', 'p6', `Pesan baru dari ${byId('p6').supervisor}`, 'Siap, kami lanjutkan sesuai gambar revisi.', 5, false),
      n('late', 'p6', 'Pekerjaan terlambat: Finishing', `${byId('p6').name} melewati target selesai. Pekerjaan “Finishing” baru 10%.`, 6, false),
      n('activity', 'p8', 'Aktivitas penting', `${byId('p8').name}: milestone “Mobilisasi & survei lokasi” tercatat selesai.`, 10, true),
      n('progress', 'p2', 'Update progres proyek', `${byId('p2').name}: pekerjaan Partisi mencapai 100%.`, 20, true),
      n('instruction', 'p6', 'Instruksi Admin HQ terkirim', 'Layout panel mengikuti gambar revisi terakhir.', 38, true),
      n('status', 'p3', 'Perubahan status', `${byId('p3').name} diubah menjadi Selesai.`, 480, true),
      n('status', 'p7', 'Perubahan status', `${byId('p7').name} masuk tahap Perencanaan; bobot scope belum final.`, 70, true)
    ];

    return { version: STATE_VERSION, projects, users, messages, notifications, profile: { name: ADMIN.name, email: 'admin.hq@example.com' }, lastDetailId: null };
  }

  /* ==========================================================================
     4. STORE — state aplikasi (satu-satunya pintu ke localStorage)
     ========================================================================== */
  let state = null;
  let onDataChange = null; // hook opsional yang dipasang halaman aktif

  const Store = {
    load() {
      const saved = LocalStore.read(KEYS.state, null);
      const ok = saved && saved.version === STATE_VERSION && Array.isArray(saved.projects) && Array.isArray(saved.messages);
      state = ok ? saved : buildSeed();
      if (!ok) LocalStore.write(KEYS.state, state);
    },
    save() {
      if (state && state.live) { Live.persist(); updateBadges(); if (onDataChange) onDataChange(); return; }
      const ok = LocalStore.write(KEYS.state, state);
      if (!ok && !Store.warned) { Store.warned = true; Toast.show('Penyimpanan lokal tidak tersedia: perubahan hanya bertahan sampai halaman ditutup.', 'error'); }
      updateBadges();
      if (onDataChange) onDataChange();
    },
    reset() { if (state && state.live) { Live.blocked(); return; } state = buildSeed(); LocalStore.write(KEYS.state, state); updateBadges(); },
    projects() { return state.projects; },
    project(id) { return state.projects.find(p => p.id === id) || null; },
    nextCode() {
      const prefix = `PCC-${new Date().getFullYear()}-`;
      const max = state.projects.reduce((m, p) => p.code.startsWith(prefix) ? Math.max(m, parseInt(p.code.slice(prefix.length), 10) || 0) : m, 0);
      return prefix + String(max + 1).padStart(3, '0');
    },
    codeExists(code, exceptId) { return state.projects.some(p => p.id !== exceptId && p.code.toLowerCase() === code.toLowerCase()); },
    addProject(data) {
      const p = Object.assign({ id: uid('p'), createdAt: new Date().toISOString(), demo: false, certified: null, scope: [], milestones: [], activities: [], locationLog: [] }, data);
      state.projects.push(p);
      Store.logActivity(p.id, 'status', `Proyek dibuat dengan status ${p.status}`, false);
      Store.save();
      return p;
    },
    updateProject(id, patch) { Object.assign(Store.project(id), patch); Store.save(); },
    removeProject(id) {
      state.projects = state.projects.filter(p => p.id !== id);
      state.messages = state.messages.filter(m => m.projectId !== id);
      state.notifications = state.notifications.filter(x => x.projectId !== id);
      state.users.forEach(u => { u.projects = u.projects.filter(x => x !== id); });
      if (state.lastDetailId === id) state.lastDetailId = null;
      Store.save();
    },
    logActivity(pid, type, text, save = true) {
      const p = Store.project(pid); if (!p) return;
      /* Non-admin (live) tidak boleh menulis dokumen proyek; aktivitasnya tercatat lewat laporan lapangan (reports). */
      if (state.live && Live.writer && Live.writer.role !== 'admin_pusat') return;
      p.activities.unshift({ id: uid('a'), at: new Date().toISOString(), user: state.profile.name, role: state.live ? roleLabel(Live.writer && Live.writer.role) : '', type, text });
      if (save) Store.save();
    },
    allActivities() {
      return state.projects.flatMap(p => p.activities.concat(p.reportActs || []).map(a => Object.assign({ project: p }, a))).sort((a, b) => String(b.at).localeCompare(String(a.at)));
    },
    projectName(id) { const p = Store.project(id); return p ? p.name : '(proyek dihapus)'; }
  };

  /* ==========================================================================
     5. PERHITUNGAN PROGRES & STATISTIK
     Progres proyek = jumlah (bobot × progres aktual) / 100
     Hanya dianggap VALID jika ada scope dan total bobot tepat 100%.
     ========================================================================== */
  const Progress = {
    totalWeight(scope) { return round(scope.reduce((s, x) => s + (Number(x.weight) || 0), 0), 2); },
    contribution(item) { return round((Number(item.weight) || 0) * (Number(item.actual) || 0) / 100, 2); },
    weighted(scope) { return round(scope.reduce((s, x) => s + (Number(x.weight) || 0) * (Number(x.actual) || 0) / 100, 0), 2); },
    isValid(scope) { return scope.length > 0 && this.totalWeight(scope) === 100; },
    summary(p) {
      const total = this.totalWeight(p.scope);
      return { total, value: this.weighted(p.scope), valid: this.isValid(p.scope), gap: round(100 - total, 2), count: p.scope.length };
    },
    /* Target rencana ILUSTRATIF (demo): kurva-S dari fraksi waktu, bukan jadwal resmi proyek. */
    timeFraction(p, at = new Date()) {
      const s = parseDate(p.startDate), e = parseDate(p.endDate);
      if (!s || !e || e <= s) return 0;
      return clamp((at - s) / (e - s), 0, 1);
    },
    sCurve(f) { return f * f * (3 - 2 * f); },
    planned(p) { return round(this.sCurve(this.timeFraction(p)) * 100, 1); },
    isOverdue(p) { const e = parseDate(p.endDate); return !!e && p.status !== 'Selesai' && e < new Date(new Date().setHours(0, 0, 0, 0)); },
    daysOverdue(p) { const e = parseDate(p.endDate); return e ? Math.max(0, Math.floor((new Date().setHours(0, 0, 0, 0) - e) / 864e5)) : 0; },
    /* Pekerjaan terlambat: belum 100% pada proyek berstatus Terlambat atau yang melewati target selesai. */
    lateItems(p) {
      if (p.status === 'Selesai' || !(p.status === 'Terlambat' || this.isOverdue(p))) return [];
      return p.scope.filter(s => s.actual < 100).map(s => ({ project: p, item: s, days: this.daysOverdue(p) }));
    }
  };

  const Stats = {
    compute() {
      const list = Store.projects();
      const count = st => list.filter(p => p.status === st).length;
      const valid = list.filter(p => Progress.summary(p).valid);
      const avg = valid.length ? round(valid.reduce((s, p) => s + Progress.summary(p).value, 0) / valid.length, 1) : null;
      return {
        total: list.length, running: count('Berjalan'), done: count('Selesai'), late: count('Terlambat'), planning: count('Perencanaan'),
        avg, validCount: valid.length
      };
    }
  };

  /* ==========================================================================
     6. NOTIFIKASI (data)
     ========================================================================== */
  const Notif = {
    list() { return state.notifications.slice().sort((a, b) => b.at.localeCompare(a.at)); },
    unreadCount() { return state.notifications.filter(n => !n.read).length; },
    add(data) { state.notifications.push(Object.assign({ id: uid('n'), at: new Date().toISOString(), read: false, demo: false }, data)); },
    setRead(id, read) { const n = state.notifications.find(x => x.id === id); if (n) { n.read = read; Store.save(); } },
    markAll() { state.notifications.forEach(n => { n.read = true; }); Store.save(); },
    markProjectMessages(pid) { state.notifications.forEach(n => { if (n.projectId === pid && n.type === 'message') n.read = true; }); }
  };

  /* ==========================================================================
     7. CHAT — ChatStore (SUMBER DATA)
     Tampilan chat HANYA memakai antarmuka ini, tidak membaca state.messages langsung.
     Untuk integrasi Firestore nanti, cukup buat adapter dengan antarmuka yang sama
     (conversations, messages, unreadCount, totalUnread, send, markRead, markUnread).
     Rancangan awal field pesan (BUKAN klaim bahwa koleksi Firestore sudah ada):
       projectId, senderId, senderName, senderRole, message, createdAt, readBy[], attachmentUrl
     ========================================================================== */
  const meId = () => (state && state.live && state.uid) ? state.uid : ADMIN.id;
  /* Pesan live menyimpan kode peran (admin_pusat, supervisor, ...); tampilkan sebagai label yang mudah dibaca. */
  const roleCode = () => state.live ? ((Live.writer && Live.writer.role) || '') : 'admin_pusat';
  const isAdminUI = () => roleCode() === 'admin_pusat';
  const isPM = () => state.live && roleCode() === 'project_manager';
  const canEditProgress = () => ['admin_pusat', 'supervisor', 'project_manager'].includes(roleCode());
  const ROLE_LABEL = { admin_pusat: 'Admin Kantor Pusat', project_manager: 'Project Manager', kepala_divisi: 'Kepala Divisi', supervisor: 'Supervisor Proyek', tim_lapangan: 'Tim Lapangan' };
  const roleLabel = r => ROLE_LABEL[r] || r || '';
  /* Nama tampilan akun: jika nama di dokumen users kosong / hanya berisi nama jabatan, pakai bagian depan email agar tiap admin dapat dibedakan. */
  function liveDisplayName(who) {
    const n = String((who && who.name) || '').trim(), mail = String((who && who.email) || '');
    if (n && !Object.values(ROLE_LABEL).includes(n)) return n;
    return mail ? mail.split('@')[0] : (n || 'Pengguna');
  }
  const ChatStore = {
    isUnread(m) {
      if (state.live) return m.senderId !== meId() && m.createdAt > Live.lastRead(m.projectId);
      return m.senderId !== ADMIN.id && !m.readBy.includes(ADMIN.id);
    },
    messages(pid) { return state.messages.filter(m => m.projectId === pid).sort((a, b) => a.createdAt.localeCompare(b.createdAt)); },
    last(pid) { const l = this.messages(pid); return l[l.length - 1] || null; },
    unreadCount(pid) { return state.messages.filter(m => m.projectId === pid && this.isUnread(m)).length; },
    totalUnread() { return state.messages.filter(m => this.isUnread(m)).length; },
    /* "Dibaca" bila ada pengguna selain pengirim yang tercatat di readBy */
    deliveryLabel(m) { return m.readBy.some(id => id !== m.senderId) ? 'Dibaca' : 'Terkirim'; },
    conversations() {
      return state.projects.map(p => ({ project: p, last: this.last(p.id), unread: this.unreadCount(p.id) }))
        .sort((a, b) => (b.last ? b.last.createdAt : '').localeCompare(a.last ? a.last.createdAt : '') || a.project.name.localeCompare(b.project.name));
    },
    send(pid, text, opts = {}) {
      const clean = String(text || '').trim();
      if (!clean || !Store.project(pid)) return null;
      if (state.live) { Live.sendChat(pid, clean.slice(0, 2000), !!opts.instruction); return { id: 'pending-' + Date.now() }; }
      const m = {
        id: uid('m'), projectId: pid, senderId: ADMIN.id, senderName: state.profile.name, senderRole: ADMIN.role,
        message: clean.slice(0, 2000), createdAt: new Date().toISOString(), readBy: [ADMIN.id], attachmentUrl: null,
        kind: opts.instruction ? 'instruction' : 'message', demo: false
      };
      state.messages.push(m);
      state.messages.forEach(x => { if (x.projectId === pid && x.senderId !== ADMIN.id && !x.readBy.includes(ADMIN.id)) x.readBy.push(ADMIN.id); });
      Notif.markProjectMessages(pid);
      if (opts.instruction) Notif.add({ type: 'instruction', projectId: pid, title: 'Instruksi Admin HQ terkirim', text: clean.slice(0, 140), read: true });
      Store.save();
      return m;
    },
    markRead(pid) {
      if (state.live) { Live.setLastRead(pid, new Date().toISOString()); Live.rebuildNotifs(); updateBadges(); return; }
      state.messages.forEach(m => { if (m.projectId === pid && this.isUnread(m)) m.readBy.push(ADMIN.id); });
      Notif.markProjectMessages(pid);
      Store.save();
    },
    markUnread(pid) {
      const incoming = this.messages(pid).filter(m => m.senderId !== meId());
      const last = incoming[incoming.length - 1];
      if (!last) return false;
      if (state.live) { Live.setLastRead(pid, new Date(new Date(last.createdAt).getTime() - 1).toISOString()); Live.rebuildNotifs(); updateBadges(); return true; }
      last.readBy = last.readBy.filter(id => id !== ADMIN.id);
      Store.save();
      return true;
    },
    /* Hanya untuk pengujian mockup: meniru pesan masuk dari supervisor proyek. */
    simulateIncoming(pid) {
      const p = Store.project(pid); if (!p) return null;
      const samples = ['Pekerjaan hari ini berjalan sesuai rencana.', 'Mohon konfirmasi jadwal kunjungan tim HQ minggu ini.', 'Foto progres terbaru sudah kami siapkan, akan diunggah segera.', 'Ada kendala cuaca, pekerjaan luar ruang tertunda setengah hari.'];
      const supId = `u-sup-${pid}`;
      const text = samples[Math.floor(Math.random() * samples.length)];
      const m = {
        id: uid('m'), projectId: pid, senderId: supId, senderName: p.supervisor, senderRole: 'Supervisor Proyek',
        message: `${text} (pesan simulasi)`, createdAt: new Date().toISOString(), readBy: [supId], attachmentUrl: null, kind: 'message', demo: true
      };
      state.messages.forEach(x => { if (x.projectId === pid && x.senderId === ADMIN.id && !x.readBy.includes(supId)) x.readBy.push(supId); });
      state.messages.push(m);
      Notif.add({ type: 'message', projectId: pid, title: `Pesan baru dari ${p.supervisor}`, text: m.message, read: false, demo: true });
      Store.save();
      return m;
    }
  };

  /* ==========================================================================
     8. UI — toast, modal, form & validasi, router, grafik, komponen bersama
     ========================================================================== */
  const Toast = {
    show(message, type = 'ok', ms = 3800) {
      if (type !== 'error' && Live.suppress) return; // mode baca-saja: jangan tampilkan toast sukses palsu setelah aksi yang diblokir
      const root = $('#toastRoot');
      const el = document.createElement('div');
      el.className = `toast ${type === 'error' ? 'error' : type === 'info' ? 'info' : ''}`;
      el.setAttribute('role', type === 'error' ? 'alert' : 'status');
      el.innerHTML = `${icon(type === 'error' ? 'alert' : 'checkcircle')}<span>${esc(message)}</span>`;
      root.appendChild(el);
      setTimeout(() => el.remove(), ms);
    }
  };

  const Modal = {
    el: null, opener: null, keyHandler: null,
    /* opts: { title, body (HTML), actions:[{label, kind, submit, onClick}], wide, onSubmit(form), dismissOnBackdrop } */
    open(opts) {
      this.close();
      this.opener = document.activeElement;
      const wrap = document.createElement('div');
      wrap.className = 'modal-backdrop';
      wrap.innerHTML = `
      <div class="modal ${opts.wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
        <div class="modal-head"><h3 id="modalTitle">${esc(opts.title)}</h3>
          <button class="icon-btn" type="button" data-modal-close aria-label="Tutup">${icon('x')}</button></div>
        <div class="modal-body">${opts.body}</div>
        <div class="modal-foot"></div>
      </div>`;
      const foot = $('.modal-foot', wrap);
      (opts.actions || []).forEach(a => {
        const b = document.createElement('button');
        b.type = a.submit ? 'submit' : 'button';
        if (a.submit) b.setAttribute('form', 'modalForm');
        b.className = `btn ${a.kind || ''}`.trim();
        b.textContent = a.label;
        if (a.onClick) b.addEventListener('click', () => a.onClick());
        if (a.close) b.setAttribute('data-modal-close', '');
        foot.appendChild(b);
      });
      wrap.addEventListener('mousedown', e => { if (e.target === wrap && opts.dismissOnBackdrop) Modal.close(); });
      wrap.addEventListener('click', e => { if (e.target.closest('[data-modal-close]')) Modal.close(); });
      const form = $('form', wrap);
      if (form && opts.onSubmit) form.addEventListener('submit', e => { e.preventDefault(); opts.onSubmit(form); });
      this.keyHandler = e => {
        if (e.key === 'Escape') { e.preventDefault(); Modal.close(); }
        if (e.key === 'Tab') Modal.trap(e);
      };
      document.addEventListener('keydown', this.keyHandler);
      $('#modalRoot').appendChild(wrap);
      this.el = wrap;
      const first = $('.modal-body input:not([type=hidden]), .modal-body select, .modal-body textarea', wrap) || $('.modal-foot .btn', wrap);
      if (first) first.focus({ preventScroll: true });
      if (opts.onOpen) opts.onOpen(wrap);
      return wrap;
    },
    trap(e) {
      const f = $$('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])', this.el).filter(x => !x.disabled && x.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    },
    close() {
      if (!this.el) return;
      this.el.remove(); this.el = null;
      document.removeEventListener('keydown', this.keyHandler);
      if (this.opener && document.contains(this.opener)) this.opener.focus({ preventScroll: true });
      this.opener = null;
    },
    confirm({ title, message, confirmLabel = 'Ya, lanjutkan', danger = false, onConfirm }) {
      this.open({
        title, body: `<p>${message}</p>`, dismissOnBackdrop: true,
        actions: [
          { label: 'Batal', close: true },
          { label: confirmLabel, kind: danger ? 'danger solid' : 'primary', onClick: () => { Modal.close(); onConfirm(); } }
        ]
      });
    },
    info(title, bodyHTML) {
      this.open({ title, body: bodyHTML, dismissOnBackdrop: true, actions: [{ label: 'Tutup', kind: 'primary', close: true }] });
    }
  };

  /* ---------- Form & validasi ---------- */
  function fieldHTML(o) {
    const { id, label, type = 'text', value = '', required = false, hint = '', attrs = '', tag = 'input', options = [], full = false } = o;
    const common = `class="input" id="f-${id}" name="${id}" aria-describedby="e-${id}" ${required ? 'aria-required="true"' : ''} ${attrs}`;
    let control;
    if (tag === 'select') control = `<select ${common}>${options.map(op => `<option value="${esc(op.value)}" ${String(op.value) === String(value) ? 'selected' : ''}>${esc(op.label)}</option>`).join('')}</select>`;
    else if (tag === 'textarea') control = `<textarea ${common}>${esc(value)}</textarea>`;
    else control = `<input ${common} type="${type}" value="${esc(value)}">`;
    return `<div class="field ${full ? 'full' : ''}"><label for="f-${id}">${esc(label)}${required ? ' <span class="req" aria-hidden="true">*</span>' : ''}</label>${control}${hint ? `<span class="hint">${hint}</span>` : ''}<div class="field-error" id="e-${id}" role="alert"></div></div>`;
  }

  const Validate = {
    data(form) {
      const out = {};
      new FormData(form).forEach((v, k) => { out[k] = typeof v === 'string' ? v.trim() : v; });
      return out;
    },
    clear(form) {
      $$('.field-error', form).forEach(e => { e.textContent = ''; });
      $$('[aria-invalid]', form).forEach(e => e.removeAttribute('aria-invalid'));
      const s = $('.form-error-summary', form); if (s) s.hidden = true;
    },
    show(form, errors) {
      this.clear(form);
      const keys = Object.keys(errors);
      keys.forEach(k => {
        const err = $(`#e-${k}`, form), inp = $(`#f-${k}`, form);
        if (err) err.textContent = errors[k];
        if (inp) inp.setAttribute('aria-invalid', 'true');
      });
      const s = $('.form-error-summary', form);
      if (s && keys.length) { s.hidden = false; s.textContent = `Ada ${keys.length} isian yang perlu diperbaiki. Periksa kolom bertanda merah.`; }
      if (keys.length) { const first = $(`#f-${keys[0]}`, form); if (first) first.focus(); }
      return keys.length === 0;
    },
    isNumber(v) { return v !== '' && Number.isFinite(Number(v)); }
  };

  function validateProject(d, exceptId) {
    const e = {};
    const req = (k, msg) => { if (!d[k]) e[k] = msg; };
    if (!d.code) e.code = 'Kode proyek wajib diisi.';
    else if (!/^[A-Za-z0-9]+(-[A-Za-z0-9]+)*$/.test(d.code) || d.code.length < 3 || d.code.length > 24) e.code = 'Gunakan 3–24 karakter huruf/angka, boleh dipisah tanda hubung. Contoh: PCC-2026-009.';
    else if (Store.codeExists(d.code, exceptId)) e.code = 'Kode proyek sudah dipakai proyek lain.';
    req('name', 'Nama proyek wajib diisi.');
    req('client', 'Klien atau pemilik proyek wajib diisi.');
    req('location', 'Alamat atau lokasi proyek wajib diisi.');
    req('pm', 'Kepala proyek atau penanggung jawab wajib diisi.');
    req('supervisor', 'Nama supervisor lapangan wajib diisi.');
    const s = parseDate(d.startDate), t = parseDate(d.endDate);
    if (!d.startDate) e.startDate = 'Tanggal mulai wajib diisi.'; else if (!s) e.startDate = 'Tanggal mulai tidak valid.';
    if (!d.endDate) e.endDate = 'Target tanggal selesai wajib diisi.'; else if (!t) e.endDate = 'Target tanggal selesai tidak valid.';
    if (s && t && t < s) e.endDate = 'Target selesai tidak boleh sebelum tanggal mulai.';
    if (!STATUSES.includes(d.status)) e.status = 'Pilih status proyek.';
    const hasLat = d.lat !== '' && d.lat != null, hasLng = d.lng !== '' && d.lng != null;
    if (hasLat !== hasLng) { e[hasLat ? 'lng' : 'lat'] = 'Isi latitude dan longitude bersamaan, atau kosongkan keduanya.'; }
    if (hasLat && !e.lat && !(Validate.isNumber(d.lat) && Math.abs(Number(d.lat)) <= 90)) e.lat = 'Latitude harus angka antara -90 dan 90.';
    if (hasLng && !e.lng && !(Validate.isNumber(d.lng) && Math.abs(Number(d.lng)) <= 180)) e.lng = 'Longitude harus angka antara -180 dan 180.';
    if (d.dashboardUrl && !isWebUrl(d.dashboardUrl)) e.dashboardUrl = 'Tautan harus diawali http:// atau https:// dan berupa alamat yang valid.';
    if (d.budget !== '' && d.budget != null && !(Validate.isNumber(d.budget) && Number(d.budget) >= 0)) e.budget = 'Anggaran harus angka 0 atau lebih.';
    return e;
  }

  function isWebUrl(v) {
    try { const u = new URL(String(v).trim()); return u.protocol === 'https:' || u.protocol === 'http:'; } catch (e) { return false; }
  }

  const SCOPE_TEMPLATES = {
    kosong: { label: 'Kosong — isi manual di halaman detail', items: [] },
    konstruksi: { label: 'Contoh: Konstruksi (Struktur, Arsitektur, MEP)', items: [['Pekerjaan Struktur', 40], ['Pekerjaan Arsitektur', 35], ['Pekerjaan MEP', 25]] },
    interior: { label: 'Contoh: Interior (Partisi, Plafon, Furnitur, Finishing)', items: [['Partisi', 25], ['Plafon', 25], ['Furnitur', 30], ['Finishing', 20]] },
    fitout: { label: 'Fit-out Store — 28 pekerjaan, 4 minggu (berdasarkan Timeline Erafone Barombong)', rich: [
      [1, 'Mobilisasi pekerja, alat kerja, & material', 'SIPIL', 'H-01', 2.5, 1, 'Lot', 'Basecamp & akomodasi siap'],
      [1, 'Pemasangan penutup Opening Soon (Kain Hitam D300)', 'SIPIL', 'H-01', 2.5, 9.88, 'm²', 'Penutup Logo Erafone & Pole Sign'],
      [1, 'Sewa & Pemasangan Steger/Scaffolding Façade', 'STRUKTUR', 'H-02', 2.5, 1, 'Lot', 'Skala 2 (lebar façade 6-10m)'],
      [1, 'Bongkar keramik/lantai existing (store & toilet)', 'SIPIL', 'H-03', 3, 15.39, 'm²', 'Store 12m² & toilet 3.39m²'],
      [1, 'Pembersihan sampah proyek & puing keluar lokasi', 'SIPIL', 'H-04', 2.5, 121.24, 'm²', 'Area bersih siap konstruksi'],
      [1, 'Fabrikasi & Pasang Tiang Pipa Schedule 40', 'STRUKTUR', 'H-05 - 07', 4, 140.32, 'kg', 'Pipa dia 5,4,3,2 inch fin zincromate'],
      [2, 'Pemasangan Talang Air PVC Kotak KW1 + Siku', 'SIPIL', 'H-08', 3, 8, 'm1', 'Talang PVC abu-abu rapi'],
      [2, 'Cat & Perbaikan Rangka Kanopi Existing', 'SIPIL', 'H-09', 4.5, 20, 'm²', 'Pengecekan kebocoran rampung'],
      [2, 'Bobokan dinding/lantai jalur kabel & pipa', 'MEP', 'H-10 - 11', 3.5, 1, 'Lot', 'Sesuai Approved Drawing'],
      [2, 'Pasang Pipa Conduit Dia. 20mm Clipsal', 'MEP', 'H-11 - 13', 3.5, 1, 'Lot', 'Jalur terpasang di balik ceiling'],
      [2, 'Tarikan Kabel Utama Eterna NYM 2x1.5mm & 3x2.5mm', 'MEP', 'H-13 - 14', 4.5, 66, 'ttk', 'Titik lampu & stop kontak'],
      [3, 'Pasang AC Split Wall Midea 2 PK (MSFQ-18 CRN)', 'HVAC', 'H-15', 4.5, 3, 'Unit', 'Unit outdoor siap dipasang'],
      [3, 'Pasang Pipa Refrigerant Hoda (0.6mm)', 'HVAC', 'H-16', 2, 30, 'm1', 'Persiapan vakum sistem'],
      [3, 'Vakum Sistem & Penguncian Outdoor AC', 'HVAC', 'H-16', 2, 3, 'Unit', 'Las bracket & gembok pengaman'],
      [3, 'Pasang Security Wiremesh Gudang Hollow 40x40', 'HVAC', 'H-17 - 18', 3.5, 34.75, 'm²', 'Frame cat hitam kawat M6'],
      [3, 'Service & Modifikasi Folding Gate/Pintu Lipat', 'HVAC', 'H-18', 2.5, 21.1, 'm²', 'Ganti kunci Dekson & rel'],
      [3, 'Pasang Closet Toto CW 422 + Jet Washer', 'HVAC', 'H-19', 2.5, 1, 'Set', 'Fitting sanitary toilet'],
      [3, 'Pasang Lampu LED T5 Morgen 18W (1200 & 600mm)', 'MEP', 'H-20', 5.5, 66, 'ttk', 'Lampu store 6500K'],
      [3, 'Pasang Automatic Timer SUL181D + Kontaktor', 'MEP', 'H-21', 3, 1, 'Set', 'Timer otomatis shop sign'],
      [4, 'Base Logo Sticker Galvalum 0.6mm Façade', 'STRUKTUR', 'H-22', 5.5, 20.29, 'm²', 'Plat galvalum abu & merah'],
      [4, 'Pasang LED Flood Light 50W Vacolux Façade', 'BRANDING', 'H-23', 2.5, 3, 'ttk', 'Lampu sorot luar'],
      [4, 'Frame Stainless & Signage Box Pole Sign', 'BRANDING', 'H-24', 4, 2.88, 'm²', 'Box reklame 2 muka'],
      [4, 'Pemasangan Stiker Doodle Art & Wallbay', 'BRANDING', 'H-25', 3.5, 30.09, 'm²', 'Samsung, Vivo, Oppo, Apple'],
      [4, 'Unloading & Instalasi Furniture Custom', 'FURNITURE', 'H-26 - 27', 15, 1, 'Lot', 'Knockdown furniture Erajaya'],
      [4, 'Pemasangan Hanging Gripper & Flexy Banner', 'HVAC', 'H-27', 3, 5, 'Unit', 'Hanging gripper & flexy'],
      [4, 'General Cleaning & Touch-up Cat Wall/Ceiling', 'HVAC', 'H-28', 2.5, 1, 'Lot', 'Area toko bersih'],
      [4, 'Pre-Checklist Internal Supervisi & Commissioning', 'HVAC', 'H-29', 1.5, 1, 'Lot', 'Tes fungsi menyeluruh'],
      [4, 'Joint Inspection & BAST Handover', 'HVAC', 'H-30', 1, 1, 'Lot', 'Serah terima toko']
    ] }
  };

  function openProjectForm(id) {
    const editing = id ? Store.project(id) : null;
    const v = editing || { code: Store.nextCode(), name: '', client: '', description: '', location: '', lat: '', lng: '', dashboardUrl: '', pm: '', supervisor: '', startDate: toISODate(new Date()), endDate: '', budget: '', status: 'Perencanaan', notes: '' };
    const pms = [...new Set(Store.projects().map(p => p.pm))].sort();
    const pmAccounts = state.live ? (state.users || []).filter(u => u.roleCode === 'project_manager' && (u.active || u.id === v.pmUid)) : [];
    const body = `
    <form id="modalForm" novalidate>
      <div class="form-error-summary" role="alert" hidden></div>
      <div class="form-grid">
        <div class="field"><label for="f-code">Kode proyek <span class="req" aria-hidden="true">*</span></label>
          <div class="inline"><input class="input" id="f-code" name="code" value="${esc(v.code)}" aria-describedby="e-code" aria-required="true" autocomplete="off">
          ${editing ? '' : `<button class="btn" type="button" id="autoCode" title="Buat kode otomatis">Otomatis</button>`}</div>
          <span class="hint">Dibuat otomatis, dapat diubah. Harus unik.</span><div class="field-error" id="e-code" role="alert"></div></div>
        ${fieldHTML({ id: 'status', label: 'Status proyek', required: true, tag: 'select', value: v.status, options: STATUSES.map(s => ({ value: s, label: s })) })}
        ${fieldHTML({ id: 'name', label: 'Nama proyek', required: true, value: v.name, full: true, attrs: 'maxlength="120"' })}
        ${fieldHTML({ id: 'client', label: 'Klien / pemilik proyek', required: true, value: v.client, full: true, attrs: 'maxlength="120"' })}
        ${fieldHTML({ id: 'description', label: 'Deskripsi proyek', tag: 'textarea', value: v.description, full: true, attrs: 'maxlength="600"' })}
        ${fieldHTML({ id: 'location', label: 'Alamat / lokasi proyek', required: true, value: v.location, full: true, attrs: 'maxlength="200"' })}
        ${fieldHTML({ id: 'dashboardUrl', label: 'Tautan dashboard lapangan (opsional)', type: 'url', value: v.dashboardUrl || '', full: true, attrs: 'maxlength="300" inputmode="url" placeholder="https://djiduthphotoworks.github.io/dashboard-progress/"', hint: 'Dashboard operasional proyek yang dipakai tim lapangan. Control Center hanya menautkannya dan tidak mengubahnya.' })}
        ${fieldHTML({ id: 'lat', label: 'Latitude (opsional)', value: v.lat ?? '', attrs: 'inputmode="decimal" placeholder="-6.2088"' })}
        ${fieldHTML({ id: 'lng', label: 'Longitude (opsional)', value: v.lng ?? '', attrs: 'inputmode="decimal" placeholder="106.8456"' })}
        ${pmAccounts.length ? `<div class="field"><label for="f-pm">Project Manager (penanggung jawab) <span class="req" aria-hidden="true">*</span></label>
          <select class="input" id="f-pm" name="pmUid" aria-describedby="e-pm h-pm" aria-required="true">
            ${(!v.pmUid) && v.pm ? `<option value="__keep">${esc(v.pm)} (nama lama, belum terhubung ke akun)</option>` : '<option value="">— Pilih Project Manager —</option>'}
            ${pmAccounts.map(u => `<option value="${esc(u.id)}" ${u.id === v.pmUid ? 'selected' : ''}>${esc(u.name)}${u.email ? ' — ' + esc(u.email) : ''}</option>`).join('')}</select>
          <div class="hint" id="h-pm">PM yang dipilih otomatis ditugaskan ke proyek ini dan dapat melihat, chat, serta mengubah progresnya.</div><div class="field-error" id="e-pm" role="alert"></div></div>` : `<div class="field"><label for="f-pm">Kepala proyek / penanggung jawab <span class="req" aria-hidden="true">*</span></label>
          <input class="input" id="f-pm" name="pm" value="${esc(v.pm)}" list="pmList" aria-describedby="e-pm${state.live ? ' h-pm' : ''}" aria-required="true" maxlength="80">
          <datalist id="pmList">${pms.map(p => `<option value="${esc(p)}">`).join('')}</datalist>${state.live ? '<div class="hint" id="h-pm">Belum ada akun Project Manager aktif. Buat dulu di Pengaturan → Tambah Pengguna (peran Project Manager) agar bisa dipilih di sini.</div>' : ''}<div class="field-error" id="e-pm" role="alert"></div></div>`}
        ${fieldHTML({ id: 'supervisor', label: 'Supervisor lapangan', required: true, value: v.supervisor, attrs: 'maxlength="80"' })}
        ${fieldHTML({ id: 'startDate', label: 'Tanggal mulai', type: 'date', required: true, value: v.startDate })}
        ${fieldHTML({ id: 'endDate', label: 'Target tanggal selesai', type: 'date', required: true, value: v.endDate })}
        ${fieldHTML({ id: 'budget', label: 'Anggaran proyek (Rp, opsional)', type: 'number', value: v.budget ?? '', attrs: 'min="0" step="1000" inputmode="numeric"' })}
        ${editing ? '' : fieldHTML({ id: 'template', label: 'Scope awal', tag: 'select', value: 'kosong', options: Object.entries(SCOPE_TEMPLATES).map(([k, t]) => ({ value: k, label: t.label })), hint: 'Bobot template hanya contoh ilustrasi, bukan standar. Bobot final harus disepakati berdasarkan BOQ/RAB.' })}
        ${fieldHTML({ id: 'notes', label: 'Catatan tambahan', tag: 'textarea', value: v.notes, full: true, attrs: 'maxlength="600"' })}
      </div>
    </form>`;
    Modal.open({
      title: editing ? `Edit Proyek — ${editing.code}` : 'Tambah Proyek', body, wide: true,
      actions: [{ label: 'Batal', close: true }, { label: editing ? 'Simpan Perubahan' : 'Simpan', kind: 'primary', submit: true }],
      onSubmit: form => submitProjectForm(form, editing),
      onOpen: wrap => { const b = $('#autoCode', wrap); if (b) b.addEventListener('click', () => { $('#f-code', wrap).value = Store.nextCode(); }); }
    });
  }

  function submitProjectForm(form, editing) {
    const d = Validate.data(form);
    d.code = (d.code || '').toUpperCase();
    let pmUid = editing ? (editing.pmUid || '') : '';
    if (state.live && form.elements.pmUid) {
      const sel = form.elements.pmUid, val = sel.value;
      if (val && val !== '__keep') { pmUid = val; const u = (state.users || []).find(x => x.id === val); d.pm = u ? u.name : sel.selectedOptions[0].textContent.split(' — ')[0]; }
      else if (val === '__keep') d.pm = editing ? editing.pm : '';
      else d.pm = '';
    }
    const errors = validateProject(d, editing && editing.id);
    if (!Validate.show(form, errors)) return;
    const clean = {
      code: d.code, name: d.name, client: d.client, description: d.description, location: d.location,
      lat: d.lat === '' ? null : Number(d.lat), lng: d.lng === '' ? null : Number(d.lng), dashboardUrl: d.dashboardUrl || '',
      pm: d.pm, ...(state.live ? { pmUid } : {}), supervisor: d.supervisor, startDate: d.startDate, endDate: d.endDate,
      budget: d.budget === '' ? null : Number(d.budget), status: d.status, notes: d.notes
    };
    if (editing) {
      const statusChanged = editing.status !== clean.status;
      if (state.live && clean.pmUid !== (editing.pmUid || '')) {
        editing.assignedUsers = (editing.assignedUsers || []).filter(x => x !== editing.pmUid);
        if (clean.pmUid && !editing.assignedUsers.includes(clean.pmUid)) editing.assignedUsers.push(clean.pmUid);
      }
      Object.assign(editing, clean);
      Store.logActivity(editing.id, statusChanged ? 'status' : 'catatan', statusChanged ? `Status proyek diubah menjadi ${clean.status}` : 'Data proyek diperbarui', false);
      if (statusChanged) Notif.add({ type: 'status', projectId: editing.id, title: 'Perubahan status', text: `${editing.name} diubah menjadi ${clean.status}.` });
      Store.save();
      Modal.close();
      if (!state.live) Toast.show(`Perubahan “${clean.name}” disimpan ke data demo lokal.`);
      if (Router.parse().name === 'project') Views.project(editing.id);
    } else {
      const tpl = SCOPE_TEMPLATES[d.template] || SCOPE_TEMPLATES.kosong;
      clean.scope = tpl.rich
        ? tpl.rich.map(([week, name, category, schedule, weight, volume, unit, note]) => ({ id: uid('s'), name, weight, actual: 0, note, category, week, schedule, volume, unit }))
        : tpl.items.map(([name, weight]) => ({ id: uid('s'), name, weight, actual: 0, note: '' }));
      clean.milestones = [];
      const p = Store.addProject(clean);
      Modal.close();
      if (!state.live) Toast.show(`Proyek “${p.name}” ditambahkan ke data demo lokal (tersimpan di browser ini).`);
    }
  }

  function openScopeForm(pid, scopeId) {
    const p = Store.project(pid); if (!p) return;
    const item = scopeId ? p.scope.find(s => s.id === scopeId) : null;
    const others = Progress.totalWeight(p.scope.filter(s => s.id !== scopeId));
    const body = `
    <form id="modalForm" novalidate>
      <div class="form-error-summary" role="alert" hidden></div>
      <div class="form-grid">
        ${fieldHTML({ id: 'name', label: 'Nama pekerjaan', required: true, value: item ? item.name : '', full: true, attrs: 'maxlength="100"' })}
        ${fieldHTML({ id: 'weight', label: 'Bobot pekerjaan (%)', type: 'number', required: true, value: item ? item.weight : '', attrs: 'min="0" max="100" step="0.1" inputmode="decimal"', hint: `Bobot item lain saat ini ${fmtNum(others)}%. Sisa agar total 100%: ${fmtNum(round(100 - others, 2))}%.` })}
        ${fieldHTML({ id: 'actual', label: 'Progres aktual (%)', type: 'number', required: true, value: item ? item.actual : 0, attrs: 'min="0" max="100" step="0.1" inputmode="decimal"' })}
        ${fieldHTML({ id: 'category', label: 'Kategori (opsional)', value: item ? (item.category || '') : '', attrs: 'maxlength="40" list="catList"', hint: 'Mis. SIPIL, MEP, FURNITURE. Dipakai untuk "Progress per Kategori".' })}
        ${fieldHTML({ id: 'week', label: 'Minggu ke- (opsional)', type: 'number', value: item && item.week != null ? item.week : '', attrs: 'min="1" max="52" step="1" inputmode="numeric"' })}
        ${fieldHTML({ id: 'schedule', label: 'Jadwal (opsional)', value: item ? (item.schedule || '') : '', attrs: 'maxlength="40"', hint: 'Mis. 10–14 Nov.' })}
        ${fieldHTML({ id: 'volume', label: 'Volume (opsional)', type: 'number', value: item && item.volume != null ? item.volume : '', attrs: 'min="0" step="any" inputmode="decimal"' })}
        ${fieldHTML({ id: 'unit', label: 'Satuan (opsional)', value: item ? (item.unit || '') : '', attrs: 'maxlength="12"', hint: 'Mis. m2, unit, ls.' })}
        ${fieldHTML({ id: 'note', label: 'Catatan', tag: 'textarea', value: item ? item.note : '', full: true, attrs: 'maxlength="300"' })}
      </div>
      <datalist id="catList">${[...new Set(p.scope.map(catOf).filter(c => c !== 'Umum'))].map(c => `<option value="${esc(c)}">`).join('')}</datalist>
    </form>`;
    Modal.open({
      title: item ? 'Edit Item Scope' : 'Tambah Item Scope', body,
      actions: [{ label: 'Batal', close: true }, { label: 'Simpan', kind: 'primary', submit: true }],
      onSubmit: form => {
        const d = Validate.data(form), e = {};
        if (!d.name) e.name = 'Nama pekerjaan wajib diisi.';
        if (!Validate.isNumber(d.weight) || Number(d.weight) <= 0 || Number(d.weight) > 100) e.weight = 'Bobot harus angka lebih dari 0 dan paling besar 100.';
        if (!Validate.isNumber(d.actual) || Number(d.actual) < 0 || Number(d.actual) > 100) e.actual = 'Progres harus angka antara 0 dan 100.';
        if (d.week !== '' && (!Validate.isNumber(d.week) || !Number.isInteger(Number(d.week)) || Number(d.week) < 1 || Number(d.week) > 52)) e.week = 'Minggu harus bilangan bulat 1–52.';
        if (d.volume !== '' && (!Validate.isNumber(d.volume) || Number(d.volume) < 0)) e.volume = 'Volume harus angka 0 atau lebih.';
        if (!Validate.show(form, e)) return;
        const vals = { name: d.name, weight: round(Number(d.weight), 2), actual: round(Number(d.actual), 2), note: d.note,
          category: (d.category || '').trim(), week: d.week === '' ? null : Number(d.week), schedule: (d.schedule || '').trim(),
          volume: d.volume === '' ? null : Number(d.volume), unit: (d.unit || '').trim() };
        if (item) Object.assign(item, vals); else p.scope.push(Object.assign({ id: uid('s') }, vals));
        p.certified = null;
        Store.logActivity(pid, 'progress', item ? `Item scope “${vals.name}” diperbarui` : `Item scope “${vals.name}” ditambahkan`, false);
        Store.save(); Modal.close();
        Toast.show(item ? 'Item scope diperbarui.' : 'Item scope ditambahkan.');
        if (Router.parse().name === 'project') Views.project(pid);
      }
    });
  }

  /* ---------- Komponen bersama ---------- */
  const statusBadge = s => `<span class="badge ${STATUS_CLS[s] || 'neutral'}">${esc(s)}</span>`;
  const demoTag = p => p && p.demo ? '<span class="demo-tag" title="Data contoh">DEMO</span>' : '';
  const barClass = s => s === 'Selesai' ? 'done' : s === 'Terlambat' ? 'late' : s === 'Perencanaan' ? 'plan' : '';

  function progressCell(p) {
    const sm = Progress.summary(p);
    if (!sm.valid) {
      const why = sm.count === 0 ? 'Belum ada scope pekerjaan' : `Total bobot ${fmtNum(sm.total)}% (harus 100%)`;
      return `<div class="progress" title="${esc(why)}"><div class="bar invalid" aria-hidden="true"></div><span class="pct invalid">Belum valid</span></div>`;
    }
    return `<div class="progress"><div class="bar ${barClass(p.status)}" role="progressbar" aria-valuenow="${sm.value}" aria-valuemin="0" aria-valuemax="100" aria-label="Progres ${esc(p.name)}"><i style="width:${sm.value}%"></i></div><span class="pct">${fmt2(sm.value)}%</span></div>`;
  }

  const emptyState = (ic, title, text, actionHTML = '') => `<div class="empty">${icon(ic)}<h4>${esc(title)}</h4><p>${text}</p>${actionHTML ? `<div style="margin-top:12px">${actionHTML}</div>` : ''}</div>`;

  /* ---------- Grafik SVG ---------- */
  function donutSVG(segments, { size = 168, thickness = 22, center = '', sub = '', label = '' } = {}) {
    const r = (size - thickness) / 2, c = 2 * Math.PI * r, cx = size / 2;
    const total = segments.reduce((s, x) => s + x.value, 0);
    let acc = 0;
    const arcs = total === 0 ? '' : segments.filter(s => s.value > 0).map(s => {
      const len = s.value / total * c;
      const out = `<circle cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke="${s.color}" stroke-width="${thickness}" stroke-dasharray="${len} ${c - len}" stroke-dashoffset="${-acc}" transform="rotate(-90 ${cx} ${cx})"><title>${esc(s.label)}: ${s.value}</title></circle>`;
      acc += len; return out;
    }).join('');
    return `<svg class="chart" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="${esc(label)}">
    <circle class="ring-bg" cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke-width="${thickness}"/>${arcs}
    <text class="donut-center" x="${cx}" y="${cx + 2}" text-anchor="middle">${esc(center)}</text>
    <text class="donut-center-sub" x="${cx}" y="${cx + 20}" text-anchor="middle">${esc(sub)}</text></svg>`;
  }

  /* Kurva-S ILUSTRATIF: x = % durasi proyek, y = % progres. Seluruhnya data demo. */
  function sCurveSVG(points, todayFrac) {
    const W = 640, H = 270, L = 40, R = 14, T = 14, B = 34, iw = W - L - R, ih = H - T - B;
    const X = f => L + f * iw, Y = v => T + (1 - v / 100) * ih;
    const path = pts => pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.f).toFixed(1)},${Y(p.v).toFixed(1)}`).join(' ');
    const grid = [0, 25, 50, 75, 100].map(v => `<line class="grid-line" x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}"/><text x="${L - 6}" y="${Y(v) + 4}" text-anchor="end">${v}%</text>`).join('');
    const xl = [0, 25, 50, 75, 100].map(v => `<text x="${X(v / 100)}" y="${H - 12}" text-anchor="middle">${v}%</text>`).join('');
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Kurva-S: rencana ilustratif dan posisi progres saat ini">
    ${grid}${xl}<text x="${L + iw / 2}" y="${H - 1}" text-anchor="middle">% durasi proyek</text>
    <line x1="${X(todayFrac)}" x2="${X(todayFrac)}" y1="${T}" y2="${T + ih}" stroke="var(--muted)" stroke-dasharray="3 4"/>
    <text x="${X(todayFrac)}" y="${T + 10}" text-anchor="${todayFrac > .85 ? 'end' : 'start'}" dx="${todayFrac > .85 ? -4 : 4}">Hari ini</text>
    <path d="${path(points.planned)}" fill="none" stroke="var(--c-plan)" stroke-width="2.5" stroke-dasharray="6 4"/>
    <path d="${path(points.actual)}" fill="none" stroke="var(--c-run)" stroke-width="3"/>
    ${points.actual.slice(-1).map(p => `<circle cx="${X(p.f)}" cy="${Y(p.v)}" r="4.5" fill="var(--c-run)"/>`).join('')}</svg>`;
  }

  /* ---------- Router ---------- */
  const isSpvView = () => new URLSearchParams(location.search).get('mode') === 'spv';
  const Router = {
    routes: {},
    parse() {
      const [name, arg] = location.hash.replace(/^#\/?/, '').split('/');
      return { name: name || 'dashboard', arg: arg ? decodeURIComponent(arg) : null };
    },
    render() {
      let { name, arg } = this.parse();
      if (!this.routes[name]) { history.replaceState(null, '', '#/dashboard'); name = 'dashboard'; arg = null; }
      if (name === 'project' && !arg) {
        const fallback = Store.project(state.lastDetailId) || Store.projects()[0];
        if (fallback) { history.replaceState(null, '', `#/project/${fallback.id}`); arg = fallback.id; }
      }
      onDataChange = null;
      Modal.close(); closeDrawer(); closeNotifMenu();
      if (name === 'settings' && state.live && !isAdminUI()) { history.replaceState(null, '', '#/dashboard'); name = 'dashboard'; arg = null; }
      const route = this.routes[name];
      $('#pageTitle').textContent = route.title;
      document.title = `${route.title} — Project Control Center HQ Jakarta`;
      $$('#nav a').forEach(a => { const on = a.dataset.route === name; a.classList.toggle('active', on); on ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'); });
      document.body.classList.toggle('role-staff', !!state.live && !isAdminUI());
      document.body.classList.toggle('is-live', !!state.live);
      document.body.classList.toggle('pd', name === 'project');
      document.body.classList.toggle('pd-light', name === 'project' && LocalStore.readRaw('pcc.pdtheme') === 'light');
      /* Tampilan khusus SPV: rute peta proyek berdiri sendiri, tanpa shell Admin HQ. */
      document.body.classList.toggle('project-map-only', name === 'project-map');
      /* Mode link SPV: monitoring tidak menampilkan navigasi Admin HQ. */
      document.body.classList.toggle('spv-project-only', name === 'project' && !!arg && isSpvView());
      /* Percakapan proyek untuk SPV juga tampil mandiri saat ID proyek ditentukan. */
      document.body.classList.toggle('project-chat-only', name === 'chat' && !!arg);
      route.render(arg);
      renderAnnouncements(); renderPdBell();
      window.scrollTo(0, 0);
      if (name === 'dashboard') {
        setTimeout(() => {
          const el = document.getElementById('dashMapContainer');
          if (el && window.PCCMap) {
            el.innerHTML = '';
            const dMap = window.PCCMap.create(el, { center: { lat: -2.5, lng: 118 }, zoom: 4 });
            const liveProjects = (typeof Store !== 'undefined' && Store.projects) ? Store.projects() : (typeof projects !== 'undefined' ? projects : []);
            if (liveProjects && liveProjects.length > 0) {
              dMap.setMarkers(liveProjects.map(p => ({
                id: p.id, lat: p.lat, lng: p.lng, name: p.name, label: p.id, status: p.status,
                color: p.status === 'COMPLETED' ? '#10b981' : p.status === 'CRITICAL' ? '#ef4444' : p.status === 'DELAYED' ? '#f59e0b' : '#2563eb'
              })), { fit: true });
            }

            // Paksa peta menyesuaikan ukuran kotak setelah layout stabil
            setTimeout(() => {
              if (typeof dMap.fitAll === 'function') dMap.fitAll();
            }, 250);
          }
        }, 150);
      }
      $('#main').focus({ preventScroll: true });
    }
  };

  function updateBadges() {
    const n = Notif.unreadCount(), c = ChatStore.totalUnread();
    [['#badgeNotif', n], ['#badgeBell', n], ['#badgeChat', c], ['#badgeDm', DM.total()]].forEach(([sel, val]) => {
      const el = $(sel); if (!el) return;
      el.hidden = val === 0; el.textContent = val > 99 ? '99+' : val;
      if (sel === '#badgeBell') el.setAttribute('aria-label', `${val} notifikasi belum dibaca`);
    });
    const bell = $('#bellBtn'); if (bell) bell.setAttribute('aria-label', n ? `Notifikasi, ${n} belum dibaca` : 'Notifikasi');
    if (!$('#notifMenu').hidden) renderNotifMenu();
    renderPdBell();
  }

  /* ---------- Drawer mobile & menu notifikasi ---------- */
  function openDrawer() { document.body.classList.add('drawer-open'); }
  function closeDrawer() { document.body.classList.remove('drawer-open'); }

  function renderNotifMenu() {
    const items = Notif.list().slice(0, 5), unread = Notif.unreadCount();
    $('#notifMenu').innerHTML = `
    <div class="dropdown-head"><span>Notifikasi ${unread ? `<span class="badge warn plain">${unread} baru</span>` : ''}</span></div>
    ${items.length ? items.map(n => {
      const t = NOTIF_TYPES[n.type];
      return `<button class="dropdown-item" type="button" data-action="open-notif" data-id="${n.id}" role="menuitem">
        <span class="ico kpi-ico ${t.tone}" style="width:34px;height:34px;border-radius:10px">${icon(t.icon, 'sm')}</span>
        <span style="flex:1;min-width:0"><span class="t">${n.read ? '' : '<span class="unread-dot"></span> '}${esc(n.title)}</span><br><span class="s">${esc(n.text.slice(0, 80))}${n.text.length > 80 ? '…' : ''} · ${fmtRel(n.at)}</span></span></button>`;
    }).join('') : '<div class="dropdown-empty">Belum ada notifikasi.</div>'}
    <div class="dropdown-foot"><button class="btn sm" type="button" data-action="mark-all-read" ${unread ? '' : 'disabled'}>Tandai semua dibaca</button><a class="btn sm primary" href="#/notifications">Lihat semua</a></div>`;
  }
  /* Lonceng di dashboard proyek: pengumuman + pesan chat baru untuk proyek ini */
  const pdNotifs = () => Notif.list().filter(n => n.type === 'announcement' || n.type === 'direct' || ((n.type === 'message' || n.type === 'instruction') && n.projectId === ui.detailId));
  function renderPdBell() {
    const b = $('#pdBellBadge'); if (!b) return;
    const list = pdNotifs(), unread = list.filter(n => !n.read).length;
    b.hidden = unread === 0; b.textContent = unread > 9 ? '9+' : unread;
    const dl = $('.pd-dm-link');
    if (dl) { const c = DM.total(); let u = $('.pd-dm-unread', dl); if (!c) { if (u) u.remove(); } else { if (!u) { u = document.createElement('span'); u.className = 'unread-badge pd-dm-unread'; dl.appendChild(u); } u.textContent = c > 9 ? '9+' : c; } }
    const cl = $('.pd-chat-link');
    if (cl && ui.detailId) { const c = ChatStore.unreadCount(ui.detailId); let u = $('.pd-chat-unread', cl);
      if (!c) { if (u) u.remove(); } else { if (!u) { u = document.createElement('span'); u.className = 'unread-badge pd-chat-unread'; cl.appendChild(u); } u.textContent = c > 9 ? '9+' : c; u.setAttribute('aria-label', `${c} pesan belum dibaca`); } }
    const btn = $('#pdBell'); if (btn) btn.setAttribute('aria-label', unread ? `Notifikasi, ${unread} belum dibaca` : 'Notifikasi');
    const m = $('#pdNotifMenu'); if (!m) return;
    m.innerHTML = `<div class="pd-menu-head"><b>Kabar terbaru</b>${unread ? `<span class="badge warn plain">${unread} baru</span>` : ''}</div>
      ${list.length ? list.slice(0, 8).map(n => { const t = NOTIF_TYPES[n.type] || NOTIF_TYPES.activity;
        return `<button class="pd-menu-item ${n.read ? '' : 'unread'}" type="button" data-action="open-notif" data-id="${n.id}" role="menuitem"><span class="ico kpi-ico ${t.tone}">${icon(t.icon, 'sm')}</span><span class="pd-menu-txt"><b>${n.read ? '' : '<i class="unread-dot"></i> '}${esc(n.title)}</b><span>${esc(String(n.text).slice(0, 70))}${String(n.text).length > 70 ? '…' : ''} · ${fmtRel(n.at)}</span></span></button>`; }).join('') : '<div class="dropdown-empty">Belum ada pengumuman atau pesan baru.</div>'}
      <div class="pd-menu-foot"><button class="pd-btn sm" type="button" data-action="pd-read-all" ${unread ? '' : 'disabled'}>Tandai semua dibaca</button></div>`;
  }
  function closePdBell() { const m = $('#pdNotifMenu'); if (m) m.hidden = true; const b = $('#pdBell'); if (b) b.setAttribute('aria-expanded', 'false'); }
  document.addEventListener('click', e => { if (!e.target.closest('.pd-bellwrap')) closePdBell(); });
  document.addEventListener('change', e => { if (e.target && e.target.id === 'pdSwitch' && e.target.value) location.hash = `#/project/${e.target.value}`; });
  function closeNotifMenu() { const m = $('#notifMenu'); if (m) m.hidden = true; const b = $('#bellBtn'); if (b) b.setAttribute('aria-expanded', 'false'); }
  function toggleNotifMenu() {
    const m = $('#notifMenu'); const open = m.hidden;
    if (open) renderNotifMenu();
    m.hidden = !open; $('#bellBtn').setAttribute('aria-expanded', String(open));
  }

  /* ---------- CSV ---------- */
  function csvCell(v) {
    if (v == null) return '';
    let s = String(v);
    if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = "'" + s; // cegah injeksi rumus spreadsheet
    return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }
  function downloadCSV(filename, rows) {
    const text = '﻿' + rows.map(r => r.map(csvCell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /* ==========================================================================
     9. HALAMAN (VIEWS)
     Setiap view mengisi #main. Pembaruan parsial dipakai di halaman yang punya
     input aktif (pencarian, chat, scope) supaya fokus & ketikan tidak hilang.
     ========================================================================== */
  const Views = {};
  const ui = {
    week: 'all',
    projects: { q: '', status: '', pm: '', sort: 'name' },
    map: { sel: null },
    chat: { sel: null, q: '' },
    notif: { read: 'all', type: '' },
    reports: { project: 'all', period: 'all' },
    detailId: null
  };
  const fmt2 = n => Number(n).toLocaleString('id-ID', { maximumFractionDigits: 2 });
  const setMain = html => { $('#main').innerHTML = html; };
  const ACT_ICON = {
    progress: { i: 'trend', t: 'tone-blue' }, foto: { i: 'image', t: 'tone-blue' }, catatan: { i: 'clipboard', t: 'tone-violet' },
    late: { i: 'alert', t: 'tone-red' }, status: { i: 'flag', t: 'tone-violet' }
  };
  const actIcon = type => ACT_ICON[type] || ACT_ICON.catatan;

  /* ---------- A. Dashboard ---------- */
  Views.dashboard = function () {
    const s = Stats.compute(), projects = Store.projects();
    const recent = projects.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);
    const acts = Store.allActivities().slice(0, 6);
    const notifs = Notif.list().slice(0, 4);
    const segs = STATUSES.map(st => ({ label: st, value: projects.filter(p => p.status === st).length, color: STATUS_COLOR[st] }));
    const kpi = (tone, ic, label, value, sub) => `<div class="card kpi"><span class="kpi-ico ${tone}">${icon(ic)}</span><div><div class="label">${label}</div><div class="value">${value}</div><div class="sub">${sub}</div></div></div>`;

    setMain(`
    <div class="page-head"><div><h2>Selamat datang, ${esc(state.profile.name.replace(/\s*\(.*\)/, ''))}</h2>
      <p>Ringkasan seluruh proyek. Angka di bawah dihitung langsung dari daftar proyek ${state.live ? '(Cloud Firestore)' : '(data demo lokal)'}.</p></div>
      <div class="page-actions"><a class="btn" href="#/projects">Semua Proyek</a><button class="btn" type="button" data-action="print-global">${icon('printer')} Cetak Laporan Global</button><button class="btn primary" type="button" data-action="add-project" data-admin-only>${icon('plus')} Tambah Proyek</button></div></div>

    <section class="card ann-box" id="annBox" data-max="5" aria-label="Pengumuman"></section>
    <section class="kpi-grid" aria-label="Ringkasan proyek">
      ${kpi('tone-blue', 'list', 'Total Proyek', s.total, `${s.planning} dalam perencanaan`)}
      ${kpi('tone-violet', 'clock', 'Proyek Berjalan', s.running, 'Status “Berjalan”')}
      ${kpi('tone-green', 'checkcircle', 'Proyek Selesai', s.done, 'Status “Selesai”')}
      ${kpi('tone-red', 'alert', 'Proyek Terlambat', s.late, 'Status “Terlambat”')}
      ${kpi('tone-amber', 'trend', 'Rata-rata Progres', s.avg === null ? '—' : fmtNum(s.avg) + '%', `${s.validCount} dari ${s.total} proyek dengan bobot valid`)}
    </section>

    <div class="grid g-2-1">
      <section class="card"><div class="card-head"><h3>Ringkasan Progres per Proyek</h3><a href="#/reports" class="small">Lihat laporan</a></div>
        <div class="card-body"><div class="progress-list">
          ${projects.map(p => `<div class="progress-row"><div><a href="#/project/${p.id}">${esc(p.name)}</a><div class="cell-sub">${esc(p.code)}</div></div>${statusBadge(p.status)}${progressCell(p)}</div>`).join('') || emptyState('list', 'Belum ada proyek', 'Tambahkan proyek pertama Anda.')}
        </div>${projects.some(p => !Progress.summary(p).valid) ? '<p class="small muted" style="margin-top:10px">“Belum valid” = belum ada scope atau total bobot scope belum 100%. Proyek tersebut tidak ikut dalam rata-rata.</p>' : ''}</div></section>
      <section class="card"><div class="card-head"><h3>Status Proyek</h3></div>
        <div class="card-body"><div class="donut-wrap">
          ${donutSVG(segs, { center: String(s.total), sub: 'proyek', label: 'Distribusi status proyek: ' + segs.map(x => `${x.label} ${x.value}`).join(', ') })}
          <div class="donut-legend">${segs.map(x => `<div><i style="background:${x.color}"></i>${x.label}<b>${x.value}</b></div>`).join('')}</div>
        </div>
  <div class="mini-map-box">
  <div class="mini-map-box">
  <div class="mini-map-head"><b>Sebaran Lokasi</b><a href="#/map" class="small">Buka peta</a></div>
  <div id="dashMapContainer" style="width: 100%; height: 220px; position: relative; overflow: hidden; display: block; background: var(--bg-surface, #e5e7eb);"></div>
  <p class="small muted">${state.live ? 'Penanda dari koordinat (lat/lng) proyek di Firestore.' : 'Penanda dari koordinat data demo.'}</p>
</div></div></section>
    </div>

    <div class="grid g-2-1">
      <section class="card"><div class="card-head"><h3>Proyek Terbaru</h3><a href="#/projects" class="small">Lihat semua</a></div>
        <div class="table-wrap"><table><thead><tr><th>Kode</th><th>Proyek</th><th>Status</th><th>Progres</th><th></th></tr></thead><tbody>
          ${recent.map(p => `<tr><td class="nowrap">${esc(p.code)}</td><td style="min-width:190px"><span class="cell-title">${esc(p.name)}</span> ${demoTag(p)}<div class="cell-sub">${esc(p.client)}</div></td><td>${statusBadge(p.status)}</td><td>${progressCell(p)}</td><td><a class="btn sm" href="#/project/${p.id}">Buka Monitoring</a></td></tr>`).join('')}
        </tbody></table></div></section>
      <section class="card"><div class="card-head"><h3>Aktivitas Terbaru</h3></div>
        <div class="card-body"><ul class="feed">
          ${acts.map(a => { const ic = actIcon(a.type); return `<li><span class="ico ${ic.t}">${icon(ic.i, 'sm')}</span><div><div class="t">${esc(a.text)}</div><div class="m">${esc(a.project.code)} · ${esc(a.user)} · ${fmtRel(a.at)}</div></div></li>`; }).join('') || '<li class="muted">Belum ada aktivitas.</li>'}
        </ul></div></section>
    </div>

    <section class="card"><div class="card-head"><h3>Notifikasi Terbaru ${Notif.unreadCount() ? `<span class="badge warn plain">${Notif.unreadCount()} belum dibaca</span>` : ''}</h3><a href="#/notifications" class="small">Buka notifikasi</a></div>
      <div class="card-body"><ul class="feed">
        ${notifs.map(n => { const t = NOTIF_TYPES[n.type]; return `<li><span class="ico ${t.tone}">${icon(t.icon, 'sm')}</span><div><div class="t">${n.read ? '' : '<span class="unread-dot"></span> '}<b>${esc(n.title)}</b> — ${esc(n.text)}</div><div class="m">${esc(t.label)} · ${fmtRel(n.at)}</div></div></li>`; }).join('') || '<li class="muted">Belum ada notifikasi.</li>'}
      </ul></div></section>`);
  };

  /* ---------- B. Semua Proyek ---------- */
  const SORTS = {
    name: ['Nama (A–Z)', (a, b) => a.name.localeCompare(b.name)],
    code: ['Kode proyek', (a, b) => a.code.localeCompare(b.code)],
    progressDesc: ['Progres tertinggi', (a, b) => progressKey(b) - progressKey(a)],
    progressAsc: ['Progres terendah', (a, b) => progressKey(a) - progressKey(b)],
    endAsc: ['Target selesai terdekat', (a, b) => a.endDate.localeCompare(b.endDate)],
    startDesc: ['Tanggal mulai terbaru', (a, b) => b.startDate.localeCompare(a.startDate)]
  };
  function progressKey(p) { const s = Progress.summary(p); return s.valid ? s.value : -1; }

  function filteredProjects() {
    const f = ui.projects, q = f.q.toLowerCase();
    return Store.projects().filter(p =>
      (!f.status || p.status === f.status) && (!f.pm || p.pm === f.pm) &&
      (!q || [p.code, p.name, p.client, p.location, p.pm, p.supervisor].some(x => String(x || '').toLowerCase().includes(q)))
    ).sort(SORTS[f.sort][1]);
  }

  Views.projects = function () {
    const f = ui.projects, pms = [...new Set(Store.projects().map(p => p.pm))].sort();
    setMain(`
    <div class="page-head"><div><h2>Semua Proyek</h2><p>Cari, filter, dan urutkan proyek. ${state.live ? 'Data dibaca dan disimpan ke Cloud Firestore sesuai role Anda.' : 'Data baru disimpan di browser ini (localStorage), bukan database bersama.'}</p></div>
      <div class="page-actions"><button class="btn" type="button" data-action="print-global">${icon('printer')} Cetak Laporan Global</button><button class="btn primary" type="button" data-action="add-project" data-admin-only>${icon('plus')} + Tambah Proyek</button></div></div>
    <section class="card">
      <div class="toolbar">
        <div class="search-box">${icon('search')}<input class="input" id="projSearch" type="search" placeholder="Cari kode, nama, klien, lokasi, penanggung jawab…" value="${esc(f.q)}" aria-label="Cari proyek"></div>
        <select class="input" id="projStatus" aria-label="Filter status"><option value="">Semua status</option>${STATUSES.map(s => `<option ${f.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
        <select class="input" id="projPm" aria-label="Filter penanggung jawab"><option value="">Semua penanggung jawab</option>${pms.map(p => `<option ${f.pm === p ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select>
        <select class="input" id="projSort" aria-label="Urutkan">${Object.entries(SORTS).map(([k, v]) => `<option value="${k}" ${f.sort === k ? 'selected' : ''}>Urut: ${v[0]}</option>`).join('')}</select>
      </div>
      <div id="projResults"></div>
    </section>`);
    renderProjectResults();
    onDataChange = renderProjectResults;
    $('#projSearch').addEventListener('input', e => { f.q = e.target.value; renderProjectResults(); });
    $('#projStatus').addEventListener('change', e => { f.status = e.target.value; renderProjectResults(); });
    $('#projPm').addEventListener('change', e => { f.pm = e.target.value; renderProjectResults(); });
    $('#projSort').addEventListener('change', e => { f.sort = e.target.value; renderProjectResults(); });
  };

  function renderProjectResults() {
    const box = $('#projResults'); if (!box) return;
    const list = filteredProjects(), total = Store.projects().length;
    if (!list.length) {
      box.innerHTML = emptyState('search', total ? 'Tidak ada proyek yang cocok' : 'Belum ada proyek', total ? 'Ubah kata kunci atau filter.' : 'Klik “Tambah Proyek” untuk memulai.',
        total ? '<button class="btn" type="button" data-action="reset-project-filters">Reset pencarian & filter</button>' : '');
      return;
    }
    const actions = p => `<div class="row-actions"><a class="btn sm" href="#/project/${p.id}">${icon('eye', 'sm')} Buka Monitoring</a><a class="btn sm" href="#/project-map/${p.id}" aria-label="Peta lokasi ${esc(p.name)}">${icon('pin', 'sm')} Peta Lokasi</a><button class="btn sm" type="button" data-action="edit-project" data-admin-only data-id="${p.id}" aria-label="Edit ${esc(p.name)}">${icon('edit', 'sm')} Edit</button><button class="btn sm" type="button" data-action="print-project" data-id="${p.id}" aria-label="Cetak laporan ${esc(p.name)}" title="Cetak laporan proyek">${icon('printer', 'sm')}</button></div>`;
    box.innerHTML = `
    <div class="table-wrap responsive-cards"><table>
      <thead><tr><th>Kode</th><th>Nama Proyek</th><th>Klien</th><th>Lokasi</th><th>Penanggung Jawab</th><th>Mulai</th><th>Target Selesai</th><th>Progres</th><th>Status</th><th>Aksi</th></tr></thead>
      <tbody>${list.map(p => `<tr>
        <td class="nowrap">${esc(p.code)}</td>
        <td><div class="cell-title"><a href="#/project/${p.id}">${esc(p.name)}</a> ${demoTag(p)}</div></td>
        <td>${esc(p.client)}</td><td class="cell-sub" style="min-width:160px">${esc(p.location || '—')}</td>
        <td>${esc(p.pm)}</td><td class="nowrap">${fmtDate(p.startDate)}</td><td class="nowrap">${fmtDate(p.endDate)}</td>
        <td style="min-width:150px">${progressCell(p)}</td><td>${statusBadge(p.status)}</td><td>${actions(p)}</td></tr>`).join('')}</tbody></table></div>
    <div class="card-list">${list.map(p => `<div class="pcard">
        <div class="row"><div><div class="cell-title"><a href="#/project/${p.id}">${esc(p.name)}</a> ${demoTag(p)}</div><div class="cell-sub">${esc(p.code)}</div></div>${statusBadge(p.status)}</div>
        ${progressCell(p)}
        <dl><dt>Klien</dt><dd>${esc(p.client)}</dd><dt>Lokasi</dt><dd>${esc(p.location || '—')}</dd><dt>PJ</dt><dd>${esc(p.pm)}</dd><dt>Periode</dt><dd>${fmtDate(p.startDate)} – ${fmtDate(p.endDate)}</dd></dl>${actions(p)}</div>`).join('')}</div>
    <div class="toolbar" style="border-top:1px solid var(--border);border-bottom:0"><span class="small muted" aria-live="polite">Menampilkan ${list.length} dari ${total} proyek</span></div>`;
  }

  /* ---------- C. Detail Proyek ---------- */
  Views.project = function (id) {
    const p = Store.project(id);
    if (!p) {
      setMain(`<div class="card">${emptyState('clipboard', 'Proyek tidak ditemukan', 'Proyek mungkin sudah dihapus.', '<a class="btn primary" href="#/projects">Kembali ke Semua Proyek</a>')}</div>`);
      return;
    }
    ui.detailId = id; state.lastDetailId = id; if (!state.live) LocalStore.write(KEYS.state, state);
    const kv = (k, v) => `<div><dt>${k}</dt><dd>${v}</dd></div>`;
    const metaBits = [esc(p.code), statusBadge(p.status), p.pm ? `PJ: <b>${esc(p.pm)}</b>` : '', p.supervisor ? `Supervisor: <b>${esc(p.supervisor)}</b>` : '', `${fmtDate(p.startDate)} – ${fmtDate(p.endDate)}`, demoTag(p)].filter(Boolean);
    setMain(`
    <header class="pd-head">
      <div class="pd-brand"><img class="pd-logo" src="assets/logo.png" alt="Logo Mata Utama" width="44" height="44">
        <div><h1 class="pd-title"><span class="g1">Timeline Progress</span> <span class="g2">/ Milestone Log</span></h1>
          <p class="pd-sub">Catatan harian atau daily update dari mandor/supervisor</p>
          <p class="pd-proj">${esc(p.name)}${p.location ? ' – ' + esc(p.location) : ''}</p></div></div>
      <div class="pd-tools">
        ${state.live && !isAdminUI() ? `${isPM() ? `<a class="pd-btn sm" href="#/dashboard" aria-label="Kembali ke Dashboard Utama">${icon('back', 'sm')} Dashboard Utama</a>` : ''}${state.projects.length > 1 || isPM() ? `<a class="pd-btn sm" href="#/projects">Semua Proyek Saya</a>` : ''}` : isSpvView() ? '' : `<a class="pd-btn sm" data-admin-only href="#/dashboard" aria-label="Kembali ke Dashboard Admin">${icon('arrow-left', 'sm')} Kembali ke Dashboard Admin</a>`}
        ${state.live ? '<span class="pd-live"><i></i>Live Tracking Active</span>' : '<span class="pd-live demo"><i></i>Mode Demo</span>'}
        <span class="pd-bellwrap"><button class="pd-btn icon" id="pdBell" type="button" data-action="pd-bell" aria-haspopup="true" aria-expanded="false" aria-label="Notifikasi" title="Pengumuman &amp; pesan baru">${icon('bell')}<b class="pd-badge" id="pdBellBadge" hidden>0</b></button><div class="pd-menu" id="pdNotifMenu" hidden role="menu" aria-label="Pengumuman dan pesan baru"></div></span>
        <button class="pd-btn icon" type="button" data-action="pd-theme" aria-label="Ganti tema dashboard proyek" title="Terang / gelap">${icon('moon')}</button>
        <button class="pd-btn" type="button" data-action="print-project" data-id="${p.id}">${icon('printer', 'sm')} Cetak Report</button>
      </div>
    </header>
    <nav class="pd-admin" aria-label="Informasi dan navigasi proyek">
      <span class="pd-meta">${metaBits.join('<i>·</i>')}</span>
      <span class="pd-admin-btns">
        ${state.live && !isAdminUI() && state.projects.length > 1 ? `<select class="pd-select" id="pdSwitch" aria-label="Pindah ke proyek lain">${state.projects.slice().sort((a, b) => String(a.code).localeCompare(String(b.code))).map(x => `<option value="${esc(x.id)}" ${x.id === p.id ? 'selected' : ''}>${esc(x.code)} — ${esc(x.name)}</option>`).join('')}</select>` : ''}
        ${state.live && !isAdminUI() ? `<a class="pd-btn sm pd-dm-link" href="#/dm">${icon('chat', 'sm')} Pesan Admin${DM.total() ? ` <span class="unread-badge pd-dm-unread">${DM.total() > 9 ? '9+' : DM.total()}</span>` : ''}</a>` : ''}
        <a class="pd-btn sm pd-chat-link" href="#/chat/${p.id}">${icon('chat', 'sm')} Chat${ChatStore.unreadCount(p.id) ? ` <span class="unread-badge pd-chat-unread" aria-label="${ChatStore.unreadCount(p.id)} pesan belum dibaca">${ChatStore.unreadCount(p.id) > 9 ? '9+' : ChatStore.unreadCount(p.id)}</span>` : ''}</a>
        <a class="pd-btn sm" href="#/project-map/${p.id}">${icon('pin', 'sm')} Peta</a>
      </span>
    </nav>
    ${p.description || p.notes ? `<p class="pd-note">${esc(p.description || '')}${p.description && p.notes ? ' · ' : ''}${p.notes ? `<b>Catatan:</b> ${esc(p.notes)}` : ''}</p>` : ''}

    <section class="card ann-box" id="annBox" data-max="3" aria-label="Pengumuman"></section>
    <div id="dashArea"></div>
    <div class="detail-cols" id="dashSide"></div>

    ${fieldDashboardCard(p)}

    <details class="pd-manage"><summary>${icon('sliders')} Pengelolaan proyek <span class="small muted">— scope &amp; bobot, milestone, riwayat aktivitas</span></summary>
    <section class="card" style="margin-bottom:16px">
      <div class="card-head"><h3>Scope Pekerjaan & Progres Berbobot</h3>
        <div class="inline" style="gap:6px"><button class="btn sm" type="button" data-action="import-tasks" data-admin-only data-id="${p.id}">${icon('plus', 'sm')} Impor Tabel</button><button class="btn sm primary" type="button" data-action="add-scope" data-admin-only data-id="${p.id}">${icon('plus', 'sm')} Tambah Scope</button></div></div>
      <div class="card-body stack">
        <div class="formula"><b>Rumus:</b> <code>Progres proyek = Σ (bobot × progres aktual) ÷ 100</code> — contoh: bobot 40% × progres 50% = <b>20%</b> kontribusi.
          Progres hanya <b>valid</b> bila total bobot tepat 100%.</div>
        <div class="notice warn">${icon('info')}<span>Bobot final perlu disepakati berdasarkan dokumen proyek (mis. BOQ/RAB) sebelum dipakai secara operasional. Aplikasi ini tidak menetapkan standar bobot resmi.</span></div>
        <div class="table-wrap"><table class="scope-table"><thead><tr><th>No</th><th>Pekerjaan</th><th class="num">Bobot (%)</th><th>Progres aktual (%)</th><th class="num">Kontribusi</th><th>Aksi</th></tr></thead>
          <tbody id="scopeBody"></tbody><tfoot id="scopeFoot"></tfoot></table></div>
        <div id="scopeStatus"></div>
      </div></section>

    <div class="detail-cols">
      <section class="card" data-admin-only><div class="card-head"><h3>Catatan & Milestone</h3></div><div class="card-body stack">
        <ul class="milestones" id="msList"></ul>
        <form class="inline" id="msForm" data-form="add-milestone" novalidate style="flex-wrap:wrap">
          <input class="input" name="text" placeholder="Milestone baru…" aria-label="Nama milestone" style="flex:2 1 160px" maxlength="100">
          <input class="input" name="date" type="date" aria-label="Tanggal milestone" style="flex:1 1 140px">
          <button class="btn" type="submit">Tambah</button></form><div class="field-error" id="msError" role="alert"></div></div></section>
    </div>

    <section class="card" style="margin-bottom:16px"><div class="card-head"><h3>Riwayat Aktivitas Proyek</h3></div><div class="card-body"><ul class="feed" id="actList"></ul></div></section>
    </details>

    <section class="card"><div class="card-head"><h3>Lembar Pengesahan Inspeksi Field Supervisi</h3></div><div class="card-body">
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:16px">
        ${[['Disiapkan Oleh', 'Pelaksana / Supervisor', p.supervisor], ['Diperiksa Oleh', 'Vendor / Kontraktor Utama', ''], ['Disetujui Oleh', 'Project / Penanggung jawab', p.pm]].map(s => `<div style="text-align:center"><div style="font-weight:700">${s[0]}</div><div class="small muted">${s[1]}</div><div style="height:72px;border-bottom:1px solid var(--border)"></div><div class="small" style="margin-top:6px">${esc(s[2] || '(nama & tanda tangan)')}</div></div>`).join('')}
      </div><p class="small muted" style="margin-top:12px">Kolom tanda tangan untuk dicetak. Pengesahan resmi belum tercatat di sistem.</p></div></section>`);
    renderScopeTable(p); renderMilestones(p); renderDetailActivities(p); renderProjectDash(p); renderProjectPanels(p);
    if (state.live) Live.watchPhotos(p.id);
  };

  function fieldDashboardCard(p) {
    const url = p.dashboardUrl && isWebUrl(p.dashboardUrl) ? p.dashboardUrl : '';
    if (!url) return '';
    const open = url
      ? `<a class="btn primary" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${icon('external')} Buka Dashboard Lapangan</a>`
      : `<button class="btn primary" type="button" data-action="edit-project" data-admin-only data-id="${p.id}">${icon('plus')} Tambah tautan</button>`;
    return `<section class="card" style="margin-bottom:16px"><div class="card-body field-dash">
    <div><h3 style="margin:0 0 4px">Dashboard Lapangan Eksternal (opsional)</h3>
      <p class="small muted" style="margin:0">${url
        ? `Dashboard operasional proyek ini tetap berdiri sendiri dan dipakai tim lapangan. Control Center hanya menautkannya (dibuka di tab baru). <span class="field-url">${esc(url)}</span>`
        : 'Belum ada tautan. Tambahkan tautan dashboard proyek ini melalui Edit agar mudah dibuka dari sini.'}</p></div>
    <div>${open}</div></div></section>`;
  }

  function renderScopeTable(p) {
    const rows = p.scope.map((s, i) => `<tr data-scope="${s.id}">
    <td>${i + 1}</td>
    <td><div class="cell-title">${esc(s.name)}</div>${s.note ? `<div class="cell-sub">${esc(s.note)}</div>` : ''}</td>
    <td class="num"><input class="input num-input" type="number" min="0" max="100" step="0.1" value="${s.weight}" data-scope-input="weight" ${isAdminUI() ? '' : 'readonly'} data-id="${s.id}" aria-label="Bobot ${esc(s.name)} dalam persen"></td>
    <td><div class="progress" style="min-width:190px"><input class="input num-input" type="number" min="0" max="100" step="0.1" value="${s.actual}" data-scope-input="actual" ${canEditProgress() ? '' : 'readonly'} data-id="${s.id}" aria-label="Progres aktual ${esc(s.name)} dalam persen"><div class="bar"><i data-bar style="width:${clamp(s.actual, 0, 100)}%"></i></div></div></td>
    <td class="num" data-contrib>${fmt2(Progress.contribution(s))}%</td>
    <td><div class="row-actions"><button class="btn sm" type="button" data-action="edit-scope" data-admin-only data-id="${p.id}" data-sid="${s.id}" aria-label="Edit ${esc(s.name)}">${icon('edit', 'sm')}</button>
      <button class="btn sm danger" type="button" data-action="delete-scope" data-admin-only data-id="${p.id}" data-sid="${s.id}" aria-label="Hapus ${esc(s.name)}">${icon('trash', 'sm')}</button></div></td></tr>`).join('');
    $('#scopeBody').innerHTML = rows || `<tr><td colspan="6">${emptyState('clipboard', 'Belum ada scope pekerjaan', 'Tambahkan item scope (mis. Struktur, Arsitektur, MEP — atau Partisi, Plafon, Furnitur, Finishing) lalu atur bobot dan progresnya.')}</td></tr>`;
    refreshDetailCalc(p);
  }

  /* Memperbarui angka turunan tanpa merender ulang input (fokus tetap terjaga) */
  function refreshDetailCalc(p) {
    const sm = Progress.summary(p);
    p.scope.forEach(s => {
      const tr = $(`tr[data-scope="${s.id}"]`); if (!tr) return;
      $('[data-contrib]', tr).textContent = `${fmt2(Progress.contribution(s))}%`;
      $('[data-bar]', tr).style.width = `${clamp(s.actual, 0, 100)}%`;
    });
    $('#scopeFoot').innerHTML = p.scope.length ? `<tr class="total-row"><td colspan="2">Total</td><td class="num">${fmt2(sm.total)}%</td><td></td><td class="num">${fmt2(sm.value)}%</td><td></td></tr>` : '';

    let msg;
    if (!p.scope.length) msg = `<div class="notice">${icon('info')}<span>Belum ada scope. Progres proyek belum bisa dihitung.</span></div>`;
    else if (sm.valid) msg = `<div class="notice" style="background:var(--c-done-bg);color:var(--c-done-fg)">${icon('checkcircle')}<span>Total bobot <b>100%</b> — progres proyek <b>${fmt2(sm.value)}%</b> valid.</span></div>`;
    else msg = `<div class="notice bad">${icon('alert')}<span>Total bobot <b>${fmt2(sm.total)}%</b> — ${sm.gap > 0 ? `kurang ${fmt2(sm.gap)}%` : `lebih ${fmt2(-sm.gap)}%`}. Total harus tepat 100% agar progres valid dan dapat disahkan. Nilai sementara: ${fmt2(sm.value)}%.</span></div>`;
    const cert = p.certified
      ? `<span class="badge done">Disahkan (mockup) ${fmtDateTime(p.certified.at)} — ${fmt2(p.certified.value)}%</span>`
      : '<span class="small muted">Belum disahkan.</span>';
    $('#scopeStatus').innerHTML = `${msg}<div class="inline" style="align-items:center;flex-wrap:wrap;margin-top:10px">
    <button class="btn sm primary" type="button" data-action="certify" data-admin-only data-id="${p.id}" ${sm.valid ? '' : 'disabled'} aria-describedby="certNote">Sahkan Progres (mockup)</button>${cert}</div>
    <p class="small muted" id="certNote" style="margin-top:6px">Penanda lokal saja. Sistem operasional memerlukan persetujuan berjenjang dan audit trail di backend.</p>`;

    if ($('#dashArea')) renderProjectDash(p);
    const v = sm.valid ? sm.value : null;
    const ringEl = $('#ringBox'); if (ringEl) ringEl.innerHTML = `${donutSVG([{ label: 'Selesai', value: v ?? 0, color: STATUS_COLOR[p.status] }, { label: 'Sisa', value: 100 - (v ?? 0), color: 'transparent' }], { size: 150, thickness: 18, center: v === null ? '—' : `${fmt2(v)}%`, sub: v === null ? 'belum valid' : 'progres', label: v === null ? 'Progres belum valid' : `Progres ${fmt2(v)} persen` })}
    <div class="cap">${v === null ? `Nilai sementara ${fmt2(sm.value)}% — total bobot ${fmt2(sm.total)}%` : 'Progres berbobot (valid)'}</div>`;
  }

  function renderMilestones(p) {
    const list = p.milestones.slice().sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    $('#msList').innerHTML = list.map(m => `<li><input type="checkbox" ${m.done ? 'checked' : ''} data-action="toggle-ms" data-id="${p.id}" data-mid="${m.id}" aria-label="Tandai ${esc(m.text)} selesai">
    <div class="grow"><span class="${m.done ? 'done-text' : ''}">${esc(m.text)}</span><div class="cell-sub">${m.date ? fmtDate(m.date) : 'Tanpa tanggal'}</div></div>
    <button class="icon-btn" type="button" data-action="delete-ms" data-id="${p.id}" data-mid="${m.id}" aria-label="Hapus milestone ${esc(m.text)}">${icon('trash', 'sm')}</button></li>`).join('')
      || '<li class="muted">Belum ada milestone.</li>';
  }
  function renderDetailActivities(p) {
    if (!$('#actList')) return;
    $('#actList').innerHTML = p.activities.concat(p.reportActs || []).sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 15).map(a => { const ic = actIcon(a.type); return `<li><span class="ico ${ic.t}">${icon(ic.i, 'sm')}</span><div><div class="t">${esc(a.text)}</div><div class="m">${esc(a.user)} · ${fmtDateTime(a.at)}</div></div></li>`; }).join('') || '<li class="muted">Belum ada aktivitas.</li>';
  }

  /* ---------- Dashboard otomatis per proyek ---------- */
  const catOf = s => (s.category && String(s.category).trim()) || 'Umum';
  const dashKpi = (tone, label, value, unit, sub, extra) => `<div class="card pd-kpi"><div class="pd-kl">${label}</div><div class="pd-kv"><span class="pd-kval ${tone}">${value}</span><span class="pd-ku">${unit}</span></div>${extra || ''}<div class="pd-ks">${sub}</div></div>`;
  function weeklyCurveSVG(planned, actual, labels) {
    const W = 640, H = 290, L = 42, R = 50, T = 14, B = 42, iw = W - L - R, ih = H - T - B, n = Math.max(1, labels.length - 1);
    const X = i => L + i / n * iw, Y = v => T + (1 - clamp(v, 0, 100) / 100) * ih;
    const line = arr => arr.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
    const grid = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(v => `<line class="grid-line" x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}"/><text x="${L - 6}" y="${Y(v) + 4}" text-anchor="end">${v}%</text>`).join('');
    const xl = labels.map((t, i) => `<text x="${X(i)}" y="${H - 16}" text-anchor="middle" font-size="10.5">${esc(t)}</text>`).join('');
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Kurva-S per minggu: target rencana dan realisasi">
    ${grid}${xl}<path d="${line(planned)} L${X(n)},${Y(0)} L${X(0)},${Y(0)} Z" fill="var(--c-run)" opacity=".12"/>
    <path d="${line(planned)}" fill="none" stroke="var(--c-run)" stroke-width="2.5"/>${planned.map((v, i) => `<circle cx="${X(i)}" cy="${Y(v)}" r="4" fill="var(--c-run)"/>`).join('')}
    <path d="${line(actual)}" fill="none" stroke="var(--c-done)" stroke-width="2.5" stroke-dasharray="5 4"/>${actual.map((v, i) => `<circle cx="${X(i)}" cy="${Y(v)}" r="4" fill="var(--c-done)"/>`).join('')}</svg>`;
  }
  const PHOTO_MAX = 5;
  function renderProjectDash(p) {
    const box = $('#dashArea'); if (!box) return;
    const sm = Progress.summary(p);
    const photos = (state.photos && state.photos[p.id]) || [];
    const photoOn = !!(state.live && Live.writer && Live.writer.service.addPhoto);
    const photosOf = sid => photos.filter(x => x.taskId === sid);
    const done = p.scope.filter(s => Number(s.actual) >= 100).length, left = p.scope.length - done;
    // penomoran 1.1, 1.2 ... per minggu
    const seq = {}, no = new Map();
    p.scope.forEach((s, i) => { const k = s.week != null ? s.week : 0; seq[k] = (seq[k] || 0) + 1; no.set(s.id, s.week != null ? `${s.week}.${seq[k]}` : String(i + 1)); });
    // kategori
    const cats = new Map();
    p.scope.forEach(s => { const c = catOf(s), o = cats.get(c) || { w: 0, c: 0 }; o.w += Number(s.weight) || 0; o.c += Progress.contribution(s); cats.set(c, o); });
    const catHTML = [...cats].map(([name, o]) => { const pct = o.w ? round(o.c / o.w * 100, 1) : 0;
      return `<div class="pd-cat"><div class="pd-cat-h"><b>${esc(name)}</b><span>${fmt2(pct)}%</span></div><div class="pd-cat-bar"><i style="width:${clamp(pct, 0, 100)}%"></i></div></div>`; }).join('')
      || '<p class="muted small">Belum ada item pekerjaan.</p>';
    // kurva-S per minggu
    const weeks = [...new Set(p.scope.map(s => s.week).filter(w => w != null))].sort((x, y) => x - y);
    let curve;
    if (weeks.length) {
      const planned = [0], actual = [0];
      weeks.forEach(w => { const its = p.scope.filter(s => s.week != null && s.week <= w); planned.push(its.reduce((t, s) => t + (Number(s.weight) || 0), 0)); actual.push(its.reduce((t, s) => t + Progress.contribution(s), 0)); });
      curve = `${weeklyCurveSVG(planned, actual, ['Start (H-0)', ...weeks.map(w => `Minggu ${w} (H-${w * 7})`)])}
        ${sm.valid ? '' : `<p class="small muted">Total bobot ${fmt2(sm.total)}% (belum 100%), kurva belum mencapai 100%.</p>`}`;
    } else if (sm.valid && p.startDate && p.endDate) {
      const t = Progress.timeFraction(p);
      curve = `${sCurveSVG({ planned: Array.from({ length: 11 }, (_, i) => ({ f: i / 10, v: Progress.sCurve(i / 10) * 100 })), actual: [{ f: t, v: sm.value }] }, t)}
         <div class="chart-legend"><span><i style="background:var(--c-plan)"></i>Target rencana (ilustratif)</span><span><i style="background:var(--c-run)"></i>Posisi progres saat ini</span></div>`;
    } else curve = `<div class="notice warn">${icon('alert')}<span>Kurva-S tampil setelah item pekerjaan diberi minggu, atau total bobot 100% dengan tanggal mulai/selesai.</span></div>`;
    // checklist
    if (ui.week !== 'all' && !weeks.includes(ui.week)) ui.week = 'all';
    const rows = p.scope.filter(s => ui.week === 'all' || s.week === ui.week);
    const tabs = ['all', ...weeks].map(w => `<button type="button" class="${ui.week === w ? 'on' : ''}" aria-pressed="${ui.week === w}" data-action="task-week" data-week="${w}">${w === 'all' ? 'Semua' : 'Minggu ' + w}</button>`).join(' ');
    const trs = rows.map(s => {
      const ph = photosOf(s.id), isDone = Number(s.actual) >= 100, locked = (photoOn && !ph.length && !isDone) || !canEditProgress();
      const thumbs = ph.slice(0, PHOTO_MAX).map(x => `<img src="${x.dataUrl}" alt="Foto bukti ${esc(s.name)}" data-action="photo-view" data-id="${p.id}" data-pid="${x.id}" style="width:40px;height:40px;object-fit:cover;border-radius:6px;cursor:pointer;margin:0 4px 4px 0">`).join('');
      const up = photoOn
        ? `<div>${thumbs}</div><div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap"><button class="btn sm" type="button" data-action="photo-upload" data-sid="${s.id}" ${ph.length >= PHOTO_MAX ? 'disabled' : ''}>${icon('image', 'sm')} Upload</button><span class="small muted">${ph.length}/${PHOTO_MAX}</span>${locked ? '<span class="small muted">Upload foto agar bisa dicentang</span>' : ''}</div>`
        : `<span class="small muted">${state.live ? 'Tidak tersedia' : 'Aktif setelah login Firestore'}</span>`;
      return `<tr><td><input type="checkbox" ${isDone ? 'checked' : ''} ${locked ? 'disabled' : ''} data-action="toggle-task" data-id="${p.id}" data-sid="${s.id}" aria-label="Tandai ${esc(s.name)} selesai"></td>
      <td style="white-space:nowrap"><b>${no.get(s.id)}</b> ${s.week != null ? `<span class="badge" style="padding:1px 7px;font-size:11px">W${s.week}</span>` : ''}</td>
      <td><div class="cell-title">${esc(s.name)}</div>${Number(s.actual) > 0 && Number(s.actual) < 100 ? `<div class="cell-sub">Progres ${fmt2(s.actual)}%</div>` : ''}</td>
      <td class="small" style="letter-spacing:.3px">${esc(catOf(s))}</td><td style="white-space:nowrap">${esc(s.schedule || '—')}</td>
      <td class="num" style="color:var(--c-run);font-weight:700">${fmt2(s.weight)}%</td><td class="num"><b>${s.volume != null ? fmtNum(s.volume) : '—'}</b></td><td>${esc(s.unit || '—')}</td>
      <td class="small muted"><i>${esc(s.note || '')}</i></td><td style="min-width:170px">${up}</td></tr>`; }).join('');
    const bar = pct => `<div class="pd-bar"><i style="width:${clamp(pct, 0, 100)}%"></i></div>`;
    box.innerHTML = `
    <section class="kpi-grid pd-kpis" aria-label="Ringkasan dashboard proyek">
      ${dashKpi('blue', 'Progress keseluruhan', sm.valid ? `${fmt2(sm.value)}%` : '—', sm.valid ? 'dari target 100%' : 'belum valid', sm.valid ? '&nbsp;' : `Total bobot ${fmt2(sm.total)}% (harus 100%)`, bar(sm.valid ? sm.value : 0))}
      ${dashKpi('green', 'Task selesai', done, 'item tercentang', photoOn ? 'Task selesai wajib memiliki minimal satu foto bukti.' : 'Aktif setelah login Firestore: foto bukti wajib.')}
      ${dashKpi('red', 'Sisa pekerjaan', `${left} Task`, 'belum selesai', 'Perbarui progres dan bukti foto sesuai kondisi lapangan.')}
    </section>
    <div class="detail-cols">
      <section class="card"><div class="card-head"><div><h3>Kurva-S Progress</h3><div class="small muted">Perbandingan target rencana dan realisasi aktual</div></div>${weeks.length ? `<div class="chart-legend pd-legend"><span><i style="background:var(--c-run)"></i>Target rencana</span><span><i style="background:var(--c-done)"></i>${state.live ? 'Realisasi live' : 'Realisasi'}</span></div>` : ''}</div><div class="card-body">${curve}</div></section>
      <section class="card"><div class="card-head"><div><h3>Progress per Kategori</h3><div class="small muted">Bobot pekerjaan yang sudah selesai</div></div></div><div class="card-body">${catHTML}</div></section>
    </div>
    <section class="card" style="margin-bottom:16px"><div class="card-head"><div><h3>Checklist Pekerjaan & Bukti Foto</h3><div class="small muted">Centang item setelah mengunggah foto bukti pekerjaan.</div></div><div class="pd-seg" role="group" aria-label="Filter minggu">${tabs}</div></div><div class="card-body stack">
      <input type="file" id="photoInput" accept="image/*" multiple hidden>
      <div class="table-wrap"><table><thead><tr><th>Done</th><th>No / Minggu</th><th>Uraian Pekerjaan</th><th>Kategori</th><th>Jadwal</th><th class="num">Bobot</th><th class="num">Volume</th><th>Satuan</th><th>Catatan / Keterangan</th><th>Bukti Foto</th></tr></thead>
        <tbody>${trs || `<tr><td colspan="10">${emptyState('clipboard', 'Belum ada item pekerjaan', 'Pilih template saat menambah proyek, impor tabel pekerjaan, atau tambahkan lewat “Tambah Scope”.')}</td></tr>`}</tbody></table></div></div></section>`;
  }
  function compressImage(file) {
    return new Promise((resolve, reject) => {
      if (!/^image\//.test(file.type)) { reject(new Error('File bukan gambar.')); return; }
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        let max = 900, q = 0.7, out = ''; const c = document.createElement('canvas');
        for (let i = 0; i < 6; i++) {
          const r = Math.min(1, max / Math.max(img.width, img.height));
          c.width = Math.max(1, Math.round(img.width * r)); c.height = Math.max(1, Math.round(img.height * r));
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          out = c.toDataURL('image/jpeg', q);
          if (out.length <= 200000) break;
          max = Math.round(max * 0.8); q = Math.max(0.4, q - 0.1);
        }
        if (out.length > 280000) { reject(new Error('Foto terlalu besar setelah dikompres.')); return; }
        resolve(out);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Foto tidak dapat dibaca.')); };
      img.src = url;
    });
  }
  async function uploadPhotos(files) {
    const p = Store.project(ui.detailId), sid = ui.photoTask;
    if (!p || !sid || !files || !files.length || !state.live || !Live.writer) return;
    const have = ((state.photos[p.id]) || []).filter(x => x.taskId === sid).length;
    const list = Array.from(files).slice(0, Math.max(0, PHOTO_MAX - have));
    if (!list.length) { Toast.show(`Maksimal ${PHOTO_MAX} foto per pekerjaan.`, 'error'); return; }
    let ok = 0;
    for (const f of list) {
      try {
        const dataUrl = await compressImage(f);
        await Live.writer.service.addPhoto(p.id, { taskId: sid, dataUrl, by: Live.writer.uid, byName: state.profile.name, at: new Date().toISOString() });
        ok++;
      } catch (err) {
        console.error('Unggah foto gagal:', err);
        Toast.show(err && err.code === 'permission-denied' ? 'Foto ditolak oleh Security Rules: Anda bukan anggota proyek ini.' : (err && err.message) || 'Foto gagal diunggah.', 'error');
        break;
      }
    }
    if (ok) {
      Toast.show(`${ok} foto bukti tersimpan.`);
      const sc = p.scope.find(x => x.id === sid);
      if (Live.writer.service.addReport) Live.writer.service.addReport(p.id, { type: 'foto', taskId: sid, taskName: sc ? sc.name : '', value: sc ? Number(sc.actual) || 0 : 0, text: `${ok} foto bukti ditambahkan untuk “${sc ? sc.name : 'pekerjaan'}”`, by: Live.writer.uid, byName: state.profile.name, byRole: Live.writer.role, at: new Date().toISOString() }).catch(e => console.warn('Laporan foto gagal dicatat:', e && e.code));
    }
  }

  /* Impor tabel pekerjaan: tempel dari Excel/Sheets (tab) atau CSV (; atau ,).
     Kolom: Minggu, Uraian, Kategori, Jadwal, Bobot, Volume, Satuan, Catatan */
  function parseTaskTable(text) {
    const lines = String(text || '').split(/\r?\n/).filter(l => l.trim());
    if (!lines.length) return { items: [], errors: ['Tabel kosong.'] };
    const delim = lines.some(l => l.includes('\t')) ? '\t' : lines.some(l => l.includes(';')) ? ';' : ',';
    const num = v => { const s = String(v == null ? '' : v).trim().replace('%', ''); if (s === '') return null; const n = Number(delim === ',' ? s : s.replace(',', '.')); return Number.isFinite(n) ? n : NaN; };
    const items = [], errors = [];
    lines.forEach((line, idx) => {
      const c = line.split(delim).map(x => x.trim());
      if (idx === 0 && /uraian|pekerjaan/i.test(c[1] || '') && !/\d/.test((c[4] || '').replace(/\D/g, ''))) return; // baris judul
      const wk = String(c[0] || '').replace(/[^\d]/g, ''), weight = num(c[4]), volume = num(c[5]);
      if (!c[1]) { errors.push(`Baris ${idx + 1}: uraian pekerjaan kosong.`); return; }
      if (weight === null || Number.isNaN(weight) || weight <= 0 || weight > 100) { errors.push(`Baris ${idx + 1}: bobot harus angka 0–100.`); return; }
      if (Number.isNaN(volume)) { errors.push(`Baris ${idx + 1}: volume harus angka.`); return; }
      items.push({ id: uid('s'), name: c[1].slice(0, 100), weight: round(weight, 2), actual: 0, note: (c[7] || '').slice(0, 300),
        category: (c[2] || '').slice(0, 40), week: wk ? Math.min(52, Number(wk)) : null, schedule: (c[3] || '').slice(0, 40), volume, unit: (c[6] || '').slice(0, 12) });
    });
    return { items, errors };
  }
  function openImportTasks(pid) {
    const p = Store.project(pid); if (!p) return;
    const body = `<form id="modalForm" novalidate><div class="form-error-summary" role="alert" hidden></div><div class="form-grid">
      <div class="field full"><label for="f-table">Tempel tabel pekerjaan</label>
        <textarea class="input" id="f-table" name="table" rows="10" placeholder="Minggu&#9;Uraian&#9;Kategori&#9;Jadwal&#9;Bobot&#9;Volume&#9;Satuan&#9;Catatan&#10;1&#9;Mobilisasi pekerja&#9;SIPIL&#9;H-01&#9;2,5&#9;1&#9;Lot&#9;Basecamp siap"></textarea>
        <span class="hint">Salin dari Excel/Google Sheets dengan urutan kolom: Minggu, Uraian, Kategori, Jadwal, Bobot (%), Volume, Satuan, Catatan. Baris judul boleh ikut. Bobot semua item sebaiknya berjumlah 100%.</span><span class="field-error" id="e-table"></span></div>
      <div class="field full"><span class="lbl">Mode</span>
        <label class="checkbox-row"><input type="radio" name="mode" value="add" checked> Tambahkan ke pekerjaan yang ada</label>
        <label class="checkbox-row"><input type="radio" name="mode" value="replace"> Ganti seluruh pekerjaan yang ada (${p.scope.length} item)</label></div></div></form>`;
    Modal.open({ title: 'Impor Pekerjaan', body, wide: true, actions: [{ label: 'Batal', close: true }, { label: 'Impor', kind: 'primary', submit: true }],
      onSubmit: form => {
        const { items, errors } = parseTaskTable(form.elements.table.value);
        if (errors.length || !items.length) { const e = $('#e-table', form); if (e) e.textContent = (errors.length ? errors.slice(0, 3).join(' ') : 'Tidak ada baris pekerjaan yang valid.'); return; }
        const replace = form.elements.mode.value === 'replace';
        if (replace) p.scope = items; else p.scope.push(...items);
        p.certified = null;
        Store.logActivity(pid, 'progress', `${items.length} item pekerjaan diimpor (${replace ? 'mengganti seluruh daftar' : 'ditambahkan'})`, false);
        Store.save(); Modal.close();
        if (!state.live) Toast.show(`${items.length} item pekerjaan diimpor.`);
        if (Router.parse().name === 'project') Views.project(pid);
      } });
  }

  function renderProjectPanels(p) {
    const box = $('#dashSide'); if (!box || !p) return;
    const old = $('#dashChatInput'), draft = old ? old.value : '', hadFocus = old && document.activeElement === old;
    const unread = ChatStore.unreadCount(p.id), msgs = ChatStore.messages(p.id).slice(-6);
    const notifs = Notif.list().filter(n => n.projectId === p.id).slice(0, 8);
    box.innerHTML = `
    <section class="card"><div class="card-head"><h3>Komunikasi Proyek</h3><a class="small" href="#/chat/${p.id}">Buka percakapan${unread ? ` (${unread} baru)` : ''}</a></div><div class="card-body stack">
      <div id="dashChatList" style="display:flex;flex-direction:column;gap:8px;max-height:280px;overflow:auto">${msgs.map(m => `<div class="msg ${m.senderId === meId() ? 'me' : 'other'}"><div class="who"><b>${esc(m.senderName)}</b> · ${fmtDateTime(m.createdAt)}</div><div class="bubble">${esc(m.message)}</div></div>`).join('') || '<p class="muted small" style="margin:0">Belum ada pesan di proyek ini.</p>'}</div>
      <form class="inline" data-form="dash-chat" data-id="${p.id}" novalidate><input class="input" id="dashChatInput" name="text" maxlength="2000" placeholder="Tulis pesan untuk tim proyek…" aria-label="Pesan proyek" style="flex:1" autocomplete="off"><button class="btn primary" type="submit">Kirim</button></form></div></section>
    <section class="card"><div class="card-head"><h3>Notifikasi & Aktivitas Proyek</h3><a class="small" href="#/notifications">Semua notifikasi</a></div><div class="card-body">
      <ul class="feed">${notifs.map(n => { const t = NOTIF_TYPES[n.type] || NOTIF_TYPES.activity; return `<li><span class="ico ${t.tone}">${icon(t.icon, 'sm')}</span><div><div class="t">${esc(n.title)}</div><div class="m">${esc(n.text)} · ${fmtDateTime(n.at)}</div></div></li>`; }).join('') || '<li class="muted">Belum ada notifikasi untuk proyek ini.</li>'}</ul></div></section>`;
    const inp = $('#dashChatInput'); if (inp) { inp.value = draft; if (hadFocus) inp.focus(); }
    const lst = $('#dashChatList'); if (lst) lst.scrollTop = lst.scrollHeight;
  }

  function onScopeInput(el, commit) {
    const p = Store.project(ui.detailId); if (!p) return;
    const s = p.scope.find(x => x.id === el.dataset.id); if (!s) return;
    const key = el.dataset.scopeInput;
    const raw = parseFloat(el.value);
    s[key] = clamp(Number.isFinite(raw) ? raw : 0, 0, 100);
    p.certified = null;
    Store.save();
    refreshDetailCalc(p);
    if (commit) {
      el.value = s[key];
      Store.logActivity(p.id, 'progress', key === 'weight' ? `Bobot “${s.name}” diubah menjadi ${s[key]}%` : `Progres “${s.name}” diperbarui menjadi ${s[key]}%`);
      renderDetailActivities(p);
    }
  }

  /* ---------- Peta khusus satu proyek ---------- */
  Views.projectMap = function (id) {
    const p = Store.project(id);
    if (!p) {
      setMain(`<div class="card">${emptyState('pin', 'Proyek tidak ditemukan', 'Proyek mungkin sudah dihapus.', '<a class="btn primary" href="#/projects">Kembali ke Semua Proyek</a>')}</div>`);
      return;
    }
    const has = p.lat != null && p.lng != null;
    const osm = has ? `https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lng}#map=16/${p.lat}/${p.lng}` : '';
    setMain(`
      <div class="page-head"><div><h2>Peta Lokasi Proyek</h2><p>Lokasi proyek ini saja.</p></div><div class="page-actions"><a class="btn" href="#/project/${encodeURIComponent(p.id)}">${icon('back', 'sm')} Kembali ke Monitoring</a></div></div>
      <div class="stack">
        <section class="card"><div class="card-head"><div><h3>${esc(p.name)}</h3><p class="small muted">${esc(p.code)} · ${esc(p.location || 'Alamat belum diisi')}</p></div>${statusBadge(p.status)}</div>
          <div class="card-body map-canvas"><div class="map-host" id="projectMapCanvas"></div>
            <div id="projectMapInfo" class="small muted" style="margin-top:10px">${has ? 'Penanda hanya menunjukkan lokasi proyek ini.' : 'Koordinat proyek belum diisi. Peta tidak dapat menampilkan penanda sampai latitude dan longitude tersedia.'}</div>
          </div>
        </section>
        <section class="card"><div class="card-head"><h3>Detail Lokasi — ${esc(p.name)}</h3>${statusBadge(p.status)}</div><div class="card-body stack">
          <dl class="meta-grid" style="margin-top:0"><div><dt>Kode Proyek</dt><dd>${esc(p.code)}</dd></div><div><dt>Alamat</dt><dd>${esc(p.location || 'Belum diisi')}</dd></div><div><dt>Koordinat</dt><dd>${has ? `${p.lat}, ${p.lng}` : 'Belum diisi'}</dd></div><div><dt>Verifikasi</dt><dd><span class="badge warn">Belum terverifikasi${p.demo ? ' (demo)' : ''}</span></dd></div></dl>
          ${has ? `<div class="page-actions"><a class="btn" href="${osm}" target="_blank" rel="noopener noreferrer">${icon('external', 'sm')} Buka di OpenStreetMap</a></div>` : ''}
        </div></section>
      </div>`);
    const host = $('#projectMapCanvas');
    if (mapView && mapView.host !== host) { mapView.inst.destroy(); mapView = null; }
    if (has && host && window.PCCMap) {
      mapView = { host, inst: PCCMap.create(host, { center: { lat: p.lat, lng: p.lng }, zoom: 15, onSelect: null }) };
      mapView.inst.setMarkers(mapMarkers([p]), { fit: true });
      mapView.inst.select(p.id, { center: true });
    } else if (host && !window.PCCMap) {
      host.innerHTML = `<div class="notice warn">${icon('info')}<span>Mesin peta tidak termuat. Pastikan file <code>Map.js</code> dimuat oleh halaman.</span></div>`;
    } else if (host && !has) {
      host.innerHTML = `<div class="notice warn">${icon('pin')}<span>Koordinat belum tersedia untuk proyek ini.</span></div>`;
    }
  };

  /* ---------- D. Peta Proyek ---------- */
  Views.map = function () {
    if (!Store.project(ui.map.sel)) ui.map.sel = (Store.projects()[0] || {}).id || null;
    setMain(`
    <div class="page-head"><div><h2>Peta Proyek</h2><p>Lokasi seluruh proyek pada peta OpenStreetMap. ${state.live ? 'Koordinat berasal dari data proyek di Firestore dan <b>belum terverifikasi</b>.' : 'Koordinat yang tersimpan adalah data demo dan <b>belum terverifikasi</b>.'}</p></div></div>
    <div class="map-layout">
      <section class="card"><div class="card-head"><h3>Daftar Proyek (${Store.projects().length})</h3></div><div class="map-list" id="mapList" style="margin-top:10px"></div></section>
      <div class="stack"><section class="card"><div class="card-head"><h3>Peta Lokasi Proyek <span class="badge warn plain">Koordinat belum terverifikasi</span></h3></div>
          <div class="card-body map-canvas"><div class="map-host" id="mapCanvas"></div><div id="mapInfo"></div></div></section>
        <section class="card" id="mapDetail"></section></div>
    </div>`);
    renderMap();
    onDataChange = renderMap;
  };

  function miniMapSVG(projects) {
    const dots = projects.filter(p => p.lat != null && p.lng != null).map(p => {
      const { x, y } = mapXY(p.lat, p.lng);
      return `<a href="#/map"><title>${esc(p.name)} — ${esc(p.status)}</title><circle cx="${x}" cy="${y}" r="9" fill="${STATUS_COLOR[p.status]}" stroke="var(--surface)" stroke-width="3"/></a>`;
    }).join('');
    const lines = [100, 110, 120, 130, 140].map(g => `<line class="grid-line" x1="${mapXY(0, g).x}" x2="${mapXY(0, g).x}" y1="20" y2="380"/>`).join('')
      + [5, 0, -5, -10].map(g => `<line class="grid-line" x1="20" x2="780" y1="${mapXY(g, 0).y}" y2="${mapXY(g, 0).y}"/>`).join('');
    return `<svg class="chart mini-map" viewBox="0 0 800 400" role="img" aria-label="Sebaran koordinat demo proyek (bukan peta sebenarnya)">${lines}${dots}</svg>`;
  }

  function mapXY(lat, lng) { return { x: 20 + (lng - 94) / 48 * 760, y: 20 + (7 - lat) / 18.5 * 360 }; }

  /* Peta: mesin ada di map.js (PCCMap). Di sini hanya menyiapkan data penanda dan menghubungkan pilihan. */
  let mapView = null;

  function mapMarkers(projects) {
    return projects.filter(p => p.lat != null && p.lng != null).map(p => ({
      id: p.id, lat: p.lat, lng: p.lng, name: p.name, label: p.code.split('-').pop(), status: p.status, color: STATUS_COLOR[p.status]
    }));
  }

  function selectMapProject(id) { ui.map.sel = id; renderMap(false); }

  function renderMapCanvas(projects, centerOnSel) {
    const host = $('#mapCanvas'); if (!host) return;
    const noXY = projects.filter(p => p.lat == null || p.lng == null);
    if (mapView && mapView.host !== host) { mapView.inst.destroy(); mapView = null; }
    if (!window.PCCMap) { renderMapDiagram(host, projects); }
    else {
      const first = !mapView;
      if (first) mapView = { host, inst: PCCMap.create(host, { onSelect: selectMapProject }) };
      mapView.inst.setMarkers(mapMarkers(projects), { fit: first });
      mapView.inst.select(ui.map.sel, { center: centerOnSel });
    }
    $('#mapInfo').innerHTML = `<div class="chart-legend" style="margin-top:10px">${STATUSES.map(s => `<span><i style="background:${STATUS_COLOR[s]}"></i>${s}</span>`).join('')}</div>
    <p class="small muted" style="margin-top:8px">Penanda mengikuti koordinat latitude/longitude yang tersimpan di mockup (data demo) dan <b>belum terverifikasi</b>. Ubin peta dimuat dari OpenStreetMap lewat internet; tidak memerlukan kunci API.${window.PCCMap ? '' : ' <b>map.js tidak termuat, sehingga hanya diagram sebaran yang ditampilkan.</b>'}${noXY.length ? ` Tanpa koordinat (tidak tampil di peta): ${noXY.map(p => esc(p.code)).join(', ')}.` : ''}</p>`;
  }

  /* Cadangan bila map.js tidak termuat: diagram sebaran, bukan peta. */
  function renderMapDiagram(host, projects) {
    const withXY = projects.filter(p => p.lat != null && p.lng != null);
    const grid = [100, 110, 120, 130, 140].map(g => `<line class="grid-line" x1="${mapXY(0, g).x}" x2="${mapXY(0, g).x}" y1="20" y2="380"/><text x="${mapXY(0, g).x}" y="396" text-anchor="middle">${g}°BT</text>`).join('')
      + [5, 0, -5, -10].map(g => `<line class="grid-line" x1="20" x2="780" y1="${mapXY(g, 0).y}" y2="${mapXY(g, 0).y}"/><text x="4" y="${mapXY(g, 0).y - 3}">${g}°</text>`).join('');
    const markers = withXY.map(p => {
      const { x, y } = mapXY(p.lat, p.lng), on = p.id === ui.map.sel;
      return `<g class="marker" data-action="map-select" data-id="${p.id}" role="button" tabindex="0" aria-label="${esc(p.name)}, ${esc(p.status)}">
      <circle class="hit" cx="${x}" cy="${y}" r="16"/>${on ? `<circle cx="${x}" cy="${y}" r="13" fill="none" stroke="${STATUS_COLOR[p.status]}" stroke-width="2"/>` : ''}
      <circle cx="${x}" cy="${y}" r="7" fill="${STATUS_COLOR[p.status]}" stroke="var(--surface)" stroke-width="2"/><text x="${x + 11}" y="${y + 4}">${esc(p.code.split('-').pop())}</text></g>`;
    }).join('');
    host.classList.add('map-fallback');
    host.innerHTML = `<svg class="chart" viewBox="0 0 800 404" role="group" aria-label="Diagram posisi relatif proyek berdasarkan koordinat demo">${grid}${markers}</svg>`;
  }

  function renderMap(centerOnSel) {
    const list = $('#mapList'); if (!list) return;
    const projects = Store.projects(), sel = Store.project(ui.map.sel);
    list.innerHTML = projects.map(p => `<div class="map-item ${p.id === ui.map.sel ? 'active' : ''}">
      <div class="row"><div><div class="cell-title">${esc(p.name)}</div><div class="cell-sub">${esc(p.location || 'Alamat belum diisi')}</div></div>${statusBadge(p.status)}</div>
      ${progressCell(p)}
      <div><button class="btn sm" type="button" data-action="map-select" data-id="${p.id}" aria-pressed="${p.id === ui.map.sel}">${icon('pin', 'sm')} Lihat detail lokasi</button></div></div>`).join('');

    renderMapCanvas(projects, centerOnSel === true);

    const box = $('#mapDetail');
    if (!sel) { box.innerHTML = emptyState('pin', 'Belum ada proyek', 'Tambahkan proyek untuk melihat lokasinya.'); return; }
    const has = sel.lat != null && sel.lng != null;
    const osm = has ? `https://www.openstreetmap.org/?mlat=${sel.lat}&mlon=${sel.lng}#map=16/${sel.lat}/${sel.lng}` : '';
    box.innerHTML = `<div class="card-head"><h3>Detail Lokasi — ${esc(sel.name)}</h3>${statusBadge(sel.status)}</div>
    <div class="card-body stack">
      <dl class="meta-grid" style="margin-top:0">
        <div><dt>Kode</dt><dd>${esc(sel.code)}</dd></div><div><dt>Alamat</dt><dd>${esc(sel.location || 'Belum diisi')}</dd></div>
        <div><dt>Koordinat</dt><dd>${has ? `${sel.lat}, ${sel.lng}` : 'Belum diisi'}</dd></div>
        <div><dt>Verifikasi</dt><dd><span class="badge warn">Belum terverifikasi${sel.demo ? ' (demo)' : ''}</span></dd></div></dl>
      <div>${progressCell(sel)}</div>
      <div class="page-actions">
        <button class="btn primary" type="button" data-action="change-location" data-id="${sel.id}">${icon('edit')} Ubah Lokasi</button>
        <a class="btn" href="#/project/${sel.id}">Detail proyek</a>
        ${has ? `<a class="btn" href="${osm}" target="_blank" rel="noopener noreferrer">${icon('external')} Buka di OpenStreetMap</a>` : ''}</div>
      ${has ? '' : '<div class="notice warn">' + icon('info') + '<span>Koordinat belum diisi, sehingga proyek ini tidak tampil di peta. Gunakan “Ubah Lokasi” untuk mengisinya.</span></div>'}
      <div class="notice">${icon('lock')}<span><b>Rancangan hak akses:</b> pada sistem operasional, perubahan lokasi hanya boleh dilakukan Kepala Divisi dan wajib mencatat pengguna, waktu, lokasi lama, lokasi baru, dan alasan. Pembatasan itu harus ditegakkan di backend/aturan database — di mockup ini siapa pun dapat mencobanya.</span></div>
      <div><h4 style="margin-bottom:6px">Riwayat perubahan lokasi (lokal)</h4>
        <ul class="log-list">${sel.locationLog.map(l => `<li><b>${esc(l.by)}</b> · ${fmtDateTime(l.at)}<br><span class="muted">Lama:</span> ${esc(l.oldText)}<br><span class="muted">Baru:</span> ${esc(l.newText)}<br><span class="muted">Alasan:</span> ${esc(l.reason)}</li>`).join('') || '<li class="muted">Belum ada perubahan lokasi tercatat.</li>'}</ul></div>
    </div>`;
  }

  const locText = (addr, lat, lng) => `${addr || '(alamat kosong)'}${lat != null && lng != null ? ` [${lat}, ${lng}]` : ' [tanpa koordinat]'}`;

  function openLocationForm(pid) {
    const p = Store.project(pid); if (!p) return;
    Modal.open({
      title: `Ubah Lokasi — ${p.code}`,
      body: `<form id="modalForm" novalidate><div class="form-error-summary" role="alert" hidden></div>
      <div class="notice warn" style="margin-bottom:14px">${icon('lock')}<span>Mockup. Di sistem operasional, hanya Kepala Divisi yang boleh mengubah lokasi, dan riwayatnya (pengguna, waktu, lokasi lama/baru, alasan) disimpan di backend.</span></div>
      <div class="form-grid">
        ${fieldHTML({ id: 'location', label: 'Alamat / lokasi baru', required: true, value: p.location, full: true, attrs: 'maxlength="200"' })}
        ${fieldHTML({ id: 'lat', label: 'Latitude', value: p.lat ?? '', attrs: 'inputmode="decimal"' })}
        ${fieldHTML({ id: 'lng', label: 'Longitude', value: p.lng ?? '', attrs: 'inputmode="decimal"' })}
        ${fieldHTML({ id: 'reason', label: 'Alasan perubahan', required: true, tag: 'textarea', full: true, attrs: 'maxlength="300"', hint: 'Wajib, minimal 10 karakter.' })}
      </div></form>`,
      actions: [{ label: 'Batal', close: true }, { label: 'Simpan Perubahan', kind: 'primary', submit: true }],
      onSubmit: form => {
        const d = Validate.data(form);
        const e = validateProject({ code: p.code, name: p.name, client: p.client, location: d.location, pm: p.pm, supervisor: p.supervisor, startDate: p.startDate, endDate: p.endDate, status: p.status, lat: d.lat, lng: d.lng, budget: '' }, p.id);
        const errors = {};['location', 'lat', 'lng'].forEach(k => { if (e[k]) errors[k] = e[k]; });
        if (!d.reason || d.reason.length < 10) errors.reason = 'Alasan perubahan wajib diisi (minimal 10 karakter).';
        if (!Validate.show(form, errors)) return;
        const lat = d.lat === '' ? null : Number(d.lat), lng = d.lng === '' ? null : Number(d.lng);
        p.locationLog.unshift({ at: new Date().toISOString(), by: state.profile.name, oldText: locText(p.location, p.lat, p.lng), newText: locText(d.location, lat, lng), reason: d.reason });
        Object.assign(p, { location: d.location, lat, lng });
        Store.logActivity(p.id, 'catatan', 'Lokasi proyek diubah (tercatat di riwayat lokasi)', false);
        Store.save(); Modal.close();
        Toast.show('Lokasi diperbarui dan dicatat di riwayat lokal.');
      }
    });
  }

  /* ---------- E. Laporan Proyek ---------- */
  const PERIODS = { all: 'Semua waktu', 7: '7 hari terakhir', 30: '30 hari terakhir', 90: '90 hari terakhir' };

  function reportData() {
    const f = ui.reports;
    const list = Store.projects().filter(p => f.project === 'all' || p.id === f.project);
    const cutoff = f.period === 'all' ? 0 : Date.now() - Number(f.period) * 864e5;
    const ids = new Set(list.map(p => p.id));
    const acts = Store.allActivities().filter(a => ids.has(a.project.id) && new Date(a.at).getTime() >= cutoff);
    const valid = list.filter(p => Progress.summary(p).valid);
    const avg = fn => valid.length ? round(valid.reduce((s, p) => s + fn(p), 0) / valid.length, 1) : null;
    return { list, acts, valid, avgActual: avg(p => Progress.summary(p).value), avgTarget: avg(p => Progress.planned(p)), late: list.flatMap(p => Progress.lateItems(p)) };
  }

  /* ---------- Pengumuman (semua proyek) ---------- */
  const ANN_TYPES = { info: { label: 'Info', cls: 'run' }, penting: { label: 'Penting', cls: 'warn' }, mendesak: { label: 'Mendesak', cls: 'late' } };
  const annSorted = () => (state.announcements || []).slice().sort((a, b) => (Number(b.pinned) - Number(a.pinned)) || String(b.at).localeCompare(String(a.at)));
  const annIsNew = a => { const n = state.notifications.find(x => x.id === `a-ann-${a.id}`); return !!(n && !n.read); };
  function annItemHTML(a, admin) {
    const t = ANN_TYPES[a.type] || ANN_TYPES.info;
    return `<li class="ann ann-${a.type} ${a.pinned ? 'is-pinned' : ''}">
      <div class="ann-h"><span class="badge ${t.cls}">${t.label}</span>${a.pinned ? `<span class="ann-pin">${icon('pin', 'sm')} Disematkan</span>` : ''}${annIsNew(a) ? '<span class="tag instr">BARU</span>' : ''}<b>${esc(a.title)}</b></div>
      <div class="ann-b">${esc(a.body)}</div>
      <div class="ann-m">${esc(a.byName || 'Admin')} · ${a.at ? fmtDateTime(a.at) : ''}</div>
      ${admin ? `<div class="ann-act"><button class="btn sm" type="button" data-action="ann-pin" data-admin-only data-id="${a.id}">${a.pinned ? 'Lepas semat' : 'Semat'}</button>
        <button class="btn sm" type="button" data-action="ann-edit" data-admin-only data-id="${a.id}">${icon('edit', 'sm')} Edit</button>
        <button class="btn sm danger" type="button" data-action="ann-delete" data-admin-only data-id="${a.id}">${icon('trash', 'sm')} Hapus</button></div>` : ''}</li>`;
  }
  function renderAnnouncements() {
    const box = $('#annBox'); if (!box) return;
    if (!state.live) { box.hidden = true; return; }
    const admin = isAdminUI(), all = annSorted(), max = Number(box.dataset.max) || 3, list = all.slice(0, max);
    if (!admin && !all.length) { box.hidden = true; return; }
    box.hidden = false;
    const hasNew = all.some(annIsNew);
    box.innerHTML = `<div class="card-head"><div><h3>${icon('flag', 'sm')} Pengumuman</h3><div class="small muted">Berlaku untuk semua proyek${all.length ? ` · ${all.length} pengumuman` : ''}</div></div>
      <div class="inline" style="gap:6px;flex-wrap:wrap">${hasNew ? '<button class="btn sm" type="button" data-action="ann-read">Tandai dibaca</button>' : ''}${admin ? `<button class="btn sm primary" type="button" data-action="ann-new" data-admin-only>${icon('plus', 'sm')} Buat pengumuman</button>` : ''}</div></div>
      <div class="card-body">${list.length ? `<ul class="ann-list">${list.map(a => annItemHTML(a, admin)).join('')}</ul>${all.length > list.length ? `<button class="btn sm" type="button" style="margin-top:8px" data-action="ann-all">Lihat semua (${all.length})</button>` : ''}` : '<p class="muted small" style="margin:0">Belum ada pengumuman. Pengumuman yang Anda buat tampil untuk semua supervisor dan tim lapangan.</p>'}</div>`;
  }
  function openAnnForm(id) {
    const a = id ? (state.announcements || []).find(x => x.id === id) : null;
    const v = a || { title: '', body: '', type: 'info', pinned: false };
    Modal.open({ title: a ? 'Edit Pengumuman' : 'Buat Pengumuman', wide: true,
      body: `<form id="modalForm" novalidate><div class="form-error-summary" role="alert" hidden></div><div class="form-grid">
        ${fieldHTML({ id: 'title', label: 'Judul', required: true, value: v.title, full: true, attrs: 'maxlength="120"' })}
        ${fieldHTML({ id: 'body', label: 'Isi pengumuman', required: true, tag: 'textarea', value: v.body, full: true, attrs: 'rows="5" maxlength="2000"' })}
        ${fieldHTML({ id: 'type', label: 'Jenis', required: true, tag: 'select', value: v.type, options: Object.entries(ANN_TYPES).map(([k, t]) => ({ value: k, label: t.label })), hint: 'Info = kabar umum · Penting = perlu perhatian · Mendesak = harus segera ditindaklanjuti.' })}
        <div class="field"><span class="lbl">Semat</span><label class="checkbox-row" style="min-height:38px"><input type="checkbox" name="pinned" ${v.pinned ? 'checked' : ''}> Sematkan di bagian atas</label><span class="hint">Pengumuman yang disematkan selalu tampil paling atas sampai Anda melepasnya.</span></div></div></form>`,
      actions: [{ label: 'Batal', close: true }, { label: a ? 'Simpan' : 'Kirim ke semua proyek', kind: 'primary', submit: true }],
      onSubmit: async form => {
        const d = Validate.data(form), e = {};
        if (!d.title) e.title = 'Judul wajib diisi.';
        if (!d.body) e.body = 'Isi pengumuman wajib diisi.';
        if (!ANN_TYPES[d.type]) e.type = 'Pilih jenis.';
        if (!Validate.show(form, e)) return;
        const W = Live.writer; if (!W || !W.service.addAnnouncement) { Toast.show('Mode Firestore belum siap.', 'error'); return; }
        const data = { title: d.title, body: d.body, type: d.type, pinned: !!form.elements.pinned.checked };
        try {
          if (a) await W.service.updateAnnouncement(a.id, data);
          else await W.service.addAnnouncement(Object.assign(data, { by: W.uid, byName: state.profile.name, at: new Date().toISOString() }));
          Modal.close(); Toast.show(a ? 'Pengumuman diperbarui.' : 'Pengumuman terkirim ke semua proyek.');
        } catch (err) { Toast.show(err && err.code === 'permission-denied' ? 'Ditolak oleh Security Rules: hanya Admin yang boleh membuat pengumuman (pastikan Rules terbaru sudah dipublikasikan).' : 'Pengumuman gagal disimpan.', 'error'); }
      } });
  }

  /* Kontainer khusus "Laporan Lapangan": update progres + foto bukti dari supervisor / tim lapangan. */
  function loadFieldPhotos(projs) {
    const svc = Live.writer && Live.writer.service; if (!svc || !svc.fetchRecentPhotos) return;
    ui.repPhotos = ui.repPhotos || {}; ui.repLoading = true;
    Promise.all(projs.map(p => svc.fetchRecentPhotos(p.id, 8).then(list => { ui.repPhotos[p.id] = list; }).catch(err => console.warn('Foto tidak dapat dibaca:', p.id, err && err.code))))
      .finally(() => { ui.repLoading = false; if (Router.parse().name === 'reports') renderFieldReports(false); });
  }
  function renderFieldReports(reload) {
    const box = $('#fieldReports'); if (!box) return;
    const f = ui.reports, projs = Store.projects().filter(p => f.project === 'all' || p.id === f.project);
    const canPhotos = !!(state.live && Live.writer && Live.writer.service.fetchRecentPhotos);
    ui.repPhotos = ui.repPhotos || {};
    const acts = projs.flatMap(p => (p.reportActs || []).map(a => Object.assign({ project: p }, a))).sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 12);
    const feed = acts.map(a => { const ic = actIcon(a.type); return `<li><span class="ico ${ic.t}">${icon(ic.i, 'sm')}</span><div><div class="t">${esc(a.text)}</div><div class="m">${esc(a.project.code)} · ${esc(a.user)} · ${a.at ? fmtDateTime(a.at) : ''}</div></div></li>`; }).join('')
      || `<li class="muted">${state.live ? 'Belum ada update dari lapangan.' : 'Aktif setelah login Firestore.'}</li>`;
    const groups = projs.map(p => ({ p, list: (ui.repPhotos[p.id] || []).slice().reverse() })).filter(g => g.list.length);
    const photos = groups.map(g => `<div class="fr-group"><div class="fr-title"><b>${esc(g.p.code)}</b> — ${esc(g.p.name)} <span class="small muted">(${g.list.length} terbaru)</span></div><div class="fr-grid">${g.list.map(ph => {
      const sc = g.p.scope.find(x => x.id === ph.taskId);
      return `<img class="fr-thumb" src="${ph.dataUrl}" alt="Foto bukti ${esc(sc ? sc.name : '')}" title="${esc((sc ? sc.name : 'Pekerjaan') + ' · ' + (ph.byName || '') + ' · ' + (ph.at ? fmtDateTime(ph.at) : ''))}" data-action="rep-photo-view" data-pid="${g.p.id}" data-phid="${ph.id}" tabindex="0">`; }).join('')}</div></div>`).join('');
    box.innerHTML = `<div class="card-head"><div><h3>Laporan Lapangan</h3><div class="small muted">Update progres dan foto bukti yang dikirim supervisor / tim lapangan, langsung dari proyek masing-masing.</div></div>
      ${canPhotos ? '<button class="btn sm no-print" type="button" data-action="rep-photos-reload">Muat ulang foto</button>' : ''}</div>
      <div class="card-body"><div class="detail-cols" style="margin-bottom:0">
        <div><h4 style="margin-bottom:8px">Update progres terbaru</h4><ul class="feed">${feed}</ul></div>
        <div><h4 style="margin-bottom:8px">Foto bukti terbaru</h4>${!canPhotos ? '<p class="small muted">Aktif setelah login Firestore.</p>' : photos || `<p class="small muted">${ui.repLoading ? 'Memuat foto…' : 'Belum ada foto bukti.'}</p>`}</div></div></div>`;
    if (reload && canPhotos) { loadFieldPhotos(projs); if (!photos) { const b = box.querySelector('.card-body .detail-cols > div:last-child p'); if (b) b.textContent = 'Memuat foto…'; } }
  }

  Views.reports = function () {
    const f = ui.reports;
    setMain(`
    <div class="page-head"><div><h2>Laporan Proyek</h2><p>Ringkasan progres, perbandingan target vs aktual, dan riwayat update. Periode memfilter riwayat update; angka progres menunjukkan kondisi saat ini.</p></div>
      <div class="page-actions no-print"><button class="btn" type="button" data-action="export-progress">${icon('download')} Ekspor CSV Progres</button>
        <button class="btn" type="button" data-action="export-history">${icon('download')} Ekspor CSV Riwayat</button>
        <button class="btn" type="button" data-action="print-global">${icon('printer')} Cetak Laporan Global</button></div></div>
    <section class="card no-print" style="margin-bottom:16px"><div class="toolbar" style="border:0">
      <label class="small muted" for="repProject">Proyek</label>
      <select class="input" id="repProject"><option value="all">Semua proyek</option>${Store.projects().map(p => `<option value="${p.id}" ${f.project === p.id ? 'selected' : ''}>${esc(p.code)} — ${esc(p.name)}</option>`).join('')}</select>
      <label class="small muted" for="repPeriod">Periode</label>
      <select class="input" id="repPeriod">${Object.entries(PERIODS).map(([k, v]) => `<option value="${k}" ${f.period === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div></section>
    <section class="card" id="fieldReports" style="margin-bottom:16px"></section>
    <div id="reportBody"></div>`);
    renderReport();
    renderFieldReports(true);
    onDataChange = renderReport;
    $('#repProject').addEventListener('change', e => { f.project = e.target.value; if (f.project !== 'all') f.curve = f.project; renderReport(); renderFieldReports(true); });
    $('#repPeriod').addEventListener('change', e => { f.period = e.target.value; renderReport(); });
  };

  function renderReport() {
    const box = $('#reportBody'); if (!box) return;
    const d = reportData(), f = ui.reports;
    if (!d.list.length) { box.innerHTML = `<div class="card">${emptyState('chart', 'Tidak ada proyek', 'Tambahkan proyek terlebih dahulu.')}</div>`; return; }
    const dev = (a, t) => { const x = round(a - t, 1); const cls = x >= 0 ? 'yes' : x > -10 ? 'partial' : ''; return `<span class="${cls}" ${cls ? '' : 'style="color:var(--c-late-fg);font-weight:600"'}>${x > 0 ? '+' : ''}${fmtNum(x)} pp</span>`; };
    const curveId = d.list.some(p => p.id === f.curve) ? f.curve : (d.valid.find(p => p.status === 'Berjalan') || d.valid[0] || d.list[0]).id;
    f.curve = curveId;
    const kpi = (tone, ic, label, value, sub) => `<div class="card kpi"><span class="kpi-ico ${tone}">${icon(ic)}</span><div><div class="label">${label}</div><div class="value">${value}</div><div class="sub">${sub}</div></div></div>`;

    box.innerHTML = `
    <section class="kpi-grid">
      ${kpi('tone-blue', 'list', 'Proyek dalam laporan', d.list.length, `${d.valid.length} dengan progres valid`)}
      ${kpi('tone-green', 'trend', 'Rata-rata aktual', d.avgActual === null ? '—' : fmtNum(d.avgActual) + '%', 'Hanya proyek valid')}
      ${kpi('tone-violet', 'flag', 'Rata-rata target (demo)', d.avgTarget === null ? '—' : fmtNum(d.avgTarget) + '%', 'Kurva-S ilustratif')}
      ${kpi('tone-red', 'alert', 'Pekerjaan terlambat', d.late.length, 'Belum 100% pada proyek terlambat')}
      ${kpi('tone-amber', 'clock', 'Update dalam periode', d.acts.length, PERIODS[f.period])}
    </section>

    <section class="card" style="margin-bottom:16px"><div class="card-head"><h3>Status & Perbandingan Target vs Aktual</h3></div>
      <div class="card-body"><p class="small muted" style="margin-bottom:10px">Target adalah <b>rencana ilustratif (data demo)</b> berbasis kurva-S dari tanggal mulai dan target selesai — bukan jadwal resmi dan bukan data dari Firebase.</p></div>
      <div class="table-wrap"><table><thead><tr><th>Proyek</th><th>Status</th><th class="num">Target (demo)</th><th class="num">Aktual</th><th class="num">Deviasi</th><th>Progres aktual</th></tr></thead><tbody>
        ${d.list.map(p => {
      const s = Progress.summary(p), t = Progress.planned(p); return `<tr><td><div class="cell-title"><a href="#/project/${p.id}">${esc(p.name)}</a></div><div class="cell-sub">${esc(p.code)}</div></td><td>${statusBadge(p.status)}</td>
          <td class="num">${fmtNum(t)}%</td><td class="num">${s.valid ? fmt2(s.value) + '%' : '<span class="muted">—</span>'}</td><td class="num">${s.valid ? dev(s.value, t) : '<span class="muted">—</span>'}</td><td style="min-width:160px">${progressCell(p)}</td></tr>`;
    }).join('')}
      </tbody></table></div></section>

    <div class="grid g-2-1">
      <section class="card"><div class="card-head"><h3>Progres per Scope</h3></div>
        <div class="table-wrap" style="margin-top:12px"><table><thead><tr><th>Proyek</th><th>Scope</th><th class="num">Bobot</th><th class="num">Aktual</th><th class="num">Kontribusi</th></tr></thead><tbody>
          ${d.list.map(p => p.scope.length ? p.scope.map((s, i) => `<tr><td class="cell-sub">${i === 0 ? esc(p.code) : ''}</td><td>${esc(s.name)}</td><td class="num">${fmt2(s.weight)}%</td><td class="num">${fmt2(s.actual)}%</td><td class="num">${fmt2(Progress.contribution(s))}%</td></tr>`).join('') + `<tr class="total-row"><td colspan="2">Total ${esc(p.code)}</td><td class="num">${fmt2(Progress.summary(p).total)}%</td><td></td><td class="num">${fmt2(Progress.summary(p).value)}%${Progress.summary(p).valid ? '' : ' ⚠'}</td></tr>` : `<tr><td class="cell-sub">${esc(p.code)}</td><td colspan="4" class="muted">Belum ada scope</td></tr>`).join('')}
        </tbody></table></div></section>
      <section class="card"><div class="card-head"><h3>Kurva-S <span class="demo-tag">DATA DEMO</span></h3></div>
        <div class="card-body stack">
          <select class="input no-print" id="curveSel" aria-label="Pilih proyek untuk kurva-S">${d.list.map(p => `<option value="${p.id}" ${p.id === curveId ? 'selected' : ''}>${esc(p.code)} — ${esc(p.name)}</option>`).join('')}</select>
          <div id="curveBox"></div></div></section>
    </div>

    <section class="card" style="margin-bottom:16px"><div class="card-head"><h3>Daftar Pekerjaan Terlambat</h3></div>
      ${d.late.length ? `<div class="table-wrap" style="margin-top:12px"><table><thead><tr><th>Proyek</th><th>Pekerjaan</th><th class="num">Bobot</th><th class="num">Progres</th><th class="num">Lewat target</th><th>Penanggung jawab</th></tr></thead><tbody>
        ${d.late.map(l => `<tr><td><a href="#/project/${l.project.id}">${esc(l.project.name)}</a></td><td>${esc(l.item.name)}</td><td class="num">${fmt2(l.item.weight)}%</td><td class="num">${fmt2(l.item.actual)}%</td><td class="num">${l.days} hari</td><td>${esc(l.project.pm)}</td></tr>`).join('')}</tbody></table></div>`
        : emptyState('checkcircle', 'Tidak ada pekerjaan terlambat', 'Semua pekerjaan berada pada proyek yang belum melewati target.')}
      <div class="card-body"><p class="small muted">Kriteria sederhana (mockup): pekerjaan belum 100% pada proyek berstatus “Terlambat” atau yang sudah melewati target selesai. Belum ada jadwal per pekerjaan.</p></div></section>

    <section class="card"><div class="card-head"><h3>Riwayat Update (${d.acts.length})</h3></div>
      ${d.acts.length ? `<div class="table-wrap" style="margin-top:12px"><table><thead><tr><th>Waktu</th><th>Proyek</th><th>Pengguna</th><th>Aktivitas</th></tr></thead><tbody>
        ${d.acts.slice(0, 40).map(a => `<tr><td class="nowrap">${fmtDateTime(a.at)}</td><td>${esc(a.project.code)}</td><td>${esc(a.user)}</td><td>${esc(a.text)}</td></tr>`).join('')}</tbody></table></div>
        ${d.acts.length > 40 ? `<div class="card-body small muted">Menampilkan 40 terbaru. Ekspor CSV memuat semuanya.</div>` : ''}`
        : emptyState('clock', 'Tidak ada update pada periode ini', 'Pilih periode yang lebih panjang.')}</section>`;
    renderCurve();
    $('#curveSel').addEventListener('change', e => { f.curve = e.target.value; renderCurve(); });
  }

  function renderCurve() {
    const p = Store.project(ui.reports.curve), box = $('#curveBox'); if (!p || !box) return;
    const sm = Progress.summary(p), t = Progress.timeFraction(p);
    if (!sm.valid) { box.innerHTML = `<div class="notice warn">${icon('alert')}<span>Progres proyek ini belum valid (total bobot ${fmt2(sm.total)}%), sehingga kurva aktual tidak ditampilkan.</span></div>`; return; }
    const planned = Array.from({ length: 11 }, (_, i) => ({ f: i / 10, v: Progress.sCurve(i / 10) * 100 }));
    const actual = t === 0 ? [{ f: 0, v: 0 }] : Array.from({ length: 11 }, (_, i) => ({ f: t * i / 10, v: sm.value * Progress.sCurve(i / 10) }));
    box.innerHTML = `${sCurveSVG({ planned, actual }, t)}
    <div class="chart-legend"><span><i style="background:var(--c-plan)"></i>Rencana (ilustratif)</span><span><i style="background:var(--c-run)"></i>Aktual (bentuk kurva disimulasikan)</span></div>
    <p class="small muted">Data demo: bentuk kurva digenerate dari tanggal proyek dan progres saat ini, <b>bukan</b> riwayat progres nyata dan bukan data Firebase.</p>`;
  }

  function exportProgressCSV() {
    const d = reportData();
    const rows = [['Kode', 'Proyek', 'Klien', 'Status', 'Penanggung Jawab', 'Target Selesai', 'Scope', 'Bobot (%)', 'Progres Aktual (%)', 'Kontribusi (%)', 'Total Bobot Proyek (%)', 'Progres Proyek (%)', 'Progres Valid', 'Target Rencana Demo (%)']];
    d.list.forEach(p => {
      const s = Progress.summary(p), head = [p.code, p.name, p.client, p.status, p.pm, p.endDate];
      const tail = [s.total, s.value, s.valid ? 'Ya' : 'Tidak', Progress.planned(p)];
      if (!p.scope.length) rows.push([...head, '', '', '', '', ...tail]);
      p.scope.forEach(x => rows.push([...head, x.name, x.weight, x.actual, Progress.contribution(x), ...tail]));
    });
    downloadCSV(`laporan-progres-${toISODate(new Date())}.csv`, rows);
    Toast.show(`CSV progres diunduh (${rows.length - 1} baris).`);
  }
  function exportHistoryCSV() {
    const d = reportData();
    const rows = [['Waktu', 'Kode', 'Proyek', 'Pengguna', 'Jenis', 'Aktivitas'], ...d.acts.map(a => [a.at, a.project.code, a.project.name, a.user, a.type, a.text])];
    downloadCSV(`laporan-riwayat-${toISODate(new Date())}.csv`, rows);
    Toast.show(`CSV riwayat diunduh (${rows.length - 1} baris).`);
  }

  /* ---------- F. Notifikasi ---------- */
  Views.notifications = function () {
    const f = ui.notif;
    setMain(`
    <div class="page-head"><div><h2>Notifikasi <span class="badge warn plain" id="notifCount"></span></h2>
      <p>Status baca disimpan lokal di browser ini. Sinkronisasi antar pengguna dan antar perangkat memerlukan backend.</p></div>
      <div class="page-actions"><button class="btn" type="button" data-action="mark-all-read" id="markAllBtn">${icon('check')} Tandai semua dibaca</button></div></div>
    <section class="card"><div class="toolbar">
      <div class="tabs" role="group" aria-label="Filter status baca">${[['all', 'Semua'], ['unread', 'Belum dibaca'], ['read', 'Sudah dibaca']].map(([k, l]) => `<button class="tab" type="button" data-action="notif-filter" data-v="${k}" aria-pressed="${f.read === k}">${l}</button>`).join('')}</div>
      <select class="input" id="notifType" aria-label="Filter jenis notifikasi"><option value="">Semua jenis</option>${Object.entries(NOTIF_TYPES).map(([k, t]) => `<option value="${k}" ${f.type === k ? 'selected' : ''}>${t.label}</option>`).join('')}</select></div>
      <div id="notifList"></div></section>`);
    renderNotifList();
    onDataChange = renderNotifList;
    $('#notifType').addEventListener('change', e => { f.type = e.target.value; renderNotifList(); });
  };

  function renderNotifList() {
    const box = $('#notifList'); if (!box) return;
    const f = ui.notif, unread = Notif.unreadCount();
    $('#notifCount').textContent = unread ? `${unread} belum dibaca` : 'Semua sudah dibaca';
    $('#markAllBtn').disabled = unread === 0;
    $$('[data-action="notif-filter"]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === f.read)));
    const list = Notif.list().filter(n => (f.read === 'all' || (f.read === 'unread') === !n.read) && (!f.type || n.type === f.type));
    box.innerHTML = list.length ? list.map(n => {
      const t = NOTIF_TYPES[n.type], p = Store.project(n.projectId);
      return `<div class="notif-item ${n.read ? '' : 'unread'}"><span class="ico ${t.tone}">${icon(t.icon)}</span>
      <div class="body"><div class="title">${n.read ? '' : '<span class="unread-dot" title="Belum dibaca"></span><span class="sr-only">Belum dibaca:</span>'}${esc(n.title)} <span class="badge neutral plain">${t.label}</span>${n.demo ? ' <span class="demo-tag">DEMO</span>' : ''}</div>
        <div>${esc(n.text)}</div><div class="cell-sub">${p ? esc(p.code) + ' · ' : ''}${fmtDateTime(n.at)} (${fmtRel(n.at)})</div>
        <div class="notif-actions"><button class="btn sm" type="button" data-action="toggle-notif" data-id="${n.id}">${n.read ? 'Tandai belum dibaca' : 'Tandai sudah dibaca'}</button>
          ${p || n.type === 'announcement' || n.type === 'direct' ? `<button class="btn sm primary" type="button" data-action="open-notif" data-id="${n.id}">${n.type === 'announcement' ? 'Lihat pengumuman' : n.type === 'direct' ? 'Buka pesan' : n.type === 'message' || n.type === 'instruction' ? 'Buka percakapan' : 'Buka proyek'}</button>` : ''}</div></div></div>`;
    }).join('') : emptyState('bell', 'Tidak ada notifikasi', f.read === 'unread' ? 'Semua notifikasi sudah dibaca.' : 'Belum ada notifikasi yang cocok dengan filter.');
  }

  function openNotification(id) {
    const n = state.notifications.find(x => x.id === id); if (!n) return;
    if (!n.read) { n.read = true; if (n.type === 'message') { /* tetap konsisten: status baca chat diatur dari halaman chat */ } Store.save(); }
    updateBadges();
    if (n.type === 'direct') { closePdBell(); location.hash = isAdminUI() ? `#/dm/${encodeURIComponent(n.threadId)}` : '#/dm'; return; }
    if (n.type === 'announcement' && Router.parse().name === 'project') { closePdBell(); const a = $('#annBox'); if (a) a.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    if ((n.type === 'message' || n.type === 'instruction') && Router.parse().name === 'project') { closePdBell(); location.hash = `#/chat/${n.projectId}`; return; }
    if (n.type === 'announcement') { location.hash = (isAdminUI() || isPM()) ? '#/dashboard' : (state.projects[0] ? `#/project/${state.projects[0].id}` : '#/projects'); return; }
    if (!Store.project(n.projectId)) return;
    location.hash = (n.type === 'message' || n.type === 'instruction') ? `#/chat/${n.projectId}` : `#/project/${n.projectId}`;
  }

  /* ---------- Komunikasi Proyek (chat per proyek) ---------- */
  const isMobile = () => window.matchMedia('(max-width: 820px)').matches;
  const isTouch = () => window.matchMedia('(pointer: coarse)').matches;
  const chatDrafts = {};

  Views.chat = function (arg) {
    const c = ui.chat;
    if (arg && Store.project(arg)) c.sel = arg;
    else {
      if (arg) history.replaceState(null, '', '#/chat');
      c.sel = isMobile() ? null : (Store.project(c.sel) ? c.sel : ((ChatStore.conversations()[0] || {}).project || {}).id || null);
      if (c.sel && !isMobile()) history.replaceState(null, '', `#/chat/${c.sel}`);
    }
    const standalone = !!arg && !!Store.project(arg);
    setMain(`
    ${standalone ? `<div class="page-head chat-standalone-head"><div><h2>Percakapan Proyek</h2><p>${esc(Store.project(arg).name)}</p></div><div class="page-actions"><a class="btn" href="#/project/${encodeURIComponent(arg)}">${icon('back', 'sm')} Kembali ke Monitoring</a></div></div>` : ''}
    <div class="chat ${standalone ? 'chat-standalone' : ''}" id="chat" data-view="${standalone ? 'thread' : (c.sel ? 'thread' : 'list')}">
      ${standalone ? '' : `<aside class="chat-list" aria-label="Daftar percakapan proyek">
        <div class="chat-list-head"><h3>Percakapan Proyek <span class="unread-badge" id="chatTotal" hidden></span></h3>
          <div class="search-box">${icon('search')}<input class="input" id="chatSearch" type="search" placeholder="Cari proyek atau percakapan…" value="${esc(c.q)}" aria-label="Cari proyek atau percakapan"></div></div>
        <div class="conv-scroll" id="convList"></div>
      </aside>`}
      <section class="chat-thread" id="thread" aria-label="Percakapan"></section>
    </div>`);
    if (!standalone) renderConvList();
    buildThread(true);
    onDataChange = refreshChat;
    const search = $('#chatSearch');
    if (search) search.addEventListener('input', e => { c.q = e.target.value; renderConvList(); });
  };

  function renderConvList() {
    const box = $('#convList'); if (!box) return;
    const c = ui.chat, q = c.q.toLowerCase();
    const total = ChatStore.totalUnread(), tb = $('#chatTotal');
    tb.hidden = total === 0; tb.textContent = total; tb.setAttribute('aria-label', `${total} pesan belum dibaca`);
    const items = ChatStore.conversations().filter(({ project: p, last }) => !q || [p.name, p.code, p.supervisor, last ? last.message : ''].some(x => String(x).toLowerCase().includes(q)));
    box.innerHTML = items.length ? items.map(({ project: p, last, unread }) => `
    <button class="conv ${p.id === c.sel ? 'active' : ''} ${unread ? 'has-unread' : ''}" type="button" data-action="chat-open" data-id="${p.id}" ${p.id === c.sel ? 'aria-current="true"' : ''}>
      <span class="av" aria-hidden="true">${esc(initials(p.name))}</span>
      <span class="info"><span class="r1"><span class="name">${esc(p.name)}</span><span class="time">${last ? fmtRel(last.createdAt) : ''}</span></span>
        <span class="sup" style="display:block">Supervisor: ${esc(p.supervisor)}</span>
        <span class="r3"><span class="snip">${last ? `${last.senderId === meId() ? 'Anda: ' : ''}${esc(last.message)}` : '<i>Belum ada pesan</i>'}</span>
          ${unread ? `<span class="unread-badge" aria-label="${unread} pesan belum dibaca">${unread}</span>` : ''}</span></span></button>`).join('')
      : emptyState('search', 'Tidak ada percakapan yang cocok', 'Ubah kata kunci pencarian.');
  }

  /* Membangun panel kanan (header, pesan, composer) untuk proyek terpilih */
  function buildThread(initial) {
    const c = ui.chat, th = $('#thread'); if (!th) return;
    const p = Store.project(c.sel);
    if (!p) {
      th.innerHTML = `<div class="chat-empty">${icon('chat')}<h4>Pilih proyek untuk memulai</h4><p>Setiap proyek punya ruang percakapan sendiri. Pesan satu proyek tidak muncul di proyek lain.</p></div>`;
      return;
    }
    th.innerHTML = `
    <div id="threadHead"></div>
    <div class="msgs" id="msgs" role="log" aria-live="polite" aria-label="Riwayat pesan ${esc(p.name)}"></div>
    <form class="composer" id="composer" data-form="chat-send" autocomplete="off">
      <div class="composer-row">
        <button class="btn icon-btn" type="button" data-action="chat-attach" aria-label="Lampirkan file (mockup)" title="Lampiran (mockup)">${icon('clip')}</button>
        <textarea id="msgInput" rows="1" maxlength="2000" placeholder="Tulis pesan untuk tim ${esc(p.name)}…" aria-label="Tulis pesan"></textarea>
        <button class="btn primary send-btn" id="sendBtn" type="submit" aria-label="Kirim pesan" disabled>${icon('send')}</button></div>
      <div class="opts">${!state.live || (Live.writer && Live.writer.role === 'admin_pusat') ? '<label class="checkbox-row"><input type="checkbox" id="msgInstr"> Tandai sebagai instruksi Admin HQ</label>' : '<span></span>'}
        <span>${isTouch() ? 'Ketuk kirim untuk mengirim' : 'Enter kirim · Shift+Enter baris baru'}</span></div>
    </form>`;
    renderThreadHead(); renderMsgs(true, initial);
    const ta = $('#msgInput'), send = $('#sendBtn');
    ta.value = chatDrafts[p.id] || ''; autoGrow(ta); send.disabled = !ta.value.trim();
    ta.addEventListener('input', () => { chatDrafts[p.id] = ta.value; autoGrow(ta); send.disabled = !ta.value.trim(); });
    ta.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !isTouch()) { e.preventDefault(); if (ta.value.trim()) $('#composer').requestSubmit(); } });
  }
  function autoGrow(ta) { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 140) + 'px'; }

  function renderThreadHead() {
    const p = Store.project(ui.chat.sel), el = $('#threadHead'); if (!p || !el) return;
    const unread = ChatStore.unreadCount(p.id), has = ChatStore.messages(p.id).some(m => m.senderId !== meId());
    el.innerHTML = `
    <div class="thread-head"><button class="icon-btn thread-back" type="button" data-action="chat-back" aria-label="Kembali ke daftar proyek">${icon('back')}</button>
      <span class="th-av" aria-hidden="true">${esc(initials(p.name) || 'P')}</span>
      <div class="ttl"><h3>${esc(p.name)} ${demoTag(p)}</h3><div class="sub"><b>${esc(p.supervisor || 'Supervisor')}</b> ↔ Admin HQ · ${esc(p.code)} · ${esc(p.status)}</div></div>
      <button class="btn sm th-btn" type="button" data-action="chat-toggle-read" ${has ? '' : 'disabled'}>${unread ? `${icon('check', 'sm')} Tandai dibaca (${unread})` : 'Tandai belum dibaca'}</button></div>
    <div class="thread-note">${state.live
      ? `Terhubung ke Cloud Firestore · Anda masuk sebagai <b>${esc(state.profile.name)}</b>`
      : `Data demo tersimpan lokal — pesan tidak dikirim ke siapa pun. <button class="btn ghost sm" type="button" data-action="chat-simulate" style="height:22px;padding:0 6px;color:inherit;text-decoration:underline">Simulasikan pesan masuk (demo)</button>`} · <a href="#/project/${p.id}" style="color:inherit;text-decoration:underline">Detail proyek</a></div>`;
  }

  function renderMsgs(forceBottom, initial) {
    const p = Store.project(ui.chat.sel), box = $('#msgs'); if (!p || !box) return;
    const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 90;
    const msgs = ChatStore.messages(p.id), c = ui.chat;
    if (!msgs.length) {
      box.innerHTML = `<div class="chat-empty">${icon('chat')}<h4>Belum ada pesan di proyek ini</h4><p>Kirim pesan pertama kepada ${esc(p.supervisor)} dan tim ${esc(p.name)}. Percakapan ini hanya untuk proyek ini.</p></div>`;
      return;
    }
    let lastDay = '', newShown = false, html = '';
    msgs.forEach(m => {
      const day = dayLabel(m.createdAt);
      if (day !== lastDay) { html += `<div class="day-sep">${esc(day)}</div>`; lastDay = day; }
      if (!newShown && ChatStore.isUnread(m)) { html += '<div class="new-sep" id="newSep">Pesan baru</div>'; newShown = true; }
      const me = m.senderId === meId();
      const nm = m.senderName || (me ? 'Anda' : 'Pengirim'), rl = m.senderRole || '';
      const read = !state.live && ChatStore.deliveryLabel(m) === 'Dibaca';
      const ticks = me ? `<svg class="ticks ${read ? 'read' : ''}" viewBox="0 0 18 18" aria-label="${read ? 'Dibaca' : 'Terkirim'}"><path d="M1.5 9.5l3.5 3.5 6-8M7.5 12.5l1 1 6.5-8.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>` : '';
      html += `<div class="msg ${me ? 'me' : 'other'} ${m.id === c.fresh ? 'fresh' : ''}">
      <div class="bubble"><div class="who-in"><b>${esc(nm)}</b>${rl && rl.toLowerCase() !== nm.toLowerCase() ? `<span>· ${esc(rl)}</span>` : ''}${m.kind === 'instruction' ? '<span class="tag instr">INSTRUKSI</span>' : ''}${m.demo ? '<span class="tag">DEMO</span>' : ''}</div>
        <div class="txt">${esc(m.message)}</div>
        <div class="meta-in"><time>${fmtTime(m.createdAt)}</time>${ticks}</div></div></div>`;
    });
    box.innerHTML = html;
    c.fresh = null;
    const sep = $('#newSep');
    if (initial && sep) box.scrollTop = Math.max(0, sep.offsetTop - 60);
    else if (forceBottom || nearBottom) box.scrollTop = box.scrollHeight;
  }

  function refreshChat() { renderConvList(); renderThreadHead(); renderMsgs(false); }

  function chatOpen(id) {
    const c = ui.chat;
    c.sel = id;
    history.pushState(null, '', `#/chat/${id}`);
    $('#chat').dataset.view = 'thread';
    renderConvList(); buildThread(true);
    window.scrollTo(0, 0);
    if (!isMobile()) { const ta = $('#msgInput'); if (ta) ta.focus({ preventScroll: true }); }
  }
  function chatBack() {
    ui.chat.sel = null;
    history.pushState(null, '', '#/chat');
    $('#chat').dataset.view = 'list';
    renderConvList(); buildThread();
  }
  function sendChatMessage(form) {
    const pid = ui.chat.sel, ta = $('#msgInput', form);
    const text = ta.value.trim(); if (!text || !pid) return;
    const instrEl = $('#msgInstr', form), instr = !!(instrEl && instrEl.checked);
    ta.value = ''; chatDrafts[pid] = ''; autoGrow(ta); $('#sendBtn', form).disabled = true;
    const m = ChatStore.send(pid, text, { instruction: instr });
    if (!m) return;
    ui.chat.fresh = m.id;
    renderMsgs(true);
    if (instrEl) instrEl.checked = false;
    if (!state.live) Toast.show(instr ? 'Instruksi ditambahkan ke data demo lokal.' : 'Pesan ditambahkan ke data demo lokal.');
    ta.focus();
  }

  /* ---------- Pesan Langsung: Admin <-> Supervisor / PM / Tim (tidak terkait proyek) ---------- */
  const DM = {
    /* Pesan langsung dianggap belum dibaca sampai percakapan dibuka (tanpa batas awal), agar pesan Admin sebelum login pertama tidak terlewat. */
    lastRead(tid) { return (Live.store(`pcc.dmread.${state.uid}`, {}))[tid] || ''; },
    setRead(tid, iso) { const k = `pcc.dmread.${state.uid}`, m = Live.store(k, {}); m[tid] = iso; Live.save(k, m); },
    isUnread(m) { return !!state.live && m.senderId !== meId() && String(m.at) > DM.lastRead(m.threadId); },
    messages(tid) { return (state.dm || []).filter(m => m.threadId === tid); },
    unread(tid) { return DM.messages(tid).filter(m => DM.isUnread(m)).length; },
    total() { return state.live ? (state.dm || []).filter(m => DM.isUnread(m)).length : 0; },
    markRead(tid) {
      const L = DM.messages(tid); if (!L.length) return;
      const last = L[L.length - 1].at;
      if (String(last) > DM.lastRead(tid)) { DM.setRead(tid, last); Live.rebuildNotifs(); updateBadges(); }
    },
    threads() {
      const users = (state.users || []).filter(u => u.roleCode && u.roleCode !== 'admin_pusat' && (u.active || DM.messages(u.id).length));
      return users.map(u => { const L = DM.messages(u.id); return { user: u, last: L[L.length - 1] || null, unread: DM.unread(u.id) }; })
        .sort((a, b) => (b.last ? 1 : 0) - (a.last ? 1 : 0) || String(b.last ? b.last.at : '').localeCompare(String(a.last ? a.last.at : '')) || a.user.name.localeCompare(b.user.name));
    }
  };
  const dmDrafts = {};

  Views.dm = function (arg) {
    if (!state.live) { setMain(`<div class="card">${emptyState('chat', 'Pesan langsung memerlukan login', 'Fitur ini aktif setelah Anda masuk dengan akun Firebase.')}</div>`); return; }
    ui.dm = ui.dm || { sel: null, q: '' };
    const d = ui.dm, admin = isAdminUI();
    if (admin) {
      if (arg) d.sel = arg;
      else if (!isMobile() && !d.sel) { const t = DM.threads()[0]; d.sel = t ? t.user.id : null; }
    } else d.sel = meId();
    setMain(`
    ${admin ? '' : `<div class="page-head chat-standalone-head"><div><h2>Pesan ke Admin</h2><p>Percakapan pribadi Anda dengan Admin Kantor Pusat, di luar chat proyek. Cocok untuk kabar saat Anda sedang survei, cuti, atau di luar kantor.</p></div></div>`}
    <div class="chat ${admin ? '' : 'chat-standalone'}" id="chat" data-view="${arg || !admin ? 'thread' : 'list'}">
      ${admin ? `<aside class="chat-list" aria-label="Daftar percakapan langsung">
        <div class="chat-list-head"><h3>Pesan Langsung <span class="unread-badge" id="dmTotal" hidden></span></h3>
          <div class="search-box">${icon('search')}<input class="input" id="dmSearch" type="search" placeholder="Cari nama atau peran…" value="${esc(d.q)}" aria-label="Cari percakapan"></div></div>
        <div class="conv-scroll" id="dmList"></div></aside>` : ''}
      <section class="chat-thread" id="dmThread" aria-label="Percakapan langsung"></section>
    </div>`);
    if (admin) renderDmList();
    buildDmThread();
    onDataChange = refreshDm;
    const sr = $('#dmSearch'); if (sr) sr.addEventListener('input', e => { d.q = e.target.value; renderDmList(); });
    if (d.sel) DM.markRead(d.sel);
  };

  function renderDmList() {
    const box = $('#dmList'); if (!box) return;
    const d = ui.dm, q = d.q.toLowerCase(), total = DM.total(), tb = $('#dmTotal');
    if (tb) { tb.hidden = total === 0; tb.textContent = total; }
    const items = DM.threads().filter(({ user: u, last }) => !q || [u.name, u.role, u.email, last ? last.text : ''].some(x => String(x).toLowerCase().includes(q)));
    box.innerHTML = items.length ? items.map(({ user: u, last, unread }) => `
    <button class="conv ${u.id === d.sel ? 'active' : ''} ${unread ? 'has-unread' : ''}" type="button" data-action="dm-open" data-id="${esc(u.id)}" ${u.id === d.sel ? 'aria-current="true"' : ''}>
      <span class="av" aria-hidden="true">${esc(initials(u.name))}</span>
      <span class="info"><span class="r1"><span class="name">${esc(u.name)}</span><span class="time">${last ? fmtRel(last.at) : ''}</span></span>
        <span class="sup" style="display:block">${esc(u.role)}${u.active ? '' : ' · nonaktif'}</span>
        <span class="r3"><span class="snip">${last ? `${last.senderId === meId() ? 'Anda: ' : ''}${esc(last.text)}` : '<i>Belum ada pesan</i>'}</span>
          ${unread ? `<span class="unread-badge" aria-label="${unread} pesan belum dibaca">${unread}</span>` : ''}</span></span></button>`).join('')
      : emptyState('search', 'Belum ada akun staf', 'Tambah supervisor, PM, atau tim lapangan di Pengaturan → Tambah Pengguna.');
  }

  function buildDmThread() {
    const d = ui.dm, th = $('#dmThread'); if (!th) return;
    const tid = d.sel, admin = isAdminUI();
    if (!tid) { th.innerHTML = `<div class="chat-empty">${icon('chat')}<h4>Pilih orang untuk memulai</h4><p>Pesan langsung bersifat pribadi dan tidak terkait proyek tertentu.</p></div>`; return; }
    const u = (state.users || []).find(x => x.id === tid);
    const title = admin ? (u ? u.name : 'Pengguna') : 'Admin Kantor Pusat';
    const sub = admin ? `${u ? u.role : ''}${u && u.email ? ' · ' + u.email : ''}` : 'Dapat dibaca oleh semua Admin Kantor Pusat';
    th.innerHTML = `
    <div class="thread-head"><button class="icon-btn thread-back" type="button" data-action="dm-back" aria-label="Kembali ke daftar">${icon('back')}</button>
      <span class="th-av" aria-hidden="true">${esc(initials(title) || 'A')}</span>
      <div class="ttl"><h3>${esc(title)}</h3><div class="sub">${esc(sub)}</div></div></div>
    <div class="thread-note">Percakapan pribadi, tidak terkait proyek tertentu · Anda masuk sebagai <b>${esc(state.profile.name)}</b></div>
    <div class="msgs" id="dmMsgs" role="log" aria-live="polite" aria-label="Riwayat pesan"></div>
    <form class="composer" id="dmComposer" data-form="dm-send" autocomplete="off">
      <div class="composer-row">
        <textarea id="dmInput" rows="1" maxlength="2000" placeholder="Tulis pesan…" aria-label="Tulis pesan"></textarea>
        <button class="btn primary send-btn" id="dmSend" type="submit" aria-label="Kirim pesan" disabled>${icon('send')}</button></div>
      <div class="opts"><span></span><span>${isTouch() ? 'Ketuk kirim untuk mengirim' : 'Enter kirim · Shift+Enter baris baru'}</span></div>
    </form>`;
    renderDmMsgs(true);
    const ta = $('#dmInput'), send = $('#dmSend');
    ta.value = dmDrafts[tid] || ''; autoGrow(ta); send.disabled = !ta.value.trim();
    ta.addEventListener('input', () => { dmDrafts[tid] = ta.value; autoGrow(ta); send.disabled = !ta.value.trim(); });
    ta.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !isTouch()) { e.preventDefault(); if (ta.value.trim()) $('#dmComposer').requestSubmit(); } });
  }

  function renderDmMsgs(forceBottom) {
    const box = $('#dmMsgs'), tid = ui.dm && ui.dm.sel; if (!box || !tid) return;
    const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 90;
    const msgs = DM.messages(tid);
    if (!msgs.length) { box.innerHTML = `<div class="chat-empty">${icon('chat')}<h4>Belum ada pesan</h4><p>${isAdminUI() ? 'Kirim pesan pertama. Penerima akan melihat notifikasi saat membuka aplikasi.' : 'Tulis pesan untuk Admin Kantor Pusat, misalnya kabar saat survei lokasi atau cuti.'}</p></div>`; return; }
    let lastDay = '', html = '';
    msgs.forEach(m => {
      const day = dayLabel(m.at);
      if (day !== lastDay) { html += `<div class="day-sep">${esc(day)}</div>`; lastDay = day; }
      const me = m.senderId === meId(), nm = m.senderName || (me ? 'Anda' : 'Pengirim'), rl = m.senderRole || '';
      html += `<div class="msg ${me ? 'me' : 'other'}"><div class="bubble"><div class="who-in"><b>${esc(nm)}</b>${rl && rl.toLowerCase() !== nm.toLowerCase() ? `<span>· ${esc(rl)}</span>` : ''}</div>
        <div class="txt">${esc(m.text)}</div><div class="meta-in"><time>${fmtTime(m.at)}</time></div></div></div>`;
    });
    box.innerHTML = html;
    if (forceBottom || nearBottom) box.scrollTop = box.scrollHeight;
  }

  function refreshDm() {
    if (Router.parse().name !== 'dm') return;
    if (isAdminUI() && ui.dm && !ui.dm.sel && !isMobile()) { const t = DM.threads()[0]; if (t) { ui.dm.sel = t.user.id; buildDmThread(); } }
    if (isAdminUI()) renderDmList();
    renderDmMsgs(false);
    if (ui.dm && ui.dm.sel && !document.hidden) DM.markRead(ui.dm.sel);
  }

  async function sendDm(form) {
    const tid = ui.dm && ui.dm.sel, ta = $('#dmInput', form), text = ta.value.trim();
    if (!text || !tid) return;
    const W = Live.writer;
    if (!W || !W.service.sendDirect) { Toast.show('Mode Firestore belum siap.', 'error'); return; }
    ta.value = ''; dmDrafts[tid] = ''; autoGrow(ta); $('#dmSend', form).disabled = true;
    try { await W.service.sendDirect({ threadId: tid, text, senderId: W.uid, senderName: state.profile.name, senderRole: W.role, at: new Date().toISOString() }); }
    catch (err) { ta.value = text; dmDrafts[tid] = text; autoGrow(ta); $('#dmSend', form).disabled = false; Toast.show(err && err.code === 'permission-denied' ? 'Ditolak oleh Security Rules. Pastikan firestore.rules terbaru sudah dipublikasikan.' : 'Pesan gagal dikirim.', 'error'); }
    ta.focus();
  }

  /* ---------- G. Pengaturan & Manajemen Pengguna ---------- */
  const PERM_MATRIX = [
    ['Melihat dashboard & seluruh proyek', 'Ya', 'Ya', 'Proyek ditugaskan', 'Proyek ditugaskan'],
    ['Menambah / mengedit data proyek', 'Ya', 'Ya', 'Tidak', 'Tidak'],
    ['Memperbarui progres & foto bukti', 'Sesuai kewenangan', 'Sesuai kewenangan', 'Proyek ditugaskan', 'Proyek ditugaskan'],
    ['Mengubah lokasi proyek', 'Tidak', 'Ya', 'Tidak', 'Tidak'],
    ['Mengelola akun & penempatan akses', 'Sesuai kewenangan', 'Sesuai kewenangan', 'Tidak', 'Tidak'],
    ['Komunikasi proyek (chat)', 'Ya', 'Ya', 'Proyek ditugaskan', 'Proyek ditugaskan'],
    ['Laporan & ekspor', 'Ya', 'Ya', 'Proyek ditugaskan', 'Tidak']
  ];
  const permCell = v => `<td class="${v === 'Ya' ? 'yes' : v === 'Tidak' ? 'no' : 'partial'}">${v === 'Ya' ? '✓ Ya' : v === 'Tidak' ? '—' : esc(v)}</td>`;

  Views.settings = function () {
    const pf = state.profile;
    setMain(`
    <div class="page-head"><div><h2>Pengaturan & Manajemen Pengguna</h2><p>${state.live ? 'Akun tim proyek (login Firebase), penugasan proyek, rancangan hak akses, dan tampilan.' : 'Profil admin demo, daftar pengguna demo, rancangan hak akses, dan tampilan.'}</p></div></div>
    <div class="settings-grid">
      <section class="card"><div class="card-head"><h3>${state.live ? 'Profil Admin' : 'Profil Admin (Demo)'}</h3></div><div class="card-body">
        <form data-form="profile-save" novalidate><div class="form-error-summary" role="alert" hidden></div><div class="form-grid">
          ${fieldHTML({ id: 'name', label: 'Nama tampilan', required: true, value: pf.name, attrs: 'maxlength="60"' })}
          ${fieldHTML({ id: 'email', label: 'Email', type: 'email', required: true, value: pf.email })}
          <div class="field full"><span class="lbl">Peran</span><div><span class="badge neutral plain">Admin Kantor Pusat</span> <span class="small muted">${state.live ? 'Nama ini dipakai sebagai nama pengirim di chat.' : 'Label tampilan saja — belum ada autentikasi.'}</span></div></div>
        </div><div style="margin-top:14px"><button class="btn primary" type="submit">Simpan Profil</button></div></form></div></section>
      <section class="card"><div class="card-head"><h3>Tampilan</h3></div><div class="card-body stack">
        <div class="radio-row" role="radiogroup" aria-label="Tema">
          <label class="radio-card"><input type="radio" name="theme" value="light" ${Theme.current() === 'light' ? 'checked' : ''}> ${icon('sun')} Terang</label>
          <label class="radio-card"><input type="radio" name="theme" value="dark" ${Theme.current() === 'dark' ? 'checked' : ''}> ${icon('moon')} Gelap</label></div>
        <p class="small muted">Preferensi tema disimpan di localStorage browser ini dan dipakai lagi saat halaman dibuka ulang.</p>
        <hr style="border:0;border-top:1px solid var(--border);width:100%">
        <div><b>Data demo lokal</b><p class="small muted" style="margin:4px 0 10px">Proyek, chat, notifikasi, dan pengguna tersimpan hanya di browser ini. Mengatur ulang akan mengembalikan data contoh awal.</p>
          <button class="btn danger" type="button" data-action="reset-demo">${icon('reset')} Reset data demo</button></div></div></section>
    </div>

    <section class="card" style="margin-bottom:16px"><div class="card-head"><h3>${state.live ? 'Akun Tim Proyek' : 'Daftar Pengguna (Demo)'}</h3>
      <button class="btn sm primary" type="button" data-action="user-add">${icon('plus', 'sm')} Tambah Pengguna</button></div>
      <div class="table-wrap" style="margin-top:12px"><table><thead><tr><th>Nama</th><th>Email</th><th>Peran</th><th>Proyek ditugaskan</th><th>Status</th><th>Aksi</th></tr></thead><tbody id="userBody"></tbody></table></div></section>

    <section class="card" style="margin-bottom:16px"><div class="card-head"><h3>Rancangan Hak Akses per Peran</h3></div><div class="card-body stack">
      <div class="notice warn">${icon('lock')}<span><b>Rancangan, belum ditegakkan.</b> Tanpa autentikasi dan pemeriksaan backend, tabel ini tidak mengamankan apa pun. Pada sistem operasional, pembatasan harus diterapkan di backend atau aturan database (mis. Firebase Security Rules), bukan sekadar menyembunyikan tombol di frontend. Isi tabel masih perlu disepakati dengan perusahaan.</span></div>
      <div class="table-wrap"><table class="matrix"><thead><tr><th>Kemampuan</th>${ROLES.map(r => `<th>${r}</th>`).join('')}</tr></thead>
        <tbody>${PERM_MATRIX.map(r => `<tr><td>${r[0]}</td>${r.slice(1).map(permCell).join('')}</tr>`).join('')}</tbody></table></div></div></section>

    <section class="card"><div class="card-head"><h3>Status Integrasi (Jujur)</h3></div><div class="card-body"><ul class="status-list">
      <li>${icon(state.live ? 'check' : 'x', 'sm')}<span><b>Firebase / Firestore:</b> ${state.live ? 'proyek dan lingkup dibaca dari project <code>my-cv-project-33552</code> saat login Proyek, lingkup, progres, dan chat tersimpan sesuai Rules; chat realtime. Notifikasi diturunkan dari aktivitas, status baca per browser.' : 'belum terhubung.'} Dashboard percontohan (<code>peminjaman-ruangan-7f797</code>) tidak diakses maupun diubah.</span></li>
      <li>${icon(state.live ? 'check' : 'x', 'sm')}<span><b>Autentikasi:</b> ${state.live ? 'login Firebase dengan pemeriksaan role di users/{uid}. Keamanan data bergantung pada Firestore Security Rules, bukan tampilan ini.' : 'belum ada. Profil &amp; peran di atas hanya tampilan.'}</span></li>
      <li>${icon(state.live ? 'check' : 'x', 'sm')}<span><b>Sinkronisasi lintas perangkat:</b> ${state.live ? 'chat realtime; data proyek dimuat saat login (muat ulang halaman untuk melihat perubahan pengguna lain).' : 'tidak ada. Data hanya di localStorage browser ini.'}</span></li>
      <li>${icon('x', 'sm')}<span><b>Unggah file/foto:</b> belum tersedia; membutuhkan backend atau layanan penyimpanan.</span></li></ul></div></section>`);
    renderUsers();
    onDataChange = renderUsers;
  };

  const ROLE_CODE = Object.fromEntries(Object.entries(ROLE_LABEL).map(([k, v]) => [v, k]));
  const isSelfUser = u => state.live ? u.id === state.uid : u.id === ADMIN.id;
  function renderUsers() {
    const body = $('#userBody'); if (!body) return;
    body.innerHTML = state.users.map(u => {
      const names = u.projects.map(id => (Store.project(id) || {}).code).filter(Boolean);
      const self = isSelfUser(u);
      return `<tr><td class="cell-title">${esc(u.name)} ${u.demo ? '<span class="demo-tag">DEMO</span>' : ''}</td><td class="cell-sub">${esc(u.email)}</td><td>${esc(u.role)}</td>
      <td class="cell-sub" title="${esc(names.join(', '))}">${names.length > 2 ? `${names.length} proyek` : esc(names.join(', ') || '—')}</td>
      <td><span class="badge ${u.active ? 'done' : 'neutral'}">${u.active ? 'Aktif' : 'Nonaktif'}</span></td>
      <td><div class="row-actions"><button class="btn sm" type="button" data-action="user-edit" data-id="${u.id}" aria-label="Edit ${esc(u.name)}">${icon('edit', 'sm')} Edit</button>
        <button class="btn sm" type="button" data-action="user-toggle" data-id="${u.id}" ${self ? 'disabled title="Akun yang sedang dipakai tidak dapat dinonaktifkan"' : ''}>${u.active ? 'Nonaktifkan' : 'Aktifkan'}</button></div></td></tr>`;
    }).join('');
  }

  function openUserForm(id) {
    const u = id ? state.users.find(x => x.id === id) : null;
    const v = u || { name: '', email: '', role: 'Supervisor Proyek', projects: [], active: true };
    Modal.open({
      title: u ? 'Edit Pengguna' : 'Tambah Pengguna', wide: true,
      body: `<form id="modalForm" novalidate><div class="form-error-summary" role="alert" hidden></div><div class="form-grid">
      ${fieldHTML({ id: 'name', label: 'Nama pengguna', required: true, value: v.name, attrs: 'maxlength="80"' })}
      ${fieldHTML({ id: 'email', label: 'Email', type: 'email', required: true, value: v.email, attrs: state.live && u ? 'readonly' : '', hint: state.live && u ? 'Email login tidak dapat diubah dari sini.' : '' })}
      ${state.live && !u ? fieldHTML({ id: 'password', label: 'Password awal (min. 6 karakter)', required: true, value: '', attrs: 'minlength="6" autocomplete="new-password"', hint: 'Berikan email dan password ini kepada yang bersangkutan untuk login.' }) : ''}
      ${fieldHTML({ id: 'role', label: 'Peran', required: true, tag: 'select', value: v.role, attrs: u && isSelfUser(u) ? 'disabled' : '', options: ROLES.map(r => ({ value: r, label: r })), hint: state.live ? 'Admin Kantor Pusat (BOD) = akses penuh. Project Manager, Supervisor & Tim Lapangan = hanya proyek yang ditugaskan (PM & Supervisor dapat update progres; PM juga chat & melihat laporan).' : '' })}
      <div class="field"><span class="lbl">Status akun</span><label class="checkbox-row" style="min-height:38px"><input type="checkbox" name="active" ${v.active ? 'checked' : ''} ${u && isSelfUser(u) ? 'disabled' : ''}> Akun aktif</label></div>
      <div class="field full"><span class="lbl">Proyek yang ditugaskan</span><div class="form-grid" style="gap:6px 12px">${Store.projects().map(p => `<label class="checkbox-row"><input type="checkbox" name="proj" value="${p.id}" ${v.projects.includes(p.id) ? 'checked' : ''}> <span>${esc(p.code)} — ${esc(p.name)}</span></label>`).join('') || '<span class="muted">Belum ada proyek.</span>'}</div>
        <span class="hint">${state.live ? 'Disimpan ke Firestore (assignedUsers). Supervisor / Tim Lapangan hanya melihat dan chat di proyek yang dicentang.' : 'Penempatan ini hanya data demo. Pada sistem operasional, aturan akses sebenarnya harus ikut diperbarui di backend.'}</span></div></div></form>`,
      actions: [{ label: 'Batal', close: true }, { label: 'Simpan', kind: 'primary', submit: true }],
      onSubmit: form => {
        const d = Validate.data(form), e = {};
        if (!d.name) e.name = 'Nama pengguna wajib diisi.';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email || '')) e.email = 'Masukkan alamat email yang valid.';
        else if (state.users.some(x => x.id !== (u && u.id) && x.email.toLowerCase() === d.email.toLowerCase())) e.email = 'Email sudah dipakai pengguna lain.';
        if (u && isSelfUser(u)) d.role = u.role;
        if (!ROLES.includes(d.role)) e.role = 'Pilih peran.';
        if (state.live && !u && (d.password || '').length < 6) e.password = 'Password minimal 6 karakter.';
        if (!Validate.show(form, e)) return;
        if (state.live) { liveSaveUser(form, u, d); return; }
        const projects = $$('input[name="proj"]:checked', form).map(x => x.value);
        const active = u && u.id === ADMIN.id ? true : form.elements.active.checked;
        if (u) Object.assign(u, { name: d.name, email: d.email, role: d.role, projects, active });
        else state.users.push({ id: uid('u'), name: d.name, email: d.email, role: d.role, projects, active, demo: false });
        Store.save(); Modal.close();
        Toast.show(u ? 'Pengguna diperbarui (data demo lokal).' : 'Pengguna ditambahkan (data demo lokal).');
      }
    });
  }

  /* Mode live: tulis akun + penugasan ke Firestore (Rules hanya mengizinkan admin_pusat). */
  function syncAssigned(uid, projects) {
    state.projects.forEach(p => { const cur = p.assignedUsers || []; p.assignedUsers = projects.includes(p.id) ? [...new Set([...cur, uid])] : cur.filter(x => x !== uid); });
  }
  const userErr = err => ({
    'auth/email-already-in-use': 'Email ini sudah terdaftar di Authentication.',
    'auth/weak-password': 'Password terlalu lemah (minimal 6 karakter).',
    'auth/invalid-email': 'Format email tidak valid.',
    'auth/operation-not-allowed': 'Login Email/Password belum diaktifkan di Firebase Authentication.',
    'permission-denied': 'Ditolak oleh Security Rules: hanya Admin Kantor Pusat aktif yang boleh mengelola akun.'
  }[err && err.code] || `Gagal menyimpan akun: ${(err && err.message) || 'kesalahan tidak diketahui'}`);
  async function liveSaveUser(form, u, d) {
    const W = Live.writer;
    if (!W || !W.service.createStaff) { Toast.show('Mode Firestore belum siap.', 'error'); return; }
    const btn = $('.modal-foot .btn.primary'); if (btn) btn.disabled = true;
    const projects = $$('input[name="proj"]:checked', form).map(x => x.value);
    const self = !!(u && isSelfUser(u));
    const roleCode = self ? 'admin_pusat' : ROLE_CODE[d.role];
    const active = self ? true : form.elements.active.checked;
    try {
      if (u) {
        const before = u.projects || [];
        await W.service.updateStaff(u.id, { name: d.name, role: roleCode, active }, projects.filter(x => !before.includes(x)), before.filter(x => !projects.includes(x)));
        Object.assign(u, { name: d.name, role: roleLabel(roleCode), roleCode, active, projects });
        syncAssigned(u.id, projects);
      } else {
        const id = await W.service.createStaff({ name: d.name, email: d.email, password: d.password, role: roleCode, active, projectIds: projects }, W.uid);
        state.users.push({ id, name: d.name, email: d.email, role: roleLabel(roleCode), roleCode, active, projects, demo: false });
        syncAssigned(id, projects);
      }
      Modal.close(); renderUsers();
      Toast.show(u ? 'Pengguna diperbarui di Firestore.' : `Akun ${d.name} dibuat. Beri tahu email & password-nya untuk login.`);
    } catch (err) {
      console.error('Gagal menyimpan akun:', err);
      Toast.show(userErr(err) + (err && err.createdUid ? ` Akun login sudah terbuat (UID ${err.createdUid}) tetapi profil belum tersimpan.` : ''), 'error');
      if (btn) btn.disabled = false;
    }
  }
  async function liveToggleUser(u) {
    const W = Live.writer; if (!W || !W.service.updateStaff) return;
    try {
      await W.service.updateStaff(u.id, { name: u.name, role: u.roleCode, active: !u.active }, [], []);
      u.active = !u.active; renderUsers();
      Toast.show(`Akun ${u.active ? 'diaktifkan' : 'dinonaktifkan'}.`);
    } catch (err) { Toast.show(userErr(err), 'error'); }
  }

  function applyProfile() {
    const n = state.profile.name;
    $('#profileName').textContent = n; $('#avatar').textContent = initials(n) || 'AH';
  }

  /* ==========================================================================
     9b. CETAK LAPORAN (per proyek & global proyek aktif)
     Dibuat di #printRoot lalu dicetak lewat dialog cetak browser (bisa "Simpan sebagai PDF").
     Seluruh isi berasal dari data demo lokal; tidak ada data dikirim ke mana pun.
     ========================================================================== */
  const PrintReport = {
    ACTIVE: ['Berjalan', 'Terlambat'],
    activeProjects() { return Store.projects().filter(p => this.ACTIVE.includes(p.status)); },
    root() {
      let r = $('#printRoot');
      if (!r) { r = document.createElement('div'); r.id = 'printRoot'; r.setAttribute('aria-hidden', 'true'); document.body.appendChild(r); }
      return r;
    },
    run(html, docTitle) {
      const prevTitle = document.title;
      this.root().innerHTML = html;
      document.body.classList.add('printing');
      document.title = docTitle;
      const done = () => {
        document.body.classList.remove('printing'); document.title = prevTitle;
        this.root().innerHTML = '';
        window.removeEventListener('afterprint', done);
      };
      window.addEventListener('afterprint', done);
      window.print();
    },
    stamp() { return new Date().toLocaleString('id-ID', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' WIB'; },
    head(title, sub, badge) {
      return `<header class="pr-head"><img src="assets/logo.png" alt="" width="44" height="44">
      <div class="pr-head-text"><div class="pr-kicker">Project Control Center — HQ Jakarta</div><h1>${esc(title)}</h1>${sub ? `<div class="pr-sub">${sub}</div>` : ''}</div>
      <div class="pr-head-meta">${badge || ''}<div>Dicetak: ${esc(this.stamp())}</div><div>Oleh: ${esc(state.profile.name)}</div></div></header>
      <div class="pr-note">Dokumen dari <b>mockup frontend</b>: seluruh data adalah <b>data demo</b> yang tersimpan lokal di browser, belum terhubung ke Firebase dan belum terverifikasi. Bobot final harus disepakati berdasarkan dokumen proyek (mis. BOQ/RAB).</div>`;
    },
    bar(v, cls) { return `<div class="pr-bar"><i class="${cls || ''}" style="width:${clamp(Number(v) || 0, 0, 100)}%"></i></div>`; },
    sign(third) {
      const cell = (t, r) => `<div><div class="pr-sign-t">${t}</div><div class="pr-sign-space"></div><div class="pr-sign-line">(……………………………)</div><div class="pr-sign-r">${r}</div></div>`;
      return `<section class="pr-sec pr-sign"><h2>Lembar Pengesahan</h2><div class="pr-sign-grid">${cell('Disiapkan Oleh:', 'Pelaksana / Supervisor')}${cell('Diperiksa Oleh:', 'Vendor / Kontraktor Utama')}${cell('Disetujui Oleh:', third)}</div></section>`;
    },
    box(label, value, sub, cls) { return `<div class="pr-box"><div class="pr-box-l">${label}</div><div class="pr-box-v ${cls || ''}">${value}</div><div class="pr-box-s">${sub}</div></div>`; },

    project(id) {
      const p = Store.project(id); if (!p) { Toast.show('Proyek tidak ditemukan.', 'error'); return; }
      const sm = Progress.summary(p), t = Progress.timeFraction(p);
      const done = p.scope.filter(s => Number(s.actual) >= 100).length, left = p.scope.length - done;
      const kv = (k, v) => `<div><dt>${k}</dt><dd>${v}</dd></div>`;
      const curve = sm.valid ? sCurveSVG({
        planned: Array.from({ length: 11 }, (_, i) => ({ f: i / 10, v: Progress.sCurve(i / 10) * 100 })),
        actual: t === 0 ? [{ f: 0, v: 0 }] : Array.from({ length: 11 }, (_, i) => ({ f: t * i / 10, v: sm.value * Progress.sCurve(i / 10) }))
      }, t) + `<div class="pr-legend"><span><i style="background:var(--c-plan)"></i>Rencana (ilustratif)</span><span><i style="background:var(--c-run)"></i>Aktual (bentuk kurva disimulasikan)</span></div>
      <p class="pr-small">Kurva-S adalah <b>data demo</b>: dibentuk dari tanggal proyek dan progres saat ini, bukan riwayat progres nyata.</p>`
        : `<p class="pr-warn">Progres belum valid (total bobot ${fmt2(sm.total)}%), sehingga Kurva-S tidak ditampilkan.</p>`;
      const scopeRows = p.scope.length ? p.scope.map((s, i) => `<tr><td>${i + 1}</td><td>${esc(s.name)}</td><td class="n">${fmt2(s.weight)}%</td><td class="n">${fmt2(s.actual)}%</td><td class="n">${fmt2(Progress.contribution(s))}%</td><td>${esc(s.note || '')}</td></tr>`).join('')
        : '<tr><td colspan="6" class="c">Belum ada item scope.</td></tr>';
      const bars = p.scope.map(s => `<div class="pr-row"><span>${esc(s.name)} <small>(bobot ${fmt2(s.weight)}%)</small></span><b>${fmt2(s.actual)}%</b>${this.bar(s.actual)}</div>`).join('');
      const ms = p.milestones.slice().sort((x, y) => (x.date || '').localeCompare(y.date || ''));
      const acts = p.activities.slice(0, 10);
      const html = `${this.head('Laporan Progres Proyek', `${esc(p.code)} · ${esc(p.name)}`, statusBadge(p.status))}
      <section class="pr-sec"><dl class="pr-meta">${kv('Klien / pemilik', esc(p.client))}${kv('Lokasi', esc(p.location || '—'))}${kv('Penanggung jawab', esc(p.pm))}${kv('Supervisor lapangan', esc(p.supervisor))}${kv('Tanggal mulai', fmtDate(p.startDate))}${kv('Target selesai', fmtDate(p.endDate))}${kv('Anggaran', p.budget != null ? fmtRp(p.budget) : '—')}${kv('Koordinat', p.lat != null ? `${p.lat}, ${p.lng}` : 'Belum diisi')}</dl></section>
      <section class="pr-sec pr-boxes">${this.box('Progres keseluruhan', sm.valid ? `${fmt2(sm.value)}%` : 'Belum valid', sm.valid ? 'dari target 100% (berbobot)' : `total bobot ${fmt2(sm.total)}% (harus 100%)`, sm.valid ? 'blue' : 'red')}${this.box('Pekerjaan selesai', done, `dari ${p.scope.length} item scope (progres 100%)`, 'green')}${this.box('Sisa pekerjaan', left, 'item belum 100%', left ? 'red' : 'green')}</section>
      ${sm.valid ? `<section class="pr-sec pr-bar-wide">${this.bar(sm.value)}</section>` : ''}
      <section class="pr-sec"><h2>Kurva-S Progres</h2>${curve}</section>
      <section class="pr-sec"><h2>Progres per Scope</h2>${bars || '<p class="pr-small">Belum ada item scope.</p>'}</section>
      <section class="pr-sec"><h2>Rincian Scope &amp; Bobot</h2>
        <table class="pr-table"><thead><tr><th>No</th><th>Pekerjaan</th><th class="n">Bobot</th><th class="n">Progres aktual</th><th class="n">Kontribusi</th><th>Catatan</th></tr></thead><tbody>${scopeRows}</tbody>
        <tfoot><tr><td colspan="2">Total</td><td class="n">${fmt2(sm.total)}%</td><td></td><td class="n">${fmt2(sm.value)}%</td><td>${sm.valid ? 'Bobot valid (100%)' : '<b>Bobot belum 100%</b>'}</td></tr></tfoot></table>
        <p class="pr-small">Progres proyek = Σ (bobot × progres aktual) ÷ 100.</p></section>
      <section class="pr-sec"><h2>Milestone</h2>${ms.length ? `<table class="pr-table"><thead><tr><th>Milestone</th><th>Tanggal</th><th>Status</th></tr></thead><tbody>${ms.map(m => `<tr><td>${esc(m.text)}</td><td>${fmtDate(m.date)}</td><td>${m.done ? 'Selesai' : 'Belum'}</td></tr>`).join('')}</tbody></table>` : '<p class="pr-small">Belum ada milestone.</p>'}</section>
      <section class="pr-sec"><h2>Foto / Bukti Progres</h2><p class="pr-small">Foto bukti belum tersedia di mockup (unggah foto memerlukan backend atau layanan penyimpanan).</p></section>
      <section class="pr-sec"><h2>Riwayat Aktivitas Terbaru</h2>${acts.length ? `<table class="pr-table"><thead><tr><th>Waktu</th><th>Pengguna</th><th>Aktivitas</th></tr></thead><tbody>${acts.map(x => `<tr><td>${esc(fmtDateTime(x.at))}</td><td>${esc(x.user)}</td><td>${esc(x.text)}</td></tr>`).join('')}</tbody></table>` : '<p class="pr-small">Belum ada aktivitas.</p>'}</section>
      ${this.sign('Pemilik Proyek / Kantor Pusat')}`;
      this.run(html, `Laporan-${p.code}`);
    },

    global() {
      const list = this.activeProjects();
      if (!list.length) { Toast.show('Tidak ada proyek berjalan untuk dicetak.', 'error'); return; }
      const valid = list.filter(p => Progress.summary(p).valid);
      const avg = valid.length ? round(valid.reduce((s, p) => s + Progress.summary(p).value, 0) / valid.length, 1) : null;
      const run = list.filter(p => p.status === 'Berjalan').length, late = list.length - run;
      const lateItems = list.flatMap(p => Progress.lateItems(p));
      const rows = list.map((p, i) => {
        const sm = Progress.summary(p); return `<tr><td>${i + 1}</td><td>${esc(p.code)}</td><td><b>${esc(p.name)}</b><br><small>${esc(p.client)}</small></td><td>${esc(p.location || '—')}</td><td>${esc(p.pm)}</td><td>${fmtDate(p.endDate)}</td>
      <td class="prog">${sm.valid ? `${fmt2(sm.value)}%${this.bar(sm.value, p.status === 'Terlambat' ? 'late' : '')}` : '<span class="red">Belum valid</span>'}</td><td class="n">${sm.valid ? fmt2(Progress.planned(p)) + '%' : '—'}</td><td>${statusBadge(p.status)}</td></tr>`;
      }).join('');
      const bars = list.map(p => { const sm = Progress.summary(p); return `<div class="pr-row"><span>${esc(p.name)} <small>${esc(p.code)}</small></span><b>${sm.valid ? fmt2(sm.value) + '%' : 'Belum valid'}</b>${this.bar(sm.valid ? sm.value : 0, p.status === 'Terlambat' ? 'late' : '')}</div>`; }).join('');
      const html = `${this.head('Laporan Global Proyek Berjalan', `Per ${esc(fmtDate(toISODate(new Date())))} · ${list.length} proyek aktif`)}
      <section class="pr-sec pr-boxes pr-boxes-4">${this.box('Proyek aktif', list.length, 'Berjalan + Terlambat', 'blue')}${this.box('Berjalan', run, 'status “Berjalan”', 'green')}${this.box('Terlambat', late, 'masih dalam pelaksanaan', late ? 'red' : 'green')}${this.box('Rata-rata progres', avg == null ? '—' : fmt2(avg) + '%', `${valid.length} dari ${list.length} proyek dengan bobot valid`, 'blue')}</section>
      <div class="pr-note pr-note-soft">Cakupan: proyek berstatus “Berjalan” dan “Terlambat” (keduanya masih dikerjakan). Proyek “Perencanaan” dan “Selesai” tidak dimasukkan. Rata-rata hanya menghitung proyek dengan total bobot 100%.</div>
      <section class="pr-sec"><h2>Progres per Proyek</h2>${bars}</section>
      <section class="pr-sec"><h2>Daftar Proyek Berjalan</h2><table class="pr-table"><thead><tr><th>No</th><th>Kode</th><th>Proyek / Klien</th><th>Lokasi</th><th>Penanggung jawab</th><th>Target selesai</th><th>Progres</th><th class="n">Rencana (demo)</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>
        <p class="pr-small">“Rencana (demo)” adalah target ilustratif berbasis waktu, bukan jadwal resmi proyek.</p></section>
      <section class="pr-sec"><h2>Pekerjaan Terlambat</h2>${lateItems.length ? `<table class="pr-table"><thead><tr><th>Proyek</th><th>Pekerjaan</th><th class="n">Bobot</th><th class="n">Progres</th><th class="n">Lewat target</th></tr></thead><tbody>${lateItems.map(l => `<tr><td>${esc(l.project.name)}</td><td>${esc(l.item.name)}</td><td class="n">${fmt2(l.item.weight)}%</td><td class="n">${fmt2(l.item.actual)}%</td><td class="n">${l.days ? l.days + ' hari' : '—'}</td></tr>`).join('')}</tbody></table>` : '<p class="pr-small">Tidak ada pekerjaan terlambat.</p>'}</section>
      ${this.sign('Kepala Divisi / Admin Kantor Pusat')}`;
      this.run(html, `Laporan-Global-Proyek-Berjalan-${toISODate(new Date())}`);
    }
  };

  /* ==========================================================================
     10. AKSI & INISIALISASI
     ========================================================================== */
  const Actions = {
    'open-drawer': openDrawer,
    'close-drawer': closeDrawer,
    'scroll-top': () => window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }),
    'toggle-theme': () => Theme.toggle(),
    'toggle-notif-menu': toggleNotifMenu,
    'pd-theme': () => { const light = !document.body.classList.contains('pd-light'); document.body.classList.toggle('pd-light', light); try { localStorage.setItem('pcc.pdtheme', light ? 'light' : 'dark'); } catch (e) { /* diabaikan */ } },
    'add-project': () => openProjectForm(),
    'edit-project': el => openProjectForm(el.dataset.id),
    'reset-project-filters': () => { Object.assign(ui.projects, { q: '', status: '', pm: '', sort: 'name' }); Views.projects(); },
    'delete-project': el => {
      const p = Store.project(el.dataset.id); if (!p) return;
      Modal.confirm({
        title: 'Hapus proyek?', danger: true, confirmLabel: 'Hapus proyek',
        message: state.live ? `Proyek <b>${esc(p.name)}</b> beserta scope-nya akan dihapus permanen dari Firestore. Tindakan ini tidak dapat dibatalkan.` : `Proyek <b>${esc(p.name)}</b> beserta scope, chat, dan notifikasinya akan dihapus dari data demo lokal. Tindakan ini tidak dapat dibatalkan (kecuali dengan “Reset data demo”).`,
        onConfirm: () => { Store.removeProject(p.id); if (!state.live) Toast.show('Proyek dihapus dari data demo lokal.'); location.hash = '#/projects'; }
      });
    },
    'photo-upload': el => { ui.photoTask = el.dataset.sid; const inp = $('#photoInput'); if (inp) { inp.value = ''; inp.click(); } },
    'ann-new': () => openAnnForm(),
    'ann-edit': el => openAnnForm(el.dataset.id),
    'ann-pin': async el => {
      const a = (state.announcements || []).find(x => x.id === el.dataset.id), W = Live.writer; if (!a || !W) return;
      try { await W.service.updateAnnouncement(a.id, { title: a.title, body: a.body, type: a.type, pinned: !a.pinned }); Toast.show(a.pinned ? 'Semat dilepas.' : 'Pengumuman disematkan.'); }
      catch (err) { Toast.show('Gagal mengubah semat pengumuman.', 'error'); }
    },
    'ann-delete': el => {
      const a = (state.announcements || []).find(x => x.id === el.dataset.id); if (!a) return;
      Modal.confirm({ title: 'Hapus pengumuman?', danger: true, confirmLabel: 'Hapus', message: `“${a.title}” akan dihapus untuk semua pengguna.`, onConfirm: async () => {
        try { await Live.writer.service.deleteAnnouncement(a.id); Toast.show('Pengumuman dihapus.'); } catch (err) { Toast.show('Pengumuman gagal dihapus.', 'error'); } } });
    },
    'ann-read': () => { state.notifications.forEach(n => { if (n.type === 'announcement') n.read = true; }); Store.save(); updateBadges(); renderAnnouncements(); },
    'ann-all': () => Modal.open({ title: 'Semua Pengumuman', wide: true, body: `<ul class="ann-list">${annSorted().map(a => annItemHTML(a, isAdminUI())).join('')}</ul>`, actions: [{ label: 'Tutup', close: true }] }),
    'rep-photos-reload': () => renderFieldReports(true),
    'rep-photo-view': el => {
      const ph = ((ui.repPhotos || {})[el.dataset.pid] || []).find(x => x.id === el.dataset.phid), p = Store.project(el.dataset.pid); if (!ph || !p) return;
      const sc = p.scope.find(x => x.id === ph.taskId);
      Modal.open({ title: `${p.code} — ${sc ? sc.name : 'Foto bukti'}`, wide: true,
        body: `<img src="${ph.dataUrl}" alt="Foto bukti pekerjaan" style="max-width:100%;max-height:70vh;display:block;margin:0 auto;border-radius:8px"><p class="small muted" style="text-align:center;margin-top:8px">${esc(ph.byName || '')} · ${ph.at ? fmtDateTime(ph.at) : ''}</p>`,
        actions: [{ label: 'Tutup', close: true }] });
    },
    'photo-view': el => {
      const ph = ((state.photos || {})[el.dataset.id] || []).find(x => x.id === el.dataset.pid); if (!ph) return;
      Modal.open({ title: 'Foto bukti pekerjaan', wide: true,
        body: `<img src="${ph.dataUrl}" alt="Foto bukti pekerjaan" style="max-width:100%;max-height:70vh;display:block;margin:0 auto;border-radius:8px"><p class="small muted" style="text-align:center;margin-top:8px">${esc(ph.byName || '')} · ${ph.at ? fmtDateTime(ph.at) : ''}</p>`,
        actions: [{ label: 'Hapus foto', kind: 'danger', onClick: () => {
          Modal.confirm({ title: 'Hapus foto?', danger: true, confirmLabel: 'Hapus foto', message: 'Foto bukti ini akan dihapus permanen dari Firestore.', onConfirm: async () => {
            try { await Live.writer.service.deletePhoto(el.dataset.id, ph.id); Toast.show('Foto dihapus.'); }
            catch (err) { Toast.show(err && err.code === 'permission-denied' ? 'Penghapusan foto ditolak oleh Security Rules.' : 'Foto gagal dihapus.', 'error'); }
          } });
        } }, { label: 'Tutup', close: true }] });
    },
    'import-tasks': el => openImportTasks(el.dataset.id),
    'task-week': el => { ui.week = el.dataset.week === 'all' ? 'all' : Number(el.dataset.week); const p = Store.project(ui.detailId); if (p) renderProjectDash(p); },
    'toggle-task': el => {
      const p = Store.project(el.dataset.id), s = p && p.scope.find(x => x.id === el.dataset.sid); if (!s) return;
      if (el.checked && state.live && Live.writer && Live.writer.service.addPhoto && !((state.photos[p.id] || []).some(x => x.taskId === s.id))) {
        el.checked = false; Toast.show('Unggah minimal 1 foto bukti sebelum mencentang pekerjaan ini.', 'error'); return;
      }
      s.actual = el.checked ? 100 : 0; p.certified = null;
      Store.logActivity(p.id, 'progress', `Pekerjaan “${s.name}” ${el.checked ? 'ditandai selesai' : 'dibuka kembali'} (${s.actual}%)`, false);
      Store.save();
      if (Router.parse().name === 'project') { renderScopeTable(p); renderDetailActivities(p); renderProjectDash(p); renderProjectPanels(p); }
    },
    'add-scope': el => openScopeForm(el.dataset.id),
    'edit-scope': el => openScopeForm(el.dataset.id, el.dataset.sid),
    'delete-scope': el => {
      const p = Store.project(el.dataset.id), s = p && p.scope.find(x => x.id === el.dataset.sid); if (!s) return;
      Modal.confirm({
        title: 'Hapus item scope?', danger: true, confirmLabel: 'Hapus', message: `Item <b>${esc(s.name)}</b> (bobot ${fmt2(s.weight)}%) akan dihapus. Total bobot akan dihitung ulang.`,
        onConfirm: () => { p.scope = p.scope.filter(x => x.id !== s.id); p.certified = null; Store.logActivity(p.id, 'progress', `Item scope “${s.name}” dihapus`, false); Store.save(); Toast.show('Item scope dihapus.'); Views.project(p.id); }
      });
    },
    'certify': el => {
      const p = Store.project(el.dataset.id), sm = p && Progress.summary(p); if (!p || !sm.valid) return;
      Modal.confirm({
        title: 'Sahkan progres (mockup)?', confirmLabel: 'Sahkan', message: `Progres <b>${fmt2(sm.value)}%</b> dengan total bobot 100% akan ditandai disahkan secara lokal. Ini hanya penanda mockup tanpa alur persetujuan atau audit trail backend.`,
        onConfirm: () => { p.certified = { at: new Date().toISOString(), value: sm.value, by: state.profile.name }; Store.logActivity(p.id, 'status', `Progres ${fmt2(sm.value)}% disahkan (mockup)`, false); Store.save(); refreshDetailCalc(p); renderDetailActivities(p); Toast.show('Progres ditandai disahkan (mockup lokal).'); }
      });
    },
    'toggle-ms': el => { const p = Store.project(el.dataset.id), m = p && p.milestones.find(x => x.id === el.dataset.mid); if (m) { m.done = el.checked; Store.logActivity(p.id, 'catatan', `Milestone “${m.text}” ${m.done ? 'selesai' : 'dibuka kembali'}`, false); Store.save(); renderMilestones(p); renderDetailActivities(p); } },
    'delete-ms': el => { const p = Store.project(el.dataset.id); if (!p) return; p.milestones = p.milestones.filter(x => x.id !== el.dataset.mid); Store.save(); renderMilestones(p); },
    'map-select': el => { ui.map.sel = el.dataset.id; renderMap(true); if (isMobile() && el.tagName === 'BUTTON') $('#mapDetail').scrollIntoView({ behavior: 'smooth', block: 'start' }); },
    'map-open': el => { ui.map.sel = el.dataset.id; },
    'change-location': el => openLocationForm(el.dataset.id),
    'pd-bell': () => { const m = $('#pdNotifMenu'); if (!m) return; const open = m.hidden; if (open) renderPdBell(); m.hidden = !open; $('#pdBell').setAttribute('aria-expanded', String(open)); },
    'pd-read-all': () => { pdNotifs().forEach(n => Notif.setRead(n.id, true)); updateBadges(); },
    'open-notif': el => { closeNotifMenu(); openNotification(el.dataset.id); },
    'mark-all-read': () => { Notif.markAll(); Toast.show('Semua notifikasi ditandai sudah dibaca (lokal).'); },
    'toggle-notif': el => { const n = state.notifications.find(x => x.id === el.dataset.id); if (n) Notif.setRead(n.id, !n.read); },
    'notif-filter': el => { ui.notif.read = el.dataset.v; renderNotifList(); },
    'chat-open': el => chatOpen(el.dataset.id),
    'chat-back': chatBack,
    'dm-open': el => { ui.dm.sel = el.dataset.id; location.hash = `#/dm/${encodeURIComponent(el.dataset.id)}`; },
    'dm-back': () => { ui.dm.sel = null; location.hash = '#/dm'; },
    'chat-toggle-read': () => {
      const pid = ui.chat.sel; if (!pid) return;
      if (ChatStore.unreadCount(pid)) { ChatStore.markRead(pid); Toast.show('Percakapan ditandai sudah dibaca.', 'info'); }
      else if (ChatStore.markUnread(pid)) Toast.show('Pesan terakhir ditandai belum dibaca.', 'info');
    },
    'chat-simulate': () => { if (ui.chat.sel) { ChatStore.simulateIncoming(ui.chat.sel); Toast.show('Pesan masuk simulasi ditambahkan (hanya untuk uji mockup).', 'info'); } },
    'chat-attach': () => Modal.info('Lampiran (mockup)', `<p>Tombol lampiran ini hanya contoh tampilan. <b>Unggah file sungguhan memerlukan backend atau layanan penyimpanan</b> (beserta aturan akses), yang belum dibuat.</p><p class="small muted" style="margin-top:8px">Pada rancangan data, field <code>attachmentUrl</code> disiapkan untuk tautan lampiran, tetapi belum dipakai di mockup ini.</p>`),
    'user-add': () => openUserForm(),
    'user-edit': el => openUserForm(el.dataset.id),
    'user-toggle': el => { const u = state.users.find(x => x.id === el.dataset.id); if (u && state.live && !isSelfUser(u)) { liveToggleUser(u); return; } if (u && u.id !== ADMIN.id) { u.active = !u.active; Store.save(); Toast.show(`Akun ${u.active ? 'diaktifkan' : 'dinonaktifkan'} (data demo lokal).`); } },
    'reset-demo': () => Modal.confirm({
      title: 'Reset data demo?', danger: true, confirmLabel: 'Reset', message: 'Semua proyek, chat, notifikasi, dan pengguna di browser ini akan dikembalikan ke data contoh awal. Perubahan Anda akan hilang.',
      onConfirm: () => { Store.reset(); Object.keys(chatDrafts).forEach(k => delete chatDrafts[k]); ui.chat.sel = null; applyProfile(); Toast.show('Data demo dikembalikan ke kondisi awal.'); Router.render(); }
    }),
    'export-progress': exportProgressCSV,
    'export-history': exportHistoryCSV,
    'print-report': () => window.print(),
    'print-project': el => PrintReport.project(el.dataset.id),
    'print-global': () => PrintReport.global()
  };

  const FormHandlers = {
    'dash-chat': form => {
      const id = form.dataset.id, ta = form.elements.text, text = ta.value.trim(); if (!text) return;
      ta.value = '';
      ChatStore.send(id, text);
      if (!state.live) renderProjectPanels(Store.project(id));
    },
    'global-search': form => {
      ui.projects.q = $('#globalSearch', form).value.trim();
      closeDrawer();
      if (location.hash.startsWith('#/projects')) Views.projects(); else location.hash = '#/projects';
    },
    'add-milestone': form => {
      const p = Store.project(ui.detailId), d = Validate.data(form), err = $('#msError');
      if (!d.text) { err.textContent = 'Nama milestone wajib diisi.'; return; }
      if (d.date && !parseDate(d.date)) { err.textContent = 'Tanggal tidak valid.'; return; }
      err.textContent = '';
      p.milestones.push({ id: uid('ms'), text: d.text, date: d.date || '', done: false });
      Store.logActivity(p.id, 'catatan', `Milestone “${d.text}” ditambahkan`, false);
      Store.save(); form.reset(); renderMilestones(p); renderDetailActivities(p);
    },
    'chat-send': sendChatMessage,
    'dm-send': sendDm,
    'profile-save': form => {
      const d = Validate.data(form), e = {};
      if (!d.name) e.name = 'Nama wajib diisi.';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email || '')) e.email = 'Masukkan alamat email yang valid.';
      if (!Validate.show(form, e)) return;
      if (state.live) {
        const W = Live.writer;
        if (!W || !W.service.updateOwnName) { Toast.show('Mode Firestore belum siap.', 'error'); return; }
        W.service.updateOwnName(W.uid, d.name).then(() => {
          state.profile = { name: d.name, email: state.profile.email };
          const me = state.users.find(u => u.id === state.uid); if (me) me.name = d.name;
          applyProfile(); renderUsers(); Toast.show('Nama profil disimpan di Firestore. Pesan berikutnya memakai nama ini.');
        }).catch(err => Toast.show(err && err.code === 'permission-denied' ? 'Ditolak oleh Security Rules: hanya Admin Kantor Pusat yang dapat mengubah profil.' : 'Nama profil gagal disimpan.', 'error'));
        return;
      }
      state.profile = { name: d.name, email: d.email };
      const admin = state.users.find(u => u.id === ADMIN.id); if (admin) { admin.name = d.name; admin.email = d.email; }
      Store.save(); applyProfile(); Toast.show('Profil disimpan (lokal).');
    }
  };

  function bindEvents() {
    document.addEventListener('click', e => {
      if (!e.target.closest('.menu-wrap')) closeNotifMenu();
      const el = e.target.closest('[data-action]');
      if (!el) return;
      const fn = Actions[el.dataset.action];
      if (fn) fn(el, e);
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') { closeDrawer(); closeNotifMenu(); }
      const g = e.target;
      if ((e.key === 'Enter' || e.key === ' ') && g.matches && g.matches('g[role="button"][data-action]')) { e.preventDefault(); g.dispatchEvent(new MouseEvent('click', { bubbles: true })); }
    });
    document.addEventListener('submit', e => {
      const form = e.target.closest('[data-form]');
      if (!form) return;
      e.preventDefault();
      const fn = FormHandlers[form.dataset.form]; if (fn) fn(form);
    });
    document.addEventListener('input', e => { if (e.target.matches('[data-scope-input]')) onScopeInput(e.target, false); });
    document.addEventListener('change', e => {
      if (e.target.id === 'photoInput') { uploadPhotos(e.target.files); return; }
      if (e.target.matches('[data-scope-input]')) onScopeInput(e.target, true);
      if (e.target.matches('input[name="theme"]')) Theme.set(e.target.value);
    });
    const toTop = $('#toTop');
    const syncToTop = () => { if (toTop) toTop.hidden = !(window.scrollY > 0 && window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 40); };
    window.addEventListener('scroll', syncToTop, { passive: true });
    window.addEventListener('resize', syncToTop);
    syncToTop();
    window.addEventListener('hashchange', () => Router.render());
    window.addEventListener('resize', () => { if (window.innerWidth > 1024) closeDrawer(); });
  }

  function init() {
    Theme.init();
    Store.load();
    applyProfile();
    Router.routes = {
      dashboard: { title: 'Dashboard Utama', render: Views.dashboard },
      projects: { title: 'Semua Proyek', render: Views.projects },
      project: { title: 'Detail Proyek', render: Views.project },
      map: { title: 'Peta Proyek', render: Views.map },
      'project-map': { title: 'Peta Lokasi Proyek', render: Views.projectMap },
      reports: { title: 'Laporan Proyek', render: Views.reports },
      notifications: { title: 'Notifikasi', render: Views.notifications },
      chat: { title: 'Komunikasi Proyek', render: Views.chat },
      dm: { title: 'Pesan Langsung', render: Views.dm },
      settings: { title: 'Pengaturan', render: Views.settings }
    };
    bindEvents();
    updateBadges();
    Router.render();
  }


  /* ==========================================================================
     LIVE MODE — data dari Cloud Firestore (BACA SAJA pada tahap ini)
     Dipanggil auth.js setelah login valid. Tidak menulis ke localStorage dan
     tidak memakai data demo. Penulisan belum diaktifkan: perubahan di UI
     dibatalkan dengan memuat ulang data dari server.
     ========================================================================== */
  const Live = {
    reload: null, writer: null, suppress: false, snap: null, q: Promise.resolve(), pt: null, unsubs: [],
    /* Preferensi per-pengguna di browser ini (status baca); bukan data bersama. */
    store(key, fallback) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; } },
    save(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* diabaikan */ } },
    lastRead(pid) {
      const base = Live.store(`pcc.chatbase.${state.uid}`, null) || (Live.save(`pcc.chatbase.${state.uid}`, new Date().toISOString()), new Date().toISOString());
      const m = Live.store(`pcc.chatread.${state.uid}`, {});
      return m[pid] || base;
    },
    setLastRead(pid, iso) { const k = `pcc.chatread.${state.uid}`, m = Live.store(k, {}); m[pid] = iso; Live.save(k, m); },
    readSet() { return new Set(Live.store(`pcc.notifread.${state.uid}`, [])); },
    saveRead() {
      const ids = new Set(Live.readSet());
      state.notifications.forEach(n => { if (n.read && n.id.startsWith('a-')) ids.add(n.id); });
      Live.save(`pcc.notifread.${state.uid}`, [...ids].slice(-500));
    },
    /* Notifikasi diturunkan dari aktivitas proyek + pesan chat yang belum dibaca (tanpa koleksi tambahan). */
    rebuildNotifs() {
      const read = Live.readSet(), me = state.profile.name, out = [];
      const map = { progress: 'progress', status: 'status', late: 'late', foto: 'activity', catatan: 'activity' };
      state.projects.forEach(p => (p.activities || []).concat(p.reportActs || []).slice(0, 60).forEach(act => {
        const id = `a-${p.id}-${act.id}`, type = map[act.type] || 'activity';
        out.push({ id, type, projectId: p.id, title: NOTIF_TYPES[type].label, text: `${act.text} — ${act.user}${act.role ? ' (' + act.role + ')' : ''}`, at: act.at, read: read.has(id) || act.user === me, demo: false });
      }));
      (state.dm || []).forEach(m => { if (DM.isUnread(m)) out.push({ id: `d-${m.id}`, type: 'direct', projectId: '', threadId: m.threadId, title: `Pesan langsung dari ${m.senderName}`, text: m.text, at: m.at, read: false, demo: false }); });
      (state.announcements || []).slice().sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 30).forEach(a => {
        const id = `a-ann-${a.id}`;
        out.push({ id, type: 'announcement', projectId: '', title: `Pengumuman: ${a.title}`, text: a.body.slice(0, 140), at: a.at || '', read: read.has(id) || a.by === state.uid, demo: false });
      });
      state.messages.forEach(m => { if (ChatStore.isUnread(m)) out.push({ id: `m-${m.id}`, type: 'message', projectId: m.projectId, title: `Pesan baru dari ${m.senderName}`, text: m.message, at: m.createdAt, read: false, demo: false }); });
      state.notifications = out;
    },
    async sendChat(pid, text, instruction) {
      try {
        await Live.writer.service.sendChat(pid, { text, senderId: Live.writer.uid, senderName: state.profile.name, senderRole: Live.writer.role, kind: instruction ? 'instruction' : 'message', at: new Date().toISOString() });
      } catch (err) {
        console.error('Gagal mengirim pesan:', err);
        Toast.show(err && err.code === 'permission-denied' ? 'Pesan ditolak oleh Security Rules: Anda bukan anggota proyek ini.' : 'Pesan gagal dikirim.', 'error');
      }
    },
    subscribe() {
      Live.unsubs.forEach(f => { try { f(); } catch (e) { /* diabaikan */ } }); Live.unsubs = [];
      if (!Live.writer || !Live.writer.service.subscribeChats) return;
      if (Live.writer.service.subscribeDirect) Live.unsubs.push(Live.writer.service.subscribeDirect(Live.writer.role, Live.writer.uid, docs => Live.onDirect(docs), err => console.warn('Pesan langsung tidak dapat dibaca:', err && err.code)));
      if (Live.writer.service.subscribeAnnouncements) Live.unsubs.push(Live.writer.service.subscribeAnnouncements(docs => Live.onAnnouncements(docs), err => console.warn('Pengumuman tidak dapat dibaca:', err && err.code)));
      state.projects.forEach(p => {
        Live.unsubs.push(Live.writer.service.subscribeChats(p.id, docs => Live.onChat(p.id, docs), err => console.warn('Chat tidak dapat dibaca untuk proyek', p.id, err && err.code)));
        if (Live.writer.service.subscribeReports) Live.unsubs.push(Live.writer.service.subscribeReports(p.id, docs => Live.onReports(p.id, docs), err => console.warn('Laporan lapangan tidak dapat dibaca untuk proyek', p.id, err && err.code)));
      });
    },
    watchPhotos(pid) {
      if (Live.photoPid === pid) return;
      if (Live.unPhotos) { try { Live.unPhotos(); } catch (e) { /* diabaikan */ } Live.unPhotos = null; }
      Live.photoPid = pid;
      if (!Live.writer || !Live.writer.service.subscribePhotos) return;
      Live.unPhotos = Live.writer.service.subscribePhotos(pid, docs => {
        state.photos = state.photos || {}; state.photos[pid] = docs;
        const r = Router.parse();
        if (r.name === 'project' && r.arg === pid) { renderProjectDash(Store.project(pid)); }
      }, err => console.warn('Foto tidak dapat dibaca:', err && err.code));
    },
    /* Daftar akun tim dari Firestore (hanya admin_pusat yang boleh membaca koleksi users). */
    async loadUsers() {
      const W = Live.writer; if (!W || W.role !== 'admin_pusat' || !W.service.listUsers) return;
      try {
        const list = await W.service.listUsers();
        state.users = list.map(u => ({ id: u.id, name: u.name || u.email || u.id, email: u.email || '', role: roleLabel(u.role), roleCode: u.role, active: u.active === true, demo: false,
          projects: state.projects.filter(p => (p.assignedUsers || []).includes(u.id)).map(p => p.id) }));
        if (Router.parse().name === 'settings') renderUsers();
        if (Router.parse().name === 'dm') refreshDm();
      } catch (err) { console.warn('Daftar pengguna tidak dapat dibaca:', err && err.code); }
    },
    onDirect(docs) {
      state.dm = docs.map(d => ({ id: d.id, threadId: String(d.threadId || ''), text: String(d.text || ''), senderId: d.senderId || '', senderName: d.senderName || 'Pengguna', senderRole: roleLabel(d.senderRole), at: d.at || '' })).sort((a, b) => String(a.at).localeCompare(String(b.at)));
      Live.rebuildNotifs(); updateBadges();
      if (Router.parse().name === 'dm') refreshDm();
    },
    onAnnouncements(docs) {
      state.announcements = docs.map(d => ({ id: d.id, title: String(d.title || ''), body: String(d.body || ''), type: ANN_TYPES[d.type] ? d.type : 'info', pinned: d.pinned === true, by: d.by || '', byName: d.byName || '', at: d.at || '' }));
      Live.rebuildNotifs(); updateBadges(); renderAnnouncements();
      if (Router.parse().name === 'notifications') Router.render();
    },
    /* Laporan lapangan (progres / foto) dari supervisor & tim: tampil di riwayat, notifikasi, dan Laporan Proyek. */
    onReports(pid, docs) {
      const p = Store.project(pid); if (!p) return;
      p.reportActs = docs.slice().reverse().map(d => ({ id: 'r-' + d.id, at: d.at || '', user: d.byName || 'Lapangan', type: d.type === 'foto' ? 'foto' : 'progress', text: d.text || '', report: true }));
      Live.rebuildNotifs(); updateBadges();
      const r = Router.parse();
      if (r.name === 'project' && r.arg === pid) { renderDetailActivities(p); renderProjectPanels(p); }
      else if (r.name === 'reports') { renderReport(); renderFieldReports(false); }
      else if (r.name === 'dashboard' || r.name === 'notifications') Router.render();
    },
    onChat(pid, docs) {
      state.messages = state.messages.filter(m => m.projectId !== pid).concat(docs.map(d => ({
        id: d.id, projectId: pid, senderId: d.senderId, senderName: d.senderName || '', senderRole: roleLabel(d.senderRole), message: String(d.text || ''),
        createdAt: d.at || new Date().toISOString(), readBy: [], attachmentUrl: null, kind: d.kind === 'instruction' ? 'instruction' : 'message', demo: false })));
      Live.rebuildNotifs(); updateBadges();
      const r = Router.parse();
      if (r.name === 'project' && r.arg === pid) renderProjectPanels(Store.project(pid));
      else if (r.name === 'chat' && !(document.activeElement && /^(TEXTAREA|INPUT)$/.test(document.activeElement.tagName))) Router.render();
      else if (r.name === 'notifications') Router.render();
    },
    blocked(msg) {
      Live.suppress = true; setTimeout(() => { Live.suppress = false; }, 50);
      Toast.show(msg || 'Mode Firestore: bagian ini belum terhubung; perubahan dibatalkan.', 'error');
      if (Live.reload) Live.reload();
    },
    projFields(p) {
      const o = {};
      Object.keys(p).forEach(k => { if (k !== 'id' && k !== 'scope' && k !== 'demo' && k !== 'assignedUsers' && k !== 'reportActs') o[k] = p[k]; });
      o.activities = (p.activities || []).slice(0, 200); o.locationLog = (p.locationLog || []).slice(0, 200);
      return JSON.parse(JSON.stringify(o));
    },
    scopeFields(s) { return JSON.parse(JSON.stringify({ name: s.name, weight: Number(s.weight) || 0, actual: Number(s.actual) || 0, note: s.note || '', category: s.category || '', week: s.week == null ? null : Number(s.week), schedule: s.schedule || '', volume: s.volume == null ? null : Number(s.volume), unit: s.unit || '' })); },
    takeSnap() {
      const pr = {};
      state.projects.forEach(p => { const sc = {}; p.scope.forEach(s => { sc[s.id] = Live.scopeFields(s); }); pr[p.id] = { f: Live.projFields(p), sc }; });
      Live.snap = { pr, msgs: state.messages.length, notifs: state.notifications.length };
    },
    persist() { Live.saveRead(); clearTimeout(Live.pt); Live.pt = setTimeout(() => { Live.q = Live.q.then(() => Live.doPersist()).catch(() => {}); }, 700); },
    async doPersist() {
      if (!Live.writer || !Live.snap) { Live.blocked('Mode Firestore belum siap; perubahan dibatalkan.'); return; }
      const W = Live.writer, ops = [], seen = new Set(), reports = [];
      state.projects.forEach(p => {
        seen.add(p.id);
        const cur = Live.projFields(p), curSc = {}; p.scope.forEach(s => { curSc[s.id] = Live.scopeFields(s); });
        const old = Live.snap.pr[p.id];
        if (!old) { ops.push(() => W.service.createProject(p.id, cur, p.scope.map((s, i) => Object.assign({ id: s.id, order: i }, curSc[s.id])), W.uid)); return; }
        let fields = {}; Object.keys(cur).forEach(k => { if (JSON.stringify(cur[k]) !== JSON.stringify(old.f[k])) fields[k] = cur[k]; });
        /* Rules: hanya admin yang menulis dokumen proyek; kepala divisi hanya field lokasi. */
        if (W.role !== 'admin_pusat') {
          const allowed = W.role === 'kepala_divisi' ? ['location', 'locationUpdatedAt', 'locationUpdatedBy', 'locationLog'] : [];
          fields = Object.fromEntries(Object.entries(fields).filter(([k]) => allowed.includes(k)));
        }
        const up = [], del = [];
        Object.keys(curSc).forEach(id => {
          if (!old.sc[id]) { up.push({ id, isNew: true, order: p.scope.findIndex(s => s.id === id), fields: curSc[id] }); return; }
          const ch = {}; Object.keys(curSc[id]).forEach(k => { if (JSON.stringify(curSc[id][k]) !== JSON.stringify(old.sc[id][k])) ch[k] = curSc[id][k]; });
          if (Object.keys(ch).length) up.push({ id, isNew: false, fields: ch });
        });
        Object.keys(old.sc).forEach(id => { if (!curSc[id]) del.push(id); });
        if (W.role !== 'admin_pusat') { del.length = 0; for (let i = up.length - 1; i >= 0; i--) { if (up[i].isNew || !['supervisor', 'project_manager'].includes(W.role)) up.splice(i, 1); } }
        if (['supervisor', 'project_manager'].includes(W.role)) up.forEach(u => {
          if (u.fields && u.fields.actual !== undefined) {
            const sc = p.scope.find(z => z.id === u.id), v = Number(u.fields.actual) || 0;
            reports.push({ pid: p.id, r: { type: 'progress', taskId: u.id, taskName: sc ? sc.name : '', value: v, text: `Progres “${sc ? sc.name : 'pekerjaan'}” diperbarui menjadi ${fmt2(v)}%`, by: W.uid, byName: state.profile.name, byRole: W.role, at: new Date().toISOString() } });
          }
        });
        if (Object.keys(fields).length || up.length || del.length) ops.push(() => W.service.updateProject(p.id, fields, up, del, W.uid, W.role === 'admin_pusat'));
      });
      Object.keys(Live.snap.pr).forEach(id => { if (!seen.has(id)) ops.push(() => W.service.deleteProjectCascade(id)); });
      if (!ops.length) return;
      try {
        for (const run of ops) await run();
        for (const x of reports) { try { await W.service.addReport(x.pid, x.r); } catch (e) { console.warn('Laporan progres gagal dicatat:', e && e.code); } }
        Live.takeSnap();
        Toast.show('Tersimpan ke Firestore.');
      } catch (err) {
        console.error('Gagal menyimpan ke Firestore:', err);
        const denied = err && err.code === 'permission-denied';
        Live.suppress = true; setTimeout(() => { Live.suppress = false; }, 50);
        Toast.show(denied ? 'Ditolak oleh Firestore Security Rules: role Anda tidak berhak mengubah data ini. Perubahan dibatalkan.' : 'Gagal menyimpan ke Firestore. Perubahan dibatalkan.', 'error');
        if (Live.reload) Live.reload();
      }
    }
  };
  const isoOf = v => {
    if (!v) return '';
    if (typeof v === 'string') return v.slice(0, 10);
    const d = typeof v.toDate === 'function' ? v.toDate() : (v instanceof Date ? v : null);
    return d && !isNaN(d) ? toISODate(d) : '';
  };
  const numOrNull = v => (v === '' || v == null || !isFinite(Number(v))) ? null : Number(v);
  function mapLiveProject(d) {
    const loc = d.location && typeof d.location === 'object' ? d.location : null;
    return {
      id: d.id, code: d.code || d.id, name: d.name || '(tanpa nama)', client: d.client || '', description: d.description || '',
      location: loc ? (loc.text || loc.address || '') : (d.location || d.address || ''),
      lat: numOrNull(d.lat ?? (loc && loc.lat)), lng: numOrNull(d.lng ?? (loc && loc.lng)),
      pm: d.pm || '', pmUid: d.pmUid || '', supervisor: d.supervisor || '',
      startDate: isoOf(d.startDate), endDate: isoOf(d.endDate), budget: Number(d.budget) || 0,
      status: STATUSES.includes(d.status) ? d.status : 'Perencanaan', notes: d.notes || '',
      createdAt: (d.createdAt && typeof d.createdAt.toDate === 'function') ? d.createdAt.toDate().toISOString() : (d.createdAt || new Date().toISOString()),
      demo: false, dashboardUrl: d.dashboardUrl || '',
      scope: (Array.isArray(d.scopes) ? d.scopes : []).slice().sort((x, y) => (x.order ?? 1e9) - (y.order ?? 1e9)).map(s => ({ id: s.id, name: s.name || '(tanpa nama)', weight: Number(s.weight) || 0, actual: Number(s.actual) || 0, note: s.note || '', category: s.category || '', week: s.week == null ? null : Number(s.week), schedule: s.schedule || '', volume: s.volume == null ? null : Number(s.volume), unit: s.unit || '' })),
      assignedUsers: Array.isArray(d.assignedUsers) ? d.assignedUsers : [],
      certified: d.certified || null, milestones: Array.isArray(d.milestones) ? d.milestones : [],
      activities: Array.isArray(d.activities) ? d.activities : [], locationLog: Array.isArray(d.locationLog) ? d.locationLog : []
    };
  }
  window.PCCLive = {
    /* list: dokumen proyek (+ scopes) dari Firestore; who: {name, email, role}; reload: fungsi muat ulang */
    apply(list, who, reload, writer) {
      Live.reload = reload || null; Live.writer = writer || null;
      state = { version: STATE_VERSION, live: true, photos: {}, uid: (writer && writer.uid) || (who && who.uid) || 'anon', projects: (list || []).map(mapLiveProject), users: [], messages: [], notifications: [],
        profile: { name: liveDisplayName(who), email: (who && who.email) || '' }, lastDetailId: null, announcements: [], dm: [] };
      Live.photoPid = null; applyProfile(); Live.takeSnap(); Live.rebuildNotifs(); Live.subscribe(); Live.loadUsers();
      if (!isAdminUI() && !isPM() && state.projects.length && (!location.hash || location.hash === '#' || location.hash === '#/dashboard')) {
        history.replaceState(null, '', state.projects.length === 1 ? `#/project/${state.projects[0].id}` : '#/projects');
      }
      const b = $('#modeBanner');
      if (b) { const bn = b.closest('.demo-banner'); if (bn) bn.style.display = 'none'; }
      const tag = $('.mock-tag'); if (tag) tag.textContent = 'FIRESTORE • LIVE';
      updateBadges();
      Router.render();
    },
    fail(message) {
      state = { version: STATE_VERSION, live: true, projects: [], users: [], messages: [], notifications: [], profile: { name: 'Pengguna', email: '' }, lastDetailId: null };
      Live.writer = null; Live.takeSnap(); Live.unsubs.forEach(f => { try { f(); } catch (e) { /* diabaikan */ } }); Live.unsubs = [];
      Toast.show(message || 'Gagal memuat data dari Firestore.', 'error');
      updateBadges();
      Router.render();
    }
  };

  init();
})();
