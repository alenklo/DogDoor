import React, { useState } from 'react';
import { PiConfig, DoorMode } from '../types';
import { Settings, Shield, Zap, Smartphone, Sparkles, Sliders, Timer, Lock, MousePointer, Camera, Bell, VideoOff, Video, CircuitBoard } from 'lucide-react';

interface ControlPanelProps {
  config: PiConfig;
  setConfig: React.Dispatch<React.SetStateAction<PiConfig>>;
  isLocked: boolean;
  onOpenGpio: () => void;
  onOpenSim: () => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({ config, setConfig, isLocked, onOpenGpio, onOpenSim }) => {
  
  const handleHoldTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setConfig(prev => ({ ...prev, holdOpenTime: parseInt(e.target.value) }));
  };

  const handleSpeedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setConfig(prev => ({ ...prev, motorSpeed: parseInt(e.target.value) }));
  };

  const handleConfidenceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setConfig(prev => ({ ...prev, confidenceThreshold: parseFloat(e.target.value) }));
  };

  const handleGraceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setConfig(prev => ({ ...prev, gracePeriod: parseFloat(e.target.value) }));
  };

  const toggleNotifications = () => {
    setConfig(prev => ({
        ...prev,
        notifications: {
            ...prev.notifications,
            enabled: !prev.notifications.enabled
        }
    }));
  };

  const toggleCamera = () => {
    setConfig(prev => ({ ...prev, cameraEnabled: !prev.cameraEnabled }));
  };

  const toggleAiFallback = () => {
      setConfig(prev => ({ ...prev, aiFallbackEnabled: !prev.aiFallbackEnabled }));
  };

  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setConfig(prev => ({
          ...prev,
          notifications: {
              ...prev.notifications,
              apiKey: val
          }
      }));
  };
  
  const handleGeminiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setConfig(prev => ({ ...prev, geminiApiKey: val }));
  };

  const setMode = (mode: DoorMode) => {
    setConfig(prev => ({ ...prev, doorMode: mode }));
  };

  return (
    <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 shadow-sm space-y-8">
      
      {/* Mode Selector */}
      <div>
        <div className="flex items-center gap-2 mb-4 text-gray-100">
            <Shield className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-semibold">System Mode</h2>
        </div>
        <div className="grid grid-cols-3 gap-2 bg-gray-800 p-1 rounded-lg">
            <button 
                onClick={() => setMode(DoorMode.AUTO)}
                disabled={isLocked}
                className={`flex flex-col items-center justify-center py-3 rounded-md transition-all ${
                    config.doorMode === DoorMode.AUTO 
                    ? 'bg-indigo-600 text-white shadow-lg' 
                    : 'text-gray-400 hover:text-white hover:bg-gray-700'
                }`}
            >
                <Sparkles className="w-5 h-5 mb-1" />
                <span className="text-xs font-bold">AUTO</span>
            </button>
            <button 
                onClick={() => setMode(DoorMode.MANUAL)}
                disabled={isLocked}
                className={`flex flex-col items-center justify-center py-3 rounded-md transition-all ${
                    config.doorMode === DoorMode.MANUAL 
                    ? 'bg-amber-600 text-white shadow-lg' 
                    : 'text-gray-400 hover:text-white hover:bg-gray-700'
                }`}
            >
                <MousePointer className="w-5 h-5 mb-1" />
                <span className="text-xs font-bold">MANUAL</span>
            </button>
            <button 
                onClick={() => setMode(DoorMode.LOCKED)}
                disabled={isLocked}
                className={`flex flex-col items-center justify-center py-3 rounded-md transition-all ${
                    config.doorMode === DoorMode.LOCKED 
                    ? 'bg-red-600 text-white shadow-lg' 
                    : 'text-gray-400 hover:text-white hover:bg-gray-700'
                }`}
            >
                <Lock className="w-5 h-5 mb-1" />
                <span className="text-xs font-bold">LOCKED</span>
            </button>
        </div>
      </div>

      {/* Advanced Tools Buttons */}
      <div className="grid grid-cols-2 gap-3">
          <button
            onClick={onOpenGpio}
            disabled={isLocked}
            className="flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 py-3 rounded-lg border border-gray-700 transition-colors"
          >
              <CircuitBoard className="w-4 h-4" />
              <span className="text-sm font-medium">GPIO Config</span>
          </button>
          <button
            onClick={onOpenSim}
            disabled={isLocked}
            className="flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 py-3 rounded-lg border border-gray-700 transition-colors"
          >
              <Sliders className="w-4 h-4" />
              <span className="text-sm font-medium">Simulator</span>
          </button>
      </div>

      {/* Door Mechanics */}
      <div>
        <div className="flex items-center gap-2 mb-6 text-gray-100">
            <Settings className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-semibold">Door Mechanics</h2>
        </div>

        <div className="space-y-6">
             {/* Camera Toggle */}
             <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
                    {config.cameraEnabled ? <Video className="w-4 h-4 text-emerald-400" /> : <VideoOff className="w-4 h-4 text-gray-500" />}
                    Enable Camera Feed
                </label>
                <button 
                    onClick={toggleCamera}
                    disabled={isLocked}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50 ${
                        config.cameraEnabled ? 'bg-emerald-500' : 'bg-gray-700'
                    }`}
                >
                    <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                        config.cameraEnabled ? 'translate-x-5' : 'translate-x-1'
                    }`} />
                </button>
            </div>

            {/* Hold Open Time */}
            <div>
            <div className="flex justify-between mb-2">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
                <Timer className="w-4 h-4 text-gray-500" />
                Hold Open Duration
                </label>
                <span className="text-sm font-mono text-cyan-400 bg-cyan-900/20 px-2 py-0.5 rounded">
                {config.holdOpenTime}s
                </span>
            </div>
            <input
                type="range"
                min="5"
                max="60"
                step="1"
                value={config.holdOpenTime}
                onChange={handleHoldTimeChange}
                disabled={isLocked}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500 disabled:opacity-50"
            />
            <div className="flex justify-between text-[10px] text-gray-500 px-1 mt-1">
                <span>5s</span>
                <span>30s</span>
                <span>60s</span>
            </div>
            </div>

            {/* Motor Speed */}
            <div>
            <div className="flex justify-between mb-2">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
                <Sliders className="w-4 h-4 text-gray-500" />
                Motor Speed
                </label>
                <span className="text-sm font-mono text-pink-400 bg-pink-900/20 px-2 py-0.5 rounded">
                Lvl {config.motorSpeed}
                </span>
            </div>
            <input
                type="range"
                min="1"
                max="5"
                step="1"
                value={config.motorSpeed}
                onChange={handleSpeedChange}
                disabled={isLocked}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-pink-500 disabled:opacity-50"
            />
             <div className="flex justify-between text-[10px] text-gray-500 px-1 mt-1">
                <span>Slow</span>
                <span>Fast</span>
            </div>
            </div>
        </div>
      </div>

      {/* AI Settings */}
      {config.cameraEnabled && (
      <div className="pt-6 border-t border-gray-800">
         <div className="flex items-center gap-2 mb-6 text-gray-100">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-semibold">AI Detection</h2>
        </div>

        <div className="space-y-6">
             {/* AI Fallback Toggle */}
             <div className="flex items-center justify-between bg-indigo-900/10 p-3 rounded-lg border border-indigo-500/20">
                <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    <div>
                        <label className="text-sm font-medium text-purple-100">Smart AI Verification</label>
                        <p className="text-[10px] text-purple-300/60">Use Gemini for backup detection</p>
                    </div>
                </div>
                <button 
                    onClick={toggleAiFallback}
                    disabled={isLocked}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50 ${
                        config.aiFallbackEnabled ? 'bg-purple-500' : 'bg-gray-700'
                    }`}
                >
                    <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                        config.aiFallbackEnabled ? 'translate-x-5' : 'translate-x-1'
                    }`} />
                </button>
            </div>
            
             {config.aiFallbackEnabled && (
                <div className="animate-in slide-in-from-top-2 fade-in duration-300">
                    <input 
                        type="password"
                        value={config.geminiApiKey || ''}
                        onChange={handleGeminiKeyChange}
                        placeholder="Gemini API Key"
                        disabled={isLocked}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                    />
                </div>
            )}

            {/* Grace Period */}
            <div>
            <div className="flex justify-between mb-2">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
                <Zap className="w-4 h-4 text-gray-500" />
                Motion Stability
                </label>
                <span className="text-sm font-mono text-amber-400 bg-amber-900/20 px-2 py-0.5 rounded">
                {config.gracePeriod || 0}s
                </span>
            </div>
            <input
                type="range"
                min="0"
                max="5.0"
                step="0.5"
                value={config.gracePeriod || 0}
                onChange={handleGraceChange}
                disabled={isLocked}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-amber-500 disabled:opacity-50"
            />
            </div>

             {/* Confidence Threshold */}
             <div>
            <div className="flex justify-between mb-2">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
                <Shield className="w-4 h-4 text-gray-500" />
                Sensitivity
                </label>
                <span className="text-sm font-mono text-emerald-400 bg-emerald-900/20 px-2 py-0.5 rounded">
                {(config.confidenceThreshold * 100).toFixed(0)}%
                </span>
            </div>
            <input
                type="range"
                min="0.2" 
                max="0.95"
                step="0.05"
                value={config.confidenceThreshold}
                onChange={handleConfidenceChange}
                disabled={isLocked}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-500 disabled:opacity-50"
            />
            </div>
        </div>
      </div>
      )}
      
      {/* Notifications Section */}
      <div className="pt-6 border-t border-gray-800">
         <div className="flex items-center gap-2 mb-6 text-gray-100">
            <Bell className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-semibold">Notifications</h2>
        </div>

        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
                    <Smartphone className="w-4 h-4 text-gray-500" />
                    Pushbullet Alerts
                </label>
                <button 
                    onClick={toggleNotifications}
                    disabled={isLocked}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
                        config.notifications.enabled ? 'bg-indigo-600' : 'bg-gray-700'
                    }`}
                >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        config.notifications.enabled ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                </button>
            </div>

            {config.notifications.enabled && (
                <div className="animate-in slide-in-from-top-2 fade-in duration-300">
                    <input 
                        type="password"
                        value={config.notifications.apiKey}
                        onChange={handleApiKeyChange}
                        placeholder="Pushbullet API Key"
                        disabled={isLocked}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    />
                </div>
            )}
        </div>
      </div>
    </div>
  );
};