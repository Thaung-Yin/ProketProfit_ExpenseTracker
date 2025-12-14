import { auth, db, provider, signInWithPopup } from "./firebase.js"; 
import { createUserWithEmailAndPassword, updateProfile } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

const signupForm = document.getElementById('signup-form');
const submitBtn = document.getElementById('submit-btn');

// Function to generate a random 6-digit ID for group sharing
function generateShareID() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

signupForm.addEventListener('submit', async (e) => {
    e.preventDefault(); 
    const fullname = document.getElementById('fullname').value;
    const email = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    if(password.length < 6){
        alert("Password should be at least 6 characters");
        return;
    }

    const originalText = submitBtn.innerText;
    submitBtn.innerText = "Creating Account...";
    submitBtn.disabled = true;

    try {

        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        await updateProfile(user, {
            displayName: fullname
        });


        const shareID = generateShareID();


        await setDoc(doc(db, "users", user.uid), {
            fullname: fullname,
            email: email,
            uid: user.uid,         
            shareID: shareID,       
            createdAt: new Date()
        });

        alert("Account Created Successfully!");
        
        window.location.href = "./index.html"; 

    } catch (error) {
        console.error("Error signing up:", error);
        
        let msg = error.message;
        if(error.code === 'auth/email-already-in-use') {
            msg = "This email is already registered.";
        }
        
        alert(msg);
        submitBtn.innerText = originalText;
        submitBtn.disabled = false;
    }
});

const googleBtn = document.querySelector('.google button');

googleBtn.addEventListener('click', async () => {
    try {
        // 1. Open Google Popup
        const result = await signInWithPopup(auth, provider);
        const user = result.user;

        // 2. Check if user already exists in Firestore
        // (We don't want to overwrite an existing user's data if they log in again)
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);

        if (!userDoc.exists()) {
            // 3. If New User -> Create Firestore Document
            // Re-using your random ID generator logic
            const shareID = Math.floor(100000 + Math.random() * 900000).toString();

            await setDoc(userDocRef, {
                fullname: user.displayName, // Google gives us the name automatically
                email: user.email,
                uid: user.uid,
                shareID: shareID,
                createdAt: new Date()
            });
        }

        // 4. Redirect to Dashboard
        // alert("Google Sign In Successful!"); // Optional
        window.location.href = "./test.html"; // Redirect to dashboard

    } catch (error) {
        console.error("Google Sign In Error:", error);
        alert(error.message);
    }
});