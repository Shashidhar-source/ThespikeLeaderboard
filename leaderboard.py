"""
THE SPIKE INDIA — leaderboard.py
High-efficiency Python Core for Spike Cross India Leaderboard
Features:
- Video Proof Link Verification & Fake Link Detector
- Character & Avatar Image Matching
- Leaderboard Alignment & Descending Speed Sorting
- Real-time Firebase Sync (Firebase Realtime Database REST API)
- Leaderboard Statistics & Analytics Engine
"""

import re
import json
import urllib.request
import urllib.error
from typing import Dict, List, Optional, Any
from datetime import datetime

# Firebase Realtime Database Endpoint
FIREBASE_RTDB_URL = "https://thespikeleaderboard-default-rtdb.firebaseio.com"

# Maximum Speed Scale
SPEED_SCALE_MAX = 1000

# Available Character Images in images/
CHARACTER_FILES = [
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
]

# Verified Video Platforms Regex Patterns
VERIFIED_VIDEO_DOMAINS = [
    {
        "name": "YouTube",
        "domains": ["youtube.com", "youtu.be", "m.youtube.com"],
        "icon": "🔴",
        "pattern": re.compile(r"(?:v=|\/embed\/|\/shorts\/|youtu\.be\/)([a-zA-Z0-9_-]{11})")
    },
    {
        "name": "Google Drive",
        "domains": ["drive.google.com"],
        "icon": "📁",
        "pattern": re.compile(r"\/file\/d\/([a-zA-Z0-9_-]+)")
    },
    {
        "name": "Streamable",
        "domains": ["streamable.com"],
        "icon": "🎬",
        "pattern": re.compile(r"streamable\.com\/([a-zA-Z0-9]+)")
    },
    {
        "name": "Medal.tv",
        "domains": ["medal.tv"],
        "icon": "🏅",
        "pattern": re.compile(r"medal\.tv\/games\/")
    },
    {
        "name": "Twitch",
        "domains": ["twitch.tv", "clips.twitch.tv"],
        "icon": "🟣",
        "pattern": re.compile(r"(?:clips\.twitch\.tv\/|twitch\.tv\/.*\/clip\/)")
    },
    {
        "name": "Discord CDN",
        "domains": ["cdn.discordapp.com", "media.discordapp.net"],
        "icon": "💬",
        "pattern": re.compile(r"\.(mp4|mov|webm)", re.IGNORECASE)
    },
    {
        "name": "Twitter / X",
        "domains": ["twitter.com", "x.com"],
        "icon": "🐦",
        "pattern": re.compile(r"\/status\/\d+")
    }
]

SUSPICIOUS_DOMAINS = ["example.com", "test.com", "fake.com", "rickroll", "localhost", "bit.ly"]


def inspect_proof_link(url_str: Optional[str]) -> Dict[str, Any]:
    """Inspects video proof URL for authenticity and detects fake or broken links."""
    if not url_str or url_str.strip() in ("", "#"):
        return {
            "isValid": False,
            "isFake": False,
            "platform": "None",
            "status": "missing",
            "message": "No proof link provided."
        }

    trimmed = url_str.strip()
    match = re.match(r"^(https?):\/\/([^\/\s]+)(.*)", trimmed, re.IGNORECASE)
    if not match:
        return {
            "isValid": False,
            "isFake": True,
            "platform": "Malformed",
            "status": "fake",
            "message": "Malformed URL: Must start with https:// or http://"
        }

    protocol, hostname, path = match.group(1).lower(), match.group(2).lower(), match.group(3)
    hostname = re.sub(r"^www\.", "", hostname)

    # Check against verified platforms
    for platform in VERIFIED_VIDEO_DOMAINS:
        matches_domain = any(hostname == d or hostname.endswith("." + d) for d in platform["domains"])
        if matches_domain:
            if platform.get("pattern") and not platform["pattern"].search(trimmed):
                return {
                    "isValid": True,
                    "isFake": False,
                    "warning": True,
                    "platform": platform["name"],
                    "icon": platform["icon"],
                    "status": "unverified_path",
                    "message": f"{platform['name']} link recognized, but missing direct video ID."
                }
            return {
                "isValid": True,
                "isFake": False,
                "platform": platform["name"],
                "icon": platform["icon"],
                "status": "verified",
                "message": f"Authentic {platform['name']} video link verified!"
            }

    # Check suspicious domains
    if any(s in hostname for s in SUSPICIOUS_DOMAINS):
        return {
            "isValid": False,
            "isFake": True,
            "platform": "Suspicious",
            "status": "fake",
            "message": "Fake or suspicious domain detected! Please provide genuine video proof."
        }

    return {
        "isValid": True,
        "isFake": False,
        "warning": True,
        "platform": "External Link",
        "icon": "🔗",
        "status": "unverified_domain",
        "message": "External link: Not a recognized standard video platform (YouTube, Drive, Streamable, etc.)."
    }


def resolve_character_image_info(char_name: str, player_name: str = "") -> Dict[str, Any]:
    """Matches character name to image assets in images/ folder."""
    norm_char = (char_name or "").strip().upper()
    norm_player = (player_name or "").strip()

    matched_name = next((f for f in CHARACTER_FILES if f.upper() == norm_char), None)

    if not matched_name and norm_char:
        if "HEES" in norm_char:
            matched_name = "HEESEONG"
        elif "ISAB" in norm_char:
            matched_name = "ISABEL"
        elif "BLACK" in norm_char or "THUNDER" in norm_char:
            matched_name = "BLACK THUNDER NISHIKAWA"
        elif "HS" in norm_char or "HIGH" in norm_char:
            matched_name = "NISHIKAWA HS OR NISHIKAWA HIGH SCHOOL"
        elif "NISHIK" in norm_char:
            matched_name = "NISHIKAWA"
        elif "YONG" in norm_char or "YOUNG" in norm_char:
            matched_name = "YOUNGSUP"
        else:
            matched_name = next((f for f in CHARACTER_FILES if f.upper() in norm_char or norm_char in f.upper()), None)

    primary_char = matched_name or (char_name.strip() if char_name else "")
    return {
        "matched": bool(matched_name),
        "name": primary_char,
        "pngSrc": f"images/{primary_char}.png" if primary_char else "",
        "jpgSrc": f"images/{primary_char}.jpg" if primary_char else "",
        "playerPng": f"images/{norm_player}.png" if norm_player else "",
        "playerJpg": f"images/{norm_player}.jpg" if norm_player else ""
    }


def align_and_sort_players(players: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Sorts players strictly by speed descending (greater speeds rank higher).
    Breaks ties cleanly by update timestamp.
    """
    cleaned: List[Dict[str, Any]] = []
    seen = set()

    for p in players:
        if not p or not p.get("tag"):
            continue
        tag_key = str(p["tag"]).strip().upper()
        if tag_key in seen:
            continue
        seen.add(tag_key)

        speed = int(p.get("speed") or 0)
        if speed <= 0:
            continue

        cleaned.append({
            "tag": str(p["tag"]).strip(),
            "speed": speed,
            "character": p.get("character") or "BLACK THUNDER NISHIKAWA",
            "setup": p.get("setup") or "Power 120 / Jump 120",
            "state": p.get("state") or p.get("region") or "India",
            "city": p.get("city") or "",
            "proof": p.get("proof") or "",
            "uid": p.get("uid") or "",
            "updatedAt": p.get("updatedAt") or datetime.utcnow().isoformat() + "Z"
        })

    # Sort descending by speed, then newest first
    cleaned.sort(key=lambda x: (x["speed"], x.get("updatedAt", "")), reverse=True)

    # Assign 1-indexed ranks
    for rank, p in enumerate(cleaned, start=1):
        p["rank"] = rank

    return cleaned


class FirebaseLeaderboardSync:
    """Synchronizes leaderboard records directly with Firebase Realtime Database."""

    def __init__(self, database_url: str = FIREBASE_RTDB_URL):
        self.base_url = database_url.rstrip("/")

    def get_all_players(self) -> List[Dict[str, Any]]:
        """Fetches all players from Firebase Realtime Database."""
        url = f"{self.base_url}/players.json"
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "TheSpike-Python/1.0"})
            with urllib.request.urlopen(req, timeout=5) as response:
                data = json.loads(response.read().decode("utf-8"))
                if not data:
                    return []
                if isinstance(data, dict):
                    return align_and_sort_players(list(data.values()))
                elif isinstance(data, list):
                    return align_and_sort_players([p for p in data if p])
                return []
        except Exception as e:
            print(f"[FirebaseSync] Error fetching players: {e}")
            return []

    def save_player(self, player_data: Dict[str, Any]) -> bool:
        """Saves or updates a player record in Firebase Realtime Database."""
        tag = (player_data.get("tag") or "").strip()
        if not tag:
            return False

        safe_tag = tag.upper().replace("/", "_").replace(".", "_")
        url = f"{self.base_url}/players/{safe_tag}.json"

        record = {
            "tag": tag,
            "speed": int(player_data.get("speed") or 0),
            "character": player_data.get("character") or "BLACK THUNDER NISHIKAWA",
            "setup": player_data.get("setup") or "Power 120 / Jump 120",
            "state": player_data.get("state") or "India",
            "city": player_data.get("city") or "",
            "proof": player_data.get("proof") or "",
            "uid": player_data.get("uid") or "",
            "updatedAt": player_data.get("updatedAt") or datetime.utcnow().isoformat() + "Z"
        }

        try:
            payload = json.dumps(record).encode("utf-8")
            req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"}, method="PUT")
            with urllib.request.urlopen(req, timeout=5) as resp:
                return resp.status == 200
        except Exception as e:
            print(f"[FirebaseSync] Error saving player {tag}: {e}")
            return False

    def delete_player(self, tag: str) -> bool:
        """Removes a player record from Firebase Realtime Database."""
        safe_tag = tag.strip().upper().replace("/", "_").replace(".", "_")
        url = f"{self.base_url}/players/{safe_tag}.json"
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "TheSpike-Python/1.0"}, method="DELETE")
            with urllib.request.urlopen(req, timeout=5) as resp:
                return resp.status == 200
        except Exception as e:
            print(f"[FirebaseSync] Error deleting player {tag}: {e}")
            return False


def compute_leaderboard_stats(players: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Calculates top speed, runner-up, podium, and state stats."""
    sorted_players = align_and_sort_players(players)
    total = len(sorted_players)
    if total == 0:
        return {
            "totalPlayers": 0,
            "topSpeed": 0,
            "topPlayer": "—",
            "runnerSpeed": 0,
            "runnerPlayer": "—",
            "avgSpeed": 0,
            "stateCount": 0
        }

    p1 = sorted_players[0]
    p2 = sorted_players[1] if total > 1 else None
    speeds = [p["speed"] for p in sorted_players]
    states = set(p["state"] for p in sorted_players if p.get("state"))

    return {
        "totalPlayers": total,
        "topSpeed": p1["speed"],
        "topPlayer": p1["tag"],
        "runnerSpeed": p2["speed"] if p2 else 0,
        "runnerPlayer": p2["tag"] if p2 else "—",
        "avgSpeed": round(sum(speeds) / total, 1),
        "stateCount": len(states)
    }


if __name__ == "__main__":
    print("=== THE SPIKE INDIA — PYTHON CORE INITIALIZED ===")
    sync = FirebaseLeaderboardSync()
    print("Fetching active records from Firebase Realtime Database...")
    current_players = sync.get_all_players()
    print(f"Total verified players in Firebase: {len(current_players)}")
    stats = compute_leaderboard_stats(current_players)
    print("Leaderboard Stats:", json.dumps(stats, indent=2))
