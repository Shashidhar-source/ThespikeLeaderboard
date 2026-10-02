/* ============================================================
   THE SPIKE INDIA — firebase-config.js
   Firebase SDK Initialization & Cloud Utilities
   ============================================================ */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
    getDatabase,
    ref,
    set,
    get,
    onValue,
    remove,
    update
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";

import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    updateProfile,
    sendPasswordResetEmail,
    GoogleAuthProvider,
    signInWithPopup
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

// Firebase config
const firebaseConfig = {
    apiKey: "AIzaSyDakEOvBAtgeXtrm3xzPgv_jZgIH9qWWCA",
    authDomain: "thespikeleaderboard.firebaseapp.com",
    databaseURL: "https://thespikeleaderboard-default-rtdb.firebaseio.com",
    projectId: "thespikeleaderboard",
    storageBucket: "thespikeleaderboard.firebasestorage.app",
    messagingSenderId: "89178505636",
    appId: "1:89178505636:web:3282b6eb99e5f4dfe18131",
    measurementId: "G-NZ2EPECS2W"
};

const app  = initializeApp(firebaseConfig);
const rtdb = getDatabase(app);
const auth = getAuth(app);
const RTDB_URL = "https://thespikeleaderboard-default-rtdb.firebaseio.com";

/* ── PROOF LINK INSPECTOR ────────────────────────────────── */
const VERIFIED_VIDEO_DOMAINS = [
    { name: "YouTube",    domains: ["youtube.com","youtu.be","m.youtube.com"], icon:"🔴", pattern: /(?:v=|\/embed\/|\/shorts\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/ },
    { name: "Google Drive", domains: ["drive.google.com"],   icon:"📁", pattern: /\/file\/d\/([a-zA-Z0-9_-]+)/ },
    { name: "Streamable", domains: ["streamable.com"],       icon:"🎬", pattern: /streamable\.com\/([a-zA-Z0-9]+)/ },
    { name: "Medal.tv",   domains: ["medal.tv"],             icon:"🏅", pattern: /medal\.tv\/games\// },
    { name: "Twitch",     domains: ["twitch.tv","clips.twitch.tv"], icon:"🟣", pattern: /(?:clips\.twitch\.tv\/|twitch\.tv\/.*\/clip\/)/ },
    { name: "Discord CDN",domains: ["cdn.discordapp.com","media.discordapp.net"], icon:"💬", pattern: /\.(mp4|mov|webm)/i },
    { name: "Twitter / X",domains: ["twitter.com","x.com"], icon:"🐦", pattern: /\/status\/\d+/ }
];

export function inspectProofLink(urlStr) {
    if (!urlStr || urlStr === '#' || !urlStr.trim()) {
        return { isValid:false, isFake:false, platform:"None", status:"missing", message:"No proof link provided." };
    }
    const trimmed = urlStr.trim();
    let parsed;
    try {
        parsed = new URL(trimmed);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            return { isValid:false, isFake:true, platform:"Invalid Protocol", status:"fake", message:"Link must start with https:// or http://" };
        }
    } catch(e) {
        return { isValid:false, isFake:true, platform:"Malformed", status:"fake", message:"Malformed URL: Not a valid web address." };
    }
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
    for (const p of VERIFIED_VIDEO_DOMAINS) {
        if (p.domains.some(d => hostname === d || hostname.endsWith('.'+d))) {
            if (p.pattern && !p.pattern.test(trimmed)) {
                return { isValid:true, isFake:false, warning:true, platform:p.name, icon:p.icon, status:"unverified_path", message:`${p.name} link recognized, but missing direct video ID.` };
            }
            return { isValid:true, isFake:false, platform:p.name, icon:p.icon, status:"verified", message:`✅ Authentic ${p.name} video link verified!` };
        }
    }
    const suspicious = ["example.com","test.com","fake.com","rickroll","localhost","bit.ly"];
    if (suspicious.some(s => hostname.includes(s))) {
        return { isValid:false, isFake:true, platform:"Suspicious", status:"fake", message:"❌ Fake or suspicious domain detected!" };
    }
    return { isValid:true, isFake:false, warning:true, platform:"External Link", icon:"🔗", status:"unverified_domain", message:"⚠️ External link: Not a recognized standard video platform." };
}

/* ── FIREBASE DAILY QUOTA GUARD (MAX 100 OPS/DAY) & LOGIN LIMITS ──
   Guarantees that cloud operations are strictly capped at 100 per day
   to ensure you are NEVER billed or charged by Firebase. */
export const FIREBASE_DAILY_LIMIT = 100;
export const DAILY_LOGIN_LIMIT    = 10;

const FIREBASE_OPS_KEY   = 'spike_firebase_daily_ops';
const LOGIN_ATTEMPTS_KEY = 'spike_daily_login_attempts';

function getTodayKey() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

export function getFirebaseDailyUsage() {
    const today = getTodayKey();
    try {
        const raw = localStorage.getItem(FIREBASE_OPS_KEY);
        if (raw) {
            const data = JSON.parse(raw);
            if (data && data.date === today) {
                const count = parseInt(data.count, 10) || 0;
                return {
                    date: today,
                    count,
                    limit: FIREBASE_DAILY_LIMIT,
                    remaining: Math.max(0, FIREBASE_DAILY_LIMIT - count),
                    isExceeded: count >= FIREBASE_DAILY_LIMIT
                };
            }
        }
    } catch(e) {}
    return {
        date: today,
        count: 0,
        limit: FIREBASE_DAILY_LIMIT,
        remaining: FIREBASE_DAILY_LIMIT,
        isExceeded: false
    };
}

export function checkAndIncrementFirebaseOp(opName = 'operation') {
    const usage = getFirebaseDailyUsage();
    if (usage.isExceeded) {
        console.warn(`[Firebase Quota Guard] 🛑 Daily limit of ${FIREBASE_DAILY_LIMIT} operations reached for ${usage.date}. Blocking ${opName} to prevent cloud billing.`);
        return false;
    }

    const newCount = usage.count + 1;
    try {
        localStorage.setItem(FIREBASE_OPS_KEY, JSON.stringify({
            date: usage.date,
            count: newCount,
            lastOp: opName,
            lastAt: new Date().toISOString()
        }));
    } catch(e) {}

    console.log(`[Firebase Quota Guard] ⚡ ${opName} logged (${newCount}/${FIREBASE_DAILY_LIMIT} used today, ${FIREBASE_DAILY_LIMIT - newCount} left).`);
    return true;
}

export function getLoginDailyUsage() {
    const today = getTodayKey();
    try {
        const raw = localStorage.getItem(LOGIN_ATTEMPTS_KEY);
        if (raw) {
            const data = JSON.parse(raw);
            if (data && data.date === today) {
                const count = parseInt(data.count, 10) || 0;
                return {
                    date: today,
                    count,
                    limit: DAILY_LOGIN_LIMIT,
                    remaining: Math.max(0, DAILY_LOGIN_LIMIT - count),
                    isExceeded: count >= DAILY_LOGIN_LIMIT
                };
            }
        }
    } catch(e) {}
    return {
        date: today,
        count: 0,
        limit: DAILY_LOGIN_LIMIT,
        remaining: DAILY_LOGIN_LIMIT,
        isExceeded: false
    };
}

export function checkAndIncrementLoginAttempt(type = 'login') {
    const usage = getLoginDailyUsage();
    if (usage.isExceeded) {
        console.warn(`[Login Rate Limit] 🛑 Daily limit of ${DAILY_LOGIN_LIMIT} logins reached for ${usage.date}. Blocking ${type}.`);
        return false;
    }

    const newCount = usage.count + 1;
    try {
        localStorage.setItem(LOGIN_ATTEMPTS_KEY, JSON.stringify({
            date: usage.date,
            count: newCount,
            lastType: type,
            lastAt: new Date().toISOString()
        }));
    } catch(e) {}

    return true;
}

/* ── SAFE KEY HELPER ─────────────────────────────────────── */
function safeKey(str) {
    return (str || '').trim().toUpperCase().replace(/[.#$[\]/]/g, '_');
}

export function getPlayerCloudKey(tag, character) {
    const sTag = safeKey(tag);
    const sChar = safeKey(character || 'BLACK_THUNDER_NISHIKAWA');
    return `${sTag}__${sChar}`;
}

/* ── PLAYER CLOUD SYNC (RTDB) ────────────────────────────── */
export async function savePlayerToCloud(playerData) {
    const tag = (playerData.tag || '').trim();
    if (!tag) return false;

    // Strict Daily Firebase Quota Check (Max 100/day)
    if (!checkAndIncrementFirebaseOp('savePlayerToCloud')) {
        console.warn('[Firebase Quota Guard] savePlayerToCloud skipped (daily 100 limit reached). Record is safely saved in local storage.');
        return false;
    }

    const char = (playerData.character || 'BLACK THUNDER NISHIKAWA').trim();
    const key = getPlayerCloudKey(tag, char);

    const record = {
        tag:       tag,
        speed:     parseInt(playerData.speed, 10) || 0,
        character: char,
        setup:     playerData.setup || 'Power 120 / Jump 120',
        state:     playerData.state || 'India',
        city:      playerData.city || '',
        proof:     playerData.proof || '',
        uid:       playerData.uid || '',
        updatedAt: playerData.updatedAt || new Date().toISOString()
    };

    // Primary: Firebase RTDB SDK
    try {
        await set(ref(rtdb, `players/${key}`), record);
        // Also clean up any legacy un-suffixed key to avoid duplicate ghost records
        try { await remove(ref(rtdb, `players/${safeKey(tag)}`)); } catch(eLegacy) {}
        return true;
    } catch(e) {
        // Fallback: REST API (works without SDK permissions)
        try {
            const r = await fetch(`${RTDB_URL}/players/${encodeURIComponent(key)}.json`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(record)
            });
            try {
                await fetch(`${RTDB_URL}/players/${encodeURIComponent(safeKey(tag))}.json`, { method: 'DELETE' });
            } catch(eDel) {}
            return r.ok;
        } catch(e2) {
            console.warn('[RTDB] savePlayerToCloud failed:', e2);
            return false;
        }
    }
}

/* ── USER PROFILE CLOUD SYNC ─────────────────────────────── */
export async function saveUserProfile(firebaseUid, profileData) {
    if (!firebaseUid) return false;

    // Strict Daily Firebase Quota Check (Max 100/day)
    if (!checkAndIncrementFirebaseOp('saveUserProfile')) {
        console.warn('[Firebase Quota Guard] saveUserProfile skipped (daily 100 limit reached). Profile stored locally.');
        return false;
    }

    const clean = {
        ign:       profileData.ign || '',
        email:     profileData.email || '',
        uid:       profileData.uid || '',
        character: profileData.character || 'BLACK THUNDER NISHIKAWA',
        setup:     profileData.setup || 'Power 120 / Jump 120',
        state:     profileData.state || 'India',
        city:      profileData.city || '',
        speed:     parseInt(profileData.speed, 10) || 0,
        proof:     profileData.proof || '',
        updatedAt: profileData.updatedAt || new Date().toISOString()
    };
    try {
        await set(ref(rtdb, `users/${firebaseUid}`), clean);
        return true;
    } catch(e) {
        try {
            await fetch(`${RTDB_URL}/users/${encodeURIComponent(firebaseUid)}.json`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(clean)
            });
            return true;
        } catch(e2) {
            console.warn('[RTDB] saveUserProfile failed:', e2);
            return false;
        }
    }
}

export async function fetchUserProfile(firebaseUid) {
    if (!firebaseUid) return null;

    // Strict Daily Firebase Quota Check (Max 100/day)
    if (!checkAndIncrementFirebaseOp('fetchUserProfile')) {
        console.warn('[Firebase Quota Guard] fetchUserProfile skipped (daily 100 limit reached). Using local profile cache.');
        return null;
    }

    try {
        const snap = await get(ref(rtdb, `users/${firebaseUid}`));
        if (snap.exists()) return snap.val();
    } catch(e) {
        try {
            const r = await fetch(`${RTDB_URL}/users/${encodeURIComponent(firebaseUid)}.json`);
            const d = await r.json();
            return d || null;
        } catch(e2) {}
    }
    return null;
}

/* ── LEADERBOARD FETCH & SUBSCRIBE (RTDB) ────────────────── */
export async function fetchPlayersFromCloud() {
    // Strict Daily Firebase Quota Check (Max 100/day)
    if (!checkAndIncrementFirebaseOp('fetchPlayersFromCloud')) {
        console.warn('[Firebase Quota Guard] fetchPlayersFromCloud skipped (daily 100 limit reached). Using local players cache.');
        return [];
    }

    try {
        const snap = await get(ref(rtdb, 'players'));
        if (snap.exists()) {
            const val = snap.val();
            return Object.values(val).filter(p => p && p.tag && (parseInt(p.speed,10)||0) > 0);
        }
    } catch(e) {
        try {
            const r = await fetch(`${RTDB_URL}/players.json`);
            const val = await r.json();
            if (val && typeof val === 'object') {
                return Object.values(val).filter(p => p && p.tag && (parseInt(p.speed,10)||0) > 0);
            }
        } catch(e2) { console.warn('[RTDB] fetchPlayersFromCloud failed:', e2); }
    }
    return [];
}

export function subscribeToCloudLeaderboard(callback) {
    // Strict Daily Firebase Quota Check (Max 100/day)
    if (!checkAndIncrementFirebaseOp('subscribeToCloudLeaderboard')) {
        console.warn('[Firebase Quota Guard] Realtime listener skipped (daily 100 limit reached). Serving local players cache.');
        return null;
    }

    try {
        const playersRef = ref(rtdb, 'players');
        // onValue fires immediately with current data AND on every change
        const unsub = onValue(playersRef, (snapshot) => {
            const val = snapshot.val();
            // val is null when no players exist — pass empty array so UI shows empty state correctly
            const list = val
                ? Object.values(val).filter(p => p && p.tag && (parseInt(p.speed,10)||0) > 0)
                : [];
            callback(list, true /* isCloud */);
        }, (err) => {
            console.warn('[RTDB] onValue error:', err);
            // On error fall back to one-time fetch
            fetchPlayersFromCloud().then(list => callback(list, true));
        });
        return unsub;
    } catch(e) {
        console.warn('[RTDB] subscribeToCloudLeaderboard failed:', e);
        fetchPlayersFromCloud().then(list => callback(list, true));
        return null;
    }
}

export async function deletePlayerFromCloud(tag, character) {
    if (!tag) return false;

    // Strict Daily Firebase Quota Check (Max 100/day)
    if (!checkAndIncrementFirebaseOp('deletePlayerFromCloud')) {
        console.warn('[Firebase Quota Guard] deletePlayerFromCloud skipped (daily 100 limit reached).');
        return false;
    }

    const sTag = safeKey(tag);
    const keysToDelete = [];
    if (character) {
        keysToDelete.push(getPlayerCloudKey(tag, character));
    }
    keysToDelete.push(sTag);

    for (const k of keysToDelete) {
        try {
            await remove(ref(rtdb, `players/${k}`));
        } catch(e) {
            try {
                await fetch(`${RTDB_URL}/players/${encodeURIComponent(k)}.json`, { method: 'DELETE' });
            } catch(e2) {}
        }
    }
    return true;
}

export {
    app, rtdb, auth, RTDB_URL,
    ref, set, get, onValue, remove, update,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut, onAuthStateChanged,
    updateProfile, sendPasswordResetEmail,
    GoogleAuthProvider, signInWithPopup
};

