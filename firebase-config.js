// Konfigurasi Firebase Web untuk Mata Utama. Ini bukan service-account credential.
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

export const firebaseConfig = {
  apiKey: "AIzaSyCcj7SfxLHX85Te2wRPm_evfhySFnVMk5c",
  authDomain: "my-cv-project-33552.firebaseapp.com",
  projectId: "my-cv-project-33552",
  storageBucket: "my-cv-project-33552.appspot.com",
  messagingSenderId: "929487004166",
  appId: "1:929487004166:web:b7ecca31ddf213958ad987",
  measurementId: "G-1M4LKJ2TNR"
};

// Inisialisasi Firebase App, Auth, dan Firestore (db) agar bisa di-import oleh file lain
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);