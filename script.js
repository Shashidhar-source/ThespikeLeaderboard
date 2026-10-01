/* ============================================================
   THE SPIKE INDIA — script.js
   ============================================================ */

const SPEED_SCALE_MAX = 220; // Gauge full-scale reference (0 to 220 km/h)
const STORAGE_KEY     = 'spike-india-players';

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

// ── DEFAULT PLAYER DATA (Using the 12 character images) ─────
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

/* ── CHARACTER & PLAYER IMAGE RESOLVER ────────────────────────
   Matches exact character name to transparent PNG in images/ folder.
   If background-removed PNG exists, uses it! Fallback to JPG or Monogram badge. */
function resolveCharacterImageInfo(charName, playerName) {
    const normChar   = (charName || '').trim().toUpperCase();
    const normPlayer = (playerName || '').trim();

    // 1. Direct match with available character files
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

/* ── LOAD PLAYERS from localStorage (admin edits) or defaults ── */
function loadPlayers() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length) {
                // If old players from previous session exist with non-matching characters, update them
                return parsed
                    .sort((a, b) => b.speed - a.speed)
                    .map((p, i) => ({ ...p, rank: i + 1 }));
            }
        }
    } catch (e) {}
    return DEFAULT_PLAYERS.map((p, i) => ({ ...p, rank: i + 1 }));
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

let pts = Array.from({ length: 80 }, mkParticle);

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

/* ── EASING FUNCTION ───────────────────────────────────────── */
function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

/* ── SPEEDOMETER: Driven by the actual #1 highest speed ─────── */
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

/* ── PODIUM (Top 3 with Gold #1 Center & Runner-Up #2 Highlight) ── */
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

/* ── TABLE ───────────────────────────────────────────────── */
function rankCell(r) {
    if (r === 1) return `<div class="rank-cell rank-1-cell" title="India #1 Champion">1</div>`;
    if (r === 2) return `<div class="rank-cell rank-2-cell" title="India #2 Runner-Up">2</div>`;
    if (r === 3) return `<div class="rank-cell rank-3-cell" title="India #3 Bronze">3</div>`;
    return `<div class="rank-default">#${r}</div>`;
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
            <td><a class="proof-btn" href="${p.proof || '#'}" target="_blank">▶ WATCH</a></td>
        </tr>
    `).join('');
}

/* ── USER SESSION IN NAVBAR ───────────────────────────────── */
function checkUserSession() {
    try {
        const raw = localStorage.getItem('spike-current-user');
        const navSlot = document.getElementById('userNavSlot');
        if (!navSlot) return;

        if (raw) {
            const user = JSON.parse(raw);
            navSlot.innerHTML = `
                <div class="logged-in-badge">
                    <span class="user-ball">🏐</span>
                    <span class="user-ign">${user.ign}</span>
                    <button class="logout-btn" id="logoutBtn" title="Log out">✕</button>
                </div>
            `;
            document.getElementById('logoutBtn')?.addEventListener('click', () => {
                localStorage.removeItem('spike-current-user');
                checkUserSession();
            });
        } else {
            navSlot.innerHTML = `<a href="login.html" class="nav-login-btn">Login</a>`;
        }
    } catch (e) {}
}

/* ── FILTER & SEARCH STATE ────────────────────────────────── */
let allPlayers   = [];
let srch = '', fChar = '', fState = '';

function filtered() {
    return allPlayers.filter(p =>
        (!srch   || (p.tag && p.tag.toLowerCase().includes(srch.toLowerCase()))) &&
        (!fChar  || (p.character && p.character.toLowerCase().includes(fChar.toLowerCase()))) &&
        (!fState || (p.state && p.state.toLowerCase() === fState.toLowerCase()))
    );
}

function updateAll() {
    const f = filtered();
    renderPodium(f);
    renderTable(f);
}

document.getElementById('searchInput')?.addEventListener('input',  e => { srch   = e.target.value; updateAll(); });
document.getElementById('charFilter')?.addEventListener('change',  e => { fChar  = e.target.value; updateAll(); });
document.getElementById('stateFilter')?.addEventListener('change', e => { fState = e.target.value; updateAll(); });

/* ── INIT ────────────────────────────────────────────────── */
window.addEventListener('DOMContentLoaded', () => {
    allPlayers = loadPlayers();
    const top  = allPlayers[0]?.speed || 198;
    animateGauge(top);
    animateCounters(allPlayers);
    populateFilters(allPlayers);
    updateAll();
    checkUserSession();
});
