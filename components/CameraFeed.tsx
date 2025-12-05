import React, { useRef, useEffect, useState, useCallback } from 'react';
import { RefreshCw, Sparkles, Scan, Check } from 'lucide-react';
import { analyzeDogSnapshot } from '../services/geminiService';
import { PiConfig } from '../types';

interface CameraFeedProps {
  onAnalysisComplete: (text: string) => void;
  isConnected: boolean;
  config: PiConfig;
  setConfig: React.Dispatch<React.SetStateAction<PiConfig>>;
}

export const CameraFeed: React.FC<CameraFeedProps> = ({ onAnalysisComplete, isConnected, config, setConfig }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isEditingZone, setIsEditingZone] = useState(false);

  useEffect(() => {
    // Only use browser webcam if NOT connected to Pi (Demo Mode)
    if (!isConnected) {
        const startCamera = async () => {
        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({ 
            video: { width: 640, height: 480 } 
            });
            setStream(mediaStream);
            if (videoRef.current) {
            videoRef.current.srcObject = mediaStream;
            }
            setError('');
        } catch (err) {
            console.error("Camera Error:", err);
            setError('Unable to access camera.');
        }
        };
        startCamera();
    } else {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected]);

  const handleSmartAnalysis = useCallback(async () => {
    setIsAnalyzing(true);
    let dataUrl = '';

    if (isConnected) {
        try {
            const response = await fetch('/snapshot'); 
            const blob = await response.blob();
            dataUrl = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.readAsDataURL(blob);
            });
        } catch (e) {
            console.error("Failed to fetch snapshot from Pi", e);
            setIsAnalyzing(false);
            return;
        }
    } else {
        if (!videoRef.current || !canvasRef.current) return;
        const context = canvasRef.current.getContext('2d');
        if (context) {
            context.drawImage(videoRef.current, 0, 0, 640, 480);
            dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.8);
        }
    }

    if (dataUrl) {
        const result = await analyzeDogSnapshot(dataUrl);
        onAnalysisComplete(result);
    }
    
    setIsAnalyzing(false);
  }, [onAnalysisComplete, isConnected]);

  const updateZone = (key: 'x' | 'y' | 'w' | 'h', val: number) => {
      setConfig(prev => ({
          ...prev,
          detectionZone: {
              ...prev.detectionZone,
              [key]: val
          }
      }));
  };

  return (
    <div className="relative w-full h-full bg-transparent">
      {/* Video Element (Only for Demo Mode / Not Connected) */}
      {!isConnected && (
           <video 
           ref={videoRef} 
           autoPlay 
           playsInline 
           muted 
           className="w-full h-full object-cover bg-black"
         />
      )}
     
      <canvas ref={canvasRef} width="640" height="480" className="hidden" />

      {/* Zone Editor Overlay - Visible when isEditingZone is TRUE */}
      {isEditingZone && (
          <div className="absolute inset-0 bg-black/70 p-4 flex flex-col justify-end pointer-events-auto z-30">
              <div className="bg-gray-900 border border-gray-600 p-4 rounded-xl space-y-3 shadow-2xl">
                  <div className="flex justify-between items-center mb-2 border-b border-gray-700 pb-2">
                      <h4 className="text-sm font-bold text-blue-400">Adjust Detection Zone</h4>
                      <button 
                        onClick={() => setIsEditingZone(false)} 
                        className="bg-blue-600 hover:bg-blue-500 text-white p-1.5 rounded-full transition-colors"
                      >
                          <Check className="w-4 h-4" />
                      </button>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                      <div>
                          <label className="text-[10px] uppercase font-bold text-gray-400 block mb-1">Position X</label>
                          <input 
                            type="range" min="0" max="1" step="0.05" 
                            value={config.detectionZone.x} 
                            onChange={(e) => updateZone('x', parseFloat(e.target.value))}
                            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                          />
                      </div>
                      <div>
                          <label className="text-[10px] uppercase font-bold text-gray-400 block mb-1">Position Y</label>
                          <input 
                            type="range" min="0" max="1" step="0.05" 
                            value={config.detectionZone.y} 
                            onChange={(e) => updateZone('y', parseFloat(e.target.value))}
                            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                          />
                      </div>
                      <div>
                          <label className="text-[10px] uppercase font-bold text-gray-400 block mb-1">Width</label>
                          <input 
                            type="range" min="0.1" max="1" step="0.05" 
                            value={config.detectionZone.w} 
                            onChange={(e) => updateZone('w', parseFloat(e.target.value))}
                            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                          />
                      </div>
                      <div>
                          <label className="text-[10px] uppercase font-bold text-gray-400 block mb-1">Height</label>
                          <input 
                            type="range" min="0.1" max="1" step="0.05" 
                            value={config.detectionZone.h} 
                            onChange={(e) => updateZone('h', parseFloat(e.target.value))}
                            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                          />
                      </div>
                  </div>
                  <p className="text-[10px] text-gray-400 text-center mt-1">
                      Drag sliders to move the BLUE BOX on the video.
                  </p>
              </div>
          </div>
      )}

      {/* Main Controls Overlay - Always visible when NOT editing zone */}
      {!isEditingZone && (
        <div className="absolute bottom-0 left-0 right-0 p-3 bg-black/60 backdrop-blur-sm flex justify-between items-end pointer-events-auto z-20">
            <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 px-2 py-1 bg-red-500/20 text-red-400 text-xs font-mono rounded border border-red-500/30">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    LIVE
                </span>
                
                <button 
                  onClick={() => setIsEditingZone(true)}
                  disabled={!isConnected}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded shadow-lg border border-blue-400/50 transition-all disabled:opacity-50 disabled:grayscale"
                >
                    <Scan className="w-3.5 h-3.5" />
                    SET ZONE
                </button>
            </div>

            <button 
            onClick={handleSmartAnalysis}
            disabled={isAnalyzing}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded-lg font-medium text-xs transition-all shadow-lg hover:shadow-indigo-500/25"
            >
            {isAnalyzing ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
                <Sparkles className="w-3.5 h-3.5" />
            )}
            {isAnalyzing ? "..." : "Gemini"}
            </button>
        </div>
      )}

      {error && !isConnected && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/90 text-red-400 p-4 text-center z-10">
          <p>{error}</p>
        </div>
      )}
    </div>
  );
};