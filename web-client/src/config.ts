const origin = window.location.origin;
const wsOrigin = origin.replace(/^http/, 'ws');

export const config = {
  apiUrl: import.meta.env.VITE_API_URL || origin,
  wsUrl: import.meta.env.VITE_WS_URL || wsOrigin,
};
