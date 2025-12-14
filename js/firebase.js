// js/firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getAuth,GoogleAuthProvider,signInWithPopup } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyD173tReTPaMZYc_a5aGAYDYgY_APyLAJ0",
    authDomain: "proketprofit.firebaseapp.com",
    projectId: "proketprofit",
    storageBucket: "proketprofit.firebasestorage.app",
    messagingSenderId: "707146431564",
    appId: "1:707146431564:web:e0bfaadbf1161b110148e9"
  };

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

export { auth, db, provider, signInWithPopup };