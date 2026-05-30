# TalentLens — Working Version Log

## STABLE v1.4 — Current Known-Good Version
**Date:** 30 May 2026  
**Status:** ✅ CONFIRMED WORKING — candidate navigation fixed, snapshot proctoring added

### What works in this version
- ✅ Landing page (New Assessment / Round 2 entry)
- ✅ Candidate registration (mandatory camera)
- ✅ Instructions page (admin-configured content)
- ✅ Assessment — all 3 segments with proctoring
- ✅ Periodic AI snapshot monitoring (Claude Vision — phone/absence detection)
- ✅ Auto-terminate on phone detected 2x
- ✅ Thank You / exit page
- ✅ Round 2 — entry, instructions, assessment, thank you
- ✅ Admin login / JWT auth
- ✅ Dashboard + Analytics
- ✅ Candidate list → click navigates to detail (FIXED — useAuth removed from CandidateList)
- ✅ Candidate detail — profile, AI recommendation, responses, lifecycle, integrity + snapshots
- ✅ Question bank (Seg 1/2/3) with batch tags
- ✅ Round 2 question bank
- ✅ Requisitions — CSV import, search, delete
- ✅ Settings — instruction editor with version history
- ✅ User management — super_admin / admin / qadmin / interviewer
- ✅ Auto-evaluation on submission (background thread)
- ✅ Auto AI recommendation after evaluation
- ✅ Role-contextualised Segment 3 evaluation (Level 2)
- ✅ Integrity report — event log + webcam photo + snapshot strip
- ✅ Analytics — recharts dashboard

### Known issues / deferred
- ⏳ Cloudinary integration (webcam portrait storage) — deferred, local filesystem only
- ⏳ Option shuffling for anti-cheat — deferred
- ⏳ Middleware domain (separate deployment or domain tagging) — deferred

### Key env vars required on Railway
- `ANTHROPIC_API_KEY` — Claude API (model: claude-sonnet-4-5)
- `SECRET_KEY` — JWT signing
- `DATABASE_URL` — auto-set by Railway Postgres plugin
- `PORT=8000` (backend), `PORT=80` (frontend)
- `VITE_API_URL` — backend Railway URL

---

## STABLE v1.3 — Pre-snapshot version
**Date:** 29 May 2026  
**Status:** ✅ Candidate navigation working, no snapshot proctoring

---

## STABLE v1.2 — Pre-Round-2 version  
**Date:** 28 May 2026  
**Status:** ✅ Full Round 1 flow, AI evaluation, admin portal

---

## STABLE v1.1 — Initial live version
**Date:** 27 May 2026  
**Status:** ✅ Basic assessment flow live on www.lpltalentlens.com
