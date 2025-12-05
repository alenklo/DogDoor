export enum SystemState {
  IDLE = 'IDLE', 
  DETECTING = 'DETECTING',
  OPENING = 'OPENING',
  OPEN = 'OPEN',
  CLOSING = 'CLOSING',
  CLOSED = 'CLOSED',
  OBSTRUCTED = 'OBSTRUCTED',
  LOCKED = 'LOCKED'
}

export enum DoorMode {
  AUTO = 'AUTO',
  MANUAL = 'MANUAL',
  LOCKED = 'LOCKED'
}

export interface NotificationConfig {
  enabled: boolean;
  provider: 'pushbullet';
  apiKey: string;
}

export interface DetectionZone {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface GpioConfig {
  dir: number;
  step: number;
  enable: number;
  limitOpen: number;
  limitClose: number;
  safety: number;
  btnOpen: number;
  btnClose: number;
  proxOutside: number;
  proxInside: number;
}

export interface PiConfig {
  doorMode: DoorMode;
  motorSpeed: number;
  holdOpenTime: number;
  
  // New: Camera Toggle
  cameraEnabled: boolean;
  
  // New: GPIO Config
  gpio: GpioConfig;

  confidenceThreshold: number;
  gracePeriod: number;
  cameraIndex: number;
  detectionZone: DetectionZone;
  aiFallbackEnabled: boolean;
  geminiApiKey?: string;
  notifications: NotificationConfig;
  
  // Backward compatibility
  timeThreshold: number; 
  triggerCooldown: number;
}

export interface AnalysisResult {
  text: string;
  timestamp: Date;
}

// New: Simulation State
export interface SimulationState {
  enabled: boolean;
  overrides: {
    limitOpen?: boolean;
    limitClose?: boolean;
    safety?: boolean;
    proxOutside?: boolean;
    proxInside?: boolean;
  }
}