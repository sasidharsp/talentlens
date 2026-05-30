/**
 * ProctorEngine — browser-based proctoring using TensorFlow.js + face-api.js
 * 
 * Phone detection:  COCO-SSD (TensorFlow.js) — trained on real phone images
 * Gaze detection:   face-api.js landmarks — exact head pose from 68 points
 * Face presence:    face-api.js TinyFaceDetector
 * 
 * Runs at ~10fps in browser. Zero API calls. Zero cost per detection.
 */

import * as cocoSsd from '@tensorflow-models/coco-ssd';
import * as tf from '@tensorflow/tfjs';
import * as faceapi from 'face-api.js';

// face-api.js model weights — served from GitHub CDN
const FACEAPI_CDN =
  'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights';

// Detection thresholds
const PHONE_CONFIDENCE   = 0.60; // COCO-SSD confidence for "cell phone"
const PHONE_FRAMES       = 3;    // consecutive frames to confirm phone (~1 sec at 10fps)
const GAZE_FRAMES        = 20;   // consecutive frames looking away (~2 sec)
const ABSENT_FRAMES      = 40;   // consecutive frames with no face (~4 sec)
const YAW_THRESHOLD      = 0.32; // nose offset ratio for sideways look
const PITCH_THRESHOLD    = 0.66; // nose/chin ratio for looking down

export class ProctorEngine {
  constructor({ onViolation, onTerminate, onStatusChange }) {
    this.onViolation     = onViolation;     // (type, action, frameB64) => void
    this.onTerminate     = onTerminate;     // (reason, frameB64) => void
    this.onStatusChange  = onStatusChange;  // (status: 'loading'|'ready'|'error') => void

    this.cocoModel    = null;
    this.faceApiReady = false;
    this.ready        = false;
    this.running      = false;
    this.video        = null;

    // Consecutive frame counters (reset on clear)
    this.phoneFrames  = 0;
    this.gazeFrames   = 0;
    this.absentFrames = 0;

    // Total confirmed violation events
    this.phoneViolations = 0;
    this.gazeViolations  = 0;
  }

  // ── Load both models ─────────────────────────────────────────────
  async load() {
    this.onStatusChange?.('loading');
    try {
      await tf.ready();

      await Promise.all([
        // COCO-SSD model (~6MB, cached after first load)
        cocoSsd.load().then(m => { this.cocoModel = m; }),

        // face-api.js tiny models (~260KB total)
        Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(FACEAPI_CDN),
          faceapi.nets.faceLandmark68TinyNet.loadFromUri(FACEAPI_CDN),
        ]).then(() => { this.faceApiReady = true; }),
      ]);

      this.ready = true;
      this.onStatusChange?.('ready');
    } catch (err) {
      console.warn('ProctorEngine: model load failed —', err.message);
      this.onStatusChange?.('error');
    }
  }

  // ── Start detection loop ──────────────────────────────────────────
  start(videoElement) {
    this.video   = videoElement;
    this.running = true;
    this._loop();
  }

  stop() {
    this.running = false;
  }

  // ── Main detection loop (~10fps) ──────────────────────────────────
  async _loop() {
    if (!this.running) return;

    if (this.ready && this.video?.readyState === 4 && this.video?.videoWidth > 0) {
      try { await this._detect(); } catch { /* silent */ }
    }

    await new Promise(r => setTimeout(r, 100)); // 10fps cap
    if (this.running) this._loop();
  }

  async _detect() {
    const video = this.video;

    // Run COCO-SSD + face-api in parallel
    const [objects, face] = await Promise.all([
      this.cocoModel.detect(video),
      this.faceApiReady
        ? faceapi
            .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.3 }))
            .withFaceLandmarks(true)
        : Promise.resolve(null),
    ]);

    this._processPhone(objects);
    this._processFace(face);
  }

  // ── Phone detection ───────────────────────────────────────────────
  _processPhone(objects) {
    const phoneDetected = objects.some(
      o => o.class === 'cell phone' && o.score > PHONE_CONFIDENCE
    );

    if (phoneDetected) {
      this.phoneFrames++;
      if (this.phoneFrames >= PHONE_FRAMES) {
        // Confirmed detection
        this.phoneFrames = 0;
        this.phoneViolations++;
        const frame = this._capture();

        if (this.phoneViolations >= 2) {
          this.onTerminate(
            `Auto-terminated: Mobile device detected ${this.phoneViolations} times`,
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

  // ── Face presence + gaze ──────────────────────────────────────────
  _processFace(face) {
    if (!face) {
      // No face detected
      this.absentFrames++;
      this.gazeFrames = 0;

      if (this.absentFrames >= ABSENT_FRAMES) {
        this.absentFrames = 0;
        this.onViolation('person_absent', 'warn_absent', this._capture());
      }
      return;
    }

    this.absentFrames = 0;

    // Check head pose from 68 landmarks
    const lookingAway = this._isLookingAway(face.landmarks);
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

  // ── Head pose from landmarks ──────────────────────────────────────
  _isLookingAway(landmarks) {
    const pts = landmarks.positions;

    const leftEye  = this._avg(pts.slice(36, 42));
    const rightEye = this._avg(pts.slice(42, 48));
    const noseTip  = pts[30];
    const chin     = pts[8];

    const faceWidth = Math.abs(rightEye.x - leftEye.x);
    if (faceWidth < 20) return false; // face too small to judge

    // YAW (looking left/right): nose deviates from eye midpoint
    const eyeMidX  = (leftEye.x + rightEye.x) / 2;
    const yawRatio = Math.abs(noseTip.x - eyeMidX) / faceWidth;
    if (yawRatio > YAW_THRESHOLD) return true;

    // PITCH (looking down): nose is low relative to face height
    const eyeMidY    = (leftEye.y + rightEye.y) / 2;
    const faceHeight = chin.y - eyeMidY;
    if (faceHeight < 10) return false;
    const pitchRatio = (noseTip.y - eyeMidY) / faceHeight;
    if (pitchRatio > PITCH_THRESHOLD) return true;

    return false;
  }

  _avg(points) {
    return {
      x: points.reduce((s, p) => s + p.x, 0) / points.length,
      y: points.reduce((s, p) => s + p.y, 0) / points.length,
    };
  }

  // ── Capture current video frame as base64 ─────────────────────────
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
