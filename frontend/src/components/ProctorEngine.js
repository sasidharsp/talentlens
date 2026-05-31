/**
 * ProctorEngine v3 — MediaPipe + COCO-SSD
 *
 * Phone detection:   COCO-SSD (TensorFlow.js)  — proven object detection
 * Gaze + presence:  MediaPipe FaceLandmarker    — Google's own library
 *                   Models from storage.googleapis.com — zero CDN risk
 *
 * Runs at ~10 fps in browser. No API calls. No cost per detection.
 */

import * as cocoSsd from '@tensorflow-models/coco-ssd';
import * as tf from '@tensorflow/tfjs';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

// MediaPipe CDN — Google's own infrastructure
const MP_WASM =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const MP_MODEL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

// Thresholds
const PHONE_CONFIDENCE  = 0.60;
const PHONE_FRAMES      = 3;    // ~1 sec to confirm phone
const GAZE_FRAMES       = 20;   // ~2 sec sustained looking away
const ABSENT_FRAMES     = 40;   // ~4 sec no face = absent
const YAW_RATIO         = 0.28; // nose vs eye-midpoint horizontal
const PITCH_RATIO       = 0.62; // nose vs face height vertical

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
    this.lastVideoTime  = -1;

    // Consecutive frame counters
    this.phoneFrames  = 0;
    this.gazeFrames   = 0;
    this.absentFrames = 0;

    // Total confirmed events
    this.phoneViolations = 0;
    this.gazeViolations  = 0;
  }

  // ── Load both models in parallel ────────────────────────────────
  async load() {
    this.onStatusChange?.('loading');
    try {
      await tf.ready();

      await Promise.all([
        // COCO-SSD — phone detection
        cocoSsd.load().then(m => { this.cocoModel = m; }),

        // MediaPipe — face detection + head pose
        FilesetResolver.forVisionTasks(MP_WASM)
          .then(fileset =>
            FaceLandmarker.createFromOptions(fileset, {
              baseOptions: {
                modelAssetPath: MP_MODEL,
                delegate: 'GPU',
              },
              outputFaceBlendshapes:              false,
              outputFacialTransformationMatrixes: true,
              runningMode: 'VIDEO',
              numFaces: 1,
            })
          )
          .then(fl => { this.faceLandmarker = fl; }),
      ]);

      this.ready = true;
      this.onStatusChange?.('ready');
    } catch (err) {
      console.error('ProctorEngine: load failed —', err);
      this.onStatusChange?.('error');
    }
  }

  // ── Start detection loop ────────────────────────────────────────
  start(videoElement) {
    this.video   = videoElement;
    this.running = true;
    this._loop();
  }

  stop() {
    this.running = false;
  }

  // ── Main loop ~10fps ────────────────────────────────────────────
  async _loop() {
    if (!this.running) return;

    if (this.ready && this.video?.readyState === 4 && this.video?.videoWidth > 0) {
      try { await this._detect(); } catch { /* silent */ }
    }

    await new Promise(r => setTimeout(r, 100));
    if (this.running) this._loop();
  }

  async _detect() {
    const video = this.video;
    const now   = performance.now();

    // COCO-SSD is async — start it first
    const objectsPromise = this.cocoModel.detect(video);

    // MediaPipe is synchronous — run while COCO-SSD is working
    let faceResults = null;
    if (video.currentTime !== this.lastVideoTime) {
      faceResults        = this.faceLandmarker.detectForVideo(video, now);
      this.lastVideoTime = video.currentTime;
    }

    // Await COCO-SSD result
    const objects = await objectsPromise;

    this._processPhone(objects);
    this._processFace(faceResults);
  }

  // ── Phone detection (COCO-SSD) ──────────────────────────────────
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
          this.onTerminate(
            `Auto-terminated: Phone detected ${this.phoneViolations} times`,
            frame
          );
          this.stop();
        } else {
          this.onViolation('phone_detected', 'warn_phone', frame);
        }
      }
    } else {
      this.phoneFrames = Math.max(0, this.phoneFrames - 1);
    }
  }

  // ── Face presence + gaze (MediaPipe) ────────────────────────────
  _processFace(results) {
    const hasFace =
      results?.faceLandmarks?.length > 0;

    if (!hasFace) {
      this.absentFrames++;
      this.gazeFrames = 0;
      if (this.absentFrames >= ABSENT_FRAMES) {
        this.absentFrames = 0;
        this.onViolation('person_absent', 'warn_absent', this._capture());
      }
      return;
    }

    this.absentFrames = 0;

    // ── Head pose ────────────────────────────────────────────────
    const lookingAway = this._isLookingAway(results);

    if (lookingAway) {
      this.gazeFrames++;
      if (this.gazeFrames >= GAZE_FRAMES) {
        this.gazeFrames = 0;
        this.gazeViolations++;
        const frame = this._capture();

        if (this.gazeViolations >= 3) {
          this.onTerminate(
            `Auto-terminated: Repeated gaze violations (${this.gazeViolations}x)`,
            frame
          );
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

  // ── Head pose from MediaPipe ────────────────────────────────────
  _isLookingAway(results) {
    // Prefer transformation matrix (direct Euler angles)
    if (results.facialTransformationMatrixes?.length > 0) {
      const m = results.facialTransformationMatrixes[0].data;
      // Extract yaw and pitch from 4×4 rotation matrix
      const pitchRad = Math.atan2(-m[9], m[10]);
      const yawRad   = Math.atan2(m[8],
        Math.sqrt(m[9] * m[9] + m[10] * m[10]));
      const pitch = pitchRad * (180 / Math.PI); // negative = looking down
      const yaw   = yawRad   * (180 / Math.PI); // |yaw| large = looking sideways

      return Math.abs(yaw) > 25 || pitch < -20;
    }

    // Fallback: 2D landmark geometry
    return this._gazeFromLandmarks(results.faceLandmarks[0]);
  }

  _gazeFromLandmarks(lm) {
    // MediaPipe landmark indices (normalized 0-1)
    const noseTip  = lm[4];
    const leftEye  = lm[33];
    const rightEye = lm[263];
    const chin     = lm[152];

    const faceW  = Math.abs(rightEye.x - leftEye.x);
    if (faceW < 0.04) return false;

    const eyeMidX = (leftEye.x + rightEye.x) / 2;
    if (Math.abs(noseTip.x - eyeMidX) / faceW > YAW_RATIO) return true;

    const eyeMidY  = (leftEye.y + rightEye.y) / 2;
    const faceH    = chin.y - eyeMidY;
    if (faceH <= 0) return false;
    if ((noseTip.y - eyeMidY) / faceH > PITCH_RATIO) return true;

    return false;
  }

  // ── Capture video frame ─────────────────────────────────────────
  _capture() {
    try {
      const v = this.video;
      const c = document.createElement('canvas');
      c.width = v.videoWidth; c.height = v.videoHeight;
      c.getContext('2d').drawImage(v, 0, 0);
      return c.toDataURL('image/jpeg', 0.9).split(',')[1];
    } catch { return null; }
  }
}
