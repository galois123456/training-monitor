import { cp, rm } from 'node:fs/promises';
await rm('dist', { recursive: true, force: true });
await cp('public', 'dist', { recursive: true });
console.log('정적 화면 빌드 완료');
