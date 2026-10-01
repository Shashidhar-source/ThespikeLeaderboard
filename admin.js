/* ============================================================
   THE SPIKE INDIA — admin.js
   ============================================================ */

const STORAGE_KEY       = 'spike-india-players';
const ADMIN_SESSION_KEY = 'spike-admin-authenticated';
const DEFAULT_PASSCODE  = 'admin123';

// ── AVAILABLE CHARACTER IMAGES IN images/ ───────────────────
const CHARACTER_FILES = [
  "BLACK THUNDER NISHIKAWA",
  "DAVE",
  "HEESEONG",
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

// ── DEFAULT PLAYERS BACKUP ──────────────────────────────────
const DEFAULT_PLAYERS = [
  { tag:"SPIKE_MASTER10",    speed:198, character:"BLACK THUNDER NISHIKAWA",              setup:"Power 120 / Jump 120", state:"Karnataka",      city:"Bagalkot",    proof:"#" },
  { tag:"IND_VolleyKing",    speed:195, character:"NISHIKAWA",                            setup:"Power 120 / Jump 115", state:"Tamil Nadu",     city:"Chennai",     proof:"#" },
  { tag:"ThunderAce",        speed:193, character:"HEESEONG",                             setup:"Power 120 / Jump 120", state:"Maharashtra",    city:"Mumbai",      proof:"#" },
  { tag:"TheSpikeIndiaYT",   speed:191, character:"JAEHYUN",                              setup:"Power 120 / Jump 120", state:"Karnataka",      city:"Bengaluru",   proof:"#" },
  { tag:"AeroSpiker",        speed:189, character:"YOUNGSUP",                             setup:"Power 120 / Jump 118", state:"Uttar Pradesh",  city:"Lucknow",     proof:"#" },
  { tag:"RedZone",           speed:188, character:"RAUL",                                 setup:"Power 118 / Jump 120", state:"Delhi",          city:"New Delhi",   proof:"#" },
  { tag:"VolleyballGod",     speed:186, character:"LUCAS",                                setup:"Power 120 / Jump 115", state:"Maharashtra",    city:"Pune",        proof:"#" },
  { tag:"CrossAce",          speed:185, character:"DAVE",                                 setup:"Power 118 / Jump 118", state:"Telangana",      city:"Hyderabad",   proof:"#" },
  { tag:"SkySpike",          speed:183, character:"RYUHYEON",                             setup:"Power 118 / Jump 118", state:"Gujarat",        city:"Ahmedabad",   proof:"#" },
  { tag:"BlazeX",            speed:182, character:"JENNY",                                setup:"Power 118 / Jump 116", state:"Rajasthan",      city:"Jaipur",      proof:"#" },
  { tag:"AceIndia",          speed:181, character:"SARA",                                 setup:"Power 116 / Jump 118", state:"West Bengal",    city:"Kolkata",     proof:"#" },
  { tag:"ShadowSpike",       speed:180, character:"NISHIKAWA HS OR NISHIKAWA HIGH SCHOOL",setup:"Power 118 / Jump 115", state:"Madhya Pradesh", city:"Indore",      proof:"#" },
  { tag:"ZenitsuPlayz",      speed:178, character:"BLACK THUNDER NISHIKAWA",              setup:"Power 116 / Jump 118", state:"Kerala",         city:"Kochi",       proof:"#" },
  { tag:"RoyalSpiker",       speed:176, character:"NISHIKAWA",                            setup:"Power 115 / Jump 116", state:"Punjab",         city:"Chandigarh",  proof:"#" },
  { tag:"SpikeStorm",        speed:175, character:"HEESEONG",                             setup:"Power 116 / Jump 116", state:"Bihar",          city:"Patna",       proof:"#" },
  { tag:"VoltSpiker",        speed:174, character:"JAEHYUN",                              setup:"Power 114 / Jump 115", state:"Assam",          city:"Guwahati",    proof:"#" },
  { tag:"InfinityJump",      speed:172, character:"YOUNGSUP",                             setup:"Power 114 / Jump 115", state:"Odisha",         city:"Bhubaneswar", proof:"#" },
  { tag:"DarkAce",           speed:171, character:"RAUL",                                 setup:"Power 115 / Jump 114", state:"Jharkhand",      city:"Ranchi",      proof:"#" },
  { tag:"HyperSpike",        speed:170, character:"LUCAS",                                setup:"Power 114 / Jump 114", state:"Chhattisgarh",   city:"Raipur",      proof:"#" },
  { tag:"NextGenSpike",      speed:168, character:"DAVE",                                 setup:"Power 112 / Jump 115", state:"Haryana",        city:"Gurugram",    proof:"#" },
];

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

// ── DATA MANAGEMENT ─────────────────────────────────────────
function loadData() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length) return parsed;
        }
    } catch (e) {}
    return JSON.parse(JSON.stringify(DEFAULT_PLAYERS));
}

function saveData(dataToSave) {
    dataToSave.sort((a, b) => b.speed - a.speed);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
    players = dataToSave;
    renderAll();
    showToast('Changes saved and synced to public leaderboard!', 'success');
}

function initAdminData() {
    players = loadData();
    players.sort((a, b) => b.speed - a.speed);
    renderAll();
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

// ── IMAGE HELPER: CHARACTER IMAGE MATCHING ──────────────────
function resolveCharacterInfo(charName, playerName) {
    const normChar = (charName || '').trim().toUpperCase();
    const normPlayer = (playerName || '').trim();

    // 1. Direct match with character files list
    let matchedName = CHARACTER_FILES.find(f => f.toUpperCase() === normChar);

    // 2. Friendly alias/partial match
    if (!matchedName && normChar) {
        if (normChar.includes('HEES')) matchedName = 'HEESEONG';
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
                 data-jpg="${info.jpgSrc || info.playerJpg}"
                 data-player="${info.playerPng}"
                 onerror="if(!this.dataset.triedJpg && this.dataset.jpg){this.dataset.triedJpg='1';this.src=this.dataset.jpg;}else if(!this.dataset.triedPlayer && this.dataset.player){this.dataset.triedPlayer='1';this.src=this.dataset.player;}else{this.style.display='none';this.nextElementSibling.style.display='block';}">
            <span class="admin-avatar-fallback" style="display:none;">${initial}</span>
        </div>
    `;
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
                    <span>🇮🇳 ${p.state}</span>, <small style="color:var(--text-muted);">${p.city}</small>
                </td>
                <td>
                    ${p.proof && p.proof !== '#' ? `<a href="${p.proof}" target="_blank" style="color:var(--accent-red);font-weight:700;">▶ Link</a>` : '<span style="color:var(--text-muted);">None</span>'}
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
const expectedImgTxt      = document.getElementById('expectedImageName');
const modalAvatar         = document.getElementById('modalAvatarPreview');
const modalImgStatus      = document.getElementById('modalImageStatus');

// Sync dropdown and text input for character
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

function openAddModal() {
    modalTitle.textContent = 'ADD NEW LEADERBOARD PLAYER';
    editIndexInput.value = '-1';
    playerForm.reset();
    formCharacterSelect.value = 'BLACK THUNDER NISHIKAWA';
    formCharacter.value = 'BLACK THUNDER NISHIKAWA';
    formSetup.value = 'Power 120 / Jump 120';
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

// Update image preview as user selects or types character name or player name
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
            modalImgStatus.innerHTML = `<span style="color:#00e676;font-weight:700;">✅ Matched image:</span> <code>images/${info.characterName}.png</code> (Transparent background active)`;
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
    const setup     = formSetup.value.trim() || 'Default Setup';
    const state     = formState.value.trim();
    const city      = formCity.value.trim();
    const proof     = formProof.value.trim() || '#';

    if (!tag || isNaN(speed) || !character || !state || !city) {
        showToast('Please fill all required fields.', 'error');
        return;
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
    if (confirm(`Are you sure you want to remove ${p.tag} (${p.speed} KM/H) from the leaderboard?`)) {
        players.splice(index, 1);
        saveData(players);
        showToast(`Removed ${p.tag}.`);
    }
};

// ── RESET TO DEFAULTS ───────────────────────────────────────
document.getElementById('resetDefaultsBtn')?.addEventListener('click', () => {
    if (confirm('Are you sure you want to reset all players to the official character roster? Any custom added players will be cleared.')) {
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
    toast.textContent = msg;
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
