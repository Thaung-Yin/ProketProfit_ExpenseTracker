// ==========================================
// 1. IMPORTS
// ==========================================
import { auth, db, provider, signInWithPopup } from "./firebase.js";
import { 
    signInWithEmailAndPassword, 
    setPersistence, 
    browserLocalPersistence,
    onAuthStateChanged // <--- ADD THIS IMPORT
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

// ==========================================
// 2. AUTO-REDIRECT (The "Facebook" Fix)
// ==========================================
// This checks if the user is ALREADY logged in when the page loads
onAuthStateChanged(auth, (user) => {
    if (user) {
        // User is already logged in -> Go straight to dashboard
        window.location.href = "./home.html";
    }
});

// ==========================================
// 3. DOM ELEMENTS
// ==========================================
const loginForm = document.getElementById('login-form');
const googleBtn = document.getElementById('google-btn');
const loginBtn = document.getElementById('login-btn');

// ==========================================
// 4. EMAIL & PASSWORD LOGIN
// ==========================================
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        if(loginBtn) {
            loginBtn.innerText = "Signing in...";
            loginBtn.disabled = true;
        }

        try {
            // Keep user logged in
            await setPersistence(auth, browserLocalPersistence);

            await signInWithEmailAndPassword(auth, email, password);
            // The onAuthStateChanged above will handle the redirect, 
            // but we keep this here just in case:
            window.location.href = "./home.html";

        } catch (error) {
            console.error("Login Error:", error);
            alert("Login failed: " + error.message);
            
            if(loginBtn) {
                loginBtn.innerText = "Login"; 
                loginBtn.disabled = false;
            }
        }
    });
}

// ==========================================
// 5. GOOGLE LOGIN
// ==========================================
if (googleBtn) {
    googleBtn.addEventListener('click', async () => {
        try {
            await setPersistence(auth, browserLocalPersistence);

            const result = await signInWithPopup(auth, provider);
            const user = result.user;

            const userDocRef = doc(db, "users", user.uid);
            const userDoc = await getDoc(userDocRef);

            if (!userDoc.exists()) {
                const shareID = Math.floor(100000 + Math.random() * 900000).toString();
                await setDoc(userDocRef, {
                    fullname: user.displayName,
                    email: user.email,
                    uid: user.uid,
                    shareID: shareID,
                    createdAt: new Date(),
                    monthlyBudget: 0 
                });
            }
            // onAuthStateChanged will handle redirect
            window.location.href = "./home.html";

        } catch (error) {
            console.error("Google Login Error:", error);
            alert(error.message);
        }
    });
}