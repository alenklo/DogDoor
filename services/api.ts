import { PiConfig, SystemState } from '../types';

const API_BASE = ''; // Empty string means relative path (same host)

export const piApi = {
  // Get current status (is dog there? is door open?)
  getStatus: async () => {
    const res = await fetch(`${API_BASE}/api/status`);
    if (!res.ok) throw new Error('Network response was not ok');
    return res.json();
  },

  // Get current settings
  getConfig: async () => {
    const res = await fetch(`${API_BASE}/api/config`);
    if (!res.ok) throw new Error('Network response was not ok');
    return res.json();
  },

  // Update settings
  updateConfig: async (config: PiConfig) => {
    const res = await fetch(`${API_BASE}/api/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    if (!res.ok) throw new Error('Network response was not ok');
    return res.json();
  },

  // Send a specific command (like manual trigger)
  sendCommand: async (command: 'trigger' | 'reset') => {
    await fetch(`${API_BASE}/api/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command }),
    });
  }
};
