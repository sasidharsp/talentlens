/**
 * ProctorEngine v4 — COCO-SSD + MediaPipe (iris + head pose)
 *
 * Key fixes over v3:
 * - COCO-SSD now reads from canvas (bypasses CSS transform bug)
 * - Threshold lowered to 0.40 for more sensitive phone detection
 * - Gaze now uses IRIS position (landmarks 468-477) + head pose combined
 * - 8-frame median filter on gaze to reduce false positives
 * - Monotonically-increasing timestamps for MediaPipe
 */

import * as cocoSsd from '@tensorflow-models/coco-ssd';
import * as tf from '@tensorflow/tfjs';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

const MP_WASM  = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const MP_MODEL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

// Thresholds
const PHONE_CONFIDENCE = 0.40;  // lower = more sensitive
const PHONE_FRAMES     = 3;     // ~1 sec sustained to confirm
const GAZE_FRAMES      = 15;    // ~1.5 sec looking away
const ABSENT_FRAMES    = 40;    // ~4 sec no face
const GAZE_HISTORY     = 8;     // frames for median filter

// Head pose angles (degrees)
const YAW_THRESHOLD   = 22;     // sideways look
const PITCH_THRESHOLD = 18;     // looking down

export class ProctorEngine {
  constructor({ onViolation, onTerminate, onStatusChange }) {
    this.onViolation    = onViolation;
    this.onTerminate    = onTerminate;
    this.onStatusChange = onStatusChange;

    this.cocoModel      = null;
    this.faceLandmarker = null;
    this.ready          = false;
    this.running        = false;
    this.video          = null;
    this.mpTimestamp    = 0;  // monotonically increasing for MediaPipe

    // Reusable canvas — avoids CSS-transform bug with video element
    this.canvas     = document.createElement('canvas');
    this.canvasCtx  = this.canvas.getContext('2d');

    // Frame counters
    this.phoneFrames  = 0;
    this.gazeFrames   = 0;
    this.absentFrames = 0;
    this.gazeHistory  = [];  // circular buffer for median filter

    // Confirmed violation events
    this.phoneViolations = 0;
    this.gazeViolations  = 0;
  }

  async load() {
    this.onStatusChange?.('loading');
    try {
      await tf.ready();
      await Promise.all([
        cocoSsd.load({ base: 'mobilenet_v2' }).then(m => { this.cocoModel = m; }),
        FilesetResolver.forVisionTasks(MP_WASM)
          .then(fs => FaceLandmarker.createFromOptions(fs, {
            baseOptions: {
              modelAssetPath: MP_MODEL,
              delegate: 'GPU',
            },
            outputFaceBlendshapes:              false,
            outputFacialTransformationMatrixes: true,
            runningMode: 'VIDEO',
            numFaces: 1,
          }))
          .then(fl => { this.faceLandmarker = fl; }),
      ]);
      this.ready = true;
      this.onStatusChange?.('ready');
    } catch (err) {
      console.error('ProctorEngine load failed:', err);
      this.onStatusChange?.('error');
    }
  }

  start(videoElement) {
    this.video   = videoElement;
    this.running = true;
    this._loop();
  }

  stop() { this.running = false; }

  async _loop() {
    if (!this.running) return;
    if (this.ready && this.video?.readyState === 4 && this.video?.videoWidth > 0) {
      try { await this._detect(); } catch (e) { console.warn('Detection error:', e); }
    }
    await new Promise(r => setTimeout(r, 100)); // ~10fps
    if (this.running) this._loop();
  }

  async _detect() {
    const video = this.video;

    // ── Draw to canvas — bypasses CSS scaleX(-1) transform bug ──────
    this.canvas.width  = video.videoWidth;
    this.canvas.height = video.videoHeight;
    this.canvasCtx.drawImage(video, 0, 0);

    // ── COCO-SSD reads canvas (not video element directly) ───────────
    const objectsPromise = this.cocoModel.detect(this.canvas);

    // ── MediaPipe with strictly increasing timestamp ─────────────────
    this.mpTimestamp += 100; // 10fps → +100ms each call
    const faceResults = this.faceLandmarker.detectForVideo(this.canvas, this.mpTimestamp);

    const objects = await objectsPromise;

    // Debug — uncomment to see what's detected:
    // const allDetected = objects.map(o => `${o.class}:${o.score.toFixed(2)}`).join(', ');
    // if (allDetected) console.log('[COCO-SSD]', allDetected);

    this._processPhone(objects);
    this._processFace(faceResults);
  }

  // ── Phone: COCO-SSD ──────────────────────────────────────────────
  _processPhone(objects) {
    const detected = objects.some(
      o => o.class === 'cell phone' && o.score > PHONE_CONFIDENCE
    );
    if (detected) {
      this.phoneFrames++;
      if (this.phoneFrames >= PHONE_FRAMES) {
        this.phoneFrames = 0;
        this.phoneViolations++;
        const frame = this._capture();
        if (this.phoneViolations >= 2) {
          this.onTerminate(`Auto-terminated: Phone detected ${this.phoneViolations} times`, frame);
          this.stop();
        } else {
          this.onViolation('phone_detected', 'warn_phone', frame);
        }
      }
    } else {
      this.phoneFrames = Math.max(0, this.phoneFrames - 1);
    }
  }

  // ── Face presence + gaze: MediaPipe ─────────────────────────────
  _processFace(results) {
    if (!results?.faceLandmarks?.length) {
      this.absentFrames++;
      this.gazeFrames = 0;
      if (this.absentFrames >= ABSENT_FRAMES) {
        this.absentFrames = 0;
        this.onViolation('person_absent', 'warn_absent', this._capture());
      }
      return;
    }
    this.absentFrames = 0;

    const lookingAway = this._gazeWithMedianFilter(results);
    if (lookingAway) {
      this.gazeFrames++;
      if (this.gazeFrames >= GAZE_FRAMES) {
        this.gazeFrames = 0;
        this.gazeViolations++;
        const frame = this._capture();
        if (this.gazeViolations >= 3) {
          this.onTerminate(`Auto-terminated: Repeated gaze violations (${this.gazeViolations}x)`, frame);
          this.stop();
        } else {
          this.onViolation(
            'looking_away',
            this.gazeViolations === 2 ? 'warn_gaze_final' : 'warn_gaze',
            frame
          );
        }
      }
    } else {
      this.gazeFrames = Math.max(0, this.gazeFrames - 1);
    }
  }

  // ── Gaze with 8-frame median filter (reduces false positives) ────
  _gazeWithMedianFilter(results) {
    const raw = this._isLookingAway(results);
    this.gazeHistory.push(raw ? 1 : 0);
    if (this.gazeHistory.length > GAZE_HISTORY) this.gazeHistory.shift();
    // More than half the recent frames = looking away
    const sum = this.gazeHistory.reduce((a, b) => a + b, 0);
    return sum > this.gazeHistory.length / 2;
  }

  // ── Head pose: transformation matrix (accurate) + iris fallback ──
  _isLookingAway(results) {
    // Primary: transformation matrix gives direct Euler angles
    if (results.facialTransformationMatrixes?.length > 0) {
      const m     = results.facialTransformationMatrixes[0].data;
      // Standard rotation matrix to Euler angle extraction
      const pitch = Math.atan2(-m[9], m[10]) * (180 / Math.PI);
      const yaw   = Math.asin(Math.max(-1, Math.min(1, m[8]))) * (180 / Math.PI);

      if (Math.abs(yaw) > YAW_THRESHOLD) return true;   // sideways
      if (pitch > PITCH_THRESHOLD)       return true;   // looking down
    }

    // Secondary: iris position relative to eye corners
    const lm = results.faceLandmarks[0];
    if (lm.length >= 478) {
      // Iris landmarks: left=468-472, right=473-477
      const leftIris   = lm[468];
      const rightIris  = lm[473];
      const leftInner  = lm[133];   // inner corner left eye
      const leftOuter  = lm[33];    // outer corner left eye
      const rightInner = lm[362];   // inner corner right eye
      const rightOuter = lm[263];   // outer corner right eye

      // Iris ratio: 0 = looking left, 0.5 = centre, 1 = looking right
      const leftEyeW  = Math.abs(leftOuter.x  - leftInner.x);
      const rightEyeW = Math.abs(rightOuter.x - rightInner.x);

      if (leftEyeW > 0.01 && rightEyeW > 0.01) {
        const leftRatio  = (leftIris.x  - leftOuter.x)  / leftEyeW;
        const rightRatio = (rightIris.x - rightOuter.x) / rightEyeW;
        const avgRatio   = (leftRatio + rightRatio) / 2;

        // Centre range 0.25-0.75; outside = looking sideways
        if (avgRatio < 0.20 || avgRatio > 0.80) return true;
      }
    }

    // Fallback: landmark geometry
    return this._geometricGaze(lm);
  }

  _geometricGaze(lm) {
    const nose  = lm[4];
    const lEye  = lm[33];
    const rEye  = lm[263];
    const chin  = lm[152];
    const fw    = Math.abs(rEye.x - lEye.x);
    if (fw < 0.04) return false;
    const midX  = (lEye.x + rEye.x) / 2;
    if (Math.abs(nose.x - midX) / fw > 0.30) return true;
    const midY  = (lEye.y + rEye.y) / 2;
    const fh    = chin.y - midY;
    if (fh <= 0) return false;
    if ((nose.y - midY) / fh > PITCH_THRESHOLD / 100) return true;
    return false;
  }

  _capture() {
    try {
      return this.canvas.toDataURL('image/jpeg', 0.9).split(',')[1];
    } catch { return null; }
  }
}
