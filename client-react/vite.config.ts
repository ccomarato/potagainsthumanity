import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Dev-time API target: the existing game server. Override with
//   VITE_API_TARGET=http://localhost:8081 npm run dev
// The default matches the server's own config (listenOn 8081).
const apiTarget = process.env.VITE_API_TARGET ?? "http://localhost:8081";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      // REST + WebSocket live under /api on the game server.
      // `ws: true` is what makes the /api/games/:gameCode upgrade
      // reach the server instead of dying at the Vite dev server.
      "/api": {
        target: apiTarget,
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
