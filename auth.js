import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, signOut, setPersistence, browserSessionPersistence } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const gate = document.getElementById("authGate");
const form = document.getElementById("emailLoginForm");
const googleBtn = document.getElementById("googleLoginBtn");
const logoutBtn = document.getElementById("authLogoutBtn");
const appLogoutBtn = document.getElementById("appLogoutBtn");
const message = document.getElementById("authMessage");
const dashboard = document.getElementById("app");

/* Login setiap kali aplikasi dibuka di tab/jendela baru.
   true  = sesi hanya hidup di tab itu (tab baru selalu mulai dari halaman login; muat ulang di tab yang sama tetap masuk).
           Berguna untuk menguji peran berbeda: tiap tab bisa memakai akun sendiri.
   false = sesi tersimpan di browser (tidak perlu login lagi sampai menekan Keluar). */
const LOGIN_SETIAP_BUKA = true;
const authReady = (async () => {
  if (!LOGIN_SETIAP_BUKA) return;
  try {
    await setPersistence(auth, browserSessionPersistence);
    if (!sessionStorage.getItem("pcc.sesi")) await signOut(auth); // tab baru: hapus sesi lama bila ada
    sessionStorage.setItem("pcc.sesi", "1");
  } catch (e) { console.warn("Pengaturan sesi login gagal:", e && e.code); }
})();

// Fail-closed: dashboard tidak ditampilkan sampai role diverifikasi dari Firestore.
if (dashboard) dashboard.hidden = true;
function say(text, kind = "") { message.textContent = text; message.dataset.kind = kind; }
function showGate(show) { gate.hidden = !show; if (dashboard) dashboard.hidden = show; }
function friendlyError(error) {
  const code = error?.code || "";
  const messages = {
    "auth/invalid-credential": "Email atau password salah.",
    "auth/user-not-found": "Akun belum terdaftar.",
    "auth/wrong-password": "Email atau password salah.",
    "auth/too-many-requests": "Terlalu banyak percobaan. Coba lagi nanti.",
    "auth/popup-closed-by-user": "Jendela login Google ditutup sebelum selesai.",
    "auth/unauthorized-domain": "Domain website belum diizinkan di Firebase Authentication.",
    "permission-denied": "Profil atau role tidak dapat dibaca. Periksa dokumen users/{uid} dan Firestore Rules."
  };
  return messages[code] || `Login gagal: ${error?.message || code || "kesalahan tidak diketahui"}`;
}
async function verifyRole(user) {
  const snap = await getDoc(doc(db, "users", user.uid));
  if (!snap.exists()) return null;
  const profile = snap.data();

  // Sesuaikan dengan data role di Firestore ("admin_pusat", dll.)
  const allowed = ["admin_pusat", "kepala_divisi", "project_manager", "supervisor", "tim_lapangan"];
  if (!allowed.includes(profile.role) || profile.active !== true) return null;
  return profile;
}
async function completeLogin(user) {
  say("Memeriksa role akun…");
  try {
    const profile = await verifyRole(user);
    if (!profile) {
      await signOut(auth);
      showGate(true);
      logoutBtn.hidden = true;
      if (appLogoutBtn) appLogoutBtn.hidden = true;
      say("Login berhasil, tetapi akun ini belum memiliki role aktif yang didaftarkan admin. Hubungi Admin Kantor Pusat.", "error");
      return;
    }
    logoutBtn.hidden = false;
    if (appLogoutBtn) appLogoutBtn.hidden = false;
    say(`Login sebagai ${profile.name || user.displayName || user.email} (${profile.role}).`, "success");
    const roleNames = ["Admin Kantor Pusat", "Kepala Divisi", "Project Manager", "Supervisor Proyek", "Tim Lapangan"];
    const rawName = (profile.name || user.displayName || "").trim();
    const name = (rawName && !roleNames.includes(rawName)) ? rawName : ((user.email || "").split("@")[0] || rawName || "Pengguna");
    const nameEl = document.getElementById("profileName");
    const avatarEl = document.getElementById("avatar");
    if (nameEl) nameEl.textContent = name;
    if (avatarEl) avatarEl.textContent = name.trim().split(/\s+/).slice(0, 2).map(x => x[0] || "").join("").toUpperCase();
    const roleText = document.querySelector(".profile-text small");
    if (roleText) roleText.textContent = ({ admin_pusat: "Admin Kantor Pusat", kepala_divisi: "Kepala Divisi", project_manager: "Project Manager", supervisor: "Supervisor Proyek", tim_lapangan: "Tim Lapangan" })[profile.role] || profile.role;
    const loadLive = async () => {
      try {
        const service = await import("./project-service.js");
        const list = await service.fetchProjectsWithScopes(profile.role, user.uid);
        window.PCCLive?.apply(list, { name, email: user.email, role: profile.role }, loadLive, { service, uid: user.uid, role: profile.role });
      } catch (err) {
        console.error("Gagal ambil data proyek:", err);
        window.PCCLive?.fail(friendlyError(err));
      }
    };
    await loadLive();
    showGate(false); // tampilkan dashboard hanya setelah data live (atau keadaan kosong) terpasang

  } catch (error) {
    console.error("Pemeriksaan role gagal:", error);


    await signOut(auth).catch(() => { });
    showGate(true);
    say(friendlyError(error), "error");
  }
}
form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = document.getElementById("authEmail").value.trim();
  const password = document.getElementById("authPassword").value;
  say("Memproses login…");
  await authReady;
  try { const credential = await signInWithEmailAndPassword(auth, email, password); await completeLogin(credential.user); }
  catch (error) { say(friendlyError(error), "error"); }
});
googleBtn?.addEventListener("click", async () => {
  say("Membuka login Google…");
  try { const result = await signInWithPopup(auth, new GoogleAuthProvider()); await completeLogin(result.user); }
  catch (error) { say(friendlyError(error), "error"); }
});
async function doLogout() { try { await signOut(auth); say("Anda sudah keluar."); } catch (error) { say(friendlyError(error), "error"); } }
logoutBtn?.addEventListener("click", doLogout);
appLogoutBtn?.addEventListener("click", doLogout);
onAuthStateChanged(auth, async (user) => {
  await authReady;
  if (user && auth.currentUser?.uid !== user.uid) return; // sesi lama sudah dihapus
  if (!user) { showGate(true); logoutBtn.hidden = true; if (appLogoutBtn) appLogoutBtn.hidden = true; say("Silakan masuk dengan akun yang sudah terdaftar."); return; }
  await completeLogin(user);
});
