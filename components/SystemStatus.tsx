import React from 'react';
import { SystemState } from '../types';
import { Lock, Unlock, Dog, AlertTriangle, ArrowRight, ArrowLeft, CheckCircle } from 'lucide-react';

interface SystemStatusProps {
  state: SystemState;
  elapsedTime: number;
  threshold: number;
}

export const SystemStatus: React.FC<SystemStatusProps> = ({ state, elapsedTime, threshold }) => {
  
  const getStatusContent = () => {
      switch (state) {
          case SystemState.OPENING:
              return { icon: ArrowRight, color: 'text-blue-400', bg: 'bg-blue-900/20', border: 'border-blue-500/50', text: 'OPENING...', animate: 'animate-pulse' };
          case SystemState.CLOSING:
              return { icon: ArrowLeft, color: 'text-amber-400', bg: 'bg-amber-900/20', border: 'border-amber-500/50', text: 'CLOSING...', animate: 'animate-pulse' };
          case SystemState.OPEN:
              return { icon: Unlock, color: 'text-emerald-400', bg: 'bg-emerald-900/20', border: 'border-emerald-500/50', text: 'OPEN', animate: '' };
          case SystemState.CLOSED:
              return { icon: Lock, color: 'text-gray-400', bg: 'bg-gray-900', border: 'border-gray-800', text: 'CLOSED', animate: '' }; 
          case SystemState.IDLE:
                return { icon: Lock, color: 'text-gray-400', bg: 'bg-gray-900', border: 'border-gray-800', text: 'CLOSED', animate: '' };
          case SystemState.LOCKED:
              return { icon: Lock, color: 'text-red-500', bg: 'bg-red-900/20', border: 'border-red-500/50', text: 'LOCKED', animate: '' };
          case SystemState.OBSTRUCTED:
              return { icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-900/20', border: 'border-red-500/50', text: 'OBSTRUCTION!', animate: 'animate-bounce' };
          default:
              return { icon: Dog, color: 'text-indigo-400', bg: 'bg-indigo-900/20', border: 'border-indigo-500/50', text: 'DETECTING', animate: 'animate-pulse' };
      }
  };

  const status = getStatusContent();
  const Icon = status.icon;

  return (
    <div className="grid grid-cols-2 gap-4">
        {/* Detection Status */}
        <div className={`col-span-1 p-4 rounded-xl border flex flex-col items-center justify-center bg-gray-900 border-gray-800`}>
            <Dog className={`w-8 h-8 mb-2 ${state === SystemState.DETECTING ? 'text-indigo-400 animate-bounce' : 'text-gray-600'}`} />
            <span className="text-sm font-bold text-gray-500">
                {state === SystemState.DETECTING ? 'DOG DETECTED' : 'AREA CLEAR'}
            </span>
        </div>

        {/* Door Status */}
        <div className={`col-span-1 p-4 rounded-xl border flex flex-col items-center justify-center transition-colors duration-300 ${status.bg} ${status.border}`}>
            <Icon className={`w-8 h-8 mb-2 ${status.color} ${status.animate}`} />
            <span className={`text-sm font-bold ${status.color}`}>
                {status.text}
            </span>
        </div>

        {/* Info Bar */}
        <div className="col-span-2 bg-gray-900 rounded-xl p-3 border border-gray-800 flex justify-between items-center text-xs text-gray-400">
            <div className="flex items-center gap-2">
                <CheckCircle className="w-3 h-3 text-emerald-500" />
                <span>System Active</span>
            </div>
            <div>
               {state === SystemState.OPEN ? `Closing in: ${(threshold - elapsedTime).toFixed(1)}s` : ''}
               {state === SystemState.OPENING || state === SystemState.CLOSING ? 'Motor Running...' : ''}
            </div>
        </div>
    </div>
  );
};