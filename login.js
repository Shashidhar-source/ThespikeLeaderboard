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

// ── TABS (LOGIN / REGISTER) ─────────────────────────────────
const tabLogin     = document.getElementById('tabLogin');
const tabRegister  = document.getElementById('tabRegister');
const loginForm    = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const authAlert    = document.getElementById('authAlert');

tabLogin?.addEventListener('click', () => {
    tabLogin.classList.add('active');
    tabRegister.classList.remove('active');
    tabLogin.setAttribute('aria-selected', 'true');
    tabRegister.setAttribute('aria-selected', 'false');
    loginForm.style.display = 'flex';
    registerForm.style.display = 'none';
    clearAlert();
});

tabRegister?.addEventListener('click', () => {
    tabRegister.classList.add('active');
    tabLogin.classList.remove('active');
    tabRegister.setAttribute('aria-selected', 'true');
    tabLogin.setAttribute('aria-selected', 'false');
    registerForm.style.display = 'flex';
    loginForm.style.display = 'none';
    clearAlert();
});

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
function showAlert(msg, isError = true) {
    if (!authAlert) return;
    authAlert.innerHTML = msg;
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
    console.error('Firebase Auth Error:', err);
    const code = err?.code || '';
    switch (code) {
        case 'auth/invalid-email':
            return 'Invalid email address format.';
        case 'auth/user-disabled':
            return 'This account has been disabled. Contact support.';
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
            return 'Invalid login credentials. Please check your email/IGN and password.';
        case 'auth/email-already-in-use':
            return 'This email is already in use. Please sign in or use another email.';
        case 'auth/weak-password':
            return 'Password is too weak. Please use at least 6 characters.';
        case 'auth/operation-not-allowed':
            return '⚠️ Email/Password sign-in is not enabled in Firebase Console. Go to Firebase Console ➔ Authentication ➔ Sign-in method to enable it.';
        case 'auth/popup-closed-by-user':
            return 'Google Sign-In popup was closed before completion.';
        case 'auth/popup-blocked':
            return 'Popup was blocked by your browser. Please allow popups for this site.';
        default:
            return err?.message || 'Authentication error. Please try again.';
    }
}

// ── LIVE PROOF LINK INSPECTION ──────────────────────────────
const regProofInput    = document.getElementById('regProof');
const regProofFeedback = document.getElementById('regProofFeedback');

regProofInput?.addEventListener('input', () => {
    const val = regProofInput.value.trim();
    if (!val) {
        regProofFeedback.style.display = 'none';
        return;
    }

    const inspection = inspectProofLink(val);
    regProofFeedback.style.display = 'block';

    if (inspection.status === 'verified') {
        regProofFeedback.className = 'proof-feedback-box valid';
        regProofFeedback.innerHTML = `${inspection.icon} <strong>${inspection.platform} Verified:</strong> Genuine video link recognized.`;
    } else if (inspection.status === 'fake') {
        regProofFeedback.className = 'proof-feedback-box invalid';
        regProofFeedback.innerHTML = `❌ <strong>Fake / Invalid Link:</strong> ${inspection.message}`;
    } else if (inspection.warning) {
        regProofFeedback.className = 'proof-feedback-box warning';
        regProofFeedback.innerHTML = `⚠️ <strong>Notice:</strong> ${inspection.message}`;
    } else {
        regProofFeedback.style.display = 'none';
    }
});

// ── REGISTRATION HANDLER (FIREBASE AUTH + FIRESTORE) ────────
registerForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAlert();

    const ign             = document.getElementById('regIgn')?.value.trim();
    const uid             = document.getElementById('regUid')?.value.trim();
    const email           = document.getElementById('regEmail')?.value.trim().toLowerCase();
    const region          = document.getElementById('regRegion')?.value;
    const character       = document.getElementById('regCharacter')?.value;
    const speed           = parseInt(document.getElementById('regSpeed')?.value) || 0;
    const proof           = document.getElementById('regProof')?.value.trim() || '#';
    const password        = document.getElementById('regPassword')?.value;
    const confirmPassword = document.getElementById('regConfirmPassword')?.value;
    const terms           = document.getElementById('termsAgree')?.checked;

    if (!ign || !uid || !email || !region || !character || !password) {
        showAlert('Please fill in all required fields.');
        return;
    }

    if (password.length < 6) {
        showAlert('Password must be at least 6 characters long.');
        return;
    }

    if (password !== confirmPassword) {
        showAlert('Passwords do not match. Please verify.');
        return;
    }

    // Inspect proof link if provided
    if (proof && proof !== '#') {
        const check = inspectProofLink(proof);
        if (check.isFake) {
            showAlert(`❌ Proof Link Error: ${check.message}`);
            return;
        }
    }

    if (!terms) {
        showAlert('Please accept the Spike Cross fair play terms.');
        return;
    }

    const regBtn = document.getElementById('registerBtn');
    if (regBtn) regBtn.disabled = true;
    showAlert('Creating official Spike Cross Firebase account...', false);

    let authUser = null;

    try {
        // 1. Create account in Firebase Authentication
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        authUser = cred.user;

        // Set display name to player IGN
        try {
            await updateProfile(authUser, { displayName: ign });
        } catch (profileErr) {
            console.warn('Profile name update note:', profileErr);
        }
    } catch (authErr) {
        console.warn('Firebase Auth registration note:', authErr);
        // If operation not allowed, give clear hint, else show error
        showAlert(formatAuthError(authErr));
        if (regBtn) regBtn.disabled = false;
        return;
    }

    const userData = {
        ign,
        uid,
        email,
        region,
        character,
        speed: speed || 0,
        proof,
        firebaseUid: authUser?.uid || '',
        registeredAt: new Date().toISOString()
    };

    // 2. Save Profile in Firestore
    try {
        // Store in users collection by Firebase Auth UID
        if (authUser?.uid) {
            await setDoc(doc(db, "users", authUser.uid), userData, { merge: true });
        }
        // Also map by IGN for quick lookups
        await setDoc(doc(db, "users_by_ign", ign.toLowerCase()), {
            email,
            ign,
            uid,
            firebaseUid: authUser?.uid || ''
        }, { merge: true });

        // If a speed record was given, publish to Firestore "players" leaderboard
        if (speed > 0) {
            await setDoc(doc(db, "players", ign.toUpperCase()), {
                tag: ign,
                speed,
                character,
                setup: 'Power 120 / Jump 120',
                state: region,
                city: region,
                proof,
                uid,
                updatedAt: new Date().toISOString()
            }, { merge: true });
        }
    } catch (dbErr) {
        console.warn('Firestore database save notice (fallback active):', dbErr);
    }

    // 3. Save to Local Session
    try {
        const sessionData = {
            ign,
            uid,
            email,
            character,
            region,
            speed: speed || 0,
            proof,
            firebaseUid: authUser?.uid || '',
            loggedInAt: Date.now()
        };
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(sessionData));

        // Sync local cache of users
        const localUsers = JSON.parse(localStorage.getItem(USERS_STORAGE_KEY) || '[]');
        localUsers.push(userData);
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(localUsers));

        if (speed > 0) {
            const localPlayers = JSON.parse(localStorage.getItem(PLAYERS_STORAGE) || '[]');
            const idx = localPlayers.findIndex(p => p.tag.toUpperCase() === ign.toUpperCase());
            const pData = { tag: ign, speed, character, setup: 'Power 120 / Jump 120', state: region, city: region, proof };
            if (idx >= 0) localPlayers[idx] = pData;
            else localPlayers.push(pData);
            localPlayers.sort((a, b) => b.speed - a.speed);
            localStorage.setItem(PLAYERS_STORAGE, JSON.stringify(localPlayers));
        }
    } catch (e) {}

    if (regBtn) regBtn.disabled = false;
    showAlert(`🎉 Spike Cross account "${ign}" registered with Firebase! Redirecting to leaderboard...`, false);

    setTimeout(() => {
        window.location.href = 'index.html';
    }, 1200);
});

// ── LOGIN HANDLER (FIREBASE AUTH EMAIL/PASSWORD) ─────────────
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
    showAlert('Authenticating with Firebase...', false);

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
    showAlert('Connecting to Google Account via Firebase...', false);

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
        showAlert(`Active Firebase Session: Logged in as <strong>${name}</strong>. <a href="index.html" style="color:var(--accent-red);font-weight:700;margin-left:8px;">Go to Leaderboard →</a>`, false);
    }
});
