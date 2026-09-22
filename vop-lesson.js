import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import {
    getAuth,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import {
    getDatabase,
    ref,
    get,
    update
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

// ---- FIREBASE CONFIG ----
const firebaseConfig = {
    apiKey: "AIzaSyAOB4q01251P4tkJ_KKmveVpbe7EDU_NwY",
    authDomain: "vop-student-list.firebaseapp.com",
    databaseURL: "https://vop-student-list-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "vop-student-list",
    storageBucket: "vop-student-list.firebasestorage.app",
    messagingSenderId: "230421900101",
    appId: "1:230421900101:web:ca7dc791606570697aec2c",
    measurementId: "G-XTWVGCTLKS"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// Get lesson variables defined in the lesson's inline script
const lessonNum = typeof window.currentLessonNumber !== "undefined" ? window.currentLessonNumber : 1;
const nextFile = typeof window.nextLessonFile !== "undefined" ? window.nextLessonFile : "index.html";

// Optional Apps Script URL if certificate email is still forwarded there
const legacyScriptURL = typeof window.scriptURL !== "undefined" ? window.scriptURL : "";

// Fast synchronous check from localStorage to prevent unauthorized viewing
const localEmail = localStorage.getItem("vop_email");
const localUid = localStorage.getItem("vop_uid");
const localProgress = parseInt(localStorage.getItem("vop_progress") || "0", 10);

if (localProgress > 0 && lessonNum > localProgress) {
    alert("He lesson hi i la unlock lo!");
    window.location.href = "index.html";
}

let isAuthResolved = false;

// Authenticate and sync with Firebase Realtime Database
onAuthStateChanged(auth, async (user) => {
    isAuthResolved = true;
    if (user) {
        localStorage.setItem("vop_uid", user.uid);
        if (user.email) localStorage.setItem("vop_email", user.email);

        try {
            const snap = await get(ref(db, "users/" + user.uid));
            if (snap.exists()) {
                const data = snap.val();
                if (data.name) localStorage.setItem("vop_name", data.name);
                const dbProgress = parseInt(data.progress || 1, 10);
                localStorage.setItem("vop_progress", dbProgress);

                if (lessonNum > dbProgress) {
                    alert("He lesson hi i la unlock lo!");
                    window.location.href = "index.html";
                }
            }
        } catch (err) {
            console.warn("Could not sync profile from Firebase:", err);
        }
    } else {
        // Not signed in with Firebase Auth
        if (!localStorage.getItem("vop_uid") && !localStorage.getItem("vop_email")) {
            alert("Login hmasak a ngai!");
            window.location.href = "index.html";
        }
    }
});

// Fallback check in case Firebase auth takes too long
setTimeout(() => {
    if (!isAuthResolved && !localStorage.getItem("vop_uid") && !localStorage.getItem("vop_email")) {
        alert("Login hmasak a ngai!");
        window.location.href = "index.html";
    }
}, 2500);

// Global submitQuiz handler
window.submitQuiz = async function () {
    const answers = window.correctAnswers || {};
    let allCorrect = true;
    let wrongQuestions = [];
    let questionNumber = 1;

    for (let qName in answers) {
        const selectedOption = document.querySelector(`input[name="${qName}"]:checked`);
        if (!selectedOption || selectedOption.value !== answers[qName]) {
            allCorrect = false;
            wrongQuestions.push(questionNumber);
        }
        questionNumber++;
    }

    const errorMsgElement = document.getElementById("errorMsg");

    if (!allCorrect) {
        if (errorMsgElement) {
            errorMsgElement.innerText = `A dik lo awm! Question no: ${wrongQuestions.join(", ")} te hi han chhang tha leh rawh.`;
        }
        return;
    }

    if (errorMsgElement) {
        errorMsgElement.innerText = "Saving progress...";
    }

    const submitBtn = document.getElementById("submitBtn");
    if (submitBtn) submitBtn.disabled = true;

    const currentProgress = parseInt(localStorage.getItem("vop_progress") || "1", 10);
    const nextLesson = lessonNum + 1;
    const uid = auth.currentUser ? auth.currentUser.uid : localStorage.getItem("vop_uid");

    if (lessonNum < 25) {
        if (nextLesson > currentProgress) {
            localStorage.setItem("vop_progress", nextLesson);
            if (uid) {
                try {
                    await update(ref(db, "users/" + uid), {
                        progress: nextLesson,
                        lastActive: Date.now()
                    });
                } catch (err) {
                    console.error("Firebase progress update error:", err);
                }
            }
        }
        const modal = document.getElementById("successModal");
        if (modal) modal.classList.remove("hidden");
    } else {
        // Lesson 25 course completion
        const continueBtn = document.getElementById("modalContinueBtn");
        const modalMsg = document.getElementById("modalMessage");
        const modal = document.getElementById("successModal");

        if (continueBtn) continueBtn.classList.add("hidden");
        if (modalMsg) {
            modalMsg.innerHTML = "Course zawng zawng i zo ta! Lawmpui a che.<br><br>⏳ I record kan save mek e...";
        }
        if (modal) modal.classList.remove("hidden");

        if (uid) {
            try {
                await update(ref(db, "users/" + uid), {
                    progress: 25,
                    completed: true,
                    completedAt: Date.now(),
                    lastActive: Date.now()
                });
            } catch (err) {
                console.error("Firebase course completion update error:", err);
            }
        }
        localStorage.setItem("vop_progress", 25);

        // Forward to certificate webhook if configured
        if (legacyScriptURL) {
            try {
                const formData = new URLSearchParams();
                formData.append("action", "finish_course");
                formData.append("email", localStorage.getItem("vop_email") || "");
                formData.append("name", localStorage.getItem("vop_name") || "");
                await fetch(legacyScriptURL, { method: "POST", body: formData });
            } catch (legacyErr) {
                console.warn("Legacy certificate trigger notice:", legacyErr);
            }
        }

        if (modalMsg) {
            modalMsg.innerHTML = "Course i zo ta! ✅ Lawmpuina kan hlan a che.";
        }
        if (continueBtn) {
            continueBtn.classList.remove("hidden");
            continueBtn.innerText = "Dashboard ah Letna";
            continueBtn.onclick = function () {
                window.location.href = "index.html";
            };
        }
    }
};

window.goToNext = function () {
    window.location.href = nextFile;
};
