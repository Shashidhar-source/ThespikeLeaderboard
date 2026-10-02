/* ============================================================
   THE SPIKE INDIA — login.js
   Firebase Authentication & User Profile Sync
   ============================================================ */

import { 
    auth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    updateProfile,
    sendPasswordResetEmail,
    GoogleAuthProvider,
    signInWithPopup,
    saveUserProfile,
    fetchUserProfile,
    inspectProofLink,
    FIREBASE_DAILY_LIMIT,
    DAILY_LOGIN_LIMIT,
    getFirebaseDailyUsage,
    checkAndIncrementFirebaseOp,
    getLoginDailyUsage,
    checkAndIncrementLoginAttempt
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

const REMEMBERED_DETAILS_KEY = 'spike-remembered-player-details';
const urlParams = new URLSearchParams(window.location.search);
const redirectTarget = 'index.html?action=profile';

// ── DAILY LIMIT DISPLAY & PROTECTION ────────────────────────
function updateLoginLimitDisplay() {
    const loginUsage = getLoginDailyUsage();
    const fbUsage = getFirebaseDailyUsage();

    const loginText = document.getElementById('dailyLoginLimitText');
    const loginBadge = document.getElementById('dailyLoginLimitBadge');
    if (loginText) {
        loginText.innerHTML = `Daily Logins: <strong>${loginUsage.count} / ${DAILY_LOGIN_LIMIT}</strong> used today`;
    }
    if (loginBadge) {
        if (loginUsage.isExceeded) loginBadge.classList.add('exceeded');
        else loginBadge.classList.remove('exceeded');
    }

    const fbText = document.getElementById('dailyFirebaseLimitText');
    const fbBadge = document.getElementById('dailyFirebaseLimitBadge');
    if (fbText) {
        fbText.innerHTML = `Firebase Cloud: <strong>${fbUsage.count} / ${FIREBASE_DAILY_LIMIT}</strong> ops (Free Tier Protected)`;
    }
    if (fbBadge) {
        if (fbUsage.isExceeded) fbBadge.classList.add('exceeded');
        else fbBadge.classList.remove('exceeded');
    }
}

// Prefill saved IGN or Email if remembered
window.addEventListener('DOMContentLoaded', () => {
    updateLoginLimitDisplay();
    try {
        const raw = localStorage.getItem(REMEMBERED_DETAILS_KEY) || localStorage.getItem(CURRENT_USER_KEY);
        if (raw) {
            const data = JSON.parse(raw);
            const loginInp = document.getElementById('loginIdentifier');
            if (loginInp && !loginInp.value) {
                loginInp.value = data.ign || data.email || '';
            }
            const regIgn = document.getElementById('regIgn');
            const regUid = document.getElementById('regUid');
            const regEmail = document.getElementById('regEmail');
            if (regIgn && !regIgn.value && data.ign) regIgn.value = data.ign;
            if (regUid && !regUid.value && data.uid) regUid.value = data.uid;
            if (regEmail && !regEmail.value && data.email) regEmail.value = data.email;
        }
    } catch (e) {}
});

// ── AUTH MODE TABS (SIGN IN / REGISTER) ─────────────────────
const tabSignIn     = document.getElementById('tabSignIn');
const tabSignUp     = document.getElementById('tabSignUp');
const loginForm     = document.getElementById('loginForm');
const registerForm  = document.getElementById('registerForm');
const authTitle     = document.getElementById('authTitle');
const authSubtitle  = document.getElementById('authSubtitle');
const authFooterTip = document.getElementById('authFooterTip');

tabSignIn?.addEventListener('click', () => {
    tabSignIn.classList.add('active');
    tabSignUp?.classList.remove('active');
    if (loginForm) loginForm.style.display = 'block';
    if (registerForm) registerForm.style.display = 'none';
    if (authTitle) authTitle.textContent = 'PLAYER SIGN IN';
    if (authSubtitle) authSubtitle.textContent = 'Sign in to your Spike Cross account to access your player profile, submit speed records, and view leaderboard ranks.';
    if (authFooterTip) authFooterTip.innerHTML = '💡 Enter your login details or sign in with Google. Your IGN, UID, and character stats will be automatically remembered!';
    clearAlert();
});

tabSignUp?.addEventListener('click', () => {
    tabSignUp.classList.add('active');
    tabSignIn?.classList.remove('active');
    if (loginForm) loginForm.style.display = 'none';
    if (registerForm) registerForm.style.display = 'block';
    if (authTitle) authTitle.textContent = 'PLAYER REGISTRATION';
    if (authSubtitle) authSubtitle.textContent = 'Create your Spike Cross account to save your player profile, UID, and spike speed records permanently.';
    if (authFooterTip) authFooterTip.innerHTML = '💡 After registration, your profile is immediately initialized and your stats will be remembered on this device.';
    clearAlert();
});

// ── REGISTRATION HANDLER ────────────────────────────────────
registerForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAlert();

    const loginUsage = getLoginDailyUsage();
    if (loginUsage.isExceeded) {
        showAlert(`⚠️ Daily limit reached (${DAILY_LOGIN_LIMIT}/${DAILY_LOGIN_LIMIT} operations used today). To protect against excess Firebase requests, registrations are paused until tomorrow.`, true);
        return;
    }

    const ign      = document.getElementById('regIgn')?.value.trim();
    const uid      = document.getElementById('regUid')?.value.trim();
    const email    = document.getElementById('regEmail')?.value.trim();
    const password = document.getElementById('regPassword')?.value;
    const regBtn   = document.getElementById('regBtn');

    if (!ign || !uid || !email || !password) {
        showAlert('Please fill in all registration fields.');
        return;
    }

    if (password.length < 6) {
        showAlert('Password must be at least 6 characters.');
        return;
    }

    checkAndIncrementLoginAttempt('registration');
    updateLoginLimitDisplay();

    if (regBtn) regBtn.disabled = true;
    showAlert('Creating your Spike Cross account...', false);

    try {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        const authUser = cred.user;

        try {
            await updateProfile(authUser, { displayName: ign });
        } catch (e) {}

        const profile = {
            ign,
            email,
            uid,
            character: 'BLACK THUNDER NISHIKAWA',
            region: 'India',
            state: 'India',
            speed: 0,
            proof: '#',
            firebaseUid: authUser.uid,
            createdAt: new Date().toISOString()
        };

        // Save profile to RTDB (cross-device sync)
        try {
            await saveUserProfile(authUser.uid, profile);
        } catch (dbErr) {
            console.warn('RTDB registration profile save note:', dbErr);
        }

        const sessionUser = {
            ...profile,
            loggedInAt: Date.now()
        };
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(sessionUser));
        localStorage.setItem(REMEMBERED_DETAILS_KEY, JSON.stringify(sessionUser));

        showAlert(`🎉 Account created! Welcome, ${ign}! Opening your player profile...`, false);
        setTimeout(() => { window.location.href = redirectTarget; }, 900);
    } catch (err) {
        if (regBtn) regBtn.disabled = false;
        showAlert(formatAuthError(err));
    }
});

// ── LOGIN HANDLER (FIREBASE AUTH EMAIL/PASSWORD) ─────────────
loginForm?.addEventListener('submit', async (e) => {

    e.preventDefault();
    clearAlert();

    const loginUsage = getLoginDailyUsage();
    if (loginUsage.isExceeded) {
        showAlert(`⚠️ Daily Login Limit Reached (${DAILY_LOGIN_LIMIT}/${DAILY_LOGIN_LIMIT} used today). To protect your account security and Firebase quotas, logins are paused until tomorrow.`, true);
        return;
    }

    const identifier = document.getElementById('loginIdentifier')?.value.trim();
    const password   = document.getElementById('loginPassword')?.value;
    const loginBtn   = document.getElementById('loginBtn');

    if (!identifier || !password) {
        showAlert('Please enter your IGN or Email, and password.');
        return;
    }

    checkAndIncrementLoginAttempt('email-login');
    updateLoginLimitDisplay();

    if (loginBtn) loginBtn.disabled = true;
    showAlert('Authenticating...', false);

    let emailToAuth = identifier;

    // Note: login requires email address (not IGN) since Firestore is not used.
    // Users who registered with email/password should enter their email here.

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

        // Fetch detailed profile from RTDB (cross-device sync)
        try {
            const cloudProfile = await fetchUserProfile(authUser.uid);
            if (cloudProfile) {
                profile = { ...profile, ...cloudProfile };
            }
        } catch (e) {}

        const sessionUser = {
            ...profile,
            loggedInAt: Date.now()
        };
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(sessionUser));
        localStorage.setItem(REMEMBERED_DETAILS_KEY, JSON.stringify(sessionUser));

        showAlert(`🔥 Welcome back, ${profile.ign}! Opening your player profile...`, false);
        setTimeout(() => { window.location.href = redirectTarget; }, 900);
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
            state: 'Karnataka',
            character: 'BLACK THUNDER NISHIKAWA',
            speed: 198,
            proof: 'https://youtube.com/shorts/demo',
            isDemo: true,
            loggedInAt: Date.now()
        };
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(demoUser));
        localStorage.setItem(REMEMBERED_DETAILS_KEY, JSON.stringify(demoUser));
        showAlert(`⚡ Demo login successful! Opening ${demoUser.ign}'s profile...`, false);
        setTimeout(() => { window.location.href = redirectTarget; }, 900);
        return;
    }

    showAlert(formatAuthError(authError));
});

// ── INSTANT DEMO LOGIN BUTTON ───────────────────────────────
document.getElementById('demoQuickLoginBtn')?.addEventListener('click', () => {
    const loginUsage = getLoginDailyUsage();
    if (loginUsage.isExceeded) {
        showAlert(`⚠️ Daily Login Limit Reached (${DAILY_LOGIN_LIMIT}/${DAILY_LOGIN_LIMIT} used today). Logins are paused until tomorrow.`, true);
        return;
    }
    checkAndIncrementLoginAttempt('demo-login');
    updateLoginLimitDisplay();

    let remembered = {};
    try {
        const raw = localStorage.getItem(REMEMBERED_DETAILS_KEY);
        if (raw) remembered = JSON.parse(raw);
    } catch (e) {}

    const demoUser = {
        ign: remembered.ign || 'SPIKE_MASTER10',
        uid: remembered.uid || 'SC-100001',
        email: 'spikemaster@thespike.in',
        region: remembered.state || 'Karnataka',
        state: remembered.state || 'Karnataka',
        character: remembered.character || 'BLACK THUNDER NISHIKAWA',
        speed: parseInt(remembered.speed) || 198,
        proof: remembered.proof || 'https://youtube.com/shorts/demo',
        isDemo: true,
        loggedInAt: Date.now()
    };
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(demoUser));
    localStorage.setItem(REMEMBERED_DETAILS_KEY, JSON.stringify(demoUser));
    showAlert(`⚡ Demo login successful! Opening ${demoUser.ign}'s profile...`, false);
    setTimeout(() => { window.location.href = redirectTarget; }, 900);
});

// ── GOOGLE AUTHENTICATION HANDLER ────────────────────────────
async function handleGoogleAuth() {
    clearAlert();

    const loginUsage = getLoginDailyUsage();
    if (loginUsage.isExceeded) {
        showAlert(`⚠️ Daily Login Limit Reached (${DAILY_LOGIN_LIMIT}/${DAILY_LOGIN_LIMIT} used today). To protect your account security and Firebase quotas, logins are paused until tomorrow.`, true);
        return;
    }
    checkAndIncrementLoginAttempt('google-login');
    updateLoginLimitDisplay();

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

        // Always try fetching existing profile from RTDB (cross-device sync)
        try {
            const cloudProfile = await fetchUserProfile(user.uid);
            if (cloudProfile) {
                // Existing profile — restore all their saved details
                profile = { ...profile, ...cloudProfile };
            } else {
                // First login — save initial profile to RTDB
                await saveUserProfile(user.uid, profile);
            }
        } catch (dbErr) {
            console.warn('Google auth RTDB note:', dbErr);
        }

        const sessionUser = {
            ...profile,
            loggedInAt: Date.now()
        };
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(sessionUser));
        localStorage.setItem(REMEMBERED_DETAILS_KEY, JSON.stringify(sessionUser));

        showAlert(`🎉 Google Login Successful! Opening ${profile.ign}'s profile...`, false);
        setTimeout(() => { window.location.href = redirectTarget; }, 900);
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
        showAlert(`Active Session: Logged in as <strong>${name}</strong>. <a href="index.html?action=profile" style="color:var(--accent-red);font-weight:700;margin-left:8px;">View Profile &amp; Submit Details →</a>`, false);
    }
});

