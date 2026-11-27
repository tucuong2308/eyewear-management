// Đo tốc độ Apps Script (#12, điều kiện chốt ADR 0002). Chạy sau khi đã triển khai Web App (docs/apps-script.md).
//
//   npm run do-toc-do -- <Web app URL> <Khóa Máy quầy> [--tao-du-lieu]
//
//   --tao-du-lieu  đẩy trước 1.000 Đơn kính GIẢ lên Sheet (chỉ dùng Sheet thử, đừng chạy trên Sheet thật)
//
// Đo mỗi thao tác 20 lần, in trung vị và p90 (ms):
//   - tải danh sách: kéo toàn bộ từ mốc 0 (gần với lần mở trang đầu tiên)
//   - lưu 1 ô: đẩy một ô
import { performance } from 'node:perf_hooks';
import { KenhAppsScript } from '../src/server/kenh-apps-script.js';
import type { ThayDoiO } from '../src/core/dong-bo.js';

const [url, khoa] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (!url || !khoa) {
  console.error('Cách dùng: npm run do-toc-do -- <Web app URL> <Khóa Máy quầy> [--tao-du-lieu]');
  process.exit(1);
}
const kenh = new KenhAppsScript({ url, khoa }, 60_000);

if (process.argv.includes('--tao-du-lieu')) {
  console.log('Đang đẩy 1.000 Đơn kính giả…');
  for (let lo = 0; lo < 10; lo++) {
    const ds: ThayDoiO[] = [];
    for (let i = 0; i < 100; i++) {
      const id = `gia-${lo * 100 + i}`;
      ds.push({ id, truong: 'ten', giaTri: `BỆNH NHÂN GIẢ ${lo * 100 + i}` }, { id, truong: 'ngayDat', giaTri: '2026-11-01' },
        { id, truong: 'mp', giaTri: '-1.25' }, { id, truong: 'mt', giaTri: '-1.50' }, { id, truong: 'ttKinh', giaTri: 'Đã trả' });
    }
    await kenh.day(ds);
  }
}

async function do20(ten: string, viec: () => Promise<unknown>) {
  const t: number[] = [];
  for (let i = 0; i < 20; i++) {
    const a = performance.now();
    await viec();
    t.push(performance.now() - a);
  }
  t.sort((x, y) => x - y);
  console.log(`${ten.padEnd(16)} trung vị ${Math.round(t[9]!)} ms   p90 ${Math.round(t[17]!)} ms   chậm nhất ${Math.round(t[19]!)} ms`);
}

await do20('tải danh sách', () => kenh.keo(0));
let n = 0;
await do20('lưu 1 ô', () => kenh.day([{ id: 'gia-0', truong: 'ghiChu', giaTri: `đo ${++n}` }]));
console.log('Tiêu chí: tải trang lần đầu ≤ 2 giây (thao tác lưu chạy ngầm, người dùng không phải chờ).');
