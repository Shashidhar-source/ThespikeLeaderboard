/* ============================================================
   THE SPIKE INDIA — login.js
   Firebase Authentication & User Profile Sync
   ============================================================ */

import { 
    db, 
    auth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    updateProfile,
    sendPasswordResetEmail,
    GoogleAuthProvider,
    signInWithPopup,
    doc, 
    setDoc, 
    getDoc, 
    collection, 
    getDocs, 
    inspectProofLink 
} from "./firebase-config.js";

const USERS_STORAGE_KEY = 'spike-cross-users';
const CURRENT_USER_KEY  = 'spike-current-user';
const PLAYERS_STORAGE   = 'spike-india-players';

// ── THEME SUPPORT ───────────────────────────────────────────
const html        = document.documentElement;
const themeToggle = document.getElementById('themeToggle');
const toggleIcon  = document.getElementById('toggleIcon');
let currentTheme  = localStorage.getItem('spike-theme') || 'dark';
applyTheme(currentTheme);

themeToggle?.addEventListener('click', () => {
    currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(currentTheme);
    localStorage.setItem('spike-theme', currentTheme);
});

function applyTheme(t) {
    html.setAttribute('data-theme', t);
    if (toggleIcon) toggleIcon.textContent = t === 'dark' ? '☀️' : '🌙';
}

// ── BACKGROUND PARTICLES ────────────────────────────────────
const canvas = document.getElementById('particles-canvas');
const ctx    = canvas?.getContext('2d');

function resizeCanvas() {
    if (!canvas) return;
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

function mkParticle() {
    return {
        x: Math.random() * (canvas?.width || 800),
        y: Math.random() * (canvas?.height || 600),
        vx: (Math.random() - 0.5) * 0.4,
        vy: -Math.random() * 0.7 - 0.2,
        size: Math.random() * 2 + 0.5,
        opacity: Math.random() * 0.5 + 0.1,
        life: 1, decay: Math.random() * 0.005 + 0.002
    };
}
let pts = Array.from({ length: 60 }, mkParticle);

function drawParticles() {
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const dark = currentTheme === 'dark';
    pts.forEach((p, i) => {
        p.x += p.vx; p.y += p.vy; p.life -= p.decay;
        if (p.life <= 0 || p.y < -10) {
            pts[i] = mkParticle();
            pts[i].y = canvas.height + 10;
        }
        ctx.save();
        ctx.globalAlpha = p.life * p.opacity * (dark ? 0.7 : 0.25);
        ctx.fillStyle = `rgba(255,${Math.floor(Math.random() * 30)},0,1)`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    });
    requestAnimationFrame(drawParticles);
}
if (canvas) drawParticles();

// ── PASSWORD VISIBILITY TOGGLE ──────────────────────────────
document.querySelectorAll('.pwd-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-target');
        const input = document.getElementById(targetId);
        if (input) {
            const isPassword = input.type === 'password';
            input.type = isPassword ? 'text' : 'password';
            btn.textContent = isPassword ? '🙈' : '👁';
        }
    });
});


// ── ALERTS & ERROR TRANSLATION ──────────────────────────────
const authAlert = document.getElementById('authAlert');

function showAlert(msg, isError = true) {
    if (!authAlert) return;
    let clean = (msg || '').toString()
        .replace(/^Firebase:\s*(Error\s*)?/i, '')
        .replace(/\(auth\/[a-z0-9-]+\)\.?/i, '')
        .trim();
    authAlert.innerHTML = clean;
    authAlert.className = `auth-alert ${isError ? 'error' : 'success'}`;
    authAlert.style.display = 'block';
}

function clearAlert() {
    if (authAlert) {
        authAlert.style.display = 'none';
        authAlert.innerHTML = '';
    }
}

function formatAuthError(err) {
    console.error('Authentication Error:', err);
    const code = err?.code || '';
    const currentHost = window.location.hostname || 'this domain';

    switch (code) {
        case 'auth/unauthorized-domain':
            return `Error: Domain "${currentHost}" is not authorized for Google Sign-In yet. Please add "${currentHost}" in Firebase Console ➔ Authentication ➔ Settings ➔ Authorized Domains.`;
        case 'auth/invalid-email':
            return 'Error: Invalid email address format.';
        case 'auth/user-disabled':
            return 'Error: This account has been disabled. Contact support.';
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
            return 'Error: Invalid login credentials. Please check your username/email and password.';
        case 'auth/email-already-in-use':
            return 'Error: This email is already registered. Please sign in instead.';
        case 'auth/weak-password':
            return 'Error: Password is too weak. Please use at least 6 characters.';
        case 'auth/operation-not-allowed':
            return 'Error: This sign-in method is not enabled. Please enable it in project settings.';
        case 'auth/popup-closed-by-user':
        case 'auth/cancelled-popup-request':
            return 'Error: Google Sign-In popup was closed before completion.';
        case 'auth/popup-blocked':
            return 'Error: Google Sign-In popup was blocked by your browser. Please allow popups for this site.';
        case 'auth/network-request-failed':
            return 'Error: Network connection problem. Please check your connection and try again.';
        case 'auth/account-exists-with-different-credential':
            return 'Error: An account already exists with this email using a different sign-in method.';
        default: {
            let msg = err?.message || 'Authentication failed. Please try again.';
            msg = msg.replace(/^Firebase:\s*(Error\s*)?/i, '').replace(/\(auth\/[a-z0-9-]+\)\.?/i, '').trim();
            return `Error: ${msg}`;
        }
    }
}

// ── LOGIN HANDLER (FIREBASE AUTH EMAIL/PASSWORD) ─────────────
const loginForm = document.getElementById('loginForm');
loginForm?.addEventListener('submit', async (e) => {

    e.preventDefault();
    clearAlert();

    const identifier = document.getElementById('loginIdentifier')?.value.trim();
    const password   = document.getElementById('loginPassword')?.value;
    const loginBtn   = document.getElementById('loginBtn');

    if (!identifier || !password) {
        showAlert('Please enter your IGN or Email, and password.');
        return;
    }

    if (loginBtn) loginBtn.disabled = true;
    showAlert('Authenticating...', false);


    let emailToAuth = identifier;

    // If identifier is not an email, lookup user email in Firestore
    if (!identifier.includes('@')) {
        try {
            const ignDoc = await getDoc(doc(db, "users_by_ign", identifier.toLowerCase()));
            if (ignDoc.exists()) {
                emailToAuth = ignDoc.data().email || identifier;
            } else {
                // Search users collection
                const snap = await getDocs(collection(db, "users"));
                snap.forEach(d => {
                    const u = d.data();
                    if (u.ign?.toLowerCase() === identifier.toLowerCase() && u.email) {
                        emailToAuth = u.email;
                    }
                });
            }
        } catch (lookupErr) {
            console.warn('IGN lookup notice:', lookupErr);
        }
    }

    let authUser = null;
    let authError = null;

    try {
        const cred = await signInWithEmailAndPassword(auth, emailToAuth, password);
        authUser = cred.user;
    } catch (err) {
        authError = err;
    }

    // If Firebase Auth succeeded
    if (authUser) {
        let profile = {
            ign: authUser.displayName || identifier,
            email: authUser.email,
            uid: 'SC-' + Math.floor(100000 + Math.random() * 900000),
            character: 'BLACK THUNDER NISHIKAWA',
            region: 'India',
            speed: 0,
            proof: '#',
            firebaseUid: authUser.uid
        };

        // Fetch detailed profile from Firestore
        try {
            const pDoc = await getDoc(doc(db, "users", authUser.uid));
            if (pDoc.exists()) {
                profile = { ...profile, ...pDoc.data() };
            }
        } catch (e) {}

        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify({
            ...profile,
            loggedInAt: Date.now()
        }));

        showAlert(`🔥 Welcome back, ${profile.ign}! Redirecting to leaderboard...`, false);
        setTimeout(() => { window.location.href = 'index.html'; }, 900);
        return;
    }

    // If Firebase Auth returned error, check if demo account or fallback
    if (loginBtn) loginBtn.disabled = false;

    // Demo account fallback for instant testing
    if ((identifier.toLowerCase() === 'spikemaster' || identifier.toLowerCase() === 'demo') && password === 'spike123') {
        const demoUser = {
            ign: 'SPIKE_MASTER10',
            uid: 'SC-100001',
            email: 'spikemaster@thespike.in',
            region: 'Karnataka',
            character: 'BLACK THUNDER NISHIKAWA',
            speed: 198,
            proof: 'https://youtube.com/shorts/demo',
            loggedInAt: Date.now()
        };
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(demoUser));
        showAlert(`⚡ Demo login successful! Welcome, ${demoUser.ign}!`, false);
        setTimeout(() => { window.location.href = 'index.html'; }, 900);
        return;
    }

    showAlert(formatAuthError(authError));
});

// ── GOOGLE AUTHENTICATION HANDLER ────────────────────────────
async function handleGoogleAuth() {
    clearAlert();
    showAlert('Connecting to Google Account...', false);


    try {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        const res = await signInWithPopup(auth, provider);
        const user = res.user;

        const ign = user.displayName || user.email.split('@')[0];
        let profile = {
            ign,
            email: user.email,
            uid: 'SC-' + Math.floor(100000 + Math.random() * 900000),
            character: 'BLACK THUNDER NISHIKAWA',
            region: 'India',
            speed: 0,
            proof: '#',
            firebaseUid: user.uid
        };

        // Try getting existing profile from Firestore
        try {
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (userDoc.exists()) {
                profile = { ...profile, ...userDoc.data() };
            } else {
                // Initialize default profile
                await setDoc(doc(db, "users", user.uid), profile, { merge: true });
                await setDoc(doc(db, "users_by_ign", ign.toLowerCase()), {
                    email: user.email,
                    ign,
                    uid: profile.uid,
                    firebaseUid: user.uid
                }, { merge: true });
            }
        } catch (dbErr) {
            console.warn('Google auth Firestore note:', dbErr);
        }

        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify({
            ...profile,
            loggedInAt: Date.now()
        }));

        showAlert(`🎉 Google Login Successful! Welcome ${profile.ign}!`, false);
        setTimeout(() => { window.location.href = 'index.html'; }, 900);
    } catch (err) {
        console.error('Google Sign-In Error:', err);
        showAlert(formatAuthError(err));
    }
}

document.getElementById('googleLoginBtn')?.addEventListener('click', handleGoogleAuth);
document.getElementById('googleRegBtn')?.addEventListener('click', handleGoogleAuth);

// ── FORGOT PASSWORD HANDLER ──────────────────────────────────
document.getElementById('forgotPassLink')?.addEventListener('click', async (e) => {
    e.preventDefault();
    clearAlert();

    const email = prompt('Enter your registered Spike Cross email address:');
    if (!email || !email.trim()) return;

    showAlert('Sending password reset email...', false);

    try {
        await sendPasswordResetEmail(auth, email.trim());
        showAlert(`📩 Password reset link sent to <strong>${email.trim()}</strong>! Check your inbox.`, false);
    } catch (err) {
        showAlert(formatAuthError(err));
    }
});

// ── SYNC FIREBASE AUTH STATE ON PAGE LOAD ────────────────────
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const active = localStorage.getItem(CURRENT_USER_KEY);
        const name = user.displayName || (active ? JSON.parse(active).ign : user.email);
        showAlert(`Active Session: Logged in as <strong>${name}</strong>. <a href="index.html" style="color:var(--accent-red);font-weight:700;margin-left:8px;">Go to Leaderboard →</a>`, false);
    }
});

