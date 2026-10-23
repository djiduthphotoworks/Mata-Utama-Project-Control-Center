// Uji Security Rules dengan Firebase Emulator.
// Jalankan: npx firebase emulators:exec --only firestore "node --test tests/rules.test.js"
// Butuh devDependency: @firebase/rules-unit-testing, firebase-tools.
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, collection, getDocs, query, where } = require('firebase/firestore');
const fs = require('fs');
const test = require('node:test');

let env;
const PID = 'p1';
const ctx = uid => env.authenticatedContext(uid).firestore();

test.before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'rules-test-local',
    firestore: { rules: fs.readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 }
  });
  await env.withSecurityRulesDisabled(async c => {
    const db = c.firestore();
    const u = (id, role, active = true) => setDoc(doc(db, 'users', id), { role, active, name: id });
    await u('admin', 'admin_pusat'); await u('head', 'kepala_divisi'); await u('sup', 'supervisor');
    await u('tim', 'tim_lapangan'); await u('sup2', 'supervisor'); await u('pm', 'project_manager'); await u('pm2', 'project_manager'); await u('off', 'admin_pusat', false);
    await u('bad', 'owner');
    await setDoc(doc(db, 'projects', PID), { name: 'P', assignedUsers: ['sup', 'tim', 'pm'], location: 'A' });
    await setDoc(doc(db, 'projects', PID, 'scopes', 's1'), { name: 'S', weight: 100, actual: 10 });
    await setDoc(doc(db, 'projects', PID, 'chats', 'm1'), { text: 'hi', senderId: 'sup' });
    await setDoc(doc(db, 'notifications', 'n1'), { toUid: 'sup', read: false });
  });
});
test.after(() => env.cleanup());

test('1 tanpa login baca projects ditolak', () => assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'projects', PID))));
test('2 login tanpa dokumen users ditolak', () => assertFails(getDoc(doc(ctx('ghost'), 'projects', PID))));
test('3 users.active=false ditolak', () => assertFails(getDoc(doc(ctx('off'), 'projects', PID))));
test('4 role tak dikenal ditolak', () => assertFails(getDoc(doc(ctx('bad'), 'projects', PID))));
test('5 admin CRUD proyek', async () => {
  await assertSucceeds(setDoc(doc(ctx('admin'), 'projects', 'p2'), { name: 'X', assignedUsers: [] }));
  await assertSucceeds(deleteDoc(doc(ctx('admin'), 'projects', 'p2')));
});
test('6 kepala_divisi: name ditolak, location boleh', async () => {
  await assertFails(updateDoc(doc(ctx('head'), 'projects', PID), { name: 'Z' }));
  await assertSucceeds(updateDoc(doc(ctx('head'), 'projects', PID), { location: 'B' }));
});
test('7 supervisor non-anggota tidak bisa baca proyek', () => assertFails(getDoc(doc(ctx('sup2'), 'projects', PID))));
test('8 supervisor: weight ditolak, actual boleh', async () => {
  const r = doc(ctx('sup'), 'projects', PID, 'scopes', 's1');
  await assertFails(updateDoc(r, { weight: 50 }));
  await assertSucceeds(updateDoc(r, { actual: 40 }));
  await assertFails(updateDoc(r, { actual: 140 }));
});
test('9 tim_lapangan tidak bisa ubah/hapus chat', async () => {
  const r = doc(ctx('tim'), 'projects', PID, 'chats', 'm1');
  await assertFails(updateDoc(r, { text: 'x' }));
  await assertFails(deleteDoc(r));
});
test('10 chat dengan senderId orang lain ditolak', async () => {
  const col = collection(ctx('tim'), 'projects', PID, 'chats');
  await assertFails(addDoc(col, { text: 'hai', senderId: 'sup' }));
  await assertSucceeds(addDoc(col, { text: 'hai', senderId: 'tim' }));
});
test('11 penerima hanya ubah field read notifikasi', async () => {
  const r = doc(ctx('sup'), 'notifications', 'n1');
  await assertFails(updateDoc(r, { toUid: 'tim' }));
  await assertSucceeds(updateDoc(r, { read: true }));
});

test('12 foto: anggota boleh tambah, non-anggota dan pemalsu by ditolak; ukuran dibatasi', async () => {
  const col = (u) => collection(ctx(u), 'projects', PID, 'photos');
  const ok = { taskId: 's1', dataUrl: 'data:image/jpeg;base64,AAAA', by: 'sup' };
  await assertSucceeds(addDoc(col('sup'), ok));
  await assertFails(addDoc(col('sup2'), { ...ok, by: 'sup2' }));          // bukan anggota
  await assertFails(addDoc(col('sup'), { ...ok, by: 'tim' }));            // by palsu
  await assertFails(addDoc(col('sup'), { ...ok, dataUrl: 'x'.repeat(300001) })); // terlalu besar
  await assertFails(addDoc(col('head'), { ...ok, by: 'head' }));          // kepala divisi tidak mengunggah
});
test('13 foto: tidak bisa diubah; hapus hanya admin/pengunggah', async () => {
  await env.withSecurityRulesDisabled(async c => { await setDoc(doc(c.firestore(), 'projects', PID, 'photos', 'ph1'), { taskId: 's1', dataUrl: 'd', by: 'sup' }); });
  const r = (u) => doc(ctx(u), 'projects', PID, 'photos', 'ph1');
  await assertFails(updateDoc(r('sup'), { dataUrl: 'z' }));
  await assertFails(deleteDoc(r('tim')));
  await assertSucceeds(deleteDoc(r('sup')));
});

// ---- Pengumuman ----
const ANN = { title: 'Libur', body: 'Besok libur nasional.', type: 'info', pinned: false };
test('14 admin membuat & menyematkan pengumuman', async () => {
  await assertSucceeds(setDoc(doc(ctx('admin'), 'announcements', 'a1'), ANN));
  await assertSucceeds(updateDoc(doc(ctx('admin'), 'announcements', 'a1'), { pinned: true }));
});
test('15 supervisor/tim/kepala divisi membaca, tidak boleh menulis', async () => {
  for (const u of ['sup', 'tim', 'head']) {
    await assertSucceeds(getDoc(doc(ctx(u), 'announcements', 'a1')));
    await assertFails(setDoc(doc(ctx(u), 'announcements', 'x-' + u), ANN));
  }
  await assertFails(updateDoc(doc(ctx('sup'), 'announcements', 'a1'), { pinned: false }));
  await assertFails(deleteDoc(doc(ctx('sup'), 'announcements', 'a1')));
});
test('16 tipe tidak valid / role tak dikenal / tanpa login ditolak', async () => {
  await assertFails(setDoc(doc(ctx('admin'), 'announcements', 'a2'), { ...ANN, type: 'rahasia' }));
  await assertFails(setDoc(doc(ctx('admin'), 'announcements', 'a3'), { ...ANN, title: '' }));
  await assertFails(getDoc(doc(ctx('bad'), 'announcements', 'a1')));
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'announcements', 'a1')));
});
test('17 admin menghapus pengumuman', () => assertSucceeds(deleteDoc(doc(ctx('admin'), 'announcements', 'a1'))));

// ---- Project Manager ----
test('18 PM membaca & chat hanya di proyek yang dipegang', async () => {
  await assertSucceeds(getDoc(doc(ctx('pm'), 'projects', PID)));
  await assertSucceeds(addDoc(collection(ctx('pm'), 'projects', PID, 'chats'), { text: 'halo', senderId: 'pm' }));
  await assertFails(getDoc(doc(ctx('pm2'), 'projects', PID)));                         // PM lain tidak lihat
  await assertFails(addDoc(collection(ctx('pm2'), 'projects', PID, 'chats'), { text: 'x', senderId: 'pm2' }));
  await assertFails(getDocs(collection(ctx('pm2'), 'projects', PID, 'chats')));
});
test('19 PM boleh update progres, foto & laporan di proyeknya, tidak boleh bobot/ubah proyek/hapus', async () => {
  const r = doc(ctx('pm'), 'projects', PID, 'scopes', 's1');
  await assertSucceeds(updateDoc(r, { actual: 50, updatedBy: 'pm' }));
  await assertFails(updateDoc(r, { weight: 90 }));
  await assertSucceeds(addDoc(collection(ctx('pm'), 'projects', PID, 'photos'), { taskId: 's1', dataUrl: 'data:image/jpeg;base64,AA', by: 'pm' }));
  await assertSucceeds(addDoc(collection(ctx('pm'), 'projects', PID, 'reports'), { value: 10, by: 'pm' }));
  await assertFails(updateDoc(doc(ctx('pm'), 'projects', PID), { name: 'baru' }));
  await assertFails(deleteDoc(doc(ctx('pm'), 'projects', PID)));
  await assertFails(updateDoc(doc(ctx('pm2'), 'projects', PID, 'scopes', 's1'), { actual: 60 }));      // PM lain
});
test('20 PM membaca pengumuman, tidak boleh menulis', async () => {
  await assertSucceeds(setDoc(doc(ctx('admin'), 'announcements', 'pa'), { title: 'T', body: 'B', type: 'info', pinned: false }));
  await assertSucceeds(getDoc(doc(ctx('pm'), 'announcements', 'pa')));
  await assertFails(setDoc(doc(ctx('pm'), 'announcements', 'pb'), { title: 'T', body: 'B', type: 'info', pinned: false }));
});

// ---- Pesan langsung ----
const DMSG = (uid, tid, text = 'halo') => ({ threadId: tid, text, senderId: uid, senderName: 'N', at: '2026-10-22T01:00:00Z' });
test('21 staf menulis & membaca percakapan sendiri; admin menulis ke staf mana pun', async () => {
  const c = collection(ctx('sup'), 'direct_messages');
  await assertSucceeds(addDoc(c, DMSG('sup', 'sup')));
  await assertSucceeds(getDocs(query(c, where('threadId', '==', 'sup'))));
  await assertSucceeds(addDoc(collection(ctx('admin'), 'direct_messages'), DMSG('admin', 'sup', 'balasan')));
  await assertSucceeds(getDocs(collection(ctx('admin'), 'direct_messages')));
});
test('22 staf tidak boleh membaca/menulis percakapan staf lain, atau memalsukan pengirim', async () => {
  const c2 = collection(ctx('sup2'), 'direct_messages');
  await assertFails(getDocs(query(c2, where('threadId', '==', 'sup'))));
  await assertFails(getDocs(c2));
  await assertFails(addDoc(c2, DMSG('sup2', 'sup')));
  await assertFails(addDoc(collection(ctx('sup'), 'direct_messages'), DMSG('tim', 'sup')));
  await assertFails(addDoc(collection(ctx('sup'), 'direct_messages'), DMSG('sup', 'sup', '')));
});
test('23 pesan langsung tidak dapat diubah/dihapus; PM juga hanya miliknya', async () => {
  const id = (await addDoc(collection(ctx('pm'), 'direct_messages'), DMSG('pm', 'pm'))).id;
  await assertFails(updateDoc(doc(ctx('pm'), 'direct_messages', id), { text: 'x' }));
  await assertFails(deleteDoc(doc(ctx('admin'), 'direct_messages', id)));
  await assertFails(getDocs(query(collection(ctx('pm2'), 'direct_messages'), where('threadId', '==', 'pm'))));
});
