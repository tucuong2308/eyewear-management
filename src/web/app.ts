// Giao diện trang Hôm nay: bảng nhập Đơn kính (kiểu A của bản thử).
import { NHAN, type DonKinh, type TruongSuaDuoc } from '../core/don-kinh.js';

const COT: [TruongSuaDuoc, string][] = [
  ['ten', 'w-ten'], ['tuoi', 'w-sm'], ['sdt', 'w-md'], ['mp', 'w-rx'], ['mt', 'w-rx'], ['add', 'w-sm'],
  ['hang', 'w-md'], ['loai', 'w-lg'], ['nguon', 'w-md'], ['ngayDat', 'w-date'], ['ngayHen', 'w-date'],
  ['ttTrong', 'w-lg'], ['ttKinh', 'w-lg'], ['tuVan', 'w-md'], ['cat', 'w-md'], ['phanHoi', 'w-md'],
  ['shipTime', 'w-md'], ['diaChi', 'w-lg'], ['ghiChu', 'w-lg'],
];
const DO_KINH = new Set<TruongSuaDuoc>(['mp', 'mt', 'add']);

const S = {
  homNay: homNayTheoMay(),
  don: [] as DonKinh[],
  trangThai: '' as '' | 'dang' | 'ok' | 'loi',
  loi: '',
  focusSau: null as string | null,
};

function homNayTheoMay() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
const ngayNgan = (s: string) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}` : '');
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

async function goi<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.loi ?? `Lỗi ${res.status}`);
  return data as T;
}

async function taiLai() {
  S.don = await goi<DonKinh[]>('GET', `/api/don-kinh?ngayDat=${S.homNay}`);
  render();
}

async function luu<T>(viec: () => Promise<T>): Promise<T | undefined> {
  S.trangThai = 'dang';
  S.loi = '';
  render();
  try {
    const kq = await viec();
    S.trangThai = 'ok';
    return kq;
  } catch (e) {
    S.trangThai = 'loi';
    S.loi = `Chưa lưu được: ${(e as Error).message}. Dữ liệu vừa gõ vẫn còn trên màn hình, hãy thử lại.`;
    return undefined;
  } finally {
    render();
  }
}

async function taoDon(ten: string) {
  const don = await luu(() => goi<DonKinh>('POST', '/api/don-kinh', { ten, ngayDat: S.homNay }));
  if (!don) return;
  S.don.push(don);
  S.focusSau = `${don.id}:tuoi`;
  render();
}

async function suaO(id: string, field: TruongSuaDuoc, value: string) {
  const don = await luu(() => goi<DonKinh>('PATCH', `/api/don-kinh/${encodeURIComponent(id)}`, { field, value }));
  if (!don) return;
  if (don.ngayDat !== S.homNay) S.don = S.don.filter((d) => d.id !== id);
  else S.don = S.don.map((d) => (d.id === id ? don : d));
  render();
}

function o(don: DonKinh, f: TruongSuaDuoc) {
  const k = `${don.id}:${f}`;
  const type = f === 'ngayDat' || f === 'ngayHen' ? 'date' : 'text';
  const extra = f === 'tuoi' ? 'inputmode="numeric"' : f === 'sdt' ? 'inputmode="tel"' : '';
  return `<input class="cell ${DO_KINH.has(f) ? 'mono' : ''}" type="${type}" ${extra} data-id="${don.id}" data-f="${f}" data-k="${k}" aria-label="${NHAN[f]}" value="${esc(don[f])}">`;
}

function render() {
  const app = document.getElementById('app')!;
  const dangFocus = document.activeElement as HTMLElement | null;
  const k = S.focusSau ?? dangFocus?.dataset?.k;

  const trangThai = { '': '', dang: 'Đang lưu…', ok: 'Đã lưu ✓', loi: 'Chưa lưu' }[S.trangThai];
  const hang = S.don.map((d) => `<tr>${COT.map(([f, w]) => `<td class="${w}">${o(d, f)}</td>`).join('')}</tr>`).join('');
  app.innerHTML = `
    <div class="top"><div class="wrap row"><span class="brand">Sổ Đơn Kính</span><nav class="tabs"><span>Hôm nay</span></nav></div></div>
    <main class="wrap">
      <div class="page-h"><h1>Hôm nay</h1><span class="muted">${ngayNgan(S.homNay)} · ${S.don.length} đơn</span><span class="grow"></span>
        <span class="saving ${S.trangThai}" aria-live="polite">${trangThai}</span></div>
      ${S.loi ? `<div class="loi" role="alert">${esc(S.loi)}</div>` : ''}
      <div class="grid-wrap"><table>
        <thead><tr>${COT.map(([f]) => `<th>${NHAN[f]}</th>`).join('')}</tr></thead>
        <tbody>${hang}
          <tr class="new"><td class="w-ten"><input class="cell" data-new="1" data-k="new:ten" placeholder="+ Gõ tên bệnh nhân…" aria-label="Tên bệnh nhân mới"></td>
          <td colspan="${COT.length - 1}" class="muted" style="padding-left:10px;font-size:12px">Gõ tên rồi Enter để tạo Đơn kính · Ngày đặt = ${ngayNgan(S.homNay)}</td></tr>
        </tbody></table></div>
    </main>`;

  const el = k ? app.querySelector<HTMLInputElement>(`[data-k="${CSS.escape(k)}"]`) : null;
  el?.focus();
  S.focusSau = null;
}

document.addEventListener('change', (e) => {
  const t = e.target as HTMLInputElement;
  if (t.dataset.new) {
    const ten = t.value.trim();
    if (ten) void taoDon(ten);
    return;
  }
  const { id, f } = t.dataset;
  if (!id || !f) return;
  const don = S.don.find((d) => d.id === id);
  if (don && don[f as TruongSuaDuoc] === t.value) return;
  // render lại sau khi trình duyệt chuyển focus sang ô kế tiếp
  setTimeout(() => void suaO(id, f as TruongSuaDuoc, t.value), 0);
});

document.addEventListener('keydown', (e) => {
  const t = e.target as HTMLInputElement;
  if (e.key === 'Enter' && t.matches?.('input.cell')) {
    e.preventDefault();
    t.blur();
  }
});

void taiLai();
