import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  base: mode === 'embed' ? '/games/gesture-particles/' : './',
  // 监听所有网卡：老师本机用 localhost，学生手机要用局域网 IP 访问同一个页面。
  // 不开这个，手机扫出来的二维码指向的是它自己的 localhost，必然打不开。
  server: { host: true, port: 5173 },
  preview: { host: true, port: 4173 },
}));
