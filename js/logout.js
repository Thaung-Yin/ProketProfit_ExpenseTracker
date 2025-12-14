// js/app.js
import { auth } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

// This file runs on Login, Register, and Reset pages.
// It checks if you are ALREADY logged in.

onAuthStateChanged(auth, (user) => {
    if (user) {
        // User is found! No need to login again.
        console.log("User already logged in. Redirecting...");
        window.location.href = "./test.html";
    } else {
        // User is not logged in.
        // Stay on the current page (Login/Register/Reset) so they can sign in.
        console.log("No user detected. Staying on public page.");
    }
});