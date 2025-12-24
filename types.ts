
import * as THREE from 'three';

export enum TreeState {
  CLOSED = 'CLOSED',
  DISPERSED = 'DISPERSED',
  ZOOMED = 'ZOOMED'
}

export interface HandData {
  gesture: 'FIST' | 'OPEN' | 'GRAB' | 'NONE';
  rotation: { x: number; y: number; z: number };
  position: { x: number; y: number; z: number };
}

export interface PhotoItem {
  id: string;
  url: string;
  texture: THREE.Texture;
  base64?: string; // Base64 for AI analysis
}

export interface GiftItem {
  id: string;
  name: string;
  blessing: string;
  isOpen: boolean;
  position: THREE.Vector3;
}
