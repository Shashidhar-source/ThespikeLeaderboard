/* ============================================================
   THE SPIKE INDIA — script.js
   Firebase Firestore Real-time Leaderboard,
   Dynamic Speedometer, Link Inspector & Player Record Submission
   ============================================================ */

import { 
    db, 
    auth,
    signOut,
    onAuthStateChanged,
    collection, 
    doc, 
    setDoc, 
    deleteDoc,
    getDocs, 
    onSnapshot, 
    query, 
    orderBy, 
    inspectProofLink 
} from "./firebase-config.js";


const SPEED_SCALE_MAX = 1000; // Gauge full-scale reference (0 to 1000 km/h)
const STORAGE_KEY     = 'spike-india-players';
const CURRENT_USER_KEY= 'spike-current-user';

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
// Eliminates dummy/seed data so leaderboard remains 100% genuine & empty until real records are submitted
const MOCK_TAGS = new Set([
  "SPIKE_MASTER10", "IND_VOLLEYKING", "THUNDERACE", "THESPIKEINDIAYT",
  "AEROSPIKER", "REDZONE", "VOLLEYBALLGOD", "CROSSACE", "SKYSPIKE",
  "BLAZEX", "ACEINDIA", "SHADOWSPIKE", "ZENITSUPLAYZ", "ROYALSPIKER",
  "SPIKESTORM", "VOLTSPIKER", "INFINITYJUMP", "DARKACE", "HYPERSPIKE", "NEXTGENSPIKE"
]);

// Empty roster by default until players submit real verified records
const DEFAULT_PLAYERS = [];

let allPlayers = [];
let srch = '', fChar = '', fState = '';

/* ── CHARACTER & PLAYER IMAGE RESOLVER ────────────────────────
   Matches exact character name to transparent PNG in images/ folder. */
function resolveCharacterImageInfo(charName, playerName) {
    const normChar   = (charName || '').trim().toUpperCase();
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
        name: primaryChar,
        pngSrc,
        jpgSrc,
        playerPng,
        playerJpg
    };
}

function getPlayerAvatarMarkup(player, rank, sizeClass = '') {
    const tag = player.tag || 'Player';
    const initial = tag.trim().charAt(0).toUpperCase();
    const info = resolveCharacterImageInfo(player.character, player.tag);

    return `
        <div class="player-avatar-wrap ${sizeClass} rank-${rank}" title="${player.character || tag}">
            <img src="${info.pngSrc || info.playerPng || info.jpgSrc}" 
                 alt="${player.character || tag}" 
                 class="player-avatar-img transparent-cutout"
                 data-jpg="${info.jpgSrc || info.playerJpg}"
                 data-player="${info.playerPng}"
                 onerror="if(!this.dataset.triedJpg && this.dataset.jpg){this.dataset.triedJpg='1';this.src=this.dataset.jpg;}else if(!this.dataset.triedPlayer && this.dataset.player){this.dataset.triedPlayer='1';this.src=this.dataset.player;}else{this.style.display='none';if(this.nextElementSibling)this.nextElementSibling.style.display='flex';}">
            <div class="avatar-monogram" style="display:none;">${initial}</div>
        </div>
    `;
}

/* ── THEME SUPPORT ─────────────────────────────────────────── */
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

/* ── PARTICLES BACKGROUND ──────────────────────────────────── */
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
        vx: (Math.random() - 0.5) * 0.5,
        vy: -Math.random() * 0.8 - 0.2,
        size: Math.random() * 2 + 0.5,
        opacity: Math.random() * 0.5 + 0.1,
        life: 1, decay: Math.random() * 0.005 + 0.002
    };
}
let pts = Array.from({ length: 70 }, mkParticle);

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

/* ── EASING ────────────────────────────────────────────────── */
function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

/* ── SPEEDOMETER: Driven by the live #1 highest speed ───────── */
function animateGauge(topSpeed) {
    const needle = document.getElementById('gaugeNeedle');
    const arc    = document.querySelector('.gauge-arc-fill');
    const label  = document.getElementById('gaugeSpeedLabel');
    if (!needle || !arc) return;

    if (!topSpeed || topSpeed <= 0) {
        needle.style.transform = 'rotate(-90deg)';
        arc.style.strokeDashoffset = '251';
        if (label) label.textContent = '--- KM/H';
        return;
    }

    const ratio         = Math.min(Math.max(topSpeed / SPEED_SCALE_MAX, 0), 1);
    const targetAngle   = -90 + (ratio * 180);   // range: -90° (0 km/h) → +90° (1000 km/h)
    const targetOffset  = 251 * (1 - ratio);     // dashoffset: 251 (empty) → 0 (full)

    const dur = 2000, t0 = performance.now();

    function step(now) {
        const prog  = Math.min((now - t0) / dur, 1);
        const eased = easeOut(prog);

        const curAngle  = -90 + eased * (targetAngle + 90);
        const curOffset = 251 - eased * (251 - targetOffset);

        needle.style.transform         = `rotate(${curAngle}deg)`;
        arc.style.strokeDashoffset     = curOffset;
        if (label) label.textContent   = `${Math.floor(eased * topSpeed)} KM/H`;

        if (prog < 1) { requestAnimationFrame(step); return; }

        if (label) label.textContent = `${topSpeed} KM/H`;
        needle.style.transition = 'transform 0.8s ease-in-out';
        setTimeout(() => {
            needle.style.transform = `rotate(${targetAngle - 3}deg)`;
            setTimeout(() => { needle.style.transform = `rotate(${targetAngle}deg)`; }, 400);
        }, 300);
    }
    setTimeout(() => requestAnimationFrame(step), 350);
}

/* ── COUNTERS ─────────────────────────────────────────────── */
function animateCounters(players) {
    const topSpeed  = players[0]?.speed || 0;
    const numStates = [...new Set(players.map(p => p.state))].length;
    const counts    = [topSpeed, players.length, numStates];

    document.querySelectorAll('.stat-num[data-count]').forEach((el, i) => {
        const target = counts[i] ?? 0;
        el.dataset.count = target;
        const t0 = performance.now();
        function up(now) {
            const p = Math.min((now - t0) / 1200, 1);
            el.textContent = Math.floor(easeOut(p) * target);
            if (p < 1) requestAnimationFrame(up); else el.textContent = target;
        }
        requestAnimationFrame(up);
    });
}

/* ── POPULATE FILTERS ─────────────────────────────────────── */
function populateFilters(players) {
    const chars  = [...new Set(players.map(p => p.character).concat(CHARACTER_FILES))].filter(Boolean).sort();
    const states = [...new Set(players.map(p => p.state))].filter(Boolean).sort();

    const cSel = document.getElementById('charFilter');
    const sSel = document.getElementById('stateFilter');

    if (cSel) {
        cSel.innerHTML = '<option value="">All Characters</option>' +
            chars.map(c => `<option value="${c}">${c}</option>`).join('');
    }
    if (sSel) {
        sSel.innerHTML = '<option value="">All States</option>' +
            states.map(s => `<option value="${s}">${s}</option>`).join('');
    }
}

/* ── PODIUM ───────────────────────────────────────────────── */
function renderPodium(list) {
    const top3   = list.slice(0, 3);
    const medals = ['🥇', '🥈', '🥉'];

    [
        { id: 'podium2', rank: 2, player: top3[1] || null },  // Left   — Rank 2 RUNNER UP (Silver)
        { id: 'podium1', rank: 1, player: top3[0] || null },  // Center — Rank 1 CHAMPION (Gold)
        { id: 'podium3', rank: 3, player: top3[2] || null },  // Right  — Rank 3 (Bronze)
    ].forEach(({ id, rank, player }) => {
        const el = document.getElementById(id);
        if (!el) return;

        if (!player) {
            // Elegant empty state awaiting genuine record submission
            if (rank === 1) {
                el.innerHTML = `
                    <div class="podium-rank">#1</div>
                    <div class="podium-empty-box gold-empty-box">
                        <div class="empty-podium-crown">👑</div>
                        <div class="empty-badge-pill gold-badge">#1 INDIA RECORD OPEN</div>
                        <div class="empty-podium-title">AWAITING FIRST RECORD</div>
                        <p class="empty-podium-desc">No records submitted yet. Submit your video proof and claim India's #1 title!</p>
                        <button class="empty-podium-cta" onclick="document.getElementById('heroProfileBtn').click()">
                            <span>⚡</span> CLAIM #1 RECORD
                        </button>
                    </div>
                `;
            } else if (rank === 2) {
                el.innerHTML = `
                    <div class="podium-rank">#2</div>
                    <div class="podium-empty-box silver-empty-box">
                        <div class="empty-podium-medal">🥈</div>
                        <div class="empty-badge-pill silver-badge">#2 RUNNER UP OPEN</div>
                        <div class="empty-podium-title">SPOT AVAILABLE</div>
                        <p class="empty-podium-desc">Waiting for verified submissions</p>
                    </div>
                `;
            } else {
                el.innerHTML = `
                    <div class="podium-rank">#3</div>
                    <div class="podium-empty-box bronze-empty-box">
                        <div class="empty-podium-medal">🥉</div>
                        <div class="empty-badge-pill bronze-badge">#3 BRONZE OPEN</div>
                        <div class="empty-podium-title">SPOT AVAILABLE</div>
                        <p class="empty-podium-desc">Waiting for verified submissions</p>
                    </div>
                `;
            }
            return;
        }

        const medal    = medals[player.rank - 1] || '';
        const isGold   = player.rank === 1;
        const isSilver = player.rank === 2;
        const avatarClass = isGold ? 'avatar-gold' : (isSilver ? 'avatar-silver' : 'avatar-bronze');

        el.innerHTML = `
            <div class="podium-rank">#${player.rank}</div>
            ${isGold   ? '<div class="podium-crown-banner">👑 #1 INDIA RECORD</div>' : ''}
            ${isSilver ? '<div class="podium-runner-banner">⚡ #2 RUNNER UP</div>' : ''}
            <span class="podium-medal">${medal}</span>
            <div class="podium-img-wrap">
                ${getPlayerAvatarMarkup(player, player.rank, avatarClass)}
            </div>
            <div class="podium-tag">${player.tag}</div>
            <div class="podium-speed">${player.speed} KM/H</div>
            <div class="podium-char">${player.character} · ${player.setup || 'Default'}</div>
            <div class="podium-state">📍 ${player.city ? player.state + ', ' + player.city : player.state}</div>
        `;
    });
}

/* ── TABLE & PROOF INSPECTOR STATUS ────────────────────────── */
function rankCell(r) {
    if (r === 1) return `<div class="rank-cell rank-1-cell" title="India #1 Champion">1</div>`;
    if (r === 2) return `<div class="rank-cell rank-2-cell" title="India #2 Runner-Up">2</div>`;
    if (r === 3) return `<div class="rank-cell rank-3-cell" title="India #3 Bronze">3</div>`;
    return `<div class="rank-default">#${r}</div>`;
}

function renderProofButton(proofUrl) {
    const check = inspectProofLink(proofUrl);
    if (!check.isValid || check.status === 'missing') {
        return `<span class="proof-btn disabled" title="No video proof submitted">NO PROOF</span>`;
    }
    if (check.isFake) {
        return `<span class="proof-btn fake-warning" title="${check.message}">⚠️ FAKE LINK</span>`;
    }
    if (check.status === 'verified') {
        return `<a class="proof-btn verified" href="${proofUrl}" target="_blank" title="${check.platform} Verified Video Proof">▶ WATCH <span class="badge-v">✓</span></a>`;
    }
    return `<a class="proof-btn" href="${proofUrl}" target="_blank" title="${check.message}">▶ WATCH</a>`;
}

function renderTable(list) {
    const tbody = document.getElementById('leaderboard-tbody');
    const noRes = document.getElementById('noResults');
    if (!tbody) return;

    if (!list.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-table-cell">
                    <div class="empty-table-state">
                        <div class="empty-table-icon">🏐</div>
                        <h4 class="empty-table-title">NO SPEED RECORDS SUBMITTED YET</h4>
                        <p class="empty-table-desc">
                            The Spike Cross India speed leaderboard is ready! Be the first player to submit your verified in-game spike record and claim your rank.
                        </p>
                        <button class="empty-table-btn" onclick="document.getElementById('heroProfileBtn').click()">
                            <span>⚡</span> SUBMIT YOUR SPEED RECORD
                        </button>
                    </div>
                </td>
            </tr>
        `;
        if (noRes) noRes.style.display = 'none';
        return;
    }
    if (noRes) noRes.style.display = 'none';

    tbody.innerHTML = list.map((p, i) => `
        <tr style="animation-delay:${i * 0.03}s">
            <td>${rankCell(p.rank)}</td>
            <td>
                <div class="player-tag-cell">
                    ${getPlayerAvatarMarkup(p, p.rank, 'table-avatar')}
                    <div class="player-tag">${p.tag}</div>
                </div>
            </td>
            <td><div class="speed-val">${p.speed} KM/H</div></td>
            <td>
                <div class="char-cell">
                    <div>
                        <div class="char-name">${p.character}</div>
                        <div class="char-setup">${p.setup || 'Power 120 / Jump 120'}</div>
                    </div>
                </div>
            </td>
            <td>
                <div class="location-cell">
                    <div class="location-state">🇮🇳 ${p.state}</div>
                    ${p.city ? `<div class="location-city">${p.city}</div>` : ''}
                </div>
            </td>
            <td>${renderProofButton(p.proof)}</td>
        </tr>
    `).join('');
}

/* ── AUTOMATIC SPEED ALIGNMENT & SORTING ──────────────────────
   Detects highest speed and aligns players automatically in rank order */
function alignAndSortPlayers(rawList) {
    return rawList
        .filter(p => p && p.tag && !MOCK_TAGS.has((p.tag || '').toUpperCase()))
        .map(p => ({
            ...p,
            speed: parseInt(p.speed) || 0
        }))
        .filter(p => p.speed > 0)
        .sort((a, b) => b.speed - a.speed)
        .map((p, i) => ({
            ...p,
            rank: i + 1
        }));
}

function updateAll() {
    const f = filtered();
    renderPodium(f);
    renderTable(f);
}

function filtered() {
    return allPlayers.filter(p =>
        (!srch   || (p.tag && p.tag.toLowerCase().includes(srch.toLowerCase()))) &&
        (!fChar  || (p.character && p.character.toLowerCase().includes(fChar.toLowerCase()))) &&
        (!fState || (p.state && p.state.toLowerCase() === fState.toLowerCase()))
    );
}

document.getElementById('searchInput')?.addEventListener('input',  e => { srch   = e.target.value; updateAll(); });
document.getElementById('charFilter')?.addEventListener('change',  e => { fChar  = e.target.value; updateAll(); });
document.getElementById('stateFilter')?.addEventListener('change', e => { fState = e.target.value; updateAll(); });

/* ── FIREBASE FIRESTORE REAL-TIME SYNC ──────────────────────── */
function mergeWithLocalPlayers(remoteList) {
    const map = new Map();
    // 1. Add all valid remote players
    if (Array.isArray(remoteList)) {
        remoteList.forEach(p => {
            if (p && p.tag) map.set(p.tag.toUpperCase(), p);
        });
    }

    // 2. Preserve any local player who has saved a valid record
    try {
        const rawLocal = localStorage.getItem(STORAGE_KEY);
        if (rawLocal) {
            const parsed = JSON.parse(rawLocal);
            if (Array.isArray(parsed)) {
                parsed.forEach(p => {
                    const tagU = (p.tag || '').toUpperCase();
                    if (tagU && !MOCK_TAGS.has(tagU) && (parseInt(p.speed) || 0) > 0) {
                        if (!map.has(tagU)) map.set(tagU, p);
                    }
                });
            }
        }
        // Also check if current user has an active speed record
        const rawUser = localStorage.getItem(CURRENT_USER_KEY);
        if (rawUser) {
            const u = JSON.parse(rawUser);
            if (u && u.ign && (parseInt(u.speed) || 0) > 0) {
                const uTag = u.ign.toUpperCase();
                if (!map.has(uTag)) {
                    map.set(uTag, {
                        tag: u.ign,
                        speed: parseInt(u.speed),
                        character: u.character || 'BLACK THUNDER NISHIKAWA',
                        setup: u.setup || 'Power 120 / Jump 120',
                        state: u.state || u.region || 'India',
                        city: u.city || '',
                        proof: u.proof || '',
                        uid: u.uid || '',
                        updatedAt: u.updatedAt || new Date().toISOString()
                    });
                }
            }
        }
    } catch (e) {
        console.warn('mergeWithLocalPlayers notice:', e);
    }

    return Array.from(map.values());
}

async function initFirebaseLeaderboard() {
    try {
        const q = query(collection(db, "players"), orderBy("speed", "desc"));

        // Real-time updates from Firestore
        onSnapshot(q, (snapshot) => {
            const cleanList = [];
            snapshot.forEach(docSnap => {
                const data = docSnap.data();
                const tagUpper = (data.tag || '').toUpperCase();
                // Filter out any mock/seed players
                if (data && data.tag && !MOCK_TAGS.has(tagUpper)) {
                    cleanList.push(data);
                } else if (MOCK_TAGS.has(tagUpper)) {
                    // Automatically clean out mock player from Firestore if present
                    try {
                        deleteDoc(doc(db, "players", docSnap.id));
                    } catch (e) {}
                }
            });

            const merged = mergeWithLocalPlayers(cleanList);
            allPlayers = alignAndSortPlayers(merged);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(allPlayers));
            onPlayersUpdated();
        }, (error) => {
            console.warn("Firestore onSnapshot note (using local cache):", error);
            loadLocalFallback();
        });
    } catch (err) {
        console.warn("Firebase initialization note:", err);
        loadLocalFallback();
    }
}

function loadLocalFallback() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length) {
                const clean = parsed.filter(p => p && p.tag && !MOCK_TAGS.has((p.tag || '').toUpperCase()));
                allPlayers = alignAndSortPlayers(clean);
                onPlayersUpdated();
                return;
            }
        }
    } catch (e) {}
    allPlayers = [];
    onPlayersUpdated();
}

function onPlayersUpdated() {
    const top = allPlayers[0]?.speed || 0;
    animateGauge(top);
    animateCounters(allPlayers);
    populateFilters(allPlayers);

    const countHeader = document.getElementById('playerCountHeader');
    if (countHeader) countHeader.textContent = allPlayers.length;

    updateAll();
}

/* ── USER SESSION & SUBMISSION OPTION ──────────────────────── */
const REMEMBERED_DETAILS_KEY = 'spike-remembered-player-details';

const recordModal          = document.getElementById('playerRecordModal');
const recordForm           = document.getElementById('recordSubmitForm');
const modalLoggedUser      = document.getElementById('modalLoggedUser');
const recordIgnInput       = document.getElementById('recordIgn');
const recordUidInput       = document.getElementById('recordUid');
const recordSpeedInput     = document.getElementById('recordSpeed');
const recordCharInput      = document.getElementById('recordCharacter');
const recordSetupInput     = document.getElementById('recordSetup');
const recordStateInput     = document.getElementById('recordState');
const recordCityInput      = document.getElementById('recordCity');
const recordProofInput     = document.getElementById('recordProof');
const inspectFeedback      = document.getElementById('proofInspectStatus');
const profileAvatarPreview = document.getElementById('profileAvatarPreview');
const profileAvatarName    = document.getElementById('profileAvatarName');
const profileAvatarStatus  = document.getElementById('profileAvatarStatus');
const loginPromptModal     = document.getElementById('loginPromptModal');

/* ── PERSISTENT REMEMBERED DETAILS SYSTEM ─────────────────────
   Ensures player never has to re-enter their IGN, UID, character, setup, etc. */
function getRememberedDetails() {
    try {
        const raw = localStorage.getItem(REMEMBERED_DETAILS_KEY);
        if (raw) return JSON.parse(raw);
    } catch (e) {}
    try {
        const rawUser = localStorage.getItem(CURRENT_USER_KEY);
        if (rawUser) return JSON.parse(rawUser);
    } catch (e) {}
    return null;
}

function saveRememberedDetails(details) {
    if (!details) return;
    try {
        const existing = getRememberedDetails() || {};
        const merged = { ...existing, ...details, savedAt: Date.now() };
        localStorage.setItem(REMEMBERED_DETAILS_KEY, JSON.stringify(merged));
    } catch (e) {
        console.warn('saveRememberedDetails note:', e);
    }
}

function persistFormDraft() {
    saveRememberedDetails({
        ign: recordIgnInput ? recordIgnInput.value.trim() : '',
        uid: recordUidInput ? recordUidInput.value.trim() : '',
        character: recordCharInput ? recordCharInput.value : '',
        speed: recordSpeedInput ? recordSpeedInput.value : '',
        setup: recordSetupInput ? recordSetupInput.value.trim() : '',
        state: recordStateInput ? recordStateInput.value : '',
        city: recordCityInput ? recordCityInput.value.trim() : '',
        proof: recordProofInput ? recordProofInput.value.trim() : ''
    });
}

// Auto-remember details in real-time as player types
[recordIgnInput, recordUidInput, recordSpeedInput, recordSetupInput, recordCityInput, recordProofInput].forEach(inp => {
    inp?.addEventListener('input', persistFormDraft);
});
recordCharInput?.addEventListener('change', () => {
    persistFormDraft();
    updateProfileAvatarPreview(recordCharInput.value, recordIgnInput?.value);
});
recordStateInput?.addEventListener('change', persistFormDraft);

function isUserLoggedIn() {
    try {
        const raw = localStorage.getItem(CURRENT_USER_KEY);
        if (!raw) return false;
        const u = JSON.parse(raw);
        return !!(u && (u.ign || u.email || u.firebaseUid));
    } catch (e) {
        return false;
    }
}

function getCurrentUser() {
    try {
        const raw = localStorage.getItem(CURRENT_USER_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        return null;
    }
}

/* ── LOGIN PROMPT MODAL ────────────────────────────────────── */
function openLoginPromptModal() {
    if (loginPromptModal) {
        loginPromptModal.style.display = 'flex';
    } else {
        if (confirm('🔐 Login Required: Please sign in or create an account to save your profile and leaderboard records. Go to login page now?')) {
            window.location.href = 'login.html?redirect=profile';
        }
    }
}

function closeLoginPromptModal() {
    if (loginPromptModal) {
        loginPromptModal.style.display = 'none';
    }
}

document.getElementById('closeLoginPromptBtn')?.addEventListener('click', closeLoginPromptModal);
document.getElementById('cancelLoginPromptBtn')?.addEventListener('click', closeLoginPromptModal);
loginPromptModal?.addEventListener('click', (e) => {
    if (e.target === loginPromptModal) closeLoginPromptModal();
});

// Quick demo login directly from login prompt modal
document.getElementById('modalDemoLoginBtn')?.addEventListener('click', () => {
    const remembered = getRememberedDetails() || {};
    const demoUser = {
        ign: remembered.ign || 'SPIKE_MASTER10',
        uid: remembered.uid || 'SC-100001',
        email: 'spikemaster@thespike.in',
        region: remembered.state || 'Karnataka',
        state: remembered.state || 'Karnataka',
        city: remembered.city || 'Bengaluru',
        character: remembered.character || 'BLACK THUNDER NISHIKAWA',
        speed: parseInt(remembered.speed) || 198,
        setup: remembered.setup || 'Power 120 / Jump 120',
        proof: remembered.proof || 'https://youtube.com/shorts/demo',
        isDemo: true,
        loggedInAt: Date.now()
    };
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(demoUser));
    saveRememberedDetails(demoUser);
    closeLoginPromptModal();
    checkUserSession();
    showToast(`⚡ Demo account connected! Logged in as ${demoUser.ign}`, 'success');
    setTimeout(() => {
        openRecordSubmissionModal(demoUser);
    }, 200);
});

function updateProfileAvatarPreview(charName, ign) {
    if (!profileAvatarPreview) return;
    const info = resolveCharacterImageInfo(charName, ign);
    if (profileAvatarName) profileAvatarName.textContent = info.name || 'Character Avatar';
    const primaryImg = info.pngSrc || info.jpgSrc;
    if (primaryImg) {
        profileAvatarPreview.innerHTML = `<img src="${primaryImg}" alt="${info.name}" style="width:100%;height:100%;object-fit:contain;" data-jpg="${info.jpgSrc || ''}" onerror="if(!this.dataset.triedJpg && this.dataset.jpg){this.dataset.triedJpg='1';this.src=this.dataset.jpg;}else{this.parentElement.innerHTML='<span>🏐</span>';}">`;
        if (profileAvatarStatus) profileAvatarStatus.textContent = 'Character image ready';
    } else {
        profileAvatarPreview.innerHTML = '<span>🏐</span>';
        if (profileAvatarStatus) profileAvatarStatus.textContent = 'Default avatar';
    }
}

function handleProfileOrSubmitClick() {
    if (!isUserLoggedIn()) {
        openLoginPromptModal();
        return;
    }
    const user = getCurrentUser();
    openRecordSubmissionModal(user);
}

// Hook up all Profile and Submit buttons across page
document.getElementById('heroProfileBtn')?.addEventListener('click', handleProfileOrSubmitClick);
document.getElementById('filterBarSubmitBtn')?.addEventListener('click', handleProfileOrSubmitClick);
document.getElementById('floatingProfileBtn')?.addEventListener('click', handleProfileOrSubmitClick);

function checkUserSession() {
    try {
        const user = getCurrentUser();
        const navSlot = document.getElementById('userNavSlot');
        const heroBtnText = document.getElementById('heroBtnText');
        const filterBtn = document.getElementById('filterBarSubmitBtn');
        const floatingBtn = document.getElementById('floatingProfileBtn');

        if (user && (user.ign || user.email)) {
            const displayName = user.ign || user.email.split('@')[0];
            if (navSlot) {
                navSlot.innerHTML = `
                    <div class="user-session-bar">
                        <div class="logged-in-badge" title="UID: ${user.uid || 'N/A'}">
                            <span class="user-ball">🏐</span>
                            <span class="user-ign">${displayName}</span>
                        </div>
                        <button class="record-nav-btn" id="openRecordModalNavBtn">
                            👤 My Profile &amp; Submit
                        </button>
                        <button class="logout-btn" id="logoutBtn" title="Log out">✕</button>
                    </div>
                `;
            }

            if (heroBtnText) {
                heroBtnText.textContent = `👤 MY PROFILE (${displayName}) & SUBMIT RECORD`;
            }
            if (filterBtn) {
                filterBtn.innerHTML = `<span>⚡</span> My Profile &amp; Record (${displayName})`;
            }
            if (floatingBtn) {
                floatingBtn.innerHTML = `<span class="btn-fire">⚡</span><span class="btn-text">👤 ${displayName} · PROFILE</span>`;
            }

            document.getElementById('openRecordModalNavBtn')?.addEventListener('click', () => {
                openRecordSubmissionModal(user);
            });

            document.getElementById('logoutBtn')?.addEventListener('click', async () => {
                try {
                    await signOut(auth);
                } catch (e) {}
                localStorage.removeItem(CURRENT_USER_KEY);
                checkUserSession();
                showToast('Logged out of Spike Cross account.');
            });
        } else {
            if (navSlot) {
                navSlot.innerHTML = `
                    <button class="record-nav-btn" id="navOpenSubmitBtn">👤 My Profile / Submit</button>
                    <a href="login.html" class="nav-login-btn">⚡ Sign In</a>
                `;
                document.getElementById('navOpenSubmitBtn')?.addEventListener('click', handleProfileOrSubmitClick);
            }
            if (heroBtnText) {
                heroBtnText.textContent = 'MY PROFILE & SUBMIT RECORD';
            }
            if (filterBtn) {
                filterBtn.innerHTML = '<span>⚡</span> Submit / View Profile';
            }
            if (floatingBtn) {
                floatingBtn.innerHTML = '<span class="btn-fire">⚡</span><span class="btn-text">MY PROFILE &amp; SUBMIT</span>';
            }
        }
    } catch (e) {
        console.error('Session check error:', e);
    }
}

// Sync Firebase Auth state changes without wiping offline local session
onAuthStateChanged(auth, (fbUser) => {
    if (fbUser) {
        try {
            const current = getCurrentUser() || {};
            const updated = {
                ...current,
                email: fbUser.email || current.email || '',
                ign: current.ign || fbUser.displayName || (fbUser.email ? fbUser.email.split('@')[0] : 'Player'),
                firebaseUid: fbUser.uid
            };
            localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(updated));
            saveRememberedDetails(updated);
        } catch (e) {}
    }
    checkUserSession();
});

function openRecordSubmissionModal(user = null) {
    if (!recordModal) return;

    const activeUser = user || getCurrentUser();
    const remembered = getRememberedDetails() || {};
    const statusStrip = document.getElementById('profileStatusStrip');

    if (modalLoggedUser) {
        modalLoggedUser.textContent = activeUser ? (activeUser.ign || 'Player') : 'Guest Player';
    }

    // Prefill existing player record if available from leaderboard list
    let existing = null;
    const lookupTag = (activeUser?.ign || remembered.ign || '').toLowerCase();
    if (lookupTag) {
        existing = allPlayers.find(p => (p.tag || '').toLowerCase() === lookupTag);
    }

    // Prefill ALL details using priority: activeUser -> remembered -> existing -> defaults
    const chosenIgn       = activeUser?.ign || remembered.ign || existing?.tag || '';
    const chosenUid       = activeUser?.uid || remembered.uid || existing?.uid || '';
    const chosenCharacter = activeUser?.character || remembered.character || existing?.character || 'BLACK THUNDER NISHIKAWA';
    const chosenSpeed     = (activeUser?.speed !== undefined && activeUser?.speed !== '' && activeUser?.speed !== 0)
                            ? activeUser.speed
                            : (remembered.speed !== undefined && remembered.speed !== '' && remembered.speed !== 0 ? remembered.speed : (existing?.speed || ''));
    const chosenSetup     = activeUser?.setup || remembered.setup || existing?.setup || 'Power 120 / Jump 120';
    const chosenState     = activeUser?.state || activeUser?.region || remembered.state || existing?.state || '';
    const chosenCity      = activeUser?.city || remembered.city || existing?.city || '';
    const chosenProof     = (activeUser?.proof && activeUser.proof !== '#')
                            ? activeUser.proof
                            : (remembered.proof && remembered.proof !== '#' ? remembered.proof : (existing?.proof && existing.proof !== '#' ? existing.proof : ''));

    if (recordIgnInput)   recordIgnInput.value   = chosenIgn;
    if (recordUidInput)   recordUidInput.value   = chosenUid;
    if (recordCharInput)  recordCharInput.value  = chosenCharacter;
    if (recordSpeedInput) recordSpeedInput.value = chosenSpeed;
    if (recordSetupInput) recordSetupInput.value = chosenSetup;
    if (recordStateInput) recordStateInput.value = chosenState;
    if (recordCityInput)  recordCityInput.value  = chosenCity;
    if (recordProofInput) recordProofInput.value = chosenProof;

    // Configure profile status banner
    if (statusStrip) {
        if (activeUser && activeUser.ign) {
            const pIdx = allPlayers.findIndex(p => p.tag.toLowerCase() === activeUser.ign.toLowerCase());
            const rankHtml = pIdx >= 0 
                ? `<span class="rank-pill">🏆 Leaderboard Rank: #${pIdx + 1} (${allPlayers[pIdx].speed} KM/H)</span>`
                : `<span class="rank-pill">⚡ Unranked (Enter speed to rank!)</span>`;

            statusStrip.innerHTML = `
                <div>
                    <strong>👤 Spike Cross Profile:</strong> 
                    <span style="color:var(--accent-red);font-weight:800;font-size:15px;margin-left:4px;">${activeUser.ign}</span>
                    <span style="color:var(--text-muted);font-size:12px;margin-left:8px;">(UID: ${activeUser.uid || 'Pending'})</span>
                </div>
                ${rankHtml}
            `;
        } else {
            statusStrip.innerHTML = `
                <div>
                    <strong>⚡ Spike Cross Player Details:</strong> Enter your details below to position your record on the leaderboard.
                </div>
                <div>
                    <a href="login.html?redirect=profile" style="color:var(--accent-red);font-weight:700;text-decoration:underline;">Sign In with Account →</a>
                </div>
            `;
        }
    }

    updateProfileAvatarPreview(recordCharInput?.value, recordIgnInput?.value);
    triggerLinkInspection(recordProofInput?.value || '');
    recordModal.style.display = 'flex';
    if (!recordIgnInput?.value) {
        recordIgnInput?.focus();
    } else {
        recordSpeedInput?.focus();
    }
}

function closeRecordModal() {
    if (recordModal) recordModal.style.display = 'none';
}

document.getElementById('closeRecordModalBtn')?.addEventListener('click', closeRecordModal);
document.getElementById('cancelRecordModalBtn')?.addEventListener('click', closeRecordModal);
recordModal?.addEventListener('click', (e) => {
    if (e.target === recordModal) closeRecordModal();
});

// Live link inspection as the player types or pastes their proof URL
recordProofInput?.addEventListener('input', () => {
    triggerLinkInspection(recordProofInput.value);
});

function triggerLinkInspection(url) {
    if (!inspectFeedback) return;
    const check = inspectProofLink(url);

    if (!url || check.status === 'missing') {
        inspectFeedback.style.display = 'none';
        return;
    }

    inspectFeedback.style.display = 'block';

    if (check.status === 'verified') {
        inspectFeedback.className = 'proof-feedback-box valid';
        inspectFeedback.innerHTML = `${check.icon} <strong>${check.platform} Verified:</strong> Genuine video link recognized.`;
    } else if (check.status === 'fake') {
        inspectFeedback.className = 'proof-feedback-box invalid';
        inspectFeedback.innerHTML = `❌ <strong>Fake / Invalid Link:</strong> ${check.message}`;
    } else if (check.warning) {
        inspectFeedback.className = 'proof-feedback-box warning';
        inspectFeedback.innerHTML = `⚠️ <strong>Notice:</strong> ${check.message}`;
    }
}

/* ── NON-BLOCKING BACKGROUND FIREBASE SYNC ──────────────────── */
async function syncRecordToFirebase(updatedUser, recordData, speed) {
    const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Firebase sync timed out')), 6000)
    );

    const syncTask = async () => {
        const ign = updatedUser.ign;
        const userDocId = updatedUser.firebaseUid ? updatedUser.firebaseUid : ign.toLowerCase();
        
        await setDoc(doc(db, "users", userDocId), updatedUser, { merge: true });
        await setDoc(doc(db, "users_by_ign", ign.toLowerCase()), {
            email: updatedUser.email || '',
            ign,
            uid: updatedUser.uid || '',
            firebaseUid: updatedUser.firebaseUid || ''
        }, { merge: true });

        if (speed > 0) {
            await setDoc(doc(db, "players", ign.toUpperCase()), recordData);
        }
    };

    try {
        await Promise.race([syncTask(), timeoutPromise]);
        console.log('Firebase Cloud sync completed successfully.');
    } catch (fbErr) {
        console.warn('Firebase profile save note (offline copy saved):', fbErr);
    }
}

// Player record form submission
recordForm?.addEventListener('submit', async (e) => {
    e.preventDefault();

    // 1. Enforce login requirement
    if (!isUserLoggedIn()) {
        showToast('🔐 Please log in first to save your profile & records.', 'warning');
        openLoginPromptModal();
        return;
    }

    const user = getCurrentUser() || {};
    const ign       = recordIgnInput ? recordIgnInput.value.trim() : (user.ign || '');
    const uid       = recordUidInput ? recordUidInput.value.trim() : (user.uid || '');
    const speed     = parseInt(recordSpeedInput.value) || 0;
    const character = recordCharInput.value;
    const setup     = recordSetupInput.value.trim() || 'Power 120 / Jump 120';
    const state     = recordStateInput.value.trim() || 'India';
    const city      = recordCityInput ? recordCityInput.value.trim() : '';
    const proof     = recordProofInput.value.trim();

    if (!ign || !uid) {
        alert('Please enter your Spike Cross In-Game Name (IGN) and UID.');
        return;
    }

    // Verify proof link if provided
    if (proof && proof !== '#') {
        const check = inspectProofLink(proof);
        if (check.isFake) {
            alert(`❌ Cannot submit fake or invalid proof link: ${check.message}`);
            recordProofInput.focus();
            return;
        }
    }

    const submitBtn = document.getElementById('submitRecordBtn');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>⏳</span> SAVING...';
    }

    const recordData = {
        tag: ign,
        speed,
        character,
        setup,
        state,
        city,
        proof,
        uid,
        updatedAt: new Date().toISOString()
    };

    const updatedUser = {
        ...user,
        ign,
        uid,
        character,
        speed,
        setup,
        state,
        region: state,
        city,
        proof,
        updatedAt: new Date().toISOString()
    };

    // 2. IMMEDIATE LOCAL PERSISTENCE: Never blocks or freezes
    // A. Update current user session
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(updatedUser));
    
    // B. Permanently remember details on this device
    saveRememberedDetails({
        ign,
        uid,
        character,
        speed,
        setup,
        state,
        city,
        proof
    });

    // C. Update leaderboard list immediately
    if (speed > 0) {
        const oldIgn = user.ign ? user.ign.toUpperCase() : '';
        const existingIdx = allPlayers.findIndex(p => 
            (p.tag || '').toUpperCase() === ign.toUpperCase() || 
            (oldIgn && (p.tag || '').toUpperCase() === oldIgn)
        );

        if (existingIdx >= 0) {
            allPlayers[existingIdx] = recordData;
        } else {
            allPlayers.push(recordData);
        }

        allPlayers = alignAndSortPlayers(allPlayers);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(allPlayers));
        onPlayersUpdated();
    }

    // D. Refresh UI & close modal
    checkUserSession();
    closeRecordModal();
    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span>💾</span> SAVE PROFILE &amp; LEADERBOARD RECORD';
    }

    const newRank = allPlayers.findIndex(p => (p.tag || '').toUpperCase() === ign.toUpperCase()) + 1;
    if (speed > 0 && newRank > 0) {
        showToast(`🎉 Profile & Record saved! ${ign} is ranked #${newRank} with ${speed} KM/H!`, 'success');
        document.getElementById('leaderboard-section')?.scrollIntoView({ behavior: 'smooth' });
    } else {
        showToast(`🎉 Spike Cross profile details updated & remembered successfully!`, 'success');
    }

    // 3. BACKGROUND SYNC TO FIREBASE (Non-blocking)
    syncRecordToFirebase(updatedUser, recordData, speed);
});

// Toast helper
let toastTimer = null;
function showToast(msg, type = '') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.innerHTML = msg;
    toast.className = `admin-toast show ${type}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        toast.className = 'admin-toast';
    }, 4000);
}

/* ── INIT ────────────────────────────────────────────────── */
window.addEventListener('DOMContentLoaded', () => {
    checkUserSession();
    initFirebaseLeaderboard();

    // Check if redirected with action=profile or submit=1
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('action') === 'profile' || urlParams.get('submit') === '1') {
        setTimeout(() => {
            handleProfileOrSubmitClick();
        }, 350);
        // Clean up URL without reload
        try {
            window.history.replaceState({}, document.title, window.location.pathname);
        } catch (e) {}
    }
});

