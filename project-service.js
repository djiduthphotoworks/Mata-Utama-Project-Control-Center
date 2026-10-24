// project-service.js
import { db, firebaseConfig } from "./firebase-config.js";
import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import {
    collection,
    getDocs,
    doc,
    getDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    writeBatch,
    serverTimestamp,
    orderBy,
    limitToLast,
    onSnapshot,
    arrayUnion,
    arrayRemove
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

/**
 * Mengambil daftar proyek berdasarkan hak akses role dan UID pengguna
 */
export async function fetchProjects(userRole, userUid) {
    try {
        const projectsRef = collection(db, "projects");
        let q = projectsRef;

        // Jika supervisor, tim lapangan, atau project manager, batasi hanya proyek yang ditugaskan (assignedUsers)
        if (userRole === "supervisor" || userRole === "tim_lapangan" || userRole === "project_manager") {
            q = query(projectsRef, where("assignedUsers", "array-contains", userUid));
        }

        const querySnapshot = await getDocs(q);
        const projects = [];

        querySnapshot.forEach((document) => {
            projects.push({
                id: document.id,
                ...document.data()
            });
        });

        return projects;
    } catch (error) {
        console.error("Gagal mengambil data proyek:", error);
        throw error;
    }
}

/**
 * Mengambil detail lengkap proyek beserta sub-koleksi scope
 */
export async function fetchProjectDetail(projectId) {
    try {
        const projectRef = doc(db, "projects", projectId);
        const projectSnap = await getDoc(projectRef);

        if (!projectSnap.exists()) {
            throw new Error("Proyek tidak ditemukan.");
        }

        const projectData = projectSnap.data();

        // Ambil sub-koleksi scopes jika ada
        const scopesRef = collection(db, `projects/${projectId}/scopes`);
        const scopesSnap = await getDocs(scopesRef);
        const scopes = [];

        scopesSnap.forEach((scopeDoc) => {
            scopes.push({
                id: scopeDoc.id,
                ...scopeDoc.data()
            });
        });

        return {
            id: projectSnap.id,
            ...projectData,
            scopes
        };
    } catch (error) {
        console.error("Gagal mengambil detail proyek:", error);
        throw error;
    }
}

/**
 * Memperbarui progres atau status proyek (Khusus Admin/Divisi/Supervisor)
 */
export async function updateProjectProgress(projectId, newProgress, status) {
    try {
        const projectRef = doc(db, "projects", projectId);
        await updateDoc(projectRef, {
            progress: newProgress,
            status: status,
            lastUpdate: new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })
        });
        return true;
    } catch (error) {
        console.error("Gagal memperbarui progres proyek:", error);
        throw error;
    }
}
/**
 * Proyek + sub-koleksi scopes (untuk perhitungan progres berbobot).
 * Biaya baca: 1 baca per proyek + 1 per lingkup. Dimuat sekali saat login (bukan realtime).
 */
export async function fetchProjectsWithScopes(userRole, userUid) {
    const projects = await fetchProjects(userRole, userUid);
    return Promise.all(projects.map(async (p) => {
        const snap = await getDocs(collection(db, `projects/${p.id}/scopes`));
        return { ...p, scopes: snap.docs.map((s) => ({ id: s.id, ...s.data() })) };
    }));
}

const clean = (o) => JSON.parse(JSON.stringify(o));

/** Buat proyek baru + lingkupnya (hanya admin_pusat yang diizinkan Rules). */
export async function createProject(id, fields, scopes, uid) {
    const batch = writeBatch(db);
    batch.set(doc(db, "projects", id), { ...clean(fields), assignedUsers: fields.pmUid ? [fields.pmUid] : [], createdBy: uid, updatedAt: serverTimestamp(), updatedBy: uid });
    scopes.forEach((s) => {
        const { id: sid, ...rest } = s;
        batch.set(doc(db, `projects/${id}/scopes/${sid}`), { ...clean(rest), updatedAt: serverTimestamp(), updatedBy: uid });
    });
    await batch.commit();
}

/** Simpan hanya field yang berubah. Metadata hanya untuk admin (Rules membatasi key untuk role lain). */
export async function updateProject(id, fields, scopeUpserts, scopeDeletes, uid, withMeta) {
    // Ganti Project Manager: PM lama dicabut, PM baru otomatis ditugaskan (assignedUsers).
    if (Object.prototype.hasOwnProperty.call(fields, "pmUid")) {
        const ref = doc(db, "projects", id);
        const before = await getDoc(ref);
        const old = before.exists() ? before.data().pmUid : "";
        if (old && old !== fields.pmUid) await updateDoc(ref, { assignedUsers: arrayRemove(old) });
        if (fields.pmUid) await updateDoc(ref, { assignedUsers: arrayUnion(fields.pmUid) });
    }
    const batch = writeBatch(db);
    if (Object.keys(fields).length) {
        batch.update(doc(db, "projects", id), withMeta ? { ...clean(fields), updatedAt: serverTimestamp(), updatedBy: uid } : clean(fields));
    }
    scopeUpserts.forEach((s) => {
        const ref = doc(db, `projects/${id}/scopes/${s.id}`);
        if (s.isNew) batch.set(ref, { ...clean(s.fields), order: s.order, updatedAt: serverTimestamp(), updatedBy: uid });
        else batch.update(ref, { ...clean(s.fields), updatedAt: serverTimestamp(), updatedBy: uid });
    });
    scopeDeletes.forEach((sid) => batch.delete(doc(db, `projects/${id}/scopes/${sid}`)));
    await batch.commit();
}

/** Hapus proyek beserta lingkupnya. Chat/laporan (jika kelak ada) tidak ikut terhapus. */
export async function deleteProjectCascade(id) {
    const snap = await getDocs(collection(db, `projects/${id}/scopes`));
    const batch = writeBatch(db);
    snap.forEach((s) => batch.delete(s.ref));
    batch.delete(doc(db, "projects", id));
    await batch.commit();
}

/** Chat proyek (realtime). Mengembalikan fungsi untuk berhenti berlangganan. */
export function subscribeChats(projectId, onData, onError) {
    const q = query(collection(db, `projects/${projectId}/chats`), orderBy("at"), limitToLast(100));
    return onSnapshot(q, (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), onError);
}

/** Kirim pesan. Rules mensyaratkan senderId = UID pengirim dan teks 1-2000 karakter. */
export async function sendChat(projectId, msg) {
    await addDoc(collection(db, `projects/${projectId}/chats`), { ...clean(msg), createdAt: serverTimestamp() });
}

/** Foto bukti pekerjaan: disimpan terkompres (data URL) di Firestore, subkoleksi photos. */
export function subscribePhotos(projectId, onData, onError) {
    const q = query(collection(db, `projects/${projectId}/photos`), orderBy("at"));
    return onSnapshot(q, (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), onError);
}
export async function addPhoto(projectId, photo) {
    await addDoc(collection(db, `projects/${projectId}/photos`), { ...clean(photo), createdAt: serverTimestamp() });
}
export async function deletePhoto(projectId, photoId) {
    await deleteDoc(doc(db, `projects/${projectId}/photos/${photoId}`));
}


/* ---------- Akun tim (khusus admin_pusat; dibatasi Rules) ---------- */
export async function listUsers() {
    const snap = await getDocs(collection(db, "users"));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Buat akun login + profil users/{uid} + penugasan proyek, tanpa Cloud Functions.
 * Akun dibuat lewat instans Firebase kedua agar sesi admin tidak berganti.
 */
export async function createStaff(f, adminUid) {
    const second = initializeApp(firebaseConfig, "second-" + Date.now());
    let uid = null;
    try {
        const sa = getAuth(second);
        const cred = await createUserWithEmailAndPassword(sa, f.email, f.password);
        uid = cred.user.uid;
        await signOut(sa);
        const batch = writeBatch(db);
        batch.set(doc(db, "users", uid), { name: f.name, email: f.email, role: f.role, active: f.active, createdBy: adminUid, createdAt: serverTimestamp() });
        f.projectIds.forEach((pid) => batch.update(doc(db, "projects", pid), { assignedUsers: arrayUnion(uid) }));
        await batch.commit();
        return uid;
    } catch (err) {
        if (uid) err.createdUid = uid;
        throw err;
    } finally {
        deleteApp(second).catch(() => { });
    }
}

/** Ubah profil + penugasan. add/remove = id proyek yang ditambah/dicabut. */
export async function updateStaff(uid, f, add, remove) {
    const batch = writeBatch(db);
    batch.update(doc(db, "users", uid), { name: f.name, role: f.role, active: f.active });
    add.forEach((pid) => batch.update(doc(db, "projects", pid), { assignedUsers: arrayUnion(uid) }));
    remove.forEach((pid) => batch.update(doc(db, "projects", pid), { assignedUsers: arrayRemove(uid) }));
    await batch.commit();
}

/** Simpan nama tampilan akun yang sedang login (Rules: users/{uid} hanya ditulis admin_pusat). */
export async function updateOwnName(uid, name) {
    await updateDoc(doc(db, "users", uid), { name });
}

/* ---------- Laporan lapangan: log progres (reports) & foto terbaru ---------- */
export function subscribeReports(projectId, onData, onError) {
    const q = query(collection(db, `projects/${projectId}/reports`), orderBy("at"), limitToLast(100));
    return onSnapshot(q, (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), onError);
}
export async function addReport(projectId, report) {
    await addDoc(collection(db, `projects/${projectId}/reports`), { ...clean(report), createdAt: serverTimestamp() });
}
export async function fetchRecentPhotos(projectId, n = 8) {
    const q = query(collection(db, `projects/${projectId}/photos`), orderBy("at"), limitToLast(n));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/* ---------- Pengumuman (semua proyek) ---------- */
export function subscribeAnnouncements(onData, onError) {
    const q = query(collection(db, "announcements"), orderBy("at"), limitToLast(100));
    return onSnapshot(q, (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), onError);
}
export async function addAnnouncement(a) {
    await addDoc(collection(db, "announcements"), { ...clean(a), createdAt: serverTimestamp() });
}
export async function updateAnnouncement(id, fields) {
    await updateDoc(doc(db, "announcements", id), clean(fields));
}
export async function deleteAnnouncement(id) {
    await deleteDoc(doc(db, "announcements", id));
}

/* ---------- Pesan langsung Admin <-> staf ---------- */
export function subscribeDirect(role, uid, onData, onError) {
    const col = collection(db, "direct_messages");
    // Admin membaca semua percakapan; staf hanya miliknya (where threadId == uid, tanpa orderBy agar tidak butuh indeks gabungan).
    const q = role === "admin_pusat" ? query(col, orderBy("at"), limitToLast(600)) : query(col, where("threadId", "==", uid));
    return onSnapshot(q, (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), onError);
}
export async function sendDirect(msg) {
    await addDoc(collection(db, "direct_messages"), { ...clean(msg), createdAt: serverTimestamp() });
}


/** Peta publik: salinan terbatas proyek (nama tampilan, kota, status, titik kota). Hanya admin yang boleh menulis (Rules). */
export async function setPublicProject(id, data) {
    const { setDoc } = await import("https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js");
    await setDoc(doc(db, "public_projects", id), { ...clean(data), updatedAt: serverTimestamp() });
}
export async function deletePublicProject(id) {
    await deleteDoc(doc(db, "public_projects", id));
}
