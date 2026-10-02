/* ============================================================
   THE SPIKE INDIA — firebase-config.js
   Firebase SDK Initialization & Utilities
   ============================================================ */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    doc, 
    setDoc, 
    getDoc, 
    getDocs, 
    onSnapshot, 
    query, 
    orderBy, 
    updateDoc, 
    deleteDoc,
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

import {
    getDatabase,
    ref,
    set,
    get,
    child,
    onValue,
    remove
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

// Your Firebase web configuration
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

// Initialize Firebase
const app  = initializeApp(firebaseConfig);
const db   = getFirestore(app);
const rtdb = getDatabase(app);
const auth = getAuth(app);
const RTDB_URL = "https://thespikeleaderboard-default-rtdb.firebaseio.com";


/* ── PROOF LINK INSPECTOR & FAKE DETECTOR ──────────────────────
   Inspects submitted proof links to verify whether they point to
   legitimate, authentic video hosting platforms or are fake/broken. */
const VERIFIED_VIDEO_DOMAINS = [
    { name: "YouTube", domains: ["youtube.com", "youtu.be", "m.youtube.com"], icon: "🔴", pattern: /(?:v=|\/embed\/|\/shorts\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/ },
    { name: "Google Drive", domains: ["drive.google.com"], icon: "📁", pattern: /\/file\/d\/([a-zA-Z0-9_-]+)/ },
    { name: "Streamable", domains: ["streamable.com"], icon: "🎬", pattern: /streamable\.com\/([a-zA-Z0-9]+)/ },
    { name: "Medal.tv", domains: ["medal.tv"], icon: "🏅", pattern: /medal\.tv\/games\// },
    { name: "Twitch", domains: ["twitch.tv", "clips.twitch.tv"], icon: "🟣", pattern: /(?:clips\.twitch\.tv\/|twitch\.tv\/.*\/clip\/)/ },
    { name: "Discord CDN", domains: ["cdn.discordapp.com", "media.discordapp.net"], icon: "💬", pattern: /\.(mp4|mov|webm)/i },
    { name: "Twitter / X", domains: ["twitter.com", "x.com"], icon: "🐦", pattern: /\/status\/\d+/ }
];

export function inspectProofLink(urlStr) {
    if (!urlStr || urlStr === '#' || urlStr.trim() === '') {
        return {
            isValid: false,
            isFake: false,
            platform: "None",
            status: "missing",
            message: "No proof link provided."
        };
    }

    const trimmed = urlStr.trim();

    // Check URL validity
    let parsed;
    try {
        parsed = new URL(trimmed);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            return {
                isValid: false,
                isFake: true,
                platform: "Invalid Protocol",
                status: "fake",
                message: "Link must start with https:// or http://"
            };
        }
    } catch (e) {
        return {
            isValid: false,
            isFake: true,
            platform: "Malformed",
            status: "fake",
            message: "Malformed URL: Not a valid web address."
        };
    }

    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');

    // Check if domain belongs to recognized video platforms
    for (const p of VERIFIED_VIDEO_DOMAINS) {
        const matchesDomain = p.domains.some(d => hostname === d || hostname.endsWith('.' + d));
        if (matchesDomain) {
            // Check specific video ID patterns
            if (p.pattern && !p.pattern.test(trimmed)) {
                return {
                    isValid: true,
                    isFake: false,
                    warning: true,
                    platform: p.name,
                    icon: p.icon,
                    status: "unverified_path",
                    message: `${p.name} link recognized, but missing direct video ID. Please check URL.`
                };
            }
            return {
                isValid: true,
                isFake: false,
                platform: p.name,
                icon: p.icon,
                status: "verified",
                message: `✅ Authentic ${p.name} video link verified!`
            };
        }
    }

    // Known spam, test or generic unverified domains
    const suspiciousDomains = ["example.com", "test.com", "fake.com", "rickroll", "localhost", "bit.ly"];
    const isSuspicious = suspiciousDomains.some(s => hostname.includes(s));

    if (isSuspicious) {
        return {
            isValid: false,
            isFake: true,
            platform: "Suspicious",
            status: "fake",
            message: "❌ Fake or suspicious domain detected! Please provide real video proof."
        };
    }

    return {
        isValid: true,
        isFake: false,
        warning: true,
        platform: "External Link",
        icon: "🔗",
        status: "unverified_domain",
        message: "⚠️ External link: Not a recognized standard video platform (YouTube, Drive, Streamable, etc.)."
    };
}

/* ── CLOUD SYNC HELPERS (FIREBASE REALTIME DB + FIRESTORE) ── */
export async function savePlayerToCloud(playerData) {
    const tag = (playerData.tag || '').trim();
    if (!tag) return false;
    const safeTag = tag.toUpperCase().replace(/[\/\.#$\[\]]/g, '_');

    const cleanRecord = {
        tag,
        speed: parseInt(playerData.speed, 10) || 0,
        character: playerData.character || 'BLACK THUNDER NISHIKAWA',
        setup: playerData.setup || 'Power 120 / Jump 120',
        state: playerData.state || 'India',
        city: playerData.city || '',
        proof: playerData.proof || '',
        uid: playerData.uid || '',
        updatedAt: playerData.updatedAt || new Date().toISOString()
    };

    let saved = false;

    // 1. Save to Firebase Realtime Database via SDK
    try {
        await set(ref(rtdb, `players/${safeTag}`), cleanRecord);
        saved = true;
    } catch (rtdbErr) {
        // Fallback to direct REST API if SDK is blocked or offline
        try {
            await fetch(`${RTDB_URL}/players/${encodeURIComponent(safeTag)}.json`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(cleanRecord)
            });
            saved = true;
        } catch (restErr) {
            console.warn('RTDB sync warning:', restErr);
        }
    }

    // 2. Also try Firestore in case it is active
    try {
        await setDoc(doc(db, "players", safeTag), cleanRecord, { merge: true });
    } catch (fsErr) {
        // Firestore may not be configured yet; RTDB handles it
    }

    return saved;
}

export async function fetchPlayersFromCloud() {
    // 1. Fetch from Firebase Realtime Database
    try {
        const snap = await get(ref(rtdb, 'players'));
        if (snap.exists()) {
            const val = snap.val();
            return Object.values(val).filter(p => p && p.tag && (parseInt(p.speed, 10) || 0) > 0);
        }
    } catch (e) {
        // Try REST API fallback
        try {
            const resp = await fetch(`${RTDB_URL}/players.json`);
            const val = await resp.json();
            if (val && typeof val === 'object') {
                return Object.values(val).filter(p => p && p.tag && (parseInt(p.speed, 10) || 0) > 0);
            }
        } catch (restErr) {
            console.warn('fetchPlayersFromCloud REST error:', restErr);
        }
    }

    // 2. Fallback to Firestore if RTDB had nothing
    try {
        const querySnap = await getDocs(collection(db, "players"));
        const list = [];
        querySnap.forEach(d => {
            const data = d.data();
            if (data && data.tag) list.push(data);
        });
        if (list.length > 0) return list;
    } catch (e) {}

    return [];
}

export function subscribeToCloudLeaderboard(callback) {
    try {
        const playersRef = ref(rtdb, 'players');
        return onValue(playersRef, (snapshot) => {
            const val = snapshot.val();
            const list = val ? Object.values(val).filter(p => p && p.tag && (parseInt(p.speed, 10) || 0) > 0) : [];
            callback(list);
        }, (err) => {
            console.warn('Realtime subscription warning:', err);
            // Polling fallback
            fetchPlayersFromCloud().then(callback);
        });
    } catch (e) {
        console.warn('subscribeToCloudLeaderboard failed, using fetch:', e);
        fetchPlayersFromCloud().then(callback);
        return null;
    }
}

export async function deletePlayerFromCloud(tag) {
    if (!tag) return false;
    const safeTag = tag.trim().toUpperCase().replace(/[\/\.#$\[\]]/g, '_');
    try {
        await remove(ref(rtdb, `players/${safeTag}`));
    } catch (e) {
        try {
            await fetch(`${RTDB_URL}/players/${encodeURIComponent(safeTag)}.json`, { method: 'DELETE' });
        } catch (err) {}
    }
    try {
        await deleteDoc(doc(db, "players", safeTag));
    } catch (e) {}
    return true;
}

export {
    app,
    db,
    rtdb,
    RTDB_URL,
    ref,
    set,
    get,
    child,
    onValue,
    remove,
    auth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    updateProfile,
    sendPasswordResetEmail,
    GoogleAuthProvider,
    signInWithPopup,
    collection,
    doc,
    setDoc,
    getDoc,
    getDocs,
    onSnapshot,
    query,
    orderBy,
    updateDoc,
    deleteDoc,
    serverTimestamp
};


