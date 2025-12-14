// js/reset.js
import { auth } from "./firebase.js";
import { sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const resetForm = document.getElementById('reset-form');
const resetBtn = document.getElementById('reset-btn');

resetForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('email').value;

    if (!email) {
        alert("Please enter your email address.");
        return;
    }

    // UI Feedback
    resetBtn.innerText = "Sending...";
    resetBtn.disabled = true;

    try {
        await sendPasswordResetEmail(auth, email);
        
        alert("Password reset email sent! Check your inbox.");
        
        // Redirect back to login after a moment
        setTimeout(() => {
            window.location.href = "./index.html";
        }, 2000);

    } catch (error) {
        console.error("Reset Error:", error);
        
        let msg = error.message;
        if (error.code === 'auth/user-not-found') {
            msg = "No account found with this email.";
        }
        
        alert(msg);
        resetBtn.innerText = "Request New Password";
        resetBtn.disabled = false;
    }
});