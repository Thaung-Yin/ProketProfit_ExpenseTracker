// js/login.js
import { auth, db, provider, signInWithPopup } from "./firebase.js";
import { 
    signInWithEmailAndPassword, 
    setPersistence, 
    browserLocalPersistence, 
    browserSessionPersistence 
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

const loginForm = document.getElementById('login-form');
const googleBtn = document.getElementById('google-btn');
const loginBtn = document.getElementById('login-btn');

// --- 1. EMAIL & PASSWORD LOGIN ---
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const rememberMe = document.getElementById('remember-me').checked;

    // UI Feedback
    const originalText = loginBtn.innerText;
    loginBtn.innerText = "Signing in...";
    loginBtn.disabled = true;

    try {
        // Set Persistence: Local (Remember me) or Session (Forget on close)
        const persistenceType = rememberMe ? browserLocalPersistence : browserSessionPersistence;
        await setPersistence(auth, persistenceType);

        // Sign In
        await signInWithEmailAndPassword(auth, email, password);

        // Redirect
        window.location.href = "./test.html";

    } catch (error) {
        console.error("Login Error:", error);
        alert("Login failed: " + error.message);
        
        loginBtn.innerText = originalText;
        loginBtn.disabled = false;
    }
});

// --- 2. GOOGLE LOGIN ---
googleBtn.addEventListener('click', async () => {
    try {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;

        // Check if profile exists (in case they login with Google for the 1st time here)
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);

        if (!userDoc.exists()) {
            // Create profile if missing
            const shareID = Math.floor(100000 + Math.random() * 900000).toString();
            await setDoc(userDocRef, {
                fullname: user.displayName,
                email: user.email,
                uid: user.uid,
                shareID: shareID,
                createdAt: new Date()
            });
        }

        window.location.href = "./test.html";

    } catch (error) {
        console.error("Google Login Error:", error);
        alert(error.message);
    }
});