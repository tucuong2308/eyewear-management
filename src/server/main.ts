// Điểm chạy của exe (chế độ dev): npm run dev
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { startServer } from './app.js';

const port = Number(process.env.PORT ?? 8080);
const dataDir = process.env.DATA_DIR ?? join(process.cwd(), 'data');
mkdirSync(dataDir, { recursive: true });

const server = await startServer({ dbPath: join(dataDir, 'so-don-kinh.db'), port });
console.log(`Sổ Đơn Kính đang chạy: http://localhost:${server.port}`);

const tat = () => server.close().then(() => process.exit(0));
process.on('SIGINT', tat);
process.on('SIGTERM', tat);
