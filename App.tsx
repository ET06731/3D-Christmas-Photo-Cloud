
import React, { useState, useRef, useEffect } from 'react';
import SceneContainer from './components/SceneContainer';
import HandTrackerUI from './components/HandTrackerUI';
import { TreeState, HandData, PhotoItem, GiftItem } from './types';
import * as THREE from 'three';
import { GoogleGenAI, Type } from "@google/genai";

const BG_MUSIC_URL = 'https://actions.google.com/sounds/v1/holidays/holiday_music_loop.ogg';

const App: React.FC = () => {
  const [treeState, setTreeState] = useState<TreeState>(TreeState.CLOSED);
  const [handData, setHandData] = useState<HandData>({
    gesture: 'NONE',
    rotation: { x: 0, y: 0, z: 0 },
    position: { x: 0.5, y: 0.5, z: 0 }
  });
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  // const [gifts, setGifts] = useState<GiftItem[]>([]);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  // const [isGeneratingGift, setIsGeneratingGift] = useState(false);
  
  const audioCtxRef = useRef<AudioContext | null>(null);
  const bgMusicRef = useRef<HTMLAudioElement | null>(null);
  const lastStateRef = useRef<TreeState>(TreeState.CLOSED);
  const lastHandXRef = useRef<number | null>(null);
  const switchCooldownRef = useRef<number>(0);

  const initAudio = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    if (bgMusicRef.current && bgMusicRef.current.paused && !isMuted) {
      bgMusicRef.current.play().catch(err => console.log("Autoplay prevented:", err));
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (bgMusicRef.current) {
      const newMuted = !isMuted;
      setIsMuted(newMuted);
      bgMusicRef.current.muted = newMuted;
    }
  };

  useEffect(() => {
    const audio = new Audio(BG_MUSIC_URL);
    audio.loop = true;
    audio.volume = 0.25;
    bgMusicRef.current = audio;
    return () => { audio.pause(); bgMusicRef.current = null; };
  }, []);

  const playSound = (type: 'converge' | 'disperse' | 'switch' | 'gift' | 'open') => {
    if (isMuted) return;
    initAudio();
    const ctx = audioCtxRef.current!;
    const now = ctx.currentTime;

    const createOsc = (freq: number, dur: number, g: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(g, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(now + dur);
    };

    if (type === 'gift' || type === 'open') createOsc(523.25, 0.5, 0.1);
    else if (type === 'switch') createOsc(440, 0.1, 0.05);
  };

  /* Gift Logic Commented Out
  const generateAIGift = async (giftId: string) => {
    if (isGeneratingGift || photos.length === 0) return;
    setIsGeneratingGift(true);
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const recentPhotos = photos.slice(-3);
      const parts = recentPhotos.map(p => ({
        inlineData: { 
          mimeType: 'image/jpeg', 
          data: p.base64?.split(',')[1] || '' 
        }
      }));

      const prompt = "你是一位充满魔法色彩的圣诞老人。请观察这些照片中的场景、人物和情感细节。根据这些记忆，为用户挑选一个最能触动心灵的『虚拟礼物』。返回一个 JSON 对象，包含 giftName（礼物名称，4-6字）和 blessing（祝词，20字以内）。";
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { parts: [...parts, { text: prompt }] },
        config: { 
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              giftName: { type: Type.STRING },
              blessing: { type: Type.STRING }
            },
            required: ["giftName", "blessing"]
          }
        },
      });

      const giftData = JSON.parse(response.text);
      setGifts(prev => prev.map(g => g.id === giftId ? { ...g, ...giftData, isOpen: true } : g));
      playSound('open');
    } catch (error) {
      console.error("AI Gift Generation Failed:", error);
      setGifts(prev => prev.map(g => g.id === giftId ? { ...g, giftName: "冬日的暖阳", blessing: "愿这抹记忆的光，照亮你新的一年。", isOpen: true } : g));
    } finally {
      setIsGeneratingGift(false);
    }
  };

  // When a gift is zoomed, trigger the AI
  useEffect(() => {
    if (treeState === TreeState.ZOOMED && selectedId) {
      const gift = gifts.find(g => g.id === selectedId);
      if (gift && !gift.isOpen && !isGeneratingGift) {
        generateAIGift(gift.id);
      }
    }
  }, [treeState, selectedId]);
  */

  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    initAudio(); 
    const files = event.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        const loader = new THREE.TextureLoader();
        loader.load(base64, (texture) => {
          const newId = Math.random().toString(36).substr(2, 9);
          setPhotos(prev => {
            const updated = [...prev, { id: newId, url: base64, texture, base64 }];
            // Gift logic commented out
            /*
            if (updated.length % 2 === 0) {
              const newGift: GiftItem = {
                id: `gift-${Math.random().toString(36).substr(2, 9)}`,
                name: '',
                blessing: '',
                isOpen: false,
                position: new THREE.Vector3(
                  (Math.random() - 0.5) * 8,
                  -5 + Math.random() * 2,
                  (Math.random() - 0.5) * 8
                )
              };
              setGifts(gPrev => [...gPrev, newGift]);
              playSound('gift');
            }
            */
            return updated;
          });
        });
      };
      reader.readAsDataURL(file as Blob);
    });
  };

  useEffect(() => {
    let newState = treeState;
    const now = Date.now();

    if (handData.gesture === 'FIST') {
      newState = TreeState.CLOSED;
      setSelectedId(null);
    } else if (handData.gesture === 'OPEN') {
      newState = TreeState.DISPERSED;
      setSelectedId(null);
    } else if (handData.gesture === 'GRAB') {
      if (now > switchCooldownRef.current) {
        // const allItems = [...photos.map(p => ({ id: p.id })), ...gifts.map(g => ({ id: g.id }))];
        const allItems = [...photos.map(p => ({ id: p.id }))];
        
        if (treeState === TreeState.CLOSED || treeState === TreeState.DISPERSED) {
          if (allItems.length > 0) {
            const randomItem = allItems[Math.floor(Math.random() * allItems.length)];
            setSelectedId(randomItem.id);
            newState = TreeState.ZOOMED;
            switchCooldownRef.current = now + 1000;
          }
        } else if (treeState === TreeState.ZOOMED) {
           if (lastHandXRef.current !== null) {
            const deltaX = handData.position.x - lastHandXRef.current;
            if (Math.abs(deltaX) > 0.15) {
              const currentIndex = allItems.findIndex(item => item.id === selectedId);
              let nextIndex = deltaX > 0 ? (currentIndex + 1) % allItems.length : (currentIndex - 1 + allItems.length) % allItems.length;
              setSelectedId(allItems[nextIndex].id);
              playSound('switch');
              switchCooldownRef.current = now + 800;
              lastHandXRef.current = handData.position.x;
            }
          }
        }
      }
    }

    if (newState !== lastStateRef.current) {
      lastStateRef.current = newState;
      setTreeState(newState);
    }
    if (handData.gesture === 'GRAB' && treeState === TreeState.ZOOMED && lastHandXRef.current === null) {
      lastHandXRef.current = handData.position.x;
    } else if (handData.gesture !== 'GRAB') {
      lastHandXRef.current = null;
    }
  }, [handData, photos, /* gifts, */ treeState, selectedId]);

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden cursor-pointer" onClick={initAudio}>
      <div className="absolute inset-0 z-0">
        <SceneContainer 
          treeState={treeState} 
          handData={handData} 
          photos={photos}
          // gifts={gifts}
          selectedId={selectedId}
        />
      </div>

      <div className="absolute top-6 right-6 z-30 flex flex-col items-center gap-4">
        <div className="flex flex-col items-end gap-1 group">
          <label className="cursor-pointer bg-white/5 hover:bg-white/10 border border-white/20 p-3 rounded-full transition-all shadow-xl backdrop-blur-md">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white/60 group-hover:text-red-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <input type="file" multiple className="hidden" onChange={handlePhotoUpload} accept="image/*" />
          </label>
          <span className="text-[9px] text-white/20 tracking-widest uppercase pointer-events-none group-hover:text-white/40 transition-colors mr-1">上传记忆</span>
        </div>

        <button onClick={toggleMute} className="flex flex-col items-center gap-2 group">
          <div className="bg-white/5 hover:bg-white/10 border border-white/20 p-3 rounded-full transition-all shadow-xl backdrop-blur-md">
            <div className="flex gap-0.5 items-end h-4 w-5 justify-center">
              {[1, 2, 3].map(i => (
                <div key={i} className={`w-0.5 bg-yellow-500/60 rounded-full transition-all ${!isMuted ? 'animate-pulse' : 'h-1'}`}
                  style={{ height: !isMuted ? `${40 + Math.random() * 60}%` : '20%' }}
                />
              ))}
            </div>
          </div>
          <span className="text-[9px] text-white/20 tracking-widest uppercase group-hover:text-white/40 transition-colors">{isMuted ? '静音' : '音乐'}</span>
        </button>
      </div>

      <div className="absolute top-6 left-6 z-20 w-32 h-24 rounded-xl overflow-hidden border border-white/10 bg-black/50 backdrop-blur-md shadow-2xl transition-all hover:w-48 hover:h-36">
        <HandTrackerUI onHandUpdate={setHandData} onCameraReady={() => setIsCameraActive(true)} />
      </div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-4 w-full max-w-md px-4 text-center pointer-events-none">
        {/*
        {isGeneratingGift && (
          <div className="flex items-center gap-2 px-6 py-3 bg-red-900/40 rounded-full border border-red-500/30 animate-pulse backdrop-blur-xl">
            <div className="w-2 h-2 bg-red-400 rounded-full animate-ping" />
            <span className="text-white/90 text-xs font-light tracking-[0.2em] uppercase">AI 正在根据你的记忆挑选礼物...</span>
          </div>
        )}
        */}
        
        <div className="bg-black/40 backdrop-blur-md px-8 py-4 rounded-full border border-white/10">
          <div className="flex gap-8 text-[10px] font-light tracking-[0.3em] text-white/40 uppercase">
            <div className={`transition-all duration-300 ${handData.gesture === 'FIST' ? 'text-red-500 scale-110 font-bold' : ''}`}>握拳·归位</div>
            <div className={`transition-all duration-300 ${handData.gesture === 'OPEN' ? 'text-green-400 scale-110 font-bold' : ''}`}>掌开·星云</div>
            <div className={`transition-all duration-300 ${handData.gesture === 'GRAB' ? 'text-yellow-400 scale-110 font-bold' : ''}`}>捏合·开启</div>
          </div>
        </div>
      </div>

      <div className="bloom-overlay" />
      
      {!isCameraActive && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#050505]">
          <div className="text-center space-y-4">
            <div className="relative w-12 h-12 mx-auto">
              <div className="absolute inset-0 border border-white/5 rounded-full"></div>
              <div className="absolute inset-0 border border-t-red-600 rounded-full animate-spin"></div>
            </div>
            <p className="text-white/30 text-[10px] uppercase tracking-[0.5em] font-extralight">加载中...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
