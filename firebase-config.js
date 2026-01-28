/**
 * Firebase 설정 (Firestore 전용)
 * Analytics 미사용, Firestore만 사용합니다.
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export const firebaseConfig = {
  apiKey: "AIzaSyArjRGJkp2oTQLybIXGV6UPrRZ-v3WVdpM",
  authDomain: "todo-ccee4.firebaseapp.com",
  projectId: "todo-ccee4",
  storageBucket: "todo-ccee4.firebasestorage.app",
  messagingSenderId: "982352437263",
  appId: "1:982352437263:web:0e45607517135b27ae037a",
  measurementId: "G-5FHMEBJSLJ",
};

const app = initializeApp(firebaseConfig);
let _db = null;

export function getDb() {
  if (!_db) _db = getFirestore(app);
  return _db;
}
