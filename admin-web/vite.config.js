import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  base: '/admin/', // 生产挂 Caddy 子路径 test2.aition.art/admin/（API 同域 /api 反代）
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      // 开发环境代理到本地服务端；生产由 Nginx 反代 /api
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist'
  }
});
