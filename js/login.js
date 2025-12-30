// ==========================================
// 1. IMPORTS
// ==========================================
import { auth, db, provider, signInWithPopup } from "./firebase.js";
import { 
    signInWithEmailAndPassword, 
    setPersistence, 
    browserLocalPersistence 
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

// ==========================================
// 2. DOM ELEMENTS
// ==========================================
const loginForm = document.getElementById('login-form');
const googleBtn = document.getElementById('google-btn');
const loginBtn = document.getElementById('login-btn');

// ==========================================
// 3. EMAIL & PASSWORD LOGIN
// ==========================================
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        // UI Feedback: Change button text
        if(loginBtn) {
            loginBtn.innerText = "Signing in...";
            loginBtn.disabled = true;
        }

        try {
            // FIX: Always use Local Persistence (Stays logged in like Facebook)
            await setPersistence(auth, browserLocalPersistence);

            // Sign In
            await signInWithEmailAndPassword(auth, email, password);

            // Redirect to Dashboard
            window.location.href = "./test.html";

        } catch (error) {
            console.error("Login Error:", error);
            alert("Login failed: " + error.message);
            
            // Reset button if error
            if(loginBtn) {
                loginBtn.innerText = "Login"; 
                loginBtn.disabled = false;
            }
        }
    });
}

// ==========================================
// 4. GOOGLE LOGIN
// ==========================================
if (googleBtn) {
    googleBtn.addEventListener('click', async () => {
        try {
            // FIX: Force persistence before popup
            await setPersistence(auth, browserLocalPersistence);

            const result = await signInWithPopup(auth, provider);
            const user = result.user;

            // Check if user profile exists in Firestore
            const userDocRef = doc(db, "users", user.uid);
            const userDoc = await getDoc(userDocRef);

            if (!userDoc.exists()) {
                // Create profile if this is the first time logging in
                const shareID = Math.floor(100000 + Math.random() * 900000).toString();
                await setDoc(userDocRef, {
                    fullname: user.displayName,
                    email: user.email,
                    uid: user.uid,
                    shareID: shareID,
                    createdAt: new Date(),
                    monthlyBudget: 0 // Initialize budget
                });
            }

            // Redirect to Dashboard
            window.location.href = "./test.html";

        } catch (error) {
            console.error("Google Login Error:", error);
            alert(error.message);
        }
    });
}