
import React, { useRef, useEffect } from 'react';
import { HandData } from '../types';

interface Props {
  onHandUpdate: (data: HandData) => void;
  onCameraReady: () => void;
}

const HandTrackerUI: React.FC<Props> = ({ onHandUpdate, onCameraReady }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // 用于视角平滑的缓存变量
  const smoothRotation = useRef({ x: 0, y: 0 });
  const LERP_FACTOR = 0.15; // 坐标平滑系数

  useEffect(() => {
    if (!videoRef.current) return;

    // @ts-ignore
    const hands = new window.Hands({
      locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });

    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.7,
    });

    hands.onResults((results: any) => {
      if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];
        
        // 辅助计算距离
        const getDist = (p1: any, p2: any) => Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
        
        // 1. 握拳检测 (Fist) - 稍微放宽距离阈值 (0.1 -> 0.13)
        // 判定四指指尖是否低于关节且相对靠近指根
        const isFist = (
          landmarks[8].y > landmarks[6].y && getDist(landmarks[8], landmarks[5]) < 0.13 &&
          landmarks[12].y > landmarks[10].y && getDist(landmarks[12], landmarks[9]) < 0.13 &&
          landmarks[16].y > landmarks[14].y && getDist(landmarks[16], landmarks[13]) < 0.13 &&
          landmarks[20].y > landmarks[18].y && getDist(landmarks[20], landmarks[17]) < 0.13
        );

        // 2. 张开手掌检测 (Open Palm)
        const isOpen = (
          landmarks[8].y < landmarks[6].y &&
          landmarks[12].y < landmarks[10].y &&
          landmarks[16].y < landmarks[14].y &&
          landmarks[20].y < landmarks[18].y &&
          !isFist
        );

        // 3. 捏合/抓取检测 (Grab/Pinch) - 收紧阈值 (0.07 -> 0.055) 以减少误判
        const dx = landmarks[4].x - landmarks[8].x;
        const dy = landmarks[4].y - landmarks[8].y;
        const dz = landmarks[4].z - landmarks[8].z;
        const distPinch = Math.sqrt(dx*dx + dy*dy + dz*dz);
        // 必须距离足够短且不是握拳状态
        const isGrab = distPinch < 0.055 && !isFist;

        // 4. 视角控制坐标平滑处理
        const rawX = (0.5 - landmarks[9].x); 
        const rawY = (landmarks[9].y - 0.5);

        // 应用低通滤波减少抖动
        smoothRotation.current.x += (rawY - smoothRotation.current.x) * LERP_FACTOR;
        smoothRotation.current.y += (rawX - smoothRotation.current.y) * LERP_FACTOR;

        onHandUpdate({
          gesture: isGrab ? 'GRAB' : (isFist ? 'FIST' : (isOpen ? 'OPEN' : 'NONE')),
          rotation: { x: smoothRotation.current.x, y: smoothRotation.current.y, z: 0 },
          position: { x: landmarks[9].x, y: landmarks[9].y, z: landmarks[9].z }
        });
      }
    });

    // @ts-ignore
    const camera = new window.Camera(videoRef.current, {
      onFrame: async () => {
        if (videoRef.current) {
          await hands.send({ image: videoRef.current });
        }
      },
      width: 640,
      height: 480,
    });

    camera.start().then(onCameraReady);

    return () => {
      camera.stop();
      hands.close();
    };
  }, []);

  return (
    <div className="relative w-full h-full bg-black">
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover scale-x-[-1] opacity-40"
        style={{ 
          filter: 'grayscale(100%) brightness(1.5) contrast(1.2)',
          mixBlendMode: 'screen' 
        }}
        autoPlay
        playsInline
        muted
      />
    </div>
  );
};

export default HandTrackerUI;
