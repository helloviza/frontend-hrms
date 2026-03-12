import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, "VITE_");
  const backendOrigin = env.VITE_BACKEND_ORIGIN || "http://localhost:8080";

  return {
    root: __dirname,
    envDir: __dirname,
    plugins: [react()],
    server: {
      port: mode === "test" ? 5174 : 5173,
      proxy: {
        "/api": {
          target: backendOrigin,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});
