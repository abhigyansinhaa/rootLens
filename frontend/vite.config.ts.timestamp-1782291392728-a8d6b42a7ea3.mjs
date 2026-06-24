// vite.config.ts
import tailwindcss from "file:///C:/Users/KIIT0001/Desktop/New%20folder/rootLens/frontend/node_modules/@tailwindcss/vite/dist/index.mjs";
import react from "file:///C:/Users/KIIT0001/Desktop/New%20folder/rootLens/frontend/node_modules/@vitejs/plugin-react/dist/index.js";
import { defineConfig, loadEnv } from "file:///C:/Users/KIIT0001/Desktop/New%20folder/rootLens/frontend/node_modules/vite/dist/node/index.js";
var vite_config_default = defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const target = env.VITE_BACKEND_URL || "http://127.0.0.1:8000";
  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5e3,
      host: true,
      proxy: {
        "/api": { target, changeOrigin: true }
      }
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes("node_modules/react-dom") || id.includes("node_modules/react/")) return "react-vendor";
            if (id.includes("node_modules/react-router")) return "router";
            if (id.includes("node_modules/@tanstack")) return "rq";
            if (id.includes("node_modules/recharts")) return "charts";
            if (id.includes("node_modules/axios")) return "http";
            return void 0;
          }
        }
      }
    }
  };
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxLSUlUMDAwMVxcXFxEZXNrdG9wXFxcXE5ldyBmb2xkZXJcXFxccm9vdExlbnNcXFxcZnJvbnRlbmRcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkM6XFxcXFVzZXJzXFxcXEtJSVQwMDAxXFxcXERlc2t0b3BcXFxcTmV3IGZvbGRlclxcXFxyb290TGVuc1xcXFxmcm9udGVuZFxcXFx2aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vQzovVXNlcnMvS0lJVDAwMDEvRGVza3RvcC9OZXclMjBmb2xkZXIvcm9vdExlbnMvZnJvbnRlbmQvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgdGFpbHdpbmRjc3MgZnJvbSAnQHRhaWx3aW5kY3NzL3ZpdGUnXG5pbXBvcnQgcmVhY3QgZnJvbSAnQHZpdGVqcy9wbHVnaW4tcmVhY3QnXG5pbXBvcnQgeyBkZWZpbmVDb25maWcsIGxvYWRFbnYgfSBmcm9tICd2aXRlJ1xuXG4vLyBodHRwczovL3ZpdGUuZGV2L2NvbmZpZy9cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZygoeyBtb2RlIH0pID0+IHtcbiAgY29uc3QgZW52ID0gbG9hZEVudihtb2RlLCBwcm9jZXNzLmN3ZCgpLCAnJylcbiAgY29uc3QgdGFyZ2V0ID0gZW52LlZJVEVfQkFDS0VORF9VUkwgfHwgJ2h0dHA6Ly8xMjcuMC4wLjE6ODAwMCdcblxuICByZXR1cm4ge1xuICAgIHBsdWdpbnM6IFtyZWFjdCgpLCB0YWlsd2luZGNzcygpXSxcbiAgICBzZXJ2ZXI6IHtcbiAgICAgIHBvcnQ6IDUwMDAsXG4gICAgICBob3N0OiB0cnVlLFxuICAgICAgcHJveHk6IHtcbiAgICAgICAgJy9hcGknOiB7IHRhcmdldCwgY2hhbmdlT3JpZ2luOiB0cnVlIH0sXG4gICAgICB9LFxuICAgIH0sXG4gICAgYnVpbGQ6IHtcbiAgICAgIHJvbGx1cE9wdGlvbnM6IHtcbiAgICAgICAgb3V0cHV0OiB7XG4gICAgICAgICAgbWFudWFsQ2h1bmtzKGlkKSB7XG4gICAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoJ25vZGVfbW9kdWxlcy9yZWFjdC1kb20nKSB8fCBpZC5pbmNsdWRlcygnbm9kZV9tb2R1bGVzL3JlYWN0LycpKSByZXR1cm4gJ3JlYWN0LXZlbmRvcidcbiAgICAgICAgICAgIGlmIChpZC5pbmNsdWRlcygnbm9kZV9tb2R1bGVzL3JlYWN0LXJvdXRlcicpKSByZXR1cm4gJ3JvdXRlcidcbiAgICAgICAgICAgIGlmIChpZC5pbmNsdWRlcygnbm9kZV9tb2R1bGVzL0B0YW5zdGFjaycpKSByZXR1cm4gJ3JxJ1xuICAgICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKCdub2RlX21vZHVsZXMvcmVjaGFydHMnKSkgcmV0dXJuICdjaGFydHMnXG4gICAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoJ25vZGVfbW9kdWxlcy9heGlvcycpKSByZXR1cm4gJ2h0dHAnXG4gICAgICAgICAgICByZXR1cm4gdW5kZWZpbmVkXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSxcbiAgfVxufSlcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBb1csT0FBTyxpQkFBaUI7QUFDNVgsT0FBTyxXQUFXO0FBQ2xCLFNBQVMsY0FBYyxlQUFlO0FBR3RDLElBQU8sc0JBQVEsYUFBYSxDQUFDLEVBQUUsS0FBSyxNQUFNO0FBQ3hDLFFBQU0sTUFBTSxRQUFRLE1BQU0sUUFBUSxJQUFJLEdBQUcsRUFBRTtBQUMzQyxRQUFNLFNBQVMsSUFBSSxvQkFBb0I7QUFFdkMsU0FBTztBQUFBLElBQ0wsU0FBUyxDQUFDLE1BQU0sR0FBRyxZQUFZLENBQUM7QUFBQSxJQUNoQyxRQUFRO0FBQUEsTUFDTixNQUFNO0FBQUEsTUFDTixNQUFNO0FBQUEsTUFDTixPQUFPO0FBQUEsUUFDTCxRQUFRLEVBQUUsUUFBUSxjQUFjLEtBQUs7QUFBQSxNQUN2QztBQUFBLElBQ0Y7QUFBQSxJQUNBLE9BQU87QUFBQSxNQUNMLGVBQWU7QUFBQSxRQUNiLFFBQVE7QUFBQSxVQUNOLGFBQWEsSUFBSTtBQUNmLGdCQUFJLEdBQUcsU0FBUyx3QkFBd0IsS0FBSyxHQUFHLFNBQVMscUJBQXFCLEVBQUcsUUFBTztBQUN4RixnQkFBSSxHQUFHLFNBQVMsMkJBQTJCLEVBQUcsUUFBTztBQUNyRCxnQkFBSSxHQUFHLFNBQVMsd0JBQXdCLEVBQUcsUUFBTztBQUNsRCxnQkFBSSxHQUFHLFNBQVMsdUJBQXVCLEVBQUcsUUFBTztBQUNqRCxnQkFBSSxHQUFHLFNBQVMsb0JBQW9CLEVBQUcsUUFBTztBQUM5QyxtQkFBTztBQUFBLFVBQ1Q7QUFBQSxRQUNGO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
