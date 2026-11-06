/* ============================================================
   THE SPIKE INDIA — admin.js
   Firebase Firestore Admin Controller & Proof Link Inspector
   ============================================================ */

import {
    inspectProofLink,
    savePlayerToCloud,
    fetchPlayersFromCloud,
    deletePlayerFromCloud,
    FIREBASE_DAILY_LIMIT,
    getFirebaseDailyUsage
} from "./firebase-config.js";

const STORAGE_KEY = 'spike-india-players';
const ADMIN_SESSION_KEY = 'spike-admin-authenticated';
const DEFAULT_PASSCODE = 'thespikeIN';

// Rate Limiting Security for Admin Login
const MAX_ADMIN_ATTEMPTS = 5;
const ADMIN_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes in milliseconds
const ADMIN_ATTEMPTS_KEY = 'spike-admin-attempts';
const ADMIN_LOCKOUT_KEY = 'spike-admin-lockout-until';

function getAdminLockoutRemaining() {
    const lockoutUntil = parseInt(localStorage.getItem(ADMIN_LOCKOUT_KEY) || '0', 10);
    const now = Date.now();
    if (lockoutUntil > now) {
        return Math.ceil((lockoutUntil - now) / 1000);
    }
    if (lockoutUntil > 0) {
        // Expired lockout
        localStorage.removeItem(ADMIN_LOCKOUT_KEY);
        localStorage.removeItem(ADMIN_ATTEMPTS_KEY);
    }
    return 0;
}

function getAdminFailedAttempts() {
    return parseInt(localStorage.getItem(ADMIN_ATTEMPTS_KEY) || '0', 10);
}

function recordAdminFailedAttempt() {
    let attempts = getAdminFailedAttempts() + 1;
    localStorage.setItem(ADMIN_ATTEMPTS_KEY, attempts.toString());
    if (attempts >= MAX_ADMIN_ATTEMPTS) {
        const lockoutUntil = Date.now() + ADMIN_COOLDOWN_MS;
        localStorage.setItem(ADMIN_LOCKOUT_KEY, lockoutUntil.toString());
        return { locked: true, remainingSecs: 300 };
    }
    return { locked: false, attemptsLeft: MAX_ADMIN_ATTEMPTS - attempts };
}

function clearAdminFailedAttempts() {
    localStorage.removeItem(ADMIN_ATTEMPTS_KEY);
    localStorage.removeItem(ADMIN_LOCKOUT_KEY);
}

// ── AVAILABLE CHARACTER IMAGES IN images/ ───────────────────
const CHARACTER_FILES = [
    "BLACK THUNDER NISHIKAWA",
    "DAVE",
    "HEESEONG",
    "ISABEL",
    "JAEHYUN",
    "JENNY",
    "LUCAS",
    "NISHIKAWA HS OR NISHIKAWA HIGH SCHOOL",
    "NISHIKAWA",
    "RAUL",
    "RYUHYEON",
    "SARA",
    "YOUNGSUP"
];

// ── MOCK PLAYER PURGE FILTER ─────────────────────────────────
const MOCK_TAGS = new Set();

const DEFAULT_PLAYERS = [];

let players = [];
let searchQuery = '';

// ── THEME SUPPORT ───────────────────────────────────────────
const html = document.documentElement;
const themeToggle = document.getElementById('themeToggle');
const toggleIcon = document.getElementById('toggleIcon');
let currentTheme = localStorage.getItem('spike-theme') || 'dark';
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
const ctx = canvas?.getContext('2d');

function resizeCanvas() {
    if (!canvas) return;
    canvas.width = window.innerWidth;
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
let pts = Array.from({ length: 50 }, mkParticle);

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

// ── PASSCODE AUTH & SECURITY ─────────────────────────────────
const authOverlay = document.getElementById('adminAuthOverlay');
const passForm = document.getElementById('adminPassForm');
const passInput = document.getElementById('adminPassInput');
const passError = document.getElementById('adminPassError');
const adminDashboard = document.getElementById('adminDashboard');
const logoutBtn = document.getElementById('logoutAdminBtn');
const submitPassBtn = passForm?.querySelector('button[type="submit"]');

let lockoutTimerInterval = null;

function updateLockoutUI() {
    const remainingSecs = getAdminLockoutRemaining();
    if (remainingSecs > 0) {
        const mins = Math.floor(remainingSecs / 60);
        const secs = remainingSecs % 60;
        const timeStr = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
        if (passError) {
            passError.textContent = `⛔ Too many failed attempts. Security cooldown active. Try again in ${timeStr} min.`;
            passError.style.display = 'block';
        }
        if (passInput) passInput.disabled = true;
        if (submitPassBtn) submitPassBtn.disabled = true;

        if (!lockoutTimerInterval) {
            lockoutTimerInterval = setInterval(() => {
                const rem = getAdminLockoutRemaining();
                if (rem <= 0) {
                    clearInterval(lockoutTimerInterval);
                    lockoutTimerInterval = null;
                    updateLockoutUI();
                } else {
                    const m = Math.floor(rem / 60);
                    const s = rem % 60;
                    if (passError) {
                        passError.textContent = `⛔ Too many failed attempts. Security cooldown active. Try again in ${m}:${s < 10 ? '0' : ''}${s} min.`;
                    }
                }
            }, 1000);
        }
    } else {
        if (lockoutTimerInterval) {
            clearInterval(lockoutTimerInterval);
            lockoutTimerInterval = null;
        }
        if (passInput) passInput.disabled = false;
        if (submitPassBtn) submitPassBtn.disabled = false;
        const attempts = getAdminFailedAttempts();
        if (attempts > 0 && attempts < MAX_ADMIN_ATTEMPTS) {
            if (passError) {
                passError.textContent = `⚠️ Incorrect passcode. ${MAX_ADMIN_ATTEMPTS - attempts} attempt(s) remaining before 5 min cooldown.`;
                passError.style.display = 'block';
            }
        } else if (passError && !passError.textContent.includes('Incorrect')) {
            passError.style.display = 'none';
        }
    }
}

function checkAuth() {
    if (sessionStorage.getItem(ADMIN_SESSION_KEY) === 'true') {
        authOverlay.style.display = 'none';
        adminDashboard.style.display = 'block';
        initAdminData();
    } else {
        authOverlay.style.display = 'flex';
        adminDashboard.style.display = 'none';
        updateLockoutUI();
        if (passInput && !passInput.disabled) passInput.focus();
    }
}

passForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const remaining = getAdminLockoutRemaining();
    if (remaining > 0) {
        updateLockoutUI();
        return;
    }

    const val = passInput.value.trim();
    if (val === DEFAULT_PASSCODE) {
        clearAdminFailedAttempts();
        sessionStorage.setItem(ADMIN_SESSION_KEY, 'true');
        passError.style.display = 'none';
        checkAuth();
        showToast('Admin dashboard unlocked successfully!', 'success');
    } else {
        const result = recordAdminFailedAttempt();
        updateLockoutUI();
        if (!result.locked) {
            passError.textContent = `Incorrect passcode. ${result.attemptsLeft} attempt(s) left before 5 minute cooldown.`;
            passError.style.display = 'block';
            passInput.select();
        }
    }
});

logoutBtn?.addEventListener('click', () => {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    checkAuth();
    showToast('Admin session locked.');
});

// ── DATA MANAGEMENT (FIREBASE + LOCAL SYNC) ─────────────────
async function initAdminData() {
    // 1. Immediately load local records so admin panel is instantly populated
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length) {
                players = parsed
                    .filter(p => p && p.tag)
                    .map(p => ({ ...p, speed: parseInt(p.speed, 10) || 0 }))
                    .filter(p => p.speed > 0)
                    .sort((a, b) => b.speed - a.speed);
                renderAll();
            }
        }
    } catch (e) { }

    // 2. Attempt remote sync from Firebase Cloud
    try {
        const cloudList = await fetchPlayersFromCloud();
        const remoteMap = new Map();
        const getAdminKey = (item) => {
            const t = (item.tag || '').trim().toUpperCase();
            const c = (item.character || 'BLACK THUNDER NISHIKAWA').trim().toUpperCase();
            return `${t}__${c}`;
        };

        cloudList.forEach(data => {
            if (data && data.tag) {
                const sp = parseInt(data.speed, 10) || 0;
                if (sp > 0) remoteMap.set(getAdminKey(data), { ...data, speed: sp });
            }
        });

        // Merge remote with current local players (preserving whichever has greater or equal speed)
        players.forEach(p => {
            const key = getAdminKey(p);
            if (!remoteMap.has(key)) {
                remoteMap.set(key, p);
            } else {
                const remoteP = remoteMap.get(key);
                if ((p.speed || 0) > (remoteP.speed || 0)) {
                    remoteMap.set(key, p);
                }
            }
        });

        players = Array.from(remoteMap.values()).sort((a, b) => (b.speed || 0) - (a.speed || 0));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(players));
        renderAll();
        showToast(players.length ? 'Leaderboard records synchronized!' : 'Leaderboard ready for submissions.', 'success');
        return;
    } catch (e) {
        console.warn('Firebase admin load note (using local cache):', e);
        if (players.length) {
            showToast(`Loaded ${players.length} records from local cache.`, '');
        }
    }
}

async function savePlayerDataToFirebase(player) {
    try {
        await savePlayerToCloud(player);
    } catch (e) {
        console.warn('Firebase save player note:', e);
    }
}

async function deletePlayerFromFirebase(tag, character) {
    try {
        await deletePlayerFromCloud(tag, character);
    } catch (e) {
        console.warn('Firebase delete player note:', e);
    }
}

function saveData(dataToSave) {
    dataToSave.sort((a, b) => (parseInt(b.speed) || 0) - (parseInt(a.speed) || 0));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
    players = dataToSave;
    renderAll();

    // Sync all to Firebase Cloud in the background
    for (const p of dataToSave) {
        savePlayerDataToFirebase(p);
    }
    showToast('Changes saved to Firebase Cloud & synced across all devices!', 'success');
}

// ── STATS COMPUTATION ───────────────────────────────────────
function updateStats() {
    const total = players.length;
    const p1 = players[0];
    const p2 = players[1];

    const statCount = document.getElementById('statPlayerCount');
    const statTopSpeed = document.getElementById('statTopSpeed');
    const statTopPlayer = document.getElementById('statTopPlayer');
    const statRunnerSpeed = document.getElementById('statRunnerSpeed');
    const statRunnerPlayer = document.getElementById('statRunnerPlayer');

    if (statCount) statCount.textContent = total;
    if (statTopSpeed) statTopSpeed.textContent = p1 ? `${p1.speed} KM/H` : '---';
    if (statTopPlayer) statTopPlayer.textContent = p1 ? `👑 #1 ${p1.tag}` : 'No Record';
    if (statRunnerSpeed) statRunnerSpeed.textContent = p2 ? `${p2.speed} KM/H` : '---';
    if (statRunnerPlayer) statRunnerPlayer.textContent = p2 ? `⚡ #2 ${p2.tag}` : 'No Runner Up';

    const statFirebaseOps = document.getElementById('statFirebaseOps');
    const quotaCard = document.getElementById('adminFirebaseQuotaCard');
    const fbUsage = getFirebaseDailyUsage();
    if (statFirebaseOps) {
        statFirebaseOps.textContent = `${fbUsage.count} / ${FIREBASE_DAILY_LIMIT}`;
    }
    if (quotaCard) {
        if (fbUsage.isExceeded) {
            quotaCard.classList.add('exceeded');
        } else {
            quotaCard.classList.remove('exceeded');
        }
    }
}

// ── IMAGE HELPER ────────────────────────────────────────────
function resolveCharacterInfo(charName, playerName) {
    const normChar = (charName || '').trim().toUpperCase();
    const normPlayer = (playerName || '').trim();

    let matchedName = CHARACTER_FILES.find(f => f.toUpperCase() === normChar);

    if (!matchedName && normChar) {
        if (normChar.includes('HEES')) matchedName = 'HEESEONG';
        else if (normChar.includes('ISAB')) matchedName = 'ISABEL';
        else if (normChar.includes('BLACK') || normChar.includes('THUNDER')) matchedName = 'BLACK THUNDER NISHIKAWA';
        else if (normChar.includes('HS') || normChar.includes('HIGH')) matchedName = 'NISHIKAWA HS OR NISHIKAWA HIGH SCHOOL';
        else if (normChar.includes('NISHIK')) matchedName = 'NISHIKAWA';
        else if (normChar.includes('YONG') || normChar.includes('YOUNG')) matchedName = 'YOUNGSUP';
        else {
            matchedName = CHARACTER_FILES.find(f => f.toUpperCase().includes(normChar) || normChar.includes(f.toUpperCase()));
        }
    }

    const primaryChar = matchedName || (charName ? charName.trim() : '');
    const pngSrc = primaryChar ? `images/${encodeURIComponent(primaryChar)}.png` : '';
    const jpgSrc = primaryChar ? `images/${encodeURIComponent(primaryChar)}.jpg` : '';
    const playerPng = normPlayer ? `images/${encodeURIComponent(normPlayer)}.png` : '';
    const playerJpg = normPlayer ? `images/${encodeURIComponent(normPlayer)}.jpg` : '';

    return {
        matched: !!matchedName,
        characterName: primaryChar,
        pngSrc,
        jpgSrc,
        playerPng,
        playerJpg
    };
}

function getPlayerAvatarCellHtml(player) {
    const tag = player.tag || 'Player';
    const initial = tag.trim().charAt(0).toUpperCase();
    const info = resolveCharacterInfo(player.character, player.tag);

    return `
        <div class="admin-avatar-cell" title="${player.character || tag}">
            <img src="${info.pngSrc || info.playerPng || info.jpgSrc}" alt="${player.character || tag}"
                 style="width:100%;height:100%;object-fit:contain;"
                 data-jpg="${info.jpgSrc || info.playerJpg}"
                 data-player="${info.playerPng}"
                 onerror="if(!this.dataset.triedJpg && this.dataset.jpg){this.dataset.triedJpg='1';this.src=this.dataset.jpg;}else if(!this.dataset.triedPlayer && this.dataset.player){this.dataset.triedPlayer='1';this.src=this.dataset.player;}else{this.style.display='none';this.nextElementSibling.style.display='block';}">
            <span class="admin-avatar-fallback" style="display:none;">${initial}</span>
        </div>
    `;
}

function renderProofLinkStatus(url) {
    const check = inspectProofLink(url);
    if (!check.isValid || check.status === 'missing') {
        return `<span style="color:var(--text-muted);font-size:11px;">None</span>`;
    }
    if (check.isFake) {
        return `<a href="${url}" target="_blank" style="color:#ff5555;font-weight:700;" title="${check.message}">❌ Fake/Bad Link</a>`;
    }
    if (check.status === 'verified') {
        return `<a href="${url}" target="_blank" style="color:#00e676;font-weight:700;" title="${check.platform} Verified">✓ ${check.platform}</a>`;
    }
    return `<a href="${url}" target="_blank" style="color:var(--accent-red);font-weight:700;">▶ Link</a>`;
}

// ── RENDER ADMIN TABLE ──────────────────────────────────────
function renderTable() {
    const tbody = document.getElementById('adminTableBody');
    if (!tbody) return;

    const filtered = players.filter(p => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (p.tag && p.tag.toLowerCase().includes(q)) ||
            (p.character && p.character.toLowerCase().includes(q)) ||
            (p.state && p.state.toLowerCase().includes(q)) ||
            (p.city && p.city.toLowerCase().includes(q));
    });

    if (!filtered.length) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:30px;color:var(--text-muted);">No matching players found. Click "+ Add New Player" to add one.</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map((p, filteredIdx) => {
        const realIdx = players.indexOf(p);
        const rank = realIdx + 1;
        const rankClass = rank === 1 ? 'rank-1' : (rank === 2 ? 'rank-2' : (rank === 3 ? 'rank-3' : ''));

        return `
            <tr>
                <td>
                    <div class="admin-rank-badge ${rankClass}">#${rank}</div>
                </td>
                <td>
                    ${getPlayerAvatarCellHtml(p)}
                </td>
                <td>
                    <strong style="color:var(--text-primary);letter-spacing:1px;">${p.tag}</strong>
                </td>
                <td>
                    <span class="admin-speed-tag">${p.speed} KM/H</span>
                </td>
                <td>
                    <span style="font-weight:700;">${p.character}</span>
                </td>
                <td>
                    <span style="color:var(--text-secondary);font-size:12px;">${p.setup || 'Default'}</span>
                </td>
                <td>
                    <span>🇮🇳 ${p.state}</span>${p.city ? `, <small style="color:var(--text-muted);">${p.city}</small>` : ''}
                </td>
                <td>
                    ${renderProofLinkStatus(p.proof)}
                </td>
                <td>
                    <div class="row-actions">
                        <button class="icon-btn edit-btn" onclick="openEditModal(${realIdx})" title="Edit Player">✏️ Edit</button>
                        <button class="icon-btn delete-btn" onclick="deletePlayer(${realIdx})" title="Delete Player">🗑️</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function renderAll() {
    updateStats();
    renderTable();
}

// ── SEARCH FILTER ───────────────────────────────────────────
document.getElementById('adminSearch')?.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    renderTable();
});

// ── MODAL: ADD / EDIT ───────────────────────────────────────
const playerModal = document.getElementById('playerModal');
const modalTitle = document.getElementById('modalTitle');
const playerForm = document.getElementById('playerForm');
const editIndexInput = document.getElementById('editIndex');
const formTag = document.getElementById('formTag');
const formSpeed = document.getElementById('formSpeed');
const formCharacterSelect = document.getElementById('formCharacterSelect');
const formCharacter = document.getElementById('formCharacter');
const formSetup = document.getElementById('formSetup');
const formState = document.getElementById('formState');
const formCity = document.getElementById('formCity');
const formProof = document.getElementById('formProof');
const adminProofFeedback = document.getElementById('adminProofFeedback');
const expectedImgTxt = document.getElementById('expectedImageName');
const modalAvatar = document.getElementById('modalAvatarPreview');
const modalImgStatus = document.getElementById('modalImageStatus');

formCharacterSelect?.addEventListener('change', () => {
    const val = formCharacterSelect.value;
    if (val && val !== 'CUSTOM') {
        formCharacter.value = val;
    } else if (val === 'CUSTOM') {
        formCharacter.value = '';
        formCharacter.focus();
    }
    updateModalImagePreview();
});

formCharacter?.addEventListener('input', () => {
    const val = formCharacter.value.trim().toUpperCase();
    if (CHARACTER_FILES.includes(val)) {
        formCharacterSelect.value = val;
    } else {
        formCharacterSelect.value = 'CUSTOM';
    }
    updateModalImagePreview();
});

// Proof link inspector in admin modal
formProof?.addEventListener('input', () => {
    const val = formProof.value.trim();
    if (!val || val === '#') {
        if (adminProofFeedback) adminProofFeedback.style.display = 'none';
        return;
    }
    const check = inspectProofLink(val);
    if (!adminProofFeedback) return;
    adminProofFeedback.style.display = 'block';

    if (check.status === 'verified') {
        adminProofFeedback.className = 'proof-feedback-box valid';
        adminProofFeedback.innerHTML = `${check.icon} <strong>${check.platform} Verified:</strong> Valid video proof format.`;
    } else if (check.status === 'fake') {
        adminProofFeedback.className = 'proof-feedback-box invalid';
        adminProofFeedback.innerHTML = `❌ <strong>Fake / Suspicious URL:</strong> ${check.message}`;
    } else if (check.warning) {
        adminProofFeedback.className = 'proof-feedback-box warning';
        adminProofFeedback.innerHTML = `⚠️ <strong>Notice:</strong> ${check.message}`;
    }
});

function openAddModal() {
    modalTitle.textContent = 'ADD NEW LEADERBOARD PLAYER';
    editIndexInput.value = '-1';
    playerForm.reset();
    formCharacterSelect.value = 'BLACK THUNDER NISHIKAWA';
    formCharacter.value = 'BLACK THUNDER NISHIKAWA';
    formSetup.value = 'Power 120 / Jump 120';
    if (adminProofFeedback) adminProofFeedback.style.display = 'none';
    updateModalImagePreview();
    playerModal.style.display = 'flex';
    formTag.focus();
}

window.openEditModal = function (index) {
    const p = players[index];
    if (!p) return;
    modalTitle.textContent = `EDIT PLAYER: ${p.tag}`;
    editIndexInput.value = index;
    formTag.value = p.tag || '';
    formSpeed.value = p.speed || '';
    formCharacter.value = p.character || 'NISHIKAWA';

    const upper = (p.character || '').trim().toUpperCase();
    if (CHARACTER_FILES.includes(upper)) {
        formCharacterSelect.value = upper;
    } else {
        formCharacterSelect.value = 'CUSTOM';
    }

    formSetup.value = p.setup || '';
    formState.value = p.state || '';
    formCity.value = p.city || '';
    formProof.value = p.proof && p.proof !== '#' ? p.proof : '';

    // Trigger inspector on existing proof
    if (formProof.value) {
        formProof.dispatchEvent(new Event('input'));
    } else if (adminProofFeedback) {
        adminProofFeedback.style.display = 'none';
    }

    updateModalImagePreview();
    playerModal.style.display = 'flex';
    formSpeed.focus();
};

function closeModal() {
    playerModal.style.display = 'none';
}

document.getElementById('openAddModalBtn')?.addEventListener('click', openAddModal);
document.getElementById('closeModalBtn')?.addEventListener('click', closeModal);
document.getElementById('cancelModalBtn')?.addEventListener('click', closeModal);

playerModal?.addEventListener('click', (e) => {
    if (e.target === playerModal) closeModal();
});

function updateModalImagePreview() {
    const charName = formCharacter ? formCharacter.value.trim() : '';
    const tag = formTag ? formTag.value.trim() : '';
    const info = resolveCharacterInfo(charName, tag);
    const initial = (tag || charName || 'P').charAt(0).toUpperCase();

    if (expectedImgTxt) {
        expectedImgTxt.textContent = info.characterName ? `images/${info.characterName}.png` : `images/${tag || 'player'}.png`;
    }

    if (modalAvatar) {
        modalAvatar.innerHTML = `
            <img src="${info.pngSrc || info.jpgSrc || info.playerPng}" alt="${charName}" 
                 style="width:100%;height:100%;object-fit:contain;"
                 data-jpg="${info.jpgSrc}"
                 data-player="${info.playerPng}"
                 onerror="if(!this.dataset.triedJpg && this.dataset.jpg){this.dataset.triedJpg='1';this.src=this.dataset.jpg;}else if(!this.dataset.triedPlayer && this.dataset.player){this.dataset.triedPlayer='1';this.src=this.dataset.player;}else{this.style.display='none';if(this.nextElementSibling)this.nextElementSibling.style.display='block';}">
            <span style="display:none;">${initial}</span>
        `;
    }

    if (modalImgStatus) {
        if (info.matched) {
            modalImgStatus.innerHTML = `<span style="color:#00e676;font-weight:700;">✅ Matched:</span> <code>images/${info.characterName}.png</code> (Transparent background active)`;
        } else if (charName) {
            modalImgStatus.innerHTML = `<span style="color:#ffaa00;">Searching for:</span> <code>images/${charName}.png</code> or <code>.jpg</code> in images folder.`;
        } else {
            modalImgStatus.textContent = 'Select or write a character name to preview image.';
        }
    }
}

formTag?.addEventListener('input', updateModalImagePreview);

// ── SAVE PLAYER (ADD OR UPDATE) ─────────────────────────────
playerForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const idx = parseInt(editIndexInput.value);
    const tag = formTag.value.trim();
    const speed = parseInt(formSpeed.value);
    const character = formCharacter.value.trim();
    const setup = formSetup.value.trim() || 'Power 120 / Jump 120';
    const state = formState.value.trim();
    const city = formCity.value.trim();
    const proof = formProof.value.trim() || '#';

    if (!tag || isNaN(speed) || !character || !state) {
        showToast('Please fill all required fields.', 'error');
        return;
    }

    // Inspect proof link
    if (proof && proof !== '#') {
        const check = inspectProofLink(proof);
        if (check.isFake) {
            if (!confirm(`Warning: The proof link appears to be fake or invalid (${check.message}). Save anyway?`)) {
                return;
            }
        }
    }

    const newPlayerData = { tag, speed, character, setup, state, city, proof };

    if (idx >= 0 && idx < players.length) {
        players[idx] = newPlayerData;
        showToast(`Updated ${tag} (${speed} KM/H)!`, 'success');
    } else {
        players.push(newPlayerData);
        showToast(`Added new player ${tag} (${speed} KM/H)!`, 'success');
    }

    closeModal();
    saveData(players);
});

// ── DELETE PLAYER ───────────────────────────────────────────
window.deletePlayer = function (index) {
    const p = players[index];
    if (!p) return;
    const charDesc = p.character ? ` [${p.character}]` : '';
    if (confirm(`Are you sure you want to remove ${p.tag}${charDesc} (${p.speed} KM/H) from the leaderboard?`)) {
        deletePlayerFromFirebase(p.tag, p.character);
        players.splice(index, 1);
        saveData(players);
        showToast(`Removed ${p.tag}${charDesc}.`);
    }
};

// ── RESET TO DEFAULTS ───────────────────────────────────────
document.getElementById('resetDefaultsBtn')?.addEventListener('click', () => {
    if (confirm('Are you sure you want to reset all players to the official character roster? This will sync to Firebase.')) {
        players = JSON.parse(JSON.stringify(DEFAULT_PLAYERS));
        saveData(players);
        showToast('Reset leaderboard to official character players.', 'success');
    }
});

// ── SAVE ALL & PUBLISH ──────────────────────────────────────
document.getElementById('saveAllBtn')?.addEventListener('click', () => {
    saveData(players);
});

// ── EXPORT LEADERBOARD AS BANNER (IMAGE / PDF) ──────────────
function buildBannerDOM(playersList) {
    const container = document.createElement('div');
    container.id = 'exportBannerContainer';
    container.style.cssText = `
        position: fixed;
        left: -9999px;
        top: 0;
        width: 1200px;
        background: radial-gradient(circle at 50% 0%, #2a0000 0%, #0c0000 40%, #050505 100%);
        color: #ffffff;
        font-family: 'Rajdhani', -apple-system, BlinkMacSystemFont, sans-serif;
        padding: 40px 48px;
        box-sizing: border-box;
        border: 2px solid #ff1515;
        border-radius: 12px;
        box-shadow: 0 0 50px rgba(255, 21, 21, 0.4);
        z-index: -1000;
    `;

    const topSpeed = playersList.length ? Math.max(...playersList.map(p => p.speed || 0)) : 0;
    const totalCount = playersList.length;

    // Header HTML
    const headerHtml = `
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid rgba(255,21,21,0.5); padding-bottom:20px; margin-bottom:28px;">
            <div style="display:flex; align-items:center; gap:20px;">
                <div style="font-size:48px; line-height:1;">⚡</div>
                <div>
                    <div style="font-family:'Barlow Condensed', sans-serif; font-size:16px; font-weight:800; color:#ff3b3b; letter-spacing:4px;">THE SPIKE CROSS INDIA</div>
                    <div style="font-family:'Barlow Condensed', sans-serif; font-size:38px; font-weight:900; font-style:italic; letter-spacing:2px; color:#ffffff; text-shadow:0 0 20px rgba(255,21,21,0.7);">OFFICIAL LEADERBOARD ROSTER</div>
                </div>
            </div>
            <div style="display:flex; gap:24px; text-align:right;">
                <div style="background:rgba(255,21,21,0.1); border:1px solid rgba(255,21,21,0.3); padding:8px 18px; border-radius:8px;">
                    <div style="font-size:11px; color:#ff9999; letter-spacing:1px; font-weight:700;">TOTAL PLAYERS</div>
                    <div style="font-family:'Barlow Condensed', sans-serif; font-size:26px; font-weight:900; color:#ffffff;">${totalCount}</div>
                </div>
                <div style="background:rgba(255,215,0,0.1); border:1px solid rgba(255,215,0,0.4); padding:8px 18px; border-radius:8px;">
                    <div style="font-size:11px; color:#ffd700; letter-spacing:1px; font-weight:700;">TOP RECORD</div>
                    <div style="font-family:'Barlow Condensed', sans-serif; font-size:26px; font-weight:900; color:#ffd700;">${topSpeed} KM/H</div>
                </div>
            </div>
        </div>
    `;

    // Table rows
    const rowsHtml = playersList.map((p, idx) => {
        const rank = idx + 1;
        let rankBadgeStyle = 'background:rgba(255,255,255,0.08); color:#cccccc; border:1px solid rgba(255,255,255,0.2);';
        let rowBg = idx % 2 === 0 ? 'background:rgba(20,0,0,0.4);' : 'background:rgba(0,0,0,0.5);';

        if (rank === 1) {
            rankBadgeStyle = 'background:linear-gradient(135deg, #ffd700, #b8860b); color:#000000; font-weight:900; box-shadow:0 0 12px rgba(255,215,0,0.6);';
            rowBg = 'background:rgba(255,215,0,0.08);';
        } else if (rank === 2) {
            rankBadgeStyle = 'background:linear-gradient(135deg, #e0e0e0, #808080); color:#000000; font-weight:900; box-shadow:0 0 10px rgba(220,220,220,0.5);';
            rowBg = 'background:rgba(220,220,220,0.05);';
        } else if (rank === 3) {
            rankBadgeStyle = 'background:linear-gradient(135deg, #cd7f32, #8b4513); color:#ffffff; font-weight:900; box-shadow:0 0 10px rgba(205,127,50,0.5);';
            rowBg = 'background:rgba(205,127,50,0.05);';
        }

        const tag = p.tag || 'Unknown';
        const speed = p.speed || 0;
        const char = p.character || '—';
        const setup = p.setup || '—';
        const loc = [p.city, p.state].filter(Boolean).join(', ') || 'India';

        return `
            <tr style="${rowBg} border-bottom:1px solid rgba(255,255,255,0.06);">
                <td style="padding:12px 14px; text-align:center;">
                    <div style="display:inline-block; width:34px; height:34px; line-height:34px; border-radius:50%; font-family:'Barlow Condensed', sans-serif; font-size:16px; ${rankBadgeStyle}">#${rank}</div>
                </td>
                <td style="padding:12px 14px; font-weight:700; font-size:17px; color:#ffffff; letter-spacing:0.5px;">
                    ${tag}
                </td>
                <td style="padding:12px 14px; font-family:'Barlow Condensed', sans-serif; font-size:22px; font-weight:900; color:#ff3b3b; font-style:italic;">
                    ${speed} <span style="font-size:12px; color:#aaa; font-style:normal;">KM/H</span>
                </td>
                <td style="padding:12px 14px; font-size:14px; color:#ffc080; font-weight:600;">
                    ${char}
                </td>
                <td style="padding:12px 14px; font-size:13px; color:#aaaaaa;">
                    ${setup}
                </td>
                <td style="padding:12px 14px; font-size:13px; color:#dddddd; font-weight:500;">
                    📍 ${loc}
                </td>
            </tr>
        `;
    }).join('');

    // Table HTML
    const tableHtml = `
        <table style="width:100%; border-collapse:collapse; margin-bottom:24px;">
            <thead>
                <tr style="background:linear-gradient(90deg, #3d0000, #7a0000, #3d0000); border-bottom:2px solid #ff1515;">
                    <th style="padding:12px 14px; font-family:'Barlow Condensed', sans-serif; font-size:15px; color:#ffffff; letter-spacing:2px; text-align:center; width:70px;">RANK</th>
                    <th style="padding:12px 14px; font-family:'Barlow Condensed', sans-serif; font-size:15px; color:#ffffff; letter-spacing:2px; text-align:left;">PLAYER NAME</th>
                    <th style="padding:12px 14px; font-family:'Barlow Condensed', sans-serif; font-size:15px; color:#ffffff; letter-spacing:2px; text-align:left; width:130px;">TOP SPEED</th>
                    <th style="padding:12px 14px; font-family:'Barlow Condensed', sans-serif; font-size:15px; color:#ffffff; letter-spacing:2px; text-align:left; width:220px;">CHARACTER</th>
                    <th style="padding:12px 14px; font-family:'Barlow Condensed', sans-serif; font-size:15px; color:#ffffff; letter-spacing:2px; text-align:left;">SETUP / STATS</th>
                    <th style="padding:12px 14px; font-family:'Barlow Condensed', sans-serif; font-size:15px; color:#ffffff; letter-spacing:2px; text-align:left; width:180px;">LOCATION</th>
                </tr>
            </thead>
            <tbody>
                ${rowsHtml}
            </tbody>
        </table>
    `;

    // Footer HTML
    const footerHtml = `
        <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid rgba(255,21,21,0.3); padding-top:16px; font-size:12px; color:#888888;">
            <div>⚡ The Spike India Official Community | Verified Speeds &amp; Roster</div>
            <div>Generated: ${new Date().toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}</div>
        </div>
    `;

    container.innerHTML = headerHtml + tableHtml + footerHtml;
    document.body.appendChild(container);
    return container;
}

async function renderBannerCanvas() {
    if (!players || players.length === 0) {
        showToast('No players available to export!', 'error');
        return null;
    }
    showToast('Generating banner... please wait.', 'info');
    const container = buildBannerDOM(players);
    try {
        // Wait a tick for fonts/layout
        await new Promise(r => setTimeout(r, 200));
        const canvas = await html2canvas(container, {
            scale: 2, // High resolution for clear text and banners
            backgroundColor: '#070000',
            useCORS: true,
            logging: false
        });
        document.body.removeChild(container);
        return canvas;
    } catch (err) {
        if (container.parentNode) {
            document.body.removeChild(container);
        }
        console.error('Banner render error:', err);
        showToast('Failed to generate banner image.', 'error');
        return null;
    }
}

// Export as Image (PNG)
document.getElementById('exportBannerImgBtn')?.addEventListener('click', async () => {
    const canvas = await renderBannerCanvas();
    if (!canvas) return;

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `TheSpike_Leaderboard_Banner_${timestamp}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast('Banner image downloaded successfully!', 'success');
});

// Export as PDF
document.getElementById('exportBannerPdfBtn')?.addEventListener('click', async () => {
    const canvas = await renderBannerCanvas();
    if (!canvas) return;

    try {
        const { jsPDF } = window.jspdf;
        const imgData = canvas.toDataURL('image/png');

        const imgWidth = canvas.width;
        const imgHeight = canvas.height;

        // Create PDF with custom size matching image proportions in landscape
        const orientation = imgWidth > imgHeight ? 'landscape' : 'portrait';
        const pdf = new jsPDF({
            orientation,
            unit: 'px',
            format: [imgWidth, imgHeight]
        });

        pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        pdf.save(`TheSpike_Leaderboard_Banner_${timestamp}.pdf`);
        showToast('Leaderboard PDF downloaded successfully!', 'success');
    } catch (err) {
        console.error('PDF generation error:', err);
        showToast('Failed to generate PDF.', 'error');
    }
});

// ── TOAST NOTIFICATION ──────────────────────────────────────
let toastTimer = null;
function showToast(msg, type = '') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.innerHTML = msg;
    toast.className = `admin-toast show ${type}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        toast.className = 'admin-toast';
    }, 3200);
}

// ── INIT ───────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
    checkAuth();
});
