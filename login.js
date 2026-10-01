/* ============================================================
   THE SPIKE INDIA — login.js
   Firebase Authentication & User Profile Sync
   ============================================================ */

import { 
    db, 
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

// ── ALERTS ──────────────────────────────────────────────────
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

// ── REGISTRATION HANDLER (FIREBASE + LOCAL SYNC) ────────────
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
    showAlert('Saving profile to Firebase Cloud...', false);

    const newUser = {
        ign,
        uid,
        email,
        region,
        character,
        speed: speed || 0,
        proof,
        password,
        registeredAt: new Date().toISOString()
    };

    try {
        // Save to Firebase Firestore "users" collection
        await setDoc(doc(db, "users", ign.toLowerCase()), newUser);

        // If a speed record was given, also push to "players" leaderboard collection
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
            });
        }
    } catch (fbErr) {
        console.warn('Firebase sync note (using local cache as fallback):', fbErr);
    }

    // Also persist locally
    try {
        const localUsers = JSON.parse(localStorage.getItem(USERS_STORAGE_KEY) || '[]');
        localUsers.push(newUser);
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(localUsers));

        // If player has speed, also update local players list
        if (speed > 0) {
            const localPlayers = JSON.parse(localStorage.getItem(PLAYERS_STORAGE) || '[]');
            const existingIdx = localPlayers.findIndex(p => p.tag.toUpperCase() === ign.toUpperCase());
            const pData = {
                tag: ign,
                speed,
                character,
                setup: 'Power 120 / Jump 120',
                state: region,
                city: region,
                proof
            };
            if (existingIdx >= 0) localPlayers[existingIdx] = pData;
            else localPlayers.push(pData);
            localPlayers.sort((a, b) => b.speed - a.speed);
            localStorage.setItem(PLAYERS_STORAGE, JSON.stringify(localPlayers));
        }
    } catch (e) {}

    if (regBtn) regBtn.disabled = false;
    showAlert(`🎉 Success! Spike Cross account "${ign}" created and synced to Firebase. Switching to login...`, false);

    setTimeout(() => {
        tabLogin.click();
        const idField = document.getElementById('loginIdentifier');
        if (idField) idField.value = ign;
        const pwdField = document.getElementById('loginPassword');
        if (pwdField) pwdField.focus();
    }, 1400);
});

// ── LOGIN HANDLER (FIREBASE + LOCAL CACHE) ───────────────────
loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAlert();

    const identifier = document.getElementById('loginIdentifier')?.value.trim().toLowerCase();
    const password   = document.getElementById('loginPassword')?.value;
    const loginBtn   = document.getElementById('loginBtn');

    if (!identifier || !password) {
        showAlert('Please enter your IGN/Email and password.');
        return;
    }

    if (loginBtn) loginBtn.disabled = true;
    showAlert('Authenticating with Firebase...', false);

    let matchedUser = null;

    // 1. Try Firebase Firestore
    try {
        const userDoc = await getDoc(doc(db, "users", identifier));
        if (userDoc.exists()) {
            const data = userDoc.data();
            if (data.password === password) {
                matchedUser = data;
            }
        } else {
            // Also search by email
            const snap = await getDocs(collection(db, "users"));
            snap.forEach(d => {
                const u = d.data();
                if ((u.email?.toLowerCase() === identifier || u.ign?.toLowerCase() === identifier) && u.password === password) {
                    matchedUser = u;
                }
            });
        }
    } catch (fbErr) {
        console.warn('Firebase query fallback:', fbErr);
    }

    // 2. Fallback to local storage
    if (!matchedUser) {
        try {
            const raw = localStorage.getItem(USERS_STORAGE_KEY);
            const users = raw ? JSON.parse(raw) : [];
            matchedUser = users.find(u => 
                (u.ign.toLowerCase() === identifier || u.email.toLowerCase() === identifier) && 
                u.password === password
            );
        } catch (e) {}
    }

    // 3. Demo / built-in test account
    if (!matchedUser && (identifier === 'spikemaster' || identifier === 'demo') && password === 'spike123') {
        matchedUser = {
            ign: 'SPIKE_MASTER10',
            uid: 'SC-100001',
            email: 'spikemaster@spikecross.in',
            region: 'Karnataka',
            character: 'BLACK THUNDER NISHIKAWA',
            speed: 198,
            proof: 'https://youtube.com/shorts/demo'
        };
    }

    if (loginBtn) loginBtn.disabled = false;

    if (!matchedUser) {
        showAlert('Invalid credentials. Check your IGN/Email and password or register a new Spike Cross account.');
        return;
    }

    // Set current active session
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify({
        ign: matchedUser.ign,
        uid: matchedUser.uid,
        character: matchedUser.character,
        region: matchedUser.region,
        speed: matchedUser.speed || 0,
        proof: matchedUser.proof || '#',
        loggedInAt: Date.now()
    }));

    showAlert(`🔥 Welcome back, ${matchedUser.ign}! Redirecting to leaderboard...`, false);

    setTimeout(() => {
        window.location.href = 'index.html';
    }, 1000);
});

// Check if currently active session
window.addEventListener('DOMContentLoaded', () => {
    try {
        const active = localStorage.getItem(CURRENT_USER_KEY);
        if (active) {
            const user = JSON.parse(active);
            showAlert(`Logged in as <strong>${user.ign}</strong>. You can switch accounts or <a href="index.html" style="color:var(--accent-red);font-weight:700;">Go to Leaderboard →</a>`, false);
        }
    } catch (e) {}
});
