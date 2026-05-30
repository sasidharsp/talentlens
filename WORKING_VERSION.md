# TalentLens — Working Version Log

## STABLE v1.5 — Current Known-Good Version
**Date:** 31 May 2026  
**Status:** ✅ CONFIRMED WORKING — webcam fixed on Chrome + Edge (built-in and external cameras)

### What works in this version
- ✅ Landing page (New Assessment / Round 2 entry)
- ✅ Candidate registration — mandatory camera, works on Chrome + Edge
- ✅ Webcam — enumerates all cameras, auto-selects external, manual switcher if multiple
- ✅ Instructions page (admin-configured content, segment cards removed)
- ✅ Assessment — all 3 segments with full proctoring
- ✅ AI Snapshot monitoring — every 5 seconds, Claude Vision on every other frame (~35 cents/candidate)
- ✅ Phone detection → warn at 1x, terminate at 2x
- ✅ Gaze violation → warn at 1x, final warning at 2x, terminate at 3x
- ✅ Person absent → warn
- ✅ Admin Integrity tab — snapshot photo strip with timestamps and flag badges
- ✅ Candidate navigation — clicking rows opens detail page (useAuth bug fixed)
- ✅ Round 2 — full flow (entry, instructions, assessment, thank you)
- ✅ Round 2 question bank + admin candidates view with R1→R2 progression
- ✅ Cross-round AI recommendation (R2 sees R1 scores and verdict)
- ✅ Auto-evaluation + auto AI recommendation (background thread)
- ✅ Question bank (Seg 1/2/3) with batch tags, import, export
- ✅ Requisitions — CSV import, search
- ✅ Settings — instruction editor
- ✅ User management — super_admin / admin / qadmin / interviewer
- ✅ Analytics dashboard

### Known issues / deferred
- ⏳ Cloudinary for persistent webcam portraits (local filesystem only — photos lost on redeploy)
- ⏳ Option shuffling for MCQ anti-cheat
- ⏳ Middleware domain tagging

### Key fixes in v1.5
- Webcam: proper camera enumeration with deviceId (fixes Chrome multi-camera issue)
- Webcam: auto-prefers external camera, falls back to built-in
- Webcam: manual camera switcher UI when multiple cameras detected
- Registration: camera now mandatory (blocks form submit without photo)
- Snapshot interval: 5 seconds with Claude Vision on every other frame

### Key env vars required on Railway
- `ANTHROPIC_API_KEY` — Claude API (model: claude-sonnet-4-5)
- `SECRET_KEY` — JWT signing
- `DATABASE_URL` — auto-set by Railway Postgres plugin
- `PORT=8000` (backend), `PORT=80` (frontend)
- `VITE_API_URL` — backend Railway URL

---

## STABLE v1.4 — Pre-camera-fix version
**Date:** 30 May 2026  
**Status:** ✅ Candidate navigation working, snapshot proctoring, camera black on Chrome

## STABLE v1.3 — Pre-snapshot version
**Date:** 29 May 2026  
**Status:** ✅ Candidate navigation working, no snapshot proctoring

## STABLE v1.2 — Pre-Round-2 version  
**Date:** 28 May 2026  
**Status:** ✅ Full Round 1 flow, AI evaluation, admin portal

## STABLE v1.1 — Initial live version
**Date:** 27 May 2026  
**Status:** ✅ Basic assessment flow live on www.lpltalentlens.com
