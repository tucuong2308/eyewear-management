// Giao diện trang Hôm nay (kiểu A của bản thử):
// bảng nhập Đơn kính hôm nay + bảng Đến hẹn và quá hẹn để bấm Hoàn thành ngay.
import { NHAN, mucGap, type DonKinh, type TruongSuaDuoc } from '../core/don-kinh.js';

const COT_NHAP: [TruongSuaDuoc, string][] = [
  ['ten', 'w-ten'], ['tuoi', 'w-sm'], ['sdt', 'w-md'], ['mp', 'w-rx'], ['mt', 'w-rx'], ['add', 'w-sm'],
  ['hang', 'w-md'], ['loai', 'w-lg'], ['nguon', 'w-md'], ['ngayDat', 'w-date'], ['ngayHen', 'w-date'],
  ['ttTrong', 'w-lg'], ['ttKinh', 'w-lg'], ['tuVan', 'w-md'], ['cat', 'w-md'], ['phanHoi', 'w-md'],
  ['shipTime', 'w-md'], ['diaChi', 'w-lg'], ['ghiChu', 'w-lg'],
];
// Bảng Đến hẹn: đủ các trường bắt buộc để nhập nốt phần thiếu ngay tại chỗ.
const COT_HEN: [TruongSuaDuoc, string][] = [
  ['ngayHen', 'w-date'], ['ten', 'w-ten'], ['tuoi', 'w-sm'], ['sdt', 'w-md'], ['mp', 'w-rx'], ['mt', 'w-rx'],
  ['hang', 'w-md'], ['loai', 'w-lg'], ['nguon', 'w-md'], ['ttTrong', 'w-lg'], ['ttKinh', 'w-lg'],
  ['tuVan', 'w-md'], ['cat', 'w-md'], ['phanHoi', 'w-md'], ['ghiChu', 'w-lg'],
];
const DO_KINH = new Set<TruongSuaDuoc>(['mp', 'mt', 'add']);

type ThongBao = { loai: 'ok' | 'loi'; noiDung: string; hoanTac?: () => Promise<void> };

const S = {
  homNay: homNayTheoMay(),
  don: [] as DonKinh[],
  denHen: [] as DonKinh[],
  trangThai: '' as '' | 'dang' | 'ok' | 'loi',
  thongBao: null as ThongBao | null,
  thieu: null as { id: string; truong: TruongSuaDuoc[] } | null,
  focusSau: null as string | null,
};

function homNayTheoMay() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
const ngayNgan = (s: string) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}` : '');
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

class LoiApi extends Error {
  constructor(message: string, readonly status: number, readonly data: Record<string, unknown>) {
    super(message);
  }
}

async function goi<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new LoiApi(data.loi ?? `Lỗi ${res.status}`, res.status, data);
  return data as T;
}

async function taiLai() {
  const [don, denHen] = await Promise.all([
    goi<DonKinh[]>('GET', `/api/don-kinh?ngayDat=${S.homNay}`),
    goi<DonKinh[]>('GET', '/api/den-hen'),
  ]);
  S.don = don;
  S.denHen = denHen;
  if (S.thieu && !denHen.some((d) => d.id === S.thieu!.id)) S.thieu = null;
  render();
}

async function luu<T>(viec: () => Promise<T>): Promise<T | undefined> {
  S.trangThai = 'dang';
  render();
  try {
    const kq = await viec();
    S.trangThai = 'ok';
    await taiLai();
    return kq;
  } catch (e) {
    S.trangThai = 'loi';
    S.thongBao = { loai: 'loi', noiDung: `Chưa lưu được: ${(e as Error).message}. Dữ liệu vừa gõ vẫn còn trên màn hình, hãy thử lại.` };
    render();
    return undefined;
  }
}

async function taoDon(ten: string) {
  const don = await luu(() => goi<DonKinh>('POST', '/api/don-kinh', { ten, ngayDat: S.homNay }));
  if (don) {
    S.focusSau = `nhap:${don.id}:tuoi`;
    render();
  }
}

async function suaO(id: string, field: TruongSuaDuoc, value: string) {
  await luu(() => goi<DonKinh>('PATCH', `/api/don-kinh/${encodeURIComponent(id)}`, { field, value }));
  if (S.thieu?.id === id) S.thieu.truong = S.thieu.truong.filter((f) => f !== field || !value.trim());
  render();
}

async function hoanThanh(id: string) {
  const truoc = S.denHen.find((d) => d.id === id);
  if (!truoc) return;
  S.trangThai = 'dang';
  render();
  try {
    await goi<DonKinh>('POST', `/api/don-kinh/${encodeURIComponent(id)}/hoan-thanh`);
    S.trangThai = 'ok';
    S.thieu = null;
    S.thongBao = {
      loai: 'ok',
      noiDung: `Đã hoàn thành “${truoc.ten}”: Tình trạng kính = Đã trả.`,
      hoanTac: async () => {
        await luu(() => goi('PATCH', `/api/don-kinh/${encodeURIComponent(id)}`, { field: 'ttKinh', value: truoc.ttKinh }));
      },
    };
    await taiLai();
  } catch (e) {
    S.trangThai = '';
    if (e instanceof LoiApi && e.status === 422) {
      const thieu = (e.data.thieu as TruongSuaDuoc[]) ?? [];
      S.thieu = { id, truong: thieu };
      S.thongBao = { loai: 'loi', noiDung: `Chưa hoàn thành được “${truoc.ten}”. ${e.message}. Nhập ngay trên dòng tô đỏ rồi bấm Hoàn thành lại.` };
      S.focusSau = thieu[0] ? `hen:${id}:${thieu[0]}` : null;
    } else {
      S.thongBao = { loai: 'loi', noiDung: `Chưa hoàn thành được: ${(e as Error).message}` };
    }
    render();
  }
}

function o(bang: 'nhap' | 'hen', don: DonKinh, f: TruongSuaDuoc) {
  const k = `${bang}:${don.id}:${f}`;
  const type = f === 'ngayDat' || f === 'ngayHen' ? 'date' : 'text';
  const extra = f === 'tuoi' ? 'inputmode="numeric"' : f === 'sdt' ? 'inputmode="tel"' : '';
  return `<input class="cell ${DO_KINH.has(f) ? 'mono' : ''}" type="${type}" ${extra} data-id="${don.id}" data-f="${f}" data-k="${k}" aria-label="${NHAN[f]} của ${esc(don.ten)}" value="${esc(don[f])}">`;
}

function bangNhap() {
  const hang = S.don.map((d) => `<tr>${COT_NHAP.map(([f, w]) => `<td class="${w}">${o('nhap', d, f)}</td>`).join('')}</tr>`).join('');
  return `<div class="grid-wrap"><table>
    <thead><tr>${COT_NHAP.map(([f]) => `<th>${NHAN[f]}</th>`).join('')}</tr></thead>
    <tbody>${hang}
      <tr class="new"><td class="w-ten"><input class="cell" data-new="1" data-k="new:ten" placeholder="+ Gõ tên bệnh nhân…" aria-label="Tên bệnh nhân mới"></td>
      <td colspan="${COT_NHAP.length - 1}" class="muted" style="padding-left:10px;font-size:12px">Gõ tên rồi Enter để tạo Đơn kính · Ngày đặt = ${ngayNgan(S.homNay)}</td></tr>
    </tbody></table></div>`;
}

function bangDenHen() {
  if (!S.denHen.length) return `<div class="empty">Không có đơn nào đến hẹn hoặc quá hẹn. Mọi Kính hẹn đã trả xong.</div>`;
  const hang = S.denHen
    .map((d) => {
      const gap = mucGap(d, S.homNay);
      const thieu = S.thieu?.id === d.id ? S.thieu.truong : [];
      const quaHen = gap === 'qua' ? `<span class="chip qua">quá ${-Math.round((Date.parse(d.ngayHen) - Date.parse(S.homNay)) / 864e5)} ngày</span>` : '<span class="chip gan">hôm nay</span>';
      return `<tr class="u-${gap} ${thieu.length ? 'co-thieu' : ''}">
        <td class="act"><button class="btn small" data-act="hoan-thanh" data-id="${d.id}">✓ Hoàn thành</button></td>
        <td class="act">${quaHen}</td>
        ${COT_HEN.map(([f, w]) => `<td class="${w} ${f === 'ngayHen' ? 'hen' : ''} ${thieu.includes(f) ? 'thieu' : ''}">${o('hen', d, f)}</td>`).join('')}</tr>`;
    })
    .join('');
  return `<div class="grid-wrap"><table>
    <thead><tr><th>Hoàn thành</th><th>Mức</th>${COT_HEN.map(([f]) => `<th>${NHAN[f]}</th>`).join('')}</tr></thead>
    <tbody>${hang}</tbody></table></div>`;
}

function render() {
  const app = document.getElementById('app')!;
  const dangFocus = document.activeElement as HTMLElement | null;
  const k = S.focusSau ?? dangFocus?.dataset?.k;

  const trangThai = { '': '', dang: 'Đang lưu…', ok: 'Đã lưu ✓', loi: 'Chưa lưu' }[S.trangThai];
  const quaHen = S.denHen.filter((d) => mucGap(d, S.homNay) === 'qua').length;
  const tb = S.thongBao;
  app.innerHTML = `
    <div class="top"><div class="wrap row"><span class="brand">Sổ Đơn Kính</span><nav class="tabs"><span>Hôm nay</span></nav></div></div>
    <main class="wrap">
      <div class="page-h"><h1>Hôm nay</h1><span class="muted">${ngayNgan(S.homNay)}</span><span class="grow"></span>
        <span class="saving ${S.trangThai}" aria-live="polite">${trangThai}</span></div>
      ${tb ? `<div class="flash ${tb.loai}" role="${tb.loai === 'loi' ? 'alert' : 'status'}"><span>${esc(tb.noiDung)}</span>
        ${tb.hoanTac ? '<button class="btn small" data-act="hoan-tac">Hoàn tác</button>' : ''}
        <button class="btn small ghost" data-act="dong-tb" aria-label="Đóng thông báo">✕</button></div>` : ''}
      <h2 class="sec-h">Nhập đơn hôm nay <span class="muted">${S.don.length} đơn</span></h2>
      ${bangNhap()}
      <h2 class="sec-h">Đến hẹn và quá hẹn <span class="muted">${S.denHen.length} đơn chờ trả${quaHen ? ` · <span class="do">${quaHen} quá hẹn</span>` : ''}</span></h2>
      ${bangDenHen()}
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
  const don = [...S.don, ...S.denHen].find((d) => d.id === id);
  if (don && don[f as TruongSuaDuoc] === t.value) return;
  // lưu sau khi trình duyệt đã chuyển focus sang ô kế tiếp
  setTimeout(() => void suaO(id, f as TruongSuaDuoc, t.value), 0);
});

document.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
  if (!b) return;
  const act = b.dataset.act;
  if (act === 'hoan-thanh' && b.dataset.id) void hoanThanh(b.dataset.id);
  if (act === 'hoan-tac' && S.thongBao?.hoanTac) {
    const viec = S.thongBao.hoanTac;
    S.thongBao = null;
    void viec();
  }
  if (act === 'dong-tb') {
    S.thongBao = null;
    render();
  }
});

document.addEventListener('keydown', (e) => {
  const t = e.target as HTMLInputElement;
  if (e.key === 'Enter' && t.matches?.('input.cell')) {
    e.preventDefault();
    t.blur();
  }
});

void taiLai();
