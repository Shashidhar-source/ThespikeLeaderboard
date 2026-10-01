/* ============================================================
   THE SPIKE INDIA — login.js
   ============================================================ */

const USERS_STORAGE_KEY = 'spike-cross-users';
const CURRENT_USER_KEY  = 'spike-current-user';

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
const tabLogin    = document.getElementById('tabLogin');
const tabRegister = document.getElementById('tabRegister');
const loginForm   = document.getElementById('loginForm');
const registerForm= document.getElementById('registerForm');
const authAlert   = document.getElementById('authAlert');

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
    authAlert.textContent = msg;
    authAlert.className = `auth-alert ${isError ? 'error' : 'success'}`;
    authAlert.style.display = 'block';
}

function clearAlert() {
    if (authAlert) {
        authAlert.style.display = 'none';
        authAlert.textContent = '';
    }
}

// ── USER REPOSITORY ─────────────────────────────────────────
function getStoredUsers() {
    try {
        const raw = localStorage.getItem(USERS_STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch (e) {
        return [];
    }
}

function saveStoredUsers(users) {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
}

// ── REGISTRATION HANDLER ────────────────────────────────────
registerForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    clearAlert();

    const ign             = document.getElementById('regIgn')?.value.trim();
    const uid             = document.getElementById('regUid')?.value.trim();
    const email           = document.getElementById('regEmail')?.value.trim().toLowerCase();
    const region          = document.getElementById('regRegion')?.value;
    const character       = document.getElementById('regCharacter')?.value;
    const speed           = parseInt(document.getElementById('regSpeed')?.value) || 0;
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

    if (!terms) {
        showAlert('Please accept the Spike Cross fair play terms.');
        return;
    }

    const users = getStoredUsers();

    // Check duplicate IGN or email
    const exists = users.find(u => u.ign.toLowerCase() === ign.toLowerCase() || u.email.toLowerCase() === email);
    if (exists) {
        showAlert('An account with this IGN or Email already exists.');
        return;
    }

    const newUser = {
        ign,
        uid,
        email,
        region,
        character,
        speed: speed || 0,
        password, // stored locally
        registeredAt: new Date().toISOString()
    };

    users.push(newUser);
    saveStoredUsers(users);

    showAlert(`Success! Spike Cross account for "${ign}" created. Switching to login...`, false);
    
    // Auto switch to login tab with prefilled IGN
    setTimeout(() => {
        tabLogin.click();
        const idField = document.getElementById('loginIdentifier');
        if (idField) idField.value = ign;
        const pwdField = document.getElementById('loginPassword');
        if (pwdField) pwdField.focus();
    }, 1500);
});

// ── LOGIN HANDLER ───────────────────────────────────────────
loginForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    clearAlert();

    const identifier = document.getElementById('loginIdentifier')?.value.trim().toLowerCase();
    const password   = document.getElementById('loginPassword')?.value;
    const rememberMe = document.getElementById('rememberMe')?.checked;

    if (!identifier || !password) {
        showAlert('Please enter your IGN/Email and password.');
        return;
    }

    const users = getStoredUsers();

    // Built-in test demo account support for convenience
    let matchedUser = users.find(u => 
        (u.ign.toLowerCase() === identifier || u.email.toLowerCase() === identifier) && 
        u.password === password
    );

    // If no custom user found, check if it's demo or admin test
    if (!matchedUser && (identifier === 'spikemaster' || identifier === 'demo') && password === 'spike123') {
        matchedUser = {
            ign: 'SPIKE_MASTER10',
            uid: 'SC-100001',
            email: 'spikemaster@spikecross.in',
            region: 'Karnataka',
            character: 'Nishikawa',
            speed: 198
        };
    }

    if (!matchedUser) {
        showAlert('Invalid credentials. Check your IGN/Email and password or register a new account.');
        return;
    }

    // Set current active user session
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify({
        ign: matchedUser.ign,
        uid: matchedUser.uid,
        character: matchedUser.character,
        region: matchedUser.region,
        speed: matchedUser.speed,
        loggedInAt: Date.now()
    }));

    showAlert(`Welcome back, ${matchedUser.ign}! Redirecting to leaderboard...`, false);

    setTimeout(() => {
        window.location.href = 'index.html';
    }, 1200);
});

// Check if already logged in
window.addEventListener('DOMContentLoaded', () => {
    try {
        const active = localStorage.getItem(CURRENT_USER_KEY);
        if (active) {
            const user = JSON.parse(active);
            showAlert(`Currently logged in as ${user.ign}. (Log in again with another account or go back to Leaderboard)`, false);
        }
    } catch (e) {}
});
