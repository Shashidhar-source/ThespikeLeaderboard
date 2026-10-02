"""
THE SPIKE INDIA — app.py
FastAPI & Python Web Server for Spike Cross India Leaderboard
Serves static frontend assets and REST API endpoints:
- GET  /api/players      -> Sorted leaderboard list
- POST /api/submit       -> Submit & validate new speed record (syncs to Firebase)
- GET  /api/stats        -> Realtime leaderboard statistics
- GET  /api/inspect-link -> Validates video proof URLs
- DELETE /api/player/{tag} -> Admin removal of a record
"""

from fastapi import FastAPI, HTTPException, Query
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
import uvicorn
import os

from leaderboard import (
    FirebaseLeaderboardSync,
    align_and_sort_players,
    inspect_proof_link,
    resolve_character_image_info,
    compute_leaderboard_stats
)

app = FastAPI(title="The Spike India Leaderboard API", version="2.0")

# Enable CORS for cross-device requests (desktop, mobile, tablet)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

firebase_sync = FirebaseLeaderboardSync()


class PlayerSubmission(BaseModel):
    tag: str = Field(..., min_length=1, max_length=50, description="Player in-game name (IGN)")
    uid: str = Field(..., min_length=1, max_length=50, description="Player UID")
    speed: int = Field(..., gt=0, le=1000, description="Spike speed in KM/H (1-1000)")
    character: Optional[str] = "BLACK THUNDER NISHIKAWA"
    setup: Optional[str] = "Power 120 / Jump 120"
    state: Optional[str] = "India"
    city: Optional[str] = ""
    proof: Optional[str] = ""


@app.get("/api/players")
def get_players():
    """Retrieve all verified leaderboard players sorted strictly by speed descending."""
    players = firebase_sync.get_all_players()
    return {
        "success": True,
        "count": len(players),
        "players": players
    }


@app.post("/api/submit")
def submit_record(sub: PlayerSubmission):
    """Validate and record a player spike speed, syncing to Firebase in real-time."""
    tag = sub.tag.strip()
    uid = sub.uid.strip()

    if not tag or not uid:
        raise HTTPException(status_code=400, detail="IGN and UID are required.")

    if sub.speed <= 0 or sub.speed > 1000:
        raise HTTPException(status_code=400, detail="Speed must be between 1 and 1000 KM/H.")

    # Validate proof link if provided
    if sub.proof and sub.proof != "#":
        check = inspect_proof_link(sub.proof)
        if check["isFake"]:
            raise HTTPException(status_code=400, detail=f"Fake or invalid proof link: {check['message']}")

    player_record = sub.dict()
    success = firebase_sync.save_player(player_record)

    if not success:
        raise HTTPException(status_code=500, detail="Failed to sync player to Firebase Cloud.")

    # Fetch updated leaderboard to return player's new rank
    all_players = firebase_sync.get_all_players()
    rank = next((p["rank"] for p in all_players if p["tag"].upper() == tag.upper()), 1)

    return {
        "success": True,
        "message": f"Record placed at Rank #{rank} with {sub.speed} KM/H!",
        "rank": rank,
        "player": player_record
    }


@app.get("/api/stats")
def get_stats():
    """Retrieve overall leaderboard analytics (top speed, runner up, total players)."""
    players = firebase_sync.get_all_players()
    return {
        "success": True,
        "stats": compute_leaderboard_stats(players)
    }


@app.get("/api/inspect-link")
def check_link(url: str = Query(..., description="Video proof URL")):
    """Check whether a video proof URL is authentic and from a verified platform."""
    return inspect_proof_link(url)


@app.delete("/api/player/{tag}")
def delete_player(tag: str):
    """Admin route: Remove a player record from Firebase."""
    success = firebase_sync.delete_player(tag)
    if not success:
        raise HTTPException(status_code=404, detail="Player not found or deletion failed.")
    return {"success": True, "message": f"Player {tag} removed successfully."}


# Mount current directory static files for frontend serving
app.mount("/", StaticFiles(directory=".", html=True), name="static")


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    print(f"🚀 The Spike India server running at http://localhost:{port}")
    uvicorn.run("app:app", host="0.0.0.0", port=port, reload=True)
