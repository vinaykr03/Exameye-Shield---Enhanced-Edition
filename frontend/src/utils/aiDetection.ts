import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import { FaceDetection } from '@mediapipe/face_detection';
import { Camera } from '@mediapipe/camera_utils';

export interface DetectionResult {
  type: 'phone' | 'multiple_person' | 'no_person' | 'object' | 'looking_away' | 'audio_noise';
  confidence: number;
  timestamp: Date;
  bbox?: number[];
}

export class AIProctorDetector {
  private cocoModel: cocoSsd.ObjectDetection | null = null;
  private faceDetection: FaceDetection | null = null;
  private isInitialized = false;
  private confidenceThreshold = 0.6; // Minimum confidence for detection
  private violationThreshold = {
    lookingAway: 3,
    audioNoise: 3,
  };
  private violationCounts = {
    lookingAway: 0,
    audioNoise: 0,
  };

  async initialize() {
    if (this.isInitialized) return;

    console.log('Initializing AI detection models...');
    
    // Load COCO-SSD for object detection
    this.cocoModel = await cocoSsd.load({
      base: 'mobilenet_v2'
    });
    console.log('COCO-SSD model loaded');

    // Initialize MediaPipe Face Detection
    this.faceDetection = new FaceDetection({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`;
      }
    });

    this.faceDetection.setOptions({
      model: 'short',
      minDetectionConfidence: 0.5
    });

    this.isInitialized = true;
    console.log('AI detection initialized successfully');
  }

  async detectObjects(videoElement: HTMLVideoElement): Promise<DetectionResult[]> {
    if (!this.cocoModel) {
      throw new Error('Models not initialized');
    }

    const predictions = await this.cocoModel.detect(videoElement);
    const violations: DetectionResult[] = [];

    // Filter predictions by confidence threshold
    const confidePredictions = predictions.filter(p => p.score >= this.confidenceThreshold);

    // Count persons
    const persons = confidePredictions.filter(p => p.class === 'person');
    
    if (persons.length === 0) {
      violations.push({
        type: 'no_person',
        confidence: 0.9,
        timestamp: new Date()
      });
    } else if (persons.length > 1) {
      violations.push({
        type: 'multiple_person',
        confidence: Math.max(...persons.map(p => p.score)),
        timestamp: new Date(),
        bbox: persons[0].bbox
      });
    }

    // Detect phones - more aggressive detection
    const phones = confidePredictions.filter(p => 
      p.class === 'cell phone' || 
      p.class === 'phone' ||
      p.class === 'remote'
    );
    if (phones.length > 0) {
      violations.push({
        type: 'phone',
        confidence: phones[0].score,
        timestamp: new Date(),
        bbox: phones[0].bbox
      });
    }

    // Detect suspicious objects
    const suspiciousObjects = confidePredictions.filter(p => 
      ['laptop', 'tablet', 'book', 'monitor', 'keyboard', 'mouse'].includes(p.class)
    );
    if (suspiciousObjects.length > 0) {
      violations.push({
        type: 'object',
        confidence: suspiciousObjects[0].score,
        timestamp: new Date(),
        bbox: suspiciousObjects[0].bbox
      });
    }

    return violations;
  }

  async detectFaces(videoElement: HTMLVideoElement): Promise<number> {
    return new Promise((resolve) => {
      if (!this.faceDetection) {
        resolve(0);
        return;
      }

      this.faceDetection.onResults((results) => {
        resolve(results.detections?.length || 0);
      });

      this.faceDetection.send({ image: videoElement });
    });
  }

  async checkLighting(videoElement: HTMLVideoElement): Promise<{ isGood: boolean; brightness: number }> {
    const canvas = document.createElement('canvas');
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return { isGood: false, brightness: 0 };

    ctx.drawImage(videoElement, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    let brightness = 0;
    for (let i = 0; i < data.length; i += 4) {
      brightness += (data[i] + data[i + 1] + data[i + 2]) / 3;
    }
    brightness = brightness / (data.length / 4);

    // Good lighting: between 60-200
    const isGood = brightness >= 60 && brightness <= 200;
    
    return { isGood, brightness };
  }

  async analyzeAudioLevel(audioStream: MediaStream): Promise<{ level: number; isNoisy: boolean }> {
    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(audioStream);
    
    source.connect(analyser);
    analyser.fftSize = 256;
    
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(dataArray);
    
    const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
    const isNoisy = average > 50; // Threshold for background noise
    
    audioContext.close();
    
    return { level: average, isNoisy };
  }

  incrementViolation(type: 'lookingAway' | 'audioNoise'): boolean {
    this.violationCounts[type]++;
    return this.violationCounts[type] >= this.violationThreshold[type];
  }

  resetViolation(type: 'lookingAway' | 'audioNoise') {
    this.violationCounts[type] = 0;
  }

  captureSnapshot(videoElement: HTMLVideoElement): string {
    const canvas = document.createElement('canvas');
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return '';
    
    ctx.drawImage(videoElement, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.8);
  }

  cleanup() {
    if (this.faceDetection) {
      this.faceDetection.close();
    }
    this.isInitialized = false;
  }
}

export const aiDetector = new AIProctorDetector();
