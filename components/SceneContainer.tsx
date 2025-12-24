
import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
// @ts-ignore
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
// @ts-ignore
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
// @ts-ignore
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
// @ts-ignore
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { TreeState, HandData, PhotoItem, GiftItem } from '../types';

interface Props {
  treeState: TreeState;
  handData: HandData;
  photos: PhotoItem[];
  gifts: GiftItem[];
  selectedId: string | null;
}

const SceneContainer: React.FC<Props> = ({ treeState, handData, photos, gifts, selectedId }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const composerRef = useRef<any>(null);
  const bloomPassRef = useRef<any>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  
  const particlesRef = useRef<THREE.InstancedMesh[]>([]);
  const targetsRef = useRef<{pos: THREE.Vector3, color: THREE.Color}[]>([]);
  const currentPosRef = useRef<THREE.Vector3[]>([]);
  
  const spiralMeshRef = useRef<THREE.InstancedMesh | null>(null);
  const spiralTargetsRef = useRef<THREE.Vector3[]>([]);
  const spiralCurrentPosRef = useRef<THREE.Vector3[]>([]);

  // Ambient Stars
  const ambientStarsRef = useRef<THREE.InstancedMesh | null>(null);
  const ambientStarDataRef = useRef<{
    pos: THREE.Vector3;
    targetPos: THREE.Vector3;
    rot: number;
    rotSpeed: number;
    scale: number;
  }[]>([]);

  const photoGroupsRef = useRef<{ id: string; group: THREE.Group; photoMesh: THREE.Mesh; frameMeshes: THREE.Mesh[] }[]>([]);
  const giftObjectsRef = useRef<{ id: string; group: THREE.Group; lid: THREE.Group; giftTag: THREE.Group; meshes: THREE.Mesh[] }[]>([]);
  
  const treeTopLightRef = useRef<THREE.PointLight | null>(null);
  const treeTopStarRef = useRef<THREE.Mesh | null>(null);
  
  const handDataRef = useRef(handData);
  const treeStateRef = useRef(treeState);
  const selectedIdRef = useRef(selectedId);
  const giftsRef = useRef(gifts);

  useEffect(() => { handDataRef.current = handData; }, [handData]);
  useEffect(() => { treeStateRef.current = treeState; }, [treeState]);
  useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);
  useEffect(() => { giftsRef.current = gifts; }, [gifts]);

  const INSTANCE_COUNT = 800;
  const SPIRAL_COUNT = 300; 
  const AMBIENT_STAR_COUNT = 60; // 减少了星星数量，使其更显精致

  const GOLD = new THREE.Color(0xD4AF37);
  const GREEN = new THREE.Color(0x1B3022);
  const RED = new THREE.Color(0x7C1B1B);
  const SILVER = new THREE.Color(0xE0E0E0); 

  const generateGlowTexture = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'white');
    gradient.addColorStop(0.5, 'rgba(255,255,255,0.2)');
    gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(canvas);
  };

  const createTextCanvas = (text: string, subtext: string) => {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, 512, 256);
    ctx.fillStyle = 'rgba(25, 15, 5, 0.95)';
    ctx.roundRect(0, 0, 512, 256, 32);
    ctx.fill();
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 12; ctx.stroke();
    ctx.fillStyle = '#E6C17A';
    ctx.font = 'bold 44px "Noto Serif SC", serif';
    ctx.textAlign = 'center'; ctx.fillText(text, 256, 100);
    ctx.font = '22px "Noto Sans SC", sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    const words = subtext.match(/.{1,18}/g) || [];
    words.forEach((w, i) => ctx.fillText(w, 256, 150 + i * 35));
    return new THREE.CanvasTexture(canvas);
  };

  useEffect(() => {
    if (!containerRef.current) return;
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x020202, 0.05);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 22; cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio); renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.8;
    containerRef.current.appendChild(renderer.domElement); rendererRef.current = renderer;

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.5, 0.9, 0.2);
    composer.addPass(bloomPass); bloomPassRef.current = bloomPass;
    composer.addPass(new OutputPass());

    const glowTexture = generateGlowTexture();
    const particleGeo = new THREE.PlaneGeometry(0.2, 0.2);
    [GOLD, GREEN, RED].forEach(color => {
      const mat = new THREE.MeshBasicMaterial({ color, map: glowTexture, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
      const mesh = new THREE.InstancedMesh(particleGeo, mat, Math.floor(INSTANCE_COUNT / 3));
      scene.add(mesh); particlesRef.current.push(mesh);
    });

    for (let i = 0; i < INSTANCE_COUNT; i++) {
      const pos = new THREE.Vector3((Math.random()-0.5)*25, (Math.random()-0.5)*25, (Math.random()-0.5)*25);
      currentPosRef.current.push(pos); targetsRef.current.push({ pos: pos.clone(), color: GOLD });
    }

    const spiralMesh = new THREE.InstancedMesh(particleGeo, new THREE.MeshBasicMaterial({ color: SILVER, map: glowTexture, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), SPIRAL_COUNT);
    scene.add(spiralMesh); spiralMeshRef.current = spiralMesh;
    for (let i = 0; i < SPIRAL_COUNT; i++) {
      const pos = new THREE.Vector3(0,0,0); spiralCurrentPosRef.current.push(pos); spiralTargetsRef.current.push(pos.clone());
    }

    // Ambient Star Setup
    const starShape = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 0.15 : 0.06; const a = (i * Math.PI) / 5;
      if (i === 0) starShape.moveTo(Math.cos(a)*r, Math.sin(a)*r); else starShape.lineTo(Math.cos(a)*r, Math.sin(a)*r);
    }
    const ambientStarGeo = new THREE.ShapeGeometry(starShape);
    const ambientStarMat = new THREE.MeshBasicMaterial({ color: 0xFFFFEE, transparent: true, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const ambientStars = new THREE.InstancedMesh(ambientStarGeo, ambientStarMat, AMBIENT_STAR_COUNT);
    scene.add(ambientStars);
    ambientStarsRef.current = ambientStars;

    for (let i = 0; i < AMBIENT_STAR_COUNT; i++) {
      const initialPos = new THREE.Vector3((Math.random()-0.5)*20, (Math.random()-0.5)*20, (Math.random()-0.5)*20);
      ambientStarDataRef.current.push({
        pos: initialPos,
        targetPos: initialPos.clone(),
        rot: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.05,
        scale: 0.3 + Math.random() * 0.7
      });
    }

    const treeTopLight = new THREE.PointLight(0xFFD700, 0, 30); treeTopLight.position.set(0, 8.5, 0);
    scene.add(treeTopLight); treeTopLightRef.current = treeTopLight;

    const largeStarShape = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 1 : 0.4; const a = (i * Math.PI) / 5;
      if (i === 0) largeStarShape.moveTo(Math.cos(a)*r, Math.sin(a)*r); else largeStarShape.lineTo(Math.cos(a)*r, Math.sin(a)*r);
    }
    const treeTopStar = new THREE.Mesh(new THREE.ExtrudeGeometry(largeStarShape, { depth: 0.2 }), new THREE.MeshBasicMaterial({ color: 0xFFFFEE }));
    treeTopStar.position.set(0, 8, 0); treeTopStar.scale.set(0.6, 0.6, 0.6);
    scene.add(treeTopStar); treeTopStarRef.current = treeTopStar;

    let time = 0;
    const animate = () => {
      requestAnimationFrame(animate);
      time += 0.01;
      const state = treeStateRef.current;
      const hData = handDataRef.current;
      const selId = selectedIdRef.current;
      const currGifts = giftsRef.current;

      if (bloomPassRef.current) {
        if (state === TreeState.ZOOMED) {
          bloomPassRef.current.strength = THREE.MathUtils.lerp(bloomPassRef.current.strength, 0.1, 0.1);
          bloomPassRef.current.threshold = THREE.MathUtils.lerp(bloomPassRef.current.threshold, 0.95, 0.1);
          renderer.toneMappingExposure = THREE.MathUtils.lerp(renderer.toneMappingExposure, 0.4, 0.1);
        } else {
          bloomPassRef.current.strength = THREE.MathUtils.lerp(bloomPassRef.current.strength, 0.6, 0.05);
          bloomPassRef.current.threshold = THREE.MathUtils.lerp(bloomPassRef.current.threshold, 0.1, 0.05);
          renderer.toneMappingExposure = THREE.MathUtils.lerp(renderer.toneMappingExposure, 0.8, 0.05);
        }
      }

      if (treeTopLightRef.current && treeTopStarRef.current) {
        if (state === TreeState.CLOSED) {
          treeTopLightRef.current.intensity += (3.5 + Math.sin(time*2)*1.5 - treeTopLightRef.current.intensity) * 0.1;
          treeTopStarRef.current.rotation.y += 0.02;
          treeTopStarRef.current.scale.setScalar(0.7 + Math.sin(time*3)*0.05);
        } else {
          treeTopLightRef.current.intensity *= 0.9;
          treeTopStarRef.current.scale.lerp(new THREE.Vector3(0,0,0), 0.1);
        }
      }

      // 礼盒材质与动画
      giftObjectsRef.current.forEach((obj, i) => {
        const gift = currGifts.find(g => g.id === obj.id);
        if (!gift) return;

        let targetOpacity = 1.0;
        if (state === TreeState.ZOOMED) {
          targetOpacity = obj.id === selId ? 1.0 : 0.0;
        }

        obj.meshes.forEach(m => {
          if (m.material instanceof THREE.Material) {
            m.material.opacity = THREE.MathUtils.lerp(m.material.opacity, targetOpacity, 0.08);
          }
        });

        if (state === TreeState.ZOOMED && selId === gift.id) {
          const camPos = cameraRef.current!.position.clone();
          const dir = cameraRef.current!.getWorldDirection(new THREE.Vector3());
          obj.group.position.lerp(camPos.add(dir.multiplyScalar(6)), 0.15);
          obj.group.scale.lerp(new THREE.Vector3(4, 4, 4), 0.1);
          obj.group.lookAt(cameraRef.current!.position);
          obj.group.visible = true;
          obj.group.renderOrder = 10;
        } else if (state === TreeState.CLOSED) {
          obj.group.position.lerp(gift.position, 0.1);
          obj.group.scale.lerp(new THREE.Vector3(1, 1, 1), 0.1);
          obj.group.lookAt(0, gift.position.y, 0);
          obj.group.visible = true;
          obj.group.renderOrder = 0;
        } else if (state === TreeState.DISPERSED) {
          const orbitR = 12 + Math.sin(time + i)*2;
          const a = (i * 1.5) + time * 0.2;
          const target = new THREE.Vector3(Math.cos(a)*orbitR, Math.sin(a*0.3)*5, Math.sin(a)*orbitR);
          obj.group.position.lerp(target, 0.05);
          obj.group.scale.lerp(new THREE.Vector3(1.1, 1.1, 1.1), 0.1);
          obj.group.lookAt(cameraRef.current!.position);
          obj.group.visible = true;
          obj.group.renderOrder = 0;
        } else if (state === TreeState.ZOOMED && selId !== gift.id) {
          if (obj.meshes[0].material.opacity < 0.01) {
            obj.group.visible = false;
          } else {
            obj.group.scale.lerp(new THREE.Vector3(3.5, 3.5, 3.5), 0.05);
            obj.group.renderOrder = 5;
          }
        }

        if (gift.isOpen) {
          obj.lid.position.y += (3 - obj.lid.position.y) * 0.05;
          obj.lid.rotation.x += 0.02; obj.lid.rotation.z += 0.03;
          obj.lid.scale.multiplyScalar(0.98);
          if (obj.lid.scale.x < 0.1) obj.lid.visible = false;
          
          if (gift.name && !obj.giftTag.visible) {
            obj.giftTag.visible = true;
            const tex = createTextCanvas(gift.name, gift.blessing);
            (obj.giftTag.children[0] as THREE.Mesh).material = new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide });
          }
          if (obj.giftTag.visible) {
            obj.giftTag.position.y += (1.8 - obj.giftTag.position.y) * 0.1;
            obj.giftTag.scale.lerp(new THREE.Vector3(1.0, 1.0, 1.0), 0.1);
            obj.giftTag.lookAt(cameraRef.current!.position);
          }
        }
      });

      if (cameraRef.current) {
        cameraRef.current.position.x += (hData.rotation.y * 30 - cameraRef.current.position.x) * 0.04;
        cameraRef.current.position.y += (hData.rotation.x * 25 - cameraRef.current.position.y) * 0.04;
        cameraRef.current.lookAt(0, state === TreeState.CLOSED ? 1 : 0, 0);
      }

      const camQ = cameraRef.current!.quaternion;

      // Update Ambient Stars
      if (ambientStarsRef.current) {
        const dummy = new THREE.Object3D();
        ambientStarDataRef.current.forEach((star, i) => {
          star.pos.lerp(star.targetPos, 0.05);
          star.rot += star.rotSpeed;
          
          dummy.position.copy(star.pos);
          // Gently float
          dummy.position.y += Math.sin(time * 0.5 + i) * 0.05;
          dummy.quaternion.copy(camQ);
          dummy.rotateZ(star.rot);
          
          const s = star.scale * (0.8 + Math.sin(time * 2 + i) * 0.2);
          dummy.scale.setScalar(s);
          
          dummy.updateMatrix();
          ambientStarsRef.current!.setMatrixAt(i, dummy.matrix);
        });
        ambientStarsRef.current.instanceMatrix.needsUpdate = true;
        // Fade out stars when zoomed
        (ambientStarsRef.current.material as THREE.Material).opacity = THREE.MathUtils.lerp((ambientStarsRef.current.material as THREE.Material).opacity, state === TreeState.ZOOMED ? 0.2 : 1.0, 0.1);
      }

      particlesRef.current.forEach((mesh, mIdx) => {
        for (let i = 0; i < mesh.count; i++) {
          const idx = mIdx * mesh.count + i;
          const curr = currentPosRef.current[idx];
          curr.lerp(targetsRef.current[idx].pos, 0.08);
          const dummy = new THREE.Object3D();
          dummy.position.copy(curr); dummy.quaternion.copy(camQ);
          dummy.scale.setScalar(0.8 + Math.sin(time*4 + idx)*0.2);
          dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
        }
        mesh.instanceMatrix.needsUpdate = true;
      });

      if (spiralMeshRef.current) {
        for (let i = 0; i < SPIRAL_COUNT; i++) {
          const progress = i / SPIRAL_COUNT;
          const h = progress * 13 - 6;
          const r = (6.5 - h) * 0.5 + 0.5;
          const a = progress * Math.PI * 10 - time;
          const target = state === TreeState.CLOSED ? new THREE.Vector3(Math.cos(a)*r, h, Math.sin(a)*r) : new THREE.Vector3(0,0,0).addScaledVector(currentPosRef.current[i % INSTANCE_COUNT], 1.5);
          spiralCurrentPosRef.current[i].lerp(target, 0.05);
          const dummy = new THREE.Object3D();
          dummy.position.copy(spiralCurrentPosRef.current[i]); dummy.quaternion.copy(camQ);
          dummy.updateMatrix(); spiralMeshRef.current.setMatrixAt(i, dummy.matrix);
        }
        spiralMeshRef.current.instanceMatrix.needsUpdate = true;
      }

      updatePhotos(time, state);
      composer.render();
    };

    const updatePhotos = (t: number, st: TreeState) => {
      const selId = selectedIdRef.current;
      photoGroupsRef.current.forEach((item, i) => {
        let targetOpacity = 1.0;
        if (st === TreeState.ZOOMED) {
          targetOpacity = item.id === selId ? 1.0 : 0.0;
        }

        [item.photoMesh, ...item.frameMeshes].forEach(m => {
          if (m.material instanceof THREE.Material) {
            m.material.opacity = THREE.MathUtils.lerp(m.material.opacity, targetOpacity, 0.1);
          }
        });

        if (st === TreeState.CLOSED) {
          const h = (i / photoGroupsRef.current.length) * 11 - 5;
          const r = (6 - h) * 0.5 + 1;
          const a = (i * 2.5) + t * 0.3;
          item.group.position.lerp(new THREE.Vector3(Math.cos(a)*r, h, Math.sin(a)*r), 0.1);
          item.group.scale.lerp(new THREE.Vector3(1, 1, 1), 0.1);
          item.group.lookAt(0, h, 0);
          item.group.visible = true;
          item.group.renderOrder = 0;
        } else if (st === TreeState.DISPERSED) {
          const orbitR = 10 + Math.sin(t + i)*1.5;
          const a = (i * 0.8) + t * 0.2;
          item.group.position.lerp(new THREE.Vector3(Math.cos(a)*orbitR, Math.sin(a*0.5)*6, Math.sin(a)*orbitR), 0.05);
          item.group.scale.lerp(new THREE.Vector3(1.2, 1.2, 1.2), 0.1);
          item.group.lookAt(cameraRef.current!.position);
          item.group.visible = true;
          item.group.renderOrder = 0;
        } else if (st === TreeState.ZOOMED) {
          if (item.id === selId) {
            const camPos = cameraRef.current!.position.clone();
            const dir = cameraRef.current!.getWorldDirection(new THREE.Vector3());
            item.group.position.lerp(camPos.add(dir.multiplyScalar(6.5)), 0.15);
            item.group.scale.lerp(new THREE.Vector3(5.5, 5.5, 5.5), 0.1);
            item.group.lookAt(cameraRef.current!.position);
            item.group.visible = true;
            item.group.renderOrder = 20; 
          } else {
            if (item.photoMesh.material.opacity < 0.01) {
              item.group.visible = false;
            } else {
              item.group.scale.lerp(new THREE.Vector3(4.8, 4.8, 4.8), 0.05);
              item.group.renderOrder = 15; 
            }
          }
        }
      });
    };

    animate();
    const handleResize = () => {
      if (!cameraRef.current || !rendererRef.current || !composerRef.current) return;
      cameraRef.current.aspect = window.innerWidth / window.innerHeight; cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(window.innerWidth, window.innerHeight); composerRef.current.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);
    return () => { window.removeEventListener('resize', handleResize); containerRef.current?.removeChild(renderer.domElement); };
  }, []);

  useEffect(() => {
    if (!sceneRef.current) return;
    gifts.forEach(gift => {
      if (!giftObjectsRef.current.find(o => o.id === gift.id)) {
        const group = new THREE.Group();
        const meshes: THREE.Mesh[] = [];

        const baseMat = new THREE.MeshPhongMaterial({ 
          color: Math.random() > 0.5 ? 0x800000 : 0x004d00,
          transparent: true,
          opacity: 1.0
        });
        const base = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), baseMat);
        group.add(base);
        meshes.push(base);

        const lidGroup = new THREE.Group();
        const lidMat = new THREE.MeshPhongMaterial({ color: 0x8B4513, transparent: true, opacity: 1.0 });
        const lid = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.2, 0.9), lidMat);
        lidGroup.add(lid); lidGroup.position.y = 0.45;
        group.add(lidGroup);
        meshes.push(lid);

        const tag = new THREE.Group();
        const tagPlane = new THREE.Mesh(new THREE.PlaneGeometry(2, 1), new THREE.MeshBasicMaterial({ transparent: true, opacity: 1 }));
        tag.add(tagPlane);
        tag.visible = false; group.add(tag);
        
        group.position.copy(gift.position);
        sceneRef.current!.add(group);
        giftObjectsRef.current.push({ id: gift.id, group, lid: lidGroup, giftTag: tag, meshes });
      }
    });
    giftObjectsRef.current = giftObjectsRef.current.filter(obj => {
      const exists = gifts.find(g => g.id === obj.id);
      if (!exists) sceneRef.current?.remove(obj.group);
      return !!exists;
    });
  }, [gifts]);

  useEffect(() => {
    if (!sceneRef.current) return;
    photos.forEach(photo => {
      if (!photoGroupsRef.current.find(p => p.id === photo.id)) {
        const group = new THREE.Group();
        const frameMeshes: THREE.Mesh[] = [];

        const frameMat = new THREE.MeshStandardMaterial({ color: 0x2a1a0f, roughness: 0.8, transparent: true, opacity: 1.0 });
        const frame = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 1.25), frameMat);
        group.add(frame);
        frameMeshes.push(frame);

        const innerMat = new THREE.MeshStandardMaterial({ color: 0x150d05, transparent: true, opacity: 1.0 });
        const inner = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), innerMat);
        inner.position.z = 0.01; group.add(inner);
        frameMeshes.push(inner);

        const photoMat = new THREE.MeshBasicMaterial({ map: photo.texture, side: THREE.DoubleSide, transparent: true, opacity: 1.0 });
        const pMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), photoMat);
        pMesh.position.z = 0.02; group.add(pMesh);

        sceneRef.current!.add(group);
        photoGroupsRef.current.push({ id: photo.id, group, photoMesh: pMesh, frameMeshes });
      }
    });
  }, [photos]);

  useEffect(() => {
    const state = treeStateRef.current;
    if (state === TreeState.CLOSED) {
      targetsRef.current.forEach(t => {
        const h = Math.random() * 14 - 7; const maxR = (7.5 - h) * 0.5; const r = maxR * (0.6 + 0.4 * Math.random());
        const theta = Math.random() * Math.PI * 2; t.pos.set(Math.cos(theta)*r, h, Math.sin(theta)*r);
      });
      // Move ambient stars to tree shell
      ambientStarDataRef.current.forEach(star => {
        const h = Math.random() * 16 - 8;
        const r = ((8.5 - h) * 0.5 + 1.5) * (0.8 + Math.random() * 0.4);
        const theta = Math.random() * Math.PI * 2;
        star.targetPos.set(Math.cos(theta)*r, h, Math.sin(theta)*r);
      });
    } else {
      targetsRef.current.forEach(t => t.pos.set((Math.random()-0.5)*45, (Math.random()-0.5)*45, (Math.random()-0.5)*25));
      // Disperse ambient stars
      ambientStarDataRef.current.forEach(star => {
        star.targetPos.set((Math.random()-0.5)*40, (Math.random()-0.5)*40, (Math.random()-0.5)*30);
      });
    }
  }, [treeState]);

  return <div ref={containerRef} className="w-full h-full" />;
};

export default SceneContainer;
