/* ============================================================
   THE SPIKE INDIA — admin.js
   Firebase Firestore Admin Controller & Proof Link Inspector
   ============================================================ */

import { 
    inspectProofLink,
    savePlayerToCloud,
    fetchPlayersFromCloud,
    deletePlayerFromCloud
} from "./firebase-config.js";

const STORAGE_KEY       = 'spike-india-players';
const ADMIN_SESSION_KEY = 'spike-admin-authenticated';
const DEFAULT_PASSCODE  = 'admin123';

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

// ── PASSCODE AUTH ───────────────────────────────────────────
const authOverlay   = document.getElementById('adminAuthOverlay');
const passForm      = document.getElementById('adminPassForm');
const passInput     = document.getElementById('adminPassInput');
const passError     = document.getElementById('adminPassError');
const adminDashboard= document.getElementById('adminDashboard');
const logoutBtn     = document.getElementById('logoutAdminBtn');

function checkAuth() {
    if (sessionStorage.getItem(ADMIN_SESSION_KEY) === 'true') {
        authOverlay.style.display = 'none';
        adminDashboard.style.display = 'block';
        initAdminData();
    } else {
        authOverlay.style.display = 'flex';
        adminDashboard.style.display = 'none';
        if (passInput) passInput.focus();
    }
}

passForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const val = passInput.value.trim();
    if (val === DEFAULT_PASSCODE) {
        sessionStorage.setItem(ADMIN_SESSION_KEY, 'true');
        passError.style.display = 'none';
        checkAuth();
        showToast('Admin dashboard unlocked successfully!', 'success');
    } else {
        passError.textContent = 'Incorrect passcode. Try default: admin123';
        passError.style.display = 'block';
        passInput.select();
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
    } catch (e) {}

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
    const pngSrc      = primaryChar ? `images/${encodeURIComponent(primaryChar)}.png` : '';
    const jpgSrc      = primaryChar ? `images/${encodeURIComponent(primaryChar)}.jpg` : '';
    const playerPng   = normPlayer  ? `images/${encodeURIComponent(normPlayer)}.png` : '';
    const playerJpg   = normPlayer  ? `images/${encodeURIComponent(normPlayer)}.jpg` : '';

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
const playerModal         = document.getElementById('playerModal');
const modalTitle          = document.getElementById('modalTitle');
const playerForm          = document.getElementById('playerForm');
const editIndexInput      = document.getElementById('editIndex');
const formTag             = document.getElementById('formTag');
const formSpeed           = document.getElementById('formSpeed');
const formCharacterSelect = document.getElementById('formCharacterSelect');
const formCharacter       = document.getElementById('formCharacter');
const formSetup           = document.getElementById('formSetup');
const formState           = document.getElementById('formState');
const formCity            = document.getElementById('formCity');
const formProof           = document.getElementById('formProof');
const adminProofFeedback  = document.getElementById('adminProofFeedback');
const expectedImgTxt      = document.getElementById('expectedImageName');
const modalAvatar         = document.getElementById('modalAvatarPreview');
const modalImgStatus      = document.getElementById('modalImageStatus');

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

window.openEditModal = function(index) {
    const p = players[index];
    if (!p) return;
    modalTitle.textContent = `EDIT PLAYER: ${p.tag}`;
    editIndexInput.value = index;
    formTag.value        = p.tag || '';
    formSpeed.value      = p.speed || '';
    formCharacter.value  = p.character || 'NISHIKAWA';

    const upper = (p.character || '').trim().toUpperCase();
    if (CHARACTER_FILES.includes(upper)) {
        formCharacterSelect.value = upper;
    } else {
        formCharacterSelect.value = 'CUSTOM';
    }

    formSetup.value      = p.setup || '';
    formState.value      = p.state || '';
    formCity.value       = p.city || '';
    formProof.value      = p.proof && p.proof !== '#' ? p.proof : '';
    
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
    const tag      = formTag ? formTag.value.trim() : '';
    const info     = resolveCharacterInfo(charName, tag);
    const initial  = (tag || charName || 'P').charAt(0).toUpperCase();

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
    const idx       = parseInt(editIndexInput.value);
    const tag       = formTag.value.trim();
    const speed     = parseInt(formSpeed.value);
    const character = formCharacter.value.trim();
    const setup     = formSetup.value.trim() || 'Power 120 / Jump 120';
    const state     = formState.value.trim();
    const city      = formCity.value.trim();
    const proof     = formProof.value.trim() || '#';

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
window.deletePlayer = function(index) {
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
