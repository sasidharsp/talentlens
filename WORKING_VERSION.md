# TalentLens — Working Version Log

## STABLE v1.6 — Current Known-Good Version
**Date:** 31 May 2026  
**Status:** ✅ CONFIRMED WORKING — full proctoring stack live and detecting violations

### What works in this version
- ✅ Landing page (New Assessment / Round 2 entry)
- ✅ Candidate registration — mandatory camera, with manual camera switcher
- ✅ Camera — enumerates all cameras, auto-prefers external, manual switcher UI
- ✅ Instructions page
- ✅ Assessment — all 3 segments with full proctoring stack

### Proctoring stack (adopted from Claude Code agent)
- ✅ MediaPipe Face Mesh via CDN — iris tracking + gaze detection
- ✅ COCO-SSD via CDN — phone/object detection
- ✅ Audio detection — Web Audio API catches sustained speaking
- ✅ DevTools detection — catches browser inspector open
- ✅ Copy/paste/keyboard shortcut blocking
- ✅ Window blur + tab switch detection
- ✅ Weighted violation system (phone=4, multi-face=3, tab=2, gaze=1 → terminate at 20pts)
- ✅ Real-time violation log shown to candidate during assessment
- ✅ Fullscreen enforcement with re-entry prompt
- ✅ Admin Integrity tab — score card, violation breakdown, snapshot strip, event log

### Admin
- ✅ Live Monitor (/admin/live) — real-time view of all active sessions
- ✅ Manual terminate button per candidate in Live Monitor
- ✅ Candidate detail — Integrity tab with full event log and snapshot strip
- ✅ Round 2 — full flow with cross-round AI evaluation
- ✅ Question bank, requisitions, settings, user management

### Known issues / deferred
- ⏳ Cloudinary for persistent webcam portraits
- ⏳ Option shuffling for MCQ anti-cheat
- ⏳ COCO-SSD phone detection accuracy — needs more real-world testing

### Key env vars required on Railway
- `ANTHROPIC_API_KEY`, `SECRET_KEY`, `DATABASE_URL`, `PORT=8000/80`, `VITE_API_URL`
---

## STABLE v1.5 — Pre-full-proctoring
**Date:** 31 May 2026 (earlier)
**Status:** ✅ Webcam fixed, snapshot monitoring, basic gaze detection

## STABLE v1.4 — Pre-camera-fix version
**Date:** 30 May 2026

## STABLE v1.3 — Pre-snapshot version
**Date:** 29 May 2026

## STABLE v1.2 — Pre-Round-2 version
**Date:** 28 May 2026

## STABLE v1.1 — Initial live version
**Date:** 27 May 2026
