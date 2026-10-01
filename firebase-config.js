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
    projectId: "thespikeleaderboard",
    storageBucket: "thespikeleaderboard.firebasestorage.app",
    messagingSenderId: "89178505636",
    appId: "1:89178505636:web:3282b6eb99e5f4dfe18131",
    measurementId: "G-NZ2EPECS2W"
};

// Initialize Firebase
const app  = initializeApp(firebaseConfig);
const db   = getFirestore(app);
const auth = getAuth(app);


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

export {
    app,
    db,
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

