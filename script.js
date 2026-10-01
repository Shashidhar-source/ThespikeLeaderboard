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
    getDocs, 
    onSnapshot, 
    query, 
    orderBy, 
    inspectProofLink 
} from "./firebase-config.js";


const SPEED_SCALE_MAX = 220; // Gauge full-scale reference (0 to 220 km/h)
const STORAGE_KEY     = 'spike-india-players';
const CURRENT_USER_KEY= 'spike-current-user';

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

// ── DEFAULT PLAYER ROSTER (Fallback & Cloud Seed) ───────────
const DEFAULT_PLAYERS = [
  { tag:"SPIKE_MASTER10",    speed:198, character:"BLACK THUNDER NISHIKAWA",              setup:"Power 120 / Jump 120", state:"Karnataka",      city:"Bagalkot",    proof:"https://youtube.com/shorts/sample1" },
  { tag:"IND_VolleyKing",    speed:195, character:"NISHIKAWA",                            setup:"Power 120 / Jump 115", state:"Tamil Nadu",     city:"Chennai",     proof:"https://youtube.com/shorts/sample2" },
  { tag:"ThunderAce",        speed:193, character:"HEESEONG",                             setup:"Power 120 / Jump 120", state:"Maharashtra",    city:"Mumbai",      proof:"https://youtube.com/shorts/sample3" },
  { tag:"TheSpikeIndiaYT",   speed:191, character:"JAEHYUN",                              setup:"Power 120 / Jump 120", state:"Karnataka",      city:"Bengaluru",   proof:"https://youtube.com/shorts/sample4" },
  { tag:"AeroSpiker",        speed:189, character:"YOUNGSUP",                             setup:"Power 120 / Jump 118", state:"Uttar Pradesh",  city:"Lucknow",     proof:"https://youtube.com/shorts/sample5" },
  { tag:"RedZone",           speed:188, character:"RAUL",                                 setup:"Power 118 / Jump 120", state:"Delhi",          city:"New Delhi",   proof:"https://youtube.com/shorts/sample6" },
  { tag:"VolleyballGod",     speed:186, character:"LUCAS",                                setup:"Power 120 / Jump 115", state:"Maharashtra",    city:"Pune",        proof:"https://youtube.com/shorts/sample7" },
  { tag:"CrossAce",          speed:185, character:"DAVE",                                 setup:"Power 118 / Jump 118", state:"Telangana",      city:"Hyderabad",   proof:"https://youtube.com/shorts/sample8" },
  { tag:"SkySpike",          speed:183, character:"RYUHYEON",                             setup:"Power 118 / Jump 118", state:"Gujarat",        city:"Ahmedabad",   proof:"https://youtube.com/shorts/sample9" },
  { tag:"BlazeX",            speed:182, character:"JENNY",                                setup:"Power 118 / Jump 116", state:"Rajasthan",      city:"Jaipur",      proof:"https://youtube.com/shorts/sample10" },
  { tag:"AceIndia",          speed:181, character:"SARA",                                 setup:"Power 116 / Jump 118", state:"West Bengal",    city:"Kolkata",     proof:"https://youtube.com/shorts/sample11" },
  { tag:"ShadowSpike",       speed:180, character:"NISHIKAWA HS OR NISHIKAWA HIGH SCHOOL",setup:"Power 118 / Jump 115", state:"Madhya Pradesh", city:"Indore",      proof:"https://youtube.com/shorts/sample12" },
  { tag:"ZenitsuPlayz",      speed:178, character:"BLACK THUNDER NISHIKAWA",              setup:"Power 116 / Jump 118", state:"Kerala",         city:"Kochi",       proof:"#" },
  { tag:"RoyalSpiker",       speed:176, character:"NISHIKAWA",                            setup:"Power 115 / Jump 116", state:"Punjab",         city:"Chandigarh",  proof:"#" },
  { tag:"SpikeStorm",        speed:175, character:"HEESEONG",                             setup:"Power 116 / Jump 116", state:"Bihar",          city:"Patna",       proof:"#" },
  { tag:"VoltSpiker",        speed:174, character:"JAEHYUN",                              setup:"Power 114 / Jump 115", state:"Assam",          city:"Guwahati",    proof:"#" },
  { tag:"InfinityJump",      speed:172, character:"YOUNGSUP",                             setup:"Power 114 / Jump 115", state:"Odisha",         city:"Bhubaneswar", proof:"#" },
  { tag:"DarkAce",           speed:171, character:"RAUL",                                 setup:"Power 115 / Jump 114", state:"Jharkhand",      city:"Ranchi",      proof:"#" },
  { tag:"HyperSpike",        speed:170, character:"LUCAS",                                setup:"Power 114 / Jump 114", state:"Chhattisgarh",   city:"Raipur",      proof:"#" },
  { tag:"NextGenSpike",      speed:168, character:"DAVE",                                 setup:"Power 112 / Jump 115", state:"Haryana",        city:"Gurugram",    proof:"#" },
];

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

    const ratio         = Math.min(Math.max(topSpeed / SPEED_SCALE_MAX, 0), 1);
    const targetAngle   = -90 + (ratio * 180);   // range: -90° (0 km/h) → +90° (220 km/h)
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
        const target = counts[i] ?? parseInt(el.dataset.count);
        el.dataset.count = target;
        const t0 = performance.now();
        function up(now) {
            const p = Math.min((now - t0) / 1500, 1);
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
        { id: 'podium2', player: top3[1] || null },  // Left   — Rank 2 RUNNER UP (Silver)
        { id: 'podium1', player: top3[0] || null },  // Center — Rank 1 CHAMPION (Gold)
        { id: 'podium3', player: top3[2] || null },  // Right  — Rank 3 (Bronze)
    ].forEach(({ id, player }) => {
        const el = document.getElementById(id);
        if (!el) return;
        if (!player) { el.innerHTML = ''; return; }

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
            <div class="podium-state">📍 ${player.state}, ${player.city}</div>
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
    if (!list.length) {
        tbody.innerHTML = '';
        noRes.style.display = 'block';
        return;
    }
    noRes.style.display = 'none';

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
                    <div class="location-city">${p.city}</div>
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
        .filter(p => p && p.tag)
        .map(p => ({
            ...p,
            speed: parseInt(p.speed) || 0
        }))
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
async function initFirebaseLeaderboard() {
    try {
        const q = query(collection(db, "players"), orderBy("speed", "desc"));

        // Real-time updates from Firestore
        onSnapshot(q, (snapshot) => {
            if (!snapshot.empty) {
                const cloudList = [];
                snapshot.forEach(docSnap => {
                    cloudList.push(docSnap.data());
                });

                allPlayers = alignAndSortPlayers(cloudList);
                localStorage.setItem(STORAGE_KEY, JSON.stringify(allPlayers));
                onPlayersUpdated();
            } else {
                // First run: seed Firestore with default player roster
                seedDefaultPlayersToFirebase();
            }
        }, (error) => {
            console.warn("Firestore onSnapshot note (using local cache):", error);
            loadLocalFallback();
        });
    } catch (err) {
        console.warn("Firebase initialization note:", err);
        loadLocalFallback();
    }
}

async function seedDefaultPlayersToFirebase() {
    console.log("Seeding initial players to Firebase Firestore...");
    allPlayers = alignAndSortPlayers(DEFAULT_PLAYERS);
    onPlayersUpdated();

    for (const p of DEFAULT_PLAYERS) {
        try {
            await setDoc(doc(db, "players", p.tag.toUpperCase()), {
                ...p,
                updatedAt: new Date().toISOString()
            });
        } catch (e) {}
    }
}

function loadLocalFallback() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length) {
                allPlayers = alignAndSortPlayers(parsed);
                onPlayersUpdated();
                return;
            }
        }
    } catch (e) {}
    allPlayers = alignAndSortPlayers(DEFAULT_PLAYERS);
    onPlayersUpdated();
}

function onPlayersUpdated() {
    const top = allPlayers[0]?.speed || 198;
    animateGauge(top);
    animateCounters(allPlayers);
    populateFilters(allPlayers);
    updateAll();
}

/* ── USER SESSION & SUBMISSION OPTION ──────────────────────── */
const recordModal      = document.getElementById('playerRecordModal');
const recordForm       = document.getElementById('recordSubmitForm');
const modalLoggedUser  = document.getElementById('modalLoggedUser');
const recordIgnInput   = document.getElementById('recordIgn');
const recordUidInput   = document.getElementById('recordUid');
const recordSpeedInput = document.getElementById('recordSpeed');
const recordCharInput  = document.getElementById('recordCharacter');
const recordSetupInput = document.getElementById('recordSetup');
const recordStateInput = document.getElementById('recordState');
const recordCityInput  = document.getElementById('recordCity');
const recordProofInput = document.getElementById('recordProof');
const inspectFeedback  = document.getElementById('proofInspectStatus');
const profileAvatarPreview = document.getElementById('profileAvatarPreview');
const profileAvatarName    = document.getElementById('profileAvatarName');
const profileAvatarStatus  = document.getElementById('profileAvatarStatus');

function updateProfileAvatarPreview(charName, ign) {
    if (!profileAvatarPreview) return;
    const info = resolveCharacterImageInfo(charName, ign);
    if (profileAvatarName) profileAvatarName.textContent = info.name || 'Character Avatar';
    if (info.pngSrc) {
        profileAvatarPreview.innerHTML = `<img src="${info.pngSrc}" alt="${info.name}" style="width:100%;height:100%;object-fit:contain;" onerror="this.onerror=null;this.parentElement.innerHTML='<span>🏐</span>'">`;
        if (profileAvatarStatus) profileAvatarStatus.textContent = 'Background-removed character image ready';
    } else {
        profileAvatarPreview.innerHTML = '<span>🏐</span>';
        if (profileAvatarStatus) profileAvatarStatus.textContent = 'Default avatar';
    }
}

recordCharInput?.addEventListener('change', () => {
    updateProfileAvatarPreview(recordCharInput.value, recordIgnInput?.value);
});

function handleProfileOrSubmitClick() {
    const raw = localStorage.getItem(CURRENT_USER_KEY);
    if (raw) {
        try {
            const user = JSON.parse(raw);
            openRecordSubmissionModal(user);
            return;
        } catch (e) {}
    }
    openRecordSubmissionModal(null);
}

// Hook up all Profile and Submit buttons across page
document.getElementById('heroProfileBtn')?.addEventListener('click', handleProfileOrSubmitClick);
document.getElementById('filterBarSubmitBtn')?.addEventListener('click', handleProfileOrSubmitClick);
document.getElementById('floatingProfileBtn')?.addEventListener('click', handleProfileOrSubmitClick);

function checkUserSession() {
    try {
        const raw = localStorage.getItem(CURRENT_USER_KEY);
        const navSlot = document.getElementById('userNavSlot');
        const heroBtnText = document.getElementById('heroBtnText');
        const filterBtn = document.getElementById('filterBarSubmitBtn');
        const floatingBtn = document.getElementById('floatingProfileBtn');

        if (raw) {
            const user = JSON.parse(raw);
            if (navSlot) {
                navSlot.innerHTML = `
                    <div class="user-session-bar">
                        <div class="logged-in-badge" title="UID: ${user.uid || 'N/A'}">
                            <span class="user-ball">🏐</span>
                            <span class="user-ign">${user.ign || 'Player'}</span>
                        </div>
                        <button class="record-nav-btn" id="openRecordModalNavBtn">
                            👤 My Profile &amp; Submit
                        </button>
                        <button class="logout-btn" id="logoutBtn" title="Log out">✕</button>
                    </div>
                `;
            }

            if (heroBtnText) {
                heroBtnText.textContent = `👤 MY PROFILE (${user.ign}) & SUBMIT RECORD`;
            }
            if (filterBtn) {
                filterBtn.innerHTML = `<span>⚡</span> My Profile &amp; Record (${user.ign})`;
            }
            if (floatingBtn) {
                floatingBtn.innerHTML = `<span class="btn-fire">⚡</span><span class="btn-text">👤 ${user.ign} · PROFILE</span>`;
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

// Sync Firebase Auth state changes
onAuthStateChanged(auth, (user) => {
    if (!user) {
        const raw = localStorage.getItem(CURRENT_USER_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed.firebaseUid && !parsed.isDemo) {
                localStorage.removeItem(CURRENT_USER_KEY);
                checkUserSession();
            }
        }
    } else {
        checkUserSession();
    }
});

function openRecordSubmissionModal(user = null) {
    if (!recordModal) return;

    const raw = localStorage.getItem(CURRENT_USER_KEY);
    const activeUser = user || (raw ? JSON.parse(raw) : null);
    const statusStrip = document.getElementById('profileStatusStrip');

    if (modalLoggedUser) {
        modalLoggedUser.textContent = activeUser ? (activeUser.ign || 'Player') : 'Guest Player';
    }

    // Prefill existing player record if available from leaderboard list
    let existing = null;
    if (activeUser && activeUser.ign) {
        existing = allPlayers.find(p => p.tag.toLowerCase() === activeUser.ign.toLowerCase());
    }

    if (recordIgnInput)   recordIgnInput.value   = activeUser ? (activeUser.ign || '') : '';
    if (recordUidInput)   recordUidInput.value   = activeUser ? (activeUser.uid || '') : (existing ? existing.uid : '');
    if (recordCharInput)  recordCharInput.value  = existing ? existing.character : (activeUser?.character || 'BLACK THUNDER NISHIKAWA');
    if (recordSpeedInput) recordSpeedInput.value = existing ? existing.speed : (activeUser?.speed || '');
    if (recordSetupInput) recordSetupInput.value = existing ? existing.setup : (activeUser?.setup || 'Power 120 / Jump 120');
    if (recordStateInput) recordStateInput.value = existing ? existing.state : (activeUser?.state || activeUser?.region || '');
    if (recordCityInput)  recordCityInput.value  = existing ? existing.city : (activeUser?.city || '');
    if (recordProofInput) recordProofInput.value = existing && existing.proof !== '#' ? existing.proof : (activeUser?.proof && activeUser.proof !== '#' ? activeUser.proof : '');

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

// Player record form submission
recordForm?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const rawUser = localStorage.getItem(CURRENT_USER_KEY);
    let user = rawUser ? JSON.parse(rawUser) : null;

    const ign       = recordIgnInput ? recordIgnInput.value.trim() : (user ? user.ign : '');
    const uid       = recordUidInput ? recordUidInput.value.trim() : (user ? user.uid : '');
    const speed     = parseInt(recordSpeedInput.value) || 0;
    const character = recordCharInput.value;
    const setup     = recordSetupInput.value.trim() || 'Power 120 / Jump 120';
    const state     = recordStateInput.value.trim() || 'India';
    const city      = recordCityInput.value.trim() || 'India';
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
    if (submitBtn) submitBtn.disabled = true;

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
        ...(user || {}),
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

    // 1. Save to Firebase Firestore
    try {
        const userDocId = (user && user.firebaseUid) ? user.firebaseUid : ign.toLowerCase();
        await setDoc(doc(db, "users", userDocId), updatedUser, { merge: true });
        await setDoc(doc(db, "users_by_ign", ign.toLowerCase()), {
            email: (user && user.email) ? user.email : '',
            ign,
            uid,
            firebaseUid: (user && user.firebaseUid) ? user.firebaseUid : ''
        }, { merge: true });

        // If player has speed record, push to "players" leaderboard collection
        if (speed > 0) {
            await setDoc(doc(db, "players", ign.toUpperCase()), recordData);
        }
    } catch (fbErr) {
        console.warn('Firebase profile save note (fallback active):', fbErr);
    }

    // 2. Update local state & immediately align list
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(updatedUser));

    if (speed > 0) {
        const oldIgn = user ? (user.ign || '').toUpperCase() : '';
        const existingIdx = allPlayers.findIndex(p => p.tag.toUpperCase() === ign.toUpperCase() || (oldIgn && p.tag.toUpperCase() === oldIgn));
        if (existingIdx >= 0) {
            allPlayers[existingIdx] = recordData;
        } else {
            allPlayers.push(recordData);
        }

        allPlayers = alignAndSortPlayers(allPlayers);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(allPlayers));
        onPlayersUpdated();
    }

    checkUserSession();
    closeRecordModal();
    if (submitBtn) submitBtn.disabled = false;

    const newRank = allPlayers.findIndex(p => p.tag.toUpperCase() === ign.toUpperCase()) + 1;
    if (speed > 0 && newRank > 0) {
        showToast(`🎉 Profile & Record saved! ${ign} is ranked #${newRank} with ${speed} KM/H!`, 'success');
        document.getElementById('leaderboard-section')?.scrollIntoView({ behavior: 'smooth' });
    } else {
        showToast(`🎉 Spike Cross profile details updated successfully!`, 'success');
    }
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

