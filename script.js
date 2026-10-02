/* ============================================================
   THE SPIKE INDIA — script.js
   Firebase Firestore Real-time Leaderboard,
   Dynamic Speedometer, Link Inspector & Player Record Submission
   ============================================================ */

import { 
    auth,
    signOut,
    onAuthStateChanged,
    inspectProofLink,
    savePlayerToCloud,
    saveUserProfile,
    fetchUserProfile,
    fetchPlayersFromCloud,
    subscribeToCloudLeaderboard,
    deletePlayerFromCloud
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
// Kept empty so no player names or genuine records are ever purged
const MOCK_TAGS = new Set();

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
   Detects highest speed and aligns players automatically in rank order.
   Supports multiple character records per player, while keeping only the
   highest speed if the same character is submitted again. */
function alignAndSortPlayers(rawList) {
    if (!Array.isArray(rawList)) return [];

    const map = new Map();
    rawList.forEach(p => {
        if (!p || !p.tag) return;
        const tag = p.tag.trim();
        const tagUpper = tag.toUpperCase();
        if (!tagUpper) return;
        const speed = parseInt(p.speed, 10) || 0;
        if (speed <= 0) return;

        const char = (p.character || 'BLACK THUNDER NISHIKAWA').trim();
        const charUpper = char.toUpperCase();

        // Player identifier: UID if present, otherwise IGN
        const playerKey = (p.uid && p.uid.trim()) ? p.uid.trim().toUpperCase() : tagUpper;
        const compositeKey = `${playerKey}____${charUpper}`;

        const normalized = {
            ...p,
            tag,
            character: char,
            speed
        };

        if (!map.has(compositeKey)) {
            map.set(compositeKey, normalized);
        } else {
            const existing = map.get(compositeKey);
            // If duplicate exists for same player & same character, keep whichever has higher speed
            if (speed > existing.speed) {
                map.set(compositeKey, normalized);
            } else if (speed === existing.speed && p.updatedAt && (!existing.updatedAt || p.updatedAt > existing.updatedAt)) {
                map.set(compositeKey, normalized);
            }
        }
    });

    return Array.from(map.values())
        // Sort strictly descending: greater speeds first, smaller speeds below
        .sort((a, b) => {
            if (b.speed !== a.speed) {
                return b.speed - a.speed;
            }
            return (a.tag || '').localeCompare(b.tag || '');
        })
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

/* ── FIREBASE REALTIME DB SYNC ─────────────────────────────── */
function mergeWithLocalPlayers(remoteList, isCloud = false) {
    const map = new Map();

    const getCompositeKey = (p) => {
        const tagUpper = (p.tag || '').trim().toUpperCase();
        const playerKey = (p.uid && p.uid.trim()) ? p.uid.trim().toUpperCase() : tagUpper;
        const charUpper = (p.character || 'BLACK THUNDER NISHIKAWA').trim().toUpperCase();
        return `${playerKey}____${charUpper}`;
    };

    // 1. Always add all valid remote/cloud players first (they are ground truth)
    if (Array.isArray(remoteList)) {
        remoteList.forEach(p => {
            if (p && p.tag) {
                const speed = parseInt(p.speed, 10) || 0;
                if (speed > 0) {
                    const key = getCompositeKey(p);
                    map.set(key, { ...p, speed });
                }
            }
        });
    }

    // 2. If cloud data is authoritative, only add locals if they aren't in cloud yet
    try {
        const rawLocal = localStorage.getItem(STORAGE_KEY);
        if (rawLocal) {
            const parsed = JSON.parse(rawLocal);
            if (Array.isArray(parsed)) {
                parsed.forEach(p => {
                    if (p && p.tag) {
                        const speed = parseInt(p.speed, 10) || 0;
                        if (speed > 0) {
                            const key = getCompositeKey(p);
                            if (!map.has(key)) {
                                map.set(key, { ...p, speed });
                            }
                        }
                    }
                });
            }
        }
    } catch (e) {
        console.warn('mergeWithLocalPlayers notice:', e);
    }

    return Array.from(map.values());
}

function initFirebaseLeaderboard() {
    // Subscribe to real-time updates from Firebase Realtime Database
    // onValue fires immediately on load AND on every write from any device
    subscribeToCloudLeaderboard((cloudList, isCloud) => {
        if (Array.isArray(cloudList) && cloudList.length > 0) {
            // Cloud is authoritative — merge then display
            const merged = mergeWithLocalPlayers(cloudList, isCloud);
            allPlayers = alignAndSortPlayers(merged);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(allPlayers));
        } else {
            // Cloud is empty — show empty leaderboard (not local cache)
            allPlayers = [];
            localStorage.removeItem(STORAGE_KEY);
        }
        onPlayersUpdated();
    });
}

// Loads stored records immediately from localStorage so leaderboard is instantly ready on page refresh
function loadStoredPlayers() {
    try {
        const merged = mergeWithLocalPlayers([]);
        allPlayers = alignAndSortPlayers(merged);
        if (allPlayers.length > 0) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(allPlayers));
        }
        onPlayersUpdated();
    } catch (e) {
        console.warn('loadStoredPlayers notice:', e);
    }
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
const charRecordBadge      = document.getElementById('charRecordBadge');

/* ── MULTI-CHARACTER RECORD LOOKUP & STATUS HELPER ─────────── */
function getPlayerCharacterRecords(ign, uid) {
    const rawUser = getCurrentUser() || {};
    const ignUpper = (ign || rawUser.ign || '').trim().toUpperCase();
    const uidUpper = (uid || rawUser.uid || '').trim().toUpperCase();

    if (!ignUpper && !uidUpper) return [];

    return allPlayers.filter(p => {
        const pTag = (p.tag || '').trim().toUpperCase();
        const pUid = (p.uid || '').trim().toUpperCase();
        const matchTag = ignUpper && pTag === ignUpper;
        const matchUid = uidUpper && pUid && pUid === uidUpper;
        return matchTag || matchUid;
    });
}

function updateCharRecordStatus(selectedChar) {
    if (!charRecordBadge) return;
    const ign = recordIgnInput ? recordIgnInput.value.trim() : '';
    const uid = recordUidInput ? recordUidInput.value.trim() : '';
    const playerRecords = getPlayerCharacterRecords(ign, uid);

    if (!playerRecords.length && !ign) {
        charRecordBadge.style.display = 'none';
        return;
    }

    const currentChar = (selectedChar || recordCharInput?.value || 'BLACK THUNDER NISHIKAWA').trim();
    const charUpper = currentChar.toUpperCase();

    // Check if player has record for this selected character
    const match = playerRecords.find(p => (p.character || '').trim().toUpperCase() === charUpper);
    const others = playerRecords.filter(p => (p.character || '').trim().toUpperCase() !== charUpper);

    let otherHtml = '';
    if (others.length > 0) {
        otherHtml = `
            <div class="player-other-chars-list">
                <span style="opacity:0.85;">Your other character records:</span>
                ${others.map(o => `
                    <span class="char-mini-tag" data-char="${o.character}" title="Click to switch to ${o.character}">
                        🏐 ${o.character} · <strong>${o.speed} KM/H</strong>
                    </span>
                `).join('')}
            </div>
        `;
    }

    if (match) {
        charRecordBadge.className = 'char-record-badge has-record';
        charRecordBadge.innerHTML = `
            <div class="char-record-badge-header">
                <span>⚡</span>
                <span>Current Record for ${currentChar}: <strong>${match.speed} KM/H</strong> (Rank #${match.rank || '—'})</span>
            </div>
            <div class="char-record-badge-sub">
                ⚠️ <strong>Higher speed required:</strong> Entering a higher speed (&gt; ${match.speed} KM/H) will automatically replace this character's record.
            </div>
            ${otherHtml}
        `;
        charRecordBadge.style.display = 'block';
    } else {
        charRecordBadge.className = 'char-record-badge no-record';
        charRecordBadge.innerHTML = `
            <div class="char-record-badge-header">
                <span>✨</span>
                <span>New Character Entry for ${currentChar}</span>
            </div>
            <div class="char-record-badge-sub">
                💡 Submitting will add a new leaderboard entry! You can submit different characters freely.
            </div>
            ${otherHtml}
        `;
        charRecordBadge.style.display = 'block';
    }

    // Attach click listeners to mini-tags to quickly jump to that character
    charRecordBadge.querySelectorAll('.char-mini-tag').forEach(tagEl => {
        tagEl.addEventListener('click', () => {
            const targetChar = tagEl.dataset.char;
            if (recordCharInput && targetChar) {
                recordCharInput.value = targetChar;
                persistFormDraft();
                updateProfileAvatarPreview(targetChar, recordIgnInput?.value);
                updateCharRecordStatus(targetChar);
            }
        });
    });
}

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

// Auto-remember details in real-time as player types & update character badge
[recordIgnInput, recordUidInput, recordSpeedInput, recordSetupInput, recordCityInput, recordProofInput].forEach(inp => {
    inp?.addEventListener('input', () => {
        persistFormDraft();
        if (inp === recordIgnInput || inp === recordUidInput) {
            updateCharRecordStatus(recordCharInput?.value);
        }
    });
});
recordCharInput?.addEventListener('change', () => {
    persistFormDraft();
    updateProfileAvatarPreview(recordCharInput.value, recordIgnInput?.value);
    updateCharRecordStatus(recordCharInput.value);
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

// Sync Firebase Auth state changes — fetch full profile from RTDB for cross-device login
onAuthStateChanged(auth, async (fbUser) => {
    if (fbUser) {
        try {
            const current = getCurrentUser() || {};
            // Fetch profile from Realtime Database (cross-device sync)
            let cloudProfile = null;
            try {
                cloudProfile = await fetchUserProfile(fbUser.uid);
            } catch(e) {}

            const updated = {
                ...current,
                // Cloud profile wins for persistent fields
                ...(cloudProfile || {}),
                email: fbUser.email || current.email || '',
                ign: (cloudProfile?.ign) || current.ign || fbUser.displayName || (fbUser.email ? fbUser.email.split('@')[0] : 'Player'),
                firebaseUid: fbUser.uid,
                // Preserve speed from cloud if higher
                speed: Math.max(parseInt(cloudProfile?.speed,10)||0, parseInt(current.speed,10)||0) || 0
            };
            localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(updated));
            saveRememberedDetails(updated);
        } catch (e) { console.warn('Auth state sync error:', e); }
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
    const lookupUid = (activeUser?.uid || remembered.uid || '').toLowerCase();
    const chosenCharacter = activeUser?.character || remembered.character || 'BLACK THUNDER NISHIKAWA';

    // Find record matching player and character if possible, or any record by player
    if (lookupTag || lookupUid) {
        existing = allPlayers.find(p => {
            const matchTag = lookupTag && (p.tag || '').toLowerCase() === lookupTag;
            const matchUid = lookupUid && (p.uid || '').toLowerCase() === lookupUid;
            const matchChar = (p.character || '').trim().toLowerCase() === chosenCharacter.trim().toLowerCase();
            return (matchTag || matchUid) && matchChar;
        }) || allPlayers.find(p => {
            const matchTag = lookupTag && (p.tag || '').toLowerCase() === lookupTag;
            const matchUid = lookupUid && (p.uid || '').toLowerCase() === lookupUid;
            return matchTag || matchUid;
        });
    }

    // Prefill ALL details using priority: activeUser -> remembered -> existing -> defaults
    const chosenIgn       = activeUser?.ign || remembered.ign || existing?.tag || '';
    const chosenUid       = activeUser?.uid || remembered.uid || existing?.uid || '';
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
    // Set character: must set the select to the exact matching option value
    if (recordCharInput) {
        const exactMatch = Array.from(recordCharInput.options).some(o => o.value === chosenCharacter);
        recordCharInput.value = exactMatch ? chosenCharacter : 'BLACK THUNDER NISHIKAWA';
    }
    if (recordSpeedInput) recordSpeedInput.value = chosenSpeed;
    if (recordSetupInput) recordSetupInput.value = chosenSetup;
    if (recordStateInput) recordStateInput.value = chosenState;
    if (recordCityInput)  recordCityInput.value  = chosenCity;
    if (recordProofInput) recordProofInput.value = chosenProof;

    // Configure profile status banner
    if (statusStrip) {
        if (activeUser && activeUser.ign) {
            const myRecords = getPlayerCharacterRecords(chosenIgn, chosenUid);
            const pIdx = allPlayers.findIndex(p => p.tag.toLowerCase() === activeUser.ign.toLowerCase());
            const charCount = myRecords.length;
            const charPill = charCount > 1 
                ? `<span class="rank-pill" style="margin-left:6px;background:rgba(0,229,255,0.15);border:1px solid #00e5ff;color:#00e5ff;">🎮 ${charCount} Character Records</span>` 
                : '';
            const rankHtml = pIdx >= 0 
                ? `<span class="rank-pill">🏆 Leaderboard Best: #${pIdx + 1} (${allPlayers[pIdx].speed} KM/H)</span>${charPill}`
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
    updateCharRecordStatus(recordCharInput?.value);
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

/* ── NON-BLOCKING BACKGROUND FIREBASE CLOUD SYNC ──────────── */
async function syncRecordToFirebase(updatedUser, recordData, speed) {
    try {
        const tasks = [];
        // 1. Save player leaderboard record to RTDB (makes it visible on all devices)
        if (speed > 0) {
            tasks.push(savePlayerToCloud(recordData));
        }
        // 2. Save user profile to RTDB (cross-device login sync)
        if (updatedUser.firebaseUid) {
            tasks.push(saveUserProfile(updatedUser.firebaseUid, updatedUser));
        }
        await Promise.all(tasks);
        console.log('[RTDB] Cross-device sync complete.');
    } catch (err) {
        console.warn('[RTDB] Sync warning (local copy saved):', err);
    }
}

// Player record form submission
recordForm?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const rawUser   = getCurrentUser() || {};
    const ign       = (recordIgnInput ? recordIgnInput.value.trim() : (rawUser.ign || '')).trim();
    const uid       = (recordUidInput ? recordUidInput.value.trim() : (rawUser.uid || '')).trim();
    const speed     = parseInt(recordSpeedInput.value, 10) || 0;
    const character = recordCharInput.value;
    const setup     = recordSetupInput.value.trim() || 'Power 120 / Jump 120';
    const state     = recordStateInput.value.trim() || 'India';
    const city      = recordCityInput ? recordCityInput.value.trim() : '';
    const proof     = recordProofInput.value.trim();

    if (!ign || !uid) {
        alert('Please enter your Spike Cross In-Game Name (IGN) and UID.');
        return;
    }

    if (speed <= 0) {
        alert('Please enter a valid spike speed greater than 0 KM/H.');
        recordSpeedInput.focus();
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
        submitBtn.innerHTML = '<span>⏳</span> SAVING RECORD...';
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

    // Player identity identifiers
    const ignUpper   = ign.toUpperCase();
    const uidUpper   = uid.toUpperCase();
    const oldIgn     = rawUser.ign ? rawUser.ign.toUpperCase() : '';
    const oldUid     = rawUser.uid ? rawUser.uid.toUpperCase() : '';
    const charUpper  = (character || 'BLACK THUNDER NISHIKAWA').trim().toUpperCase();

    const isPlayerMatch = (p) => {
        if (!p) return false;
        const pTag = (p.tag || '').trim().toUpperCase();
        const pUid = (p.uid || '').trim().toUpperCase();
        const matchTag = ignUpper && pTag === ignUpper;
        const matchOldTag = oldIgn && pTag === oldIgn;
        const matchUid = uidUpper && pUid && pUid === uidUpper;
        const matchOldUid = oldUid && pUid && pUid === oldUid;
        return matchTag || matchOldTag || matchUid || matchOldUid;
    };

    // Find if player has an existing record with THIS SAME character
    const existingCharIdx = allPlayers.findIndex(p => 
        isPlayerMatch(p) && (p.character || '').trim().toUpperCase() === charUpper
    );
    const existingCharRecord = existingCharIdx >= 0 ? allPlayers[existingCharIdx] : null;

    // Check all other character records the player holds
    const otherCharRecords = allPlayers.filter(p => 
        isPlayerMatch(p) && (p.character || '').trim().toUpperCase() !== charUpper
    );

    let speedChangeNotice = '';
    if (existingCharRecord) {
        const oldSpeed = parseInt(existingCharRecord.speed, 10) || 0;
        if (speed <= oldSpeed) {
            // Player submitted same character with lower or equal speed -> Reject / warn
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<span>💾</span> SAVE PROFILE &amp; LEADERBOARD RECORD';
            }
            alert(`⚠️ Cannot replace record:\n\nYou already have a verified record of ${oldSpeed} KM/H for ${character}.\n\n` +
                  `• Same character: You can only submit a HIGHER speed (greater than ${oldSpeed} KM/H) to replace this record.\n` +
                  `• Different characters: You can select other characters from the dropdown (e.g. OASIS, JAEHYUN, HEESEONG) to add separate leaderboard entries!\n\n` +
                  `Please enter a speed greater than ${oldSpeed} KM/H, or select a different character.`);
            recordSpeedInput.focus();
            return;
        }

        // Higher speed with same character -> Replace the existing record!
        allPlayers[existingCharIdx] = recordData;
        speedChangeNotice = `⚡ RECORD REPLACED: ${character} speed improved from ${oldSpeed} KM/H to ${speed} KM/H (+${speed - oldSpeed} KM/H)!`;
    } else {
        // Different character! Add as new record entry
        allPlayers.push(recordData);
        if (otherCharRecords.length > 0) {
            speedChangeNotice = `🎉 NEW CHARACTER RECORD: Added ${character} (${speed} KM/H)! You now hold ${otherCharRecords.length + 1} character records.`;
        } else {
            speedChangeNotice = `🎉 First record placed for ${character} at ${speed} KM/H!`;
        }
    }

    // Compute player's personal best across all their characters
    const allMySpeeds = allPlayers
        .filter(p => isPlayerMatch(p))
        .map(p => parseInt(p.speed, 10) || 0);
    const personalBest = Math.max(...allMySpeeds, speed);

    const updatedUser = {
        ...rawUser,
        ign,
        uid,
        character,
        speed: personalBest,
        setup,
        state,
        region: state,
        city,
        proof,
        updatedAt: new Date().toISOString()
    };

    // 1. IMMEDIATE LOCAL PERSISTENCE: Saved instantly across all refreshes
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(updatedUser));
    saveRememberedDetails(updatedUser);

    // 2. POSITION RECORD IN LEADERBOARD & SORT
    allPlayers = alignAndSortPlayers(allPlayers);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allPlayers));
    onPlayersUpdated();

    // 3. Find the player's rank for THIS specific character record
    const newRank = allPlayers.findIndex(p => 
        isPlayerMatch(p) && (p.character || '').trim().toUpperCase() === charUpper
    ) + 1;
    const totalPlayers = allPlayers.length;

    // 4. Refresh UI and close modal
    checkUserSession();
    closeRecordModal();
    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span>💾</span> SAVE PROFILE &amp; LEADERBOARD RECORD';
    }

    // 5. Scroll to leaderboard & highlight the placed row
    const tableSection = document.getElementById('leaderboard-section');
    if (tableSection) {
        tableSection.scrollIntoView({ behavior: 'smooth' });
    }

    setTimeout(() => {
        const targetRow = document.querySelector(`#leaderboard-tbody tr:nth-child(${newRank})`);
        if (targetRow) {
            document.querySelectorAll('tr.row-just-placed').forEach(r => r.classList.remove('row-just-placed'));
            targetRow.classList.add('row-just-placed');
            targetRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => targetRow.classList.remove('row-just-placed'), 7000);
        }
    }, 150);

    // 6. Descriptive toast feedback showing their rank in the table
    let rankMessage = '';
    if (newRank === 1) {
        rankMessage = `👑 NEW #1 RECORD! <strong>${ign}</strong> (${character}) is India's Champion with <strong>${speed} KM/H</strong>!`;
    } else if (newRank <= 3) {
        rankMessage = `🏆 PODIUM FINISH! <strong>${ign}</strong> (${character}) claimed Rank <strong>#${newRank}</strong> with <strong>${speed} KM/H</strong>!`;
    } else {
        rankMessage = `🎉 Record placed at Rank <strong>#${newRank}</strong> of ${totalPlayers} with <strong>${speed} KM/H</strong> (${character})!`;
    }

    if (speedChangeNotice) {
        showToast(`${rankMessage}<div style="margin-top:4px;font-size:12px;opacity:0.9;">${speedChangeNotice}</div>`, 'success');
    } else {
        showToast(rankMessage, 'success');
    }

    // 7. Background sync to Firebase (non-blocking)
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
    }, 4500);
}

/* ── INIT & IMMEDIATE DATA LOAD ──────────────────────────── */
function initApp() {
    checkUserSession();
    // Firebase Realtime Database onValue fires immediately and overwrites local cache.
    // This is the single source of truth across all devices.
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
}

if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

