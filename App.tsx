import React, { useState, useEffect } from 'react';
import { CameraFeed } from './components/CameraFeed';
import { ControlPanel } from './components/ControlPanel';
import { SystemStatus } from './components/SystemStatus';
import { PiConfig, SystemState, AnalysisResult, DoorMode, GpioConfig, SimulationState } from './types';
import { piApi } from './services/api';
import { Terminal, Power, Cpu, AlertCircle, WifiOff, ArrowUp, ArrowDown, VideoOff, CircuitBoard, X, Radio, ArrowRightFromLine, ArrowLeftFromLine, Sliders } from 'lucide-react';

const App: React.FC = () => {
  // --- State ---
  const [isConnected, setIsConnected] = useState(false);
  const [systemState, setSystemState] = useState<SystemState>(SystemState.IDLE);
  const [config, setConfig] = useState<PiConfig>({
    doorMode: DoorMode.AUTO,
    motorSpeed: 3,
    holdOpenTime: 10,
    cameraEnabled: true, // Default on
    gpio: { dir: 20, step: 21, enable: 16, limitOpen: 19, limitClose: 26, safety: 13, btnOpen: 5, btnClose: 6, proxOutside: 23, proxInside: 24 },
    confidenceThreshold: 0.5,
    gracePeriod: 1.5,
    cameraIndex: 0,
    detectionZone: { x: 0.0, y: 0.0, w: 1.0, h: 1.0 }, 
    aiFallbackEnabled: false,
    notifications: { enabled: false, provider: 'pushbullet', apiKey: '' },
    timeThreshold: 5, triggerCooldown: 15
  });
  
  const [doorTimer, setDoorTimer] = useState(0); 
  const [geminiAnalysis, setGeminiAnalysis] = useState<AnalysisResult | null>(null);
  const [lastLog, setLastLog] = useState<string>("System initialized...");
  const [pollingError, setPollingError] = useState(false);
  const [isCommanding, setIsCommanding] = useState(false);
  const [videoError, setVideoError] = useState(false);
  
  // Modals
  const [showGpioModal, setShowGpioModal] = useState(false);
  const [showSimModal, setShowSimModal] = useState(false);
  const [simState, setSimState] = useState<SimulationState>({ enabled: false, overrides: {} });

  // --- Handlers ---

  const toggleConnection = async () => {
    if (isConnected) {
        setIsConnected(false);
        setPollingError(false);
        setVideoError(false);
    } else {
        try {
            const remoteConfig = await piApi.getConfig();
            setConfig(remoteConfig);
            setIsConnected(true);
            setPollingError(false);
            setVideoError(false);
            setLastLog("[INFO] Connected to Raspberry Pi Backend");
        } catch (err) {
            console.error(err);
            setLastLog("[ERR] Could not connect to Pi. Is the Python script running?");
            alert("Could not connect to the backend. Make sure the Python script is running.");
        }
    }
  };

  const handleConfigChange = (newConfig: React.SetStateAction<PiConfig>) => {
      const updated = typeof newConfig === 'function' ? newConfig(config) : newConfig;
      setConfig(updated);

      if (isConnected) {
          piApi.updateConfig(updated).catch(err => {
              setLastLog("[ERR] Failed to save settings to Pi");
              console.error("Config save failed", err);
          });
      }
  };

  const sendDoorCommand = async (cmd: 'open' | 'close') => {
      if (!isConnected) return;
      setIsCommanding(true);
      try {
          await piApi.sendCommand(cmd as any);
          setLastLog(`[CMD] Manual ${cmd.toUpperCase()} Sent`);
      } catch (err) {
          console.error(err);
          setLastLog("[ERR] Failed to send command");
      } finally {
          setIsCommanding(false);
      }
  };

  const updateSimulation = async (key: string, value: boolean) => {
    if (!isConnected) return;
    const newOverrides = { ...simState.overrides, [key]: value };
    const newSimState = { ...simState, overrides: newOverrides };
    setSimState(newSimState);
    
    // Send to server
    try {
      await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSimState),
      });
    } catch(e) { console.error(e); }
  };

  const toggleSimMode = async () => {
      if (!isConnected) return;
      const newState = { ...simState, enabled: !simState.enabled };
      setSimState(newState);
      try {
        await fetch('/api/simulate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newState),
        });
      } catch(e) { console.error(e); }
  };

  const handleGeminiResult = (text: string) => {
    setGeminiAnalysis({ text, timestamp: new Date() });
    setLastLog("[AI] Analysis received");
  };

  useEffect(() => {
    let intervalId: number;
    if (isConnected) {
        const pollBackend = async () => {
            try {
                const status = await piApi.getStatus();
                setSystemState(status.state);
                setDoorTimer(status.elapsed_time); 
                setPollingError(false);
                if (status.last_message) setLastLog(status.last_message);
            } catch (err) {
                console.error("Polling error", err);
                setPollingError(true);
            }
        };
        pollBackend();
        intervalId = window.setInterval(pollBackend, 500);
    }
    return () => clearInterval(intervalId);
  }, [isConnected]);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-4 md:p-8 font-sans relative">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gray-900/50 p-6 rounded-2xl border border-gray-800 backdrop-blur-sm">
          <div>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-cyan-400">
              DogDoor Pro
            </h1>
            <p className="text-gray-400 text-sm mt-1 flex items-center gap-2">
              <Cpu className="w-4 h-4" /> Motorized Sliding Door System
            </p>
          </div>
          
          <button
            onClick={toggleConnection}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-full font-semibold transition-all shadow-lg ${
              isConnected 
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/50 hover:bg-emerald-500/20' 
                : 'bg-gray-700/50 text-gray-300 border border-gray-600 hover:bg-gray-700'
            }`}
          >
            <Power className="w-5 h-5" />
            {isConnected ? 'Connected' : 'Connect to Pi'}
          </button>
        </header>

        {pollingError && isConnected && (
            <div className="bg-red-900/20 border border-red-800 p-3 rounded-xl flex items-center gap-3 animate-pulse">
                <WifiOff className="w-5 h-5 text-red-400" />
                <span className="text-red-300 text-sm">Lost connection to Backend... Retrying...</span>
            </div>
        )}

        <main className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
          
          {/* Left Column: Camera / Status Board */}
          <div className="lg:col-span-2 space-y-6">
            <div className="aspect-video w-full rounded-2xl overflow-hidden shadow-2xl bg-black relative border border-gray-800">
              
              {/* If Camera Enabled, Show Feed */}
              {config.cameraEnabled ? (
                 isConnected ? (
                  <div className="w-full h-full">
                      {!videoError ? (
                         <img 
                         src="/video_feed" 
                         alt="Live Stream" 
                         className="absolute inset-0 w-full h-full object-cover z-0"
                         onError={() => setVideoError(true)}
                       />
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 gap-2 z-0 bg-gray-900">
                           <VideoOff className="w-12 h-12 opacity-50" />
                           <span className="text-sm font-mono">Camera Feed Offline</span>
                        </div>
                      )}
                      <div className="absolute inset-0 pointer-events-none z-10">
                        <CameraFeed 
                          isConnected={isConnected} 
                          onAnalysisComplete={handleGeminiResult}
                          config={config}
                          setConfig={handleConfigChange}
                        />
                      </div>
                  </div>
              ) : (
                  <CameraFeed 
                    isConnected={false} 
                    onAnalysisComplete={handleGeminiResult} 
                    config={config}
                    setConfig={handleConfigChange}
                  />
              )
              ) : (
                  /* Sensor Status Dashboard (No Camera Mode) */
                  <div className="w-full h-full bg-gray-900 flex flex-col items-center justify-center p-8">
                      <h2 className="text-2xl font-bold text-gray-600 mb-8 flex items-center gap-2">
                          <CircuitBoard className="w-6 h-6" /> Sensor Status
                      </h2>
                      <div className="grid grid-cols-3 gap-8 w-full max-w-lg">
                         <div className={`flex flex-col items-center gap-2 p-4 rounded-xl border ${systemState === SystemState.OPEN ? 'bg-emerald-900/20 border-emerald-500/50' : 'bg-gray-800 border-gray-700'}`}>
                             <ArrowLeftFromLine className={`w-8 h-8 ${systemState === SystemState.OPEN ? 'text-emerald-400' : 'text-gray-500'}`} />
                             <span className="text-xs font-bold text-gray-400">OPEN LIMIT</span>
                         </div>
                         <div className={`flex flex-col items-center gap-2 p-4 rounded-xl border ${simState.overrides.safety ? 'bg-red-900/20 border-red-500/50' : 'bg-gray-800 border-gray-700'}`}>
                             <AlertCircle className={`w-8 h-8 ${simState.overrides.safety ? 'text-red-400' : 'text-gray-500'}`} />
                             <span className="text-xs font-bold text-gray-400">SAFETY</span>
                         </div>
                         <div className={`flex flex-col items-center gap-2 p-4 rounded-xl border ${systemState === SystemState.CLOSED ? 'bg-indigo-900/20 border-indigo-500/50' : 'bg-gray-800 border-gray-700'}`}>
                             <ArrowRightFromLine className={`w-8 h-8 ${systemState === SystemState.CLOSED ? 'text-indigo-400' : 'text-gray-500'}`} />
                             <span className="text-xs font-bold text-gray-400">CLOSE LIMIT</span>
                         </div>
                      </div>
                      <p className="mt-8 text-sm text-gray-500">Camera feed is disabled. System running on Logic Mode.</p>
                  </div>
              )}
              
            </div>

            {config.cameraEnabled && geminiAnalysis && (
              <div className="bg-indigo-950/30 border border-indigo-500/30 p-4 rounded-xl animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex justify-between items-start mb-2">
                   <h3 className="text-indigo-300 font-semibold flex items-center gap-2">
                      <Terminal className="w-4 h-4" /> Gemini Analysis
                   </h3>
                   <span className="text-xs text-gray-500">{geminiAnalysis.timestamp.toLocaleTimeString()}</span>
                </div>
                <p className="text-gray-200 leading-relaxed text-sm">
                  {geminiAnalysis.text}
                </p>
              </div>
            )}
          </div>

          {/* Right Column: Controls */}
          <div className="space-y-6">
            
            {/* Manual Controls */}
             <div className="grid grid-cols-2 gap-3">
                <button
                    onClick={() => sendDoorCommand('open')}
                    disabled={!isConnected || systemState === SystemState.LOCKED}
                    className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-800 disabled:text-gray-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                    <ArrowUp className="w-6 h-6" />
                    OPEN
                </button>
                <button
                    onClick={() => sendDoorCommand('close')}
                    disabled={!isConnected || systemState === SystemState.LOCKED}
                    className="bg-amber-600 hover:bg-amber-500 disabled:bg-gray-800 disabled:text-gray-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                    <ArrowDown className="w-6 h-6" />
                    CLOSE
                </button>
             </div>
             
             {systemState === SystemState.LOCKED && (
                 <div className="bg-red-900/30 border border-red-500/50 p-3 rounded-lg text-center text-red-200 text-sm font-bold animate-pulse">
                     SYSTEM LOCKED - MANUAL CONTROLS DISABLED
                 </div>
             )}

            {/* System Status Indicators */}
            <SystemStatus 
              state={systemState} 
              elapsedTime={doorTimer} 
              threshold={config.holdOpenTime} 
            />

            {/* Config Panel */}
            <ControlPanel 
              config={config} 
              setConfig={handleConfigChange} 
              isLocked={!isConnected}
              onOpenGpio={() => setShowGpioModal(true)}
              onOpenSim={() => setShowSimModal(true)}
            />

            {/* Debug Console Log */}
            <div className="bg-black rounded-xl p-4 border border-gray-800 h-64 overflow-y-auto font-mono text-xs">
              <div className="text-gray-500 mb-2 border-b border-gray-800 pb-2 sticky top-0 bg-black">System Logs</div>
              <div className="space-y-1">
                 <div className="text-gray-400 font-mono">{lastLog}</div>
              </div>
            </div>

          </div>
        </main>
      </div>

      {/* GPIO CONFIG MODAL */}
      {showGpioModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 w-full max-w-md rounded-2xl border border-gray-700 p-6 shadow-2xl">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-gray-100 flex items-center gap-2">
                        <CircuitBoard className="w-5 h-5 text-indigo-400" /> GPIO Assignment (BCM)
                    </h3>
                    <button onClick={() => setShowGpioModal(false)}><X className="text-gray-500 hover:text-white" /></button>
                </div>
                <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                    {Object.entries(config.gpio).map(([key, val]) => (
                        <div key={key} className="flex justify-between items-center bg-gray-800 p-3 rounded-lg border border-gray-700">
                             <label className="text-sm font-mono text-gray-400 uppercase">{key.replace(/([A-Z])/g, ' $1').trim()}</label>
                             <input 
                                type="number" 
                                value={val} 
                                onChange={(e) => setConfig(prev => ({...prev, gpio: {...prev.gpio, [key]: parseInt(e.target.value)}}))}
                                className="bg-gray-900 border border-gray-600 rounded w-16 px-2 py-1 text-right text-indigo-400 font-bold focus:border-indigo-500 focus:outline-none"
                             />
                        </div>
                    ))}
                </div>
                <div className="mt-6 flex justify-end gap-3">
                     <button onClick={() => setShowGpioModal(false)} className="px-4 py-2 text-gray-400 hover:text-white">Cancel</button>
                     <button onClick={() => { handleConfigChange(config); setShowGpioModal(false); }} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold">Save & Apply</button>
                </div>
            </div>
        </div>
      )}

      {/* SIMULATION MODAL */}
      {showSimModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 w-full max-w-md rounded-2xl border border-gray-700 p-6 shadow-2xl">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-gray-100 flex items-center gap-2">
                        <Sliders className="w-5 h-5 text-amber-400" /> Hardware Simulator
                    </h3>
                    <button onClick={() => setShowSimModal(false)}><X className="text-gray-500 hover:text-white" /></button>
                </div>
                
                <div className="mb-6 bg-gray-800 p-4 rounded-xl border border-gray-700">
                    <div className="flex justify-between items-center">
                        <span className="text-gray-300 font-medium">Simulation Mode</span>
                        <button 
                            onClick={toggleSimMode} 
                            className={`px-4 py-1 rounded-full text-xs font-bold transition-all ${simState.enabled ? 'bg-amber-500 text-black' : 'bg-gray-600 text-gray-400'}`}
                        >
                            {simState.enabled ? 'ENABLED' : 'DISABLED'}
                        </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">When enabled, physical pins are ignored. Use buttons below to trigger sensors.</p>
                </div>

                <div className={`space-y-3 ${!simState.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
                    <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Simulate Input (Click to Toggle)</h4>
                    
                    <button 
                        onClick={() => updateSimulation('limitOpen', !simState.overrides.limitOpen)}
                        className={`w-full p-3 rounded-lg border flex justify-between items-center ${simState.overrides.limitOpen ? 'bg-emerald-900/30 border-emerald-500/50' : 'bg-gray-800 border-gray-700'}`}
                    >
                        <span className={simState.overrides.limitOpen ? 'text-emerald-400 font-bold' : 'text-gray-400'}>Limit Switch: OPEN</span>
                        <Radio className={`w-4 h-4 ${simState.overrides.limitOpen ? 'text-emerald-400' : 'text-gray-600'}`} />
                    </button>

                    <button 
                        onClick={() => updateSimulation('limitClose', !simState.overrides.limitClose)}
                        className={`w-full p-3 rounded-lg border flex justify-between items-center ${simState.overrides.limitClose ? 'bg-emerald-900/30 border-emerald-500/50' : 'bg-gray-800 border-gray-700'}`}
                    >
                        <span className={simState.overrides.limitClose ? 'text-emerald-400 font-bold' : 'text-gray-400'}>Limit Switch: CLOSED</span>
                        <Radio className={`w-4 h-4 ${simState.overrides.limitClose ? 'text-emerald-400' : 'text-gray-600'}`} />
                    </button>

                     <button 
                        onClick={() => updateSimulation('safety', !simState.overrides.safety)}
                        className={`w-full p-3 rounded-lg border flex justify-between items-center ${simState.overrides.safety ? 'bg-red-900/30 border-red-500/50' : 'bg-gray-800 border-gray-700'}`}
                    >
                        <span className={simState.overrides.safety ? 'text-red-400 font-bold' : 'text-gray-400'}>Safety Sensor (Obstruction)</span>
                        <AlertCircle className={`w-4 h-4 ${simState.overrides.safety ? 'text-red-400' : 'text-gray-600'}`} />
                    </button>
                    
                    <div className="grid grid-cols-2 gap-3 mt-4">
                        <button 
                            onMouseDown={() => updateSimulation('proxOutside', true)}
                            onMouseUp={() => updateSimulation('proxOutside', false)}
                            className="bg-gray-800 hover:bg-gray-700 border border-gray-700 p-3 rounded-lg text-xs font-bold text-gray-300 active:bg-blue-900 active:border-blue-500"
                        >
                            TRIG OUTSIDE
                        </button>
                        <button 
                            onMouseDown={() => updateSimulation('proxInside', true)}
                            onMouseUp={() => updateSimulation('proxInside', false)}
                            className="bg-gray-800 hover:bg-gray-700 border border-gray-700 p-3 rounded-lg text-xs font-bold text-gray-300 active:bg-blue-900 active:border-blue-500"
                        >
                            TRIG INSIDE
                        </button>
                    </div>
                </div>

                <div className="mt-6 flex justify-end">
                     <button onClick={() => setShowSimModal(false)} className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-bold">Close</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default App;