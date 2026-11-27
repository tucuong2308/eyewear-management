// Giao diện kiểu A của bản thử (bảng tính).
// Trang Hôm nay: bảng nhập Đơn kính hôm nay + bảng Đến hẹn và quá hẹn để bấm Hoàn thành ngay.
// Trang Kính hẹn: mọi Kính hẹn, rút gọn cột. Trang Sự cố: đơn có Phản hồi = Sự cố. Trang Thùng rác: khôi phục đơn.
import {
  DANH_SACH_CUA_TRUONG, DANH_SACH_THEM_DUOC, NHAN, mucGap, soNgay,
  type DanhSach, type DonKinh, type LoaiDanhSach, type TruongSuaDuoc,
} from '../core/don-kinh.js';

const COT_NHAP: [TruongSuaDuoc, string][] = [
  ['ten', 'w-ten'], ['tuoi', 'w-sm'], ['sdt', 'w-md'], ['mp', 'w-rx'], ['mt', 'w-rx'], ['add', 'w-sm'],
  ['hang', 'w-md'], ['loai', 'w-lg'], ['nguon', 'w-md'], ['ngayDat', 'w-date'], ['ngayHen', 'w-date'],
  ['ttTrong', 'w-lg'], ['ttKinh', 'w-lg'], ['tuVan', 'w-md'], ['cat', 'w-md'], ['phanHoi', 'w-ph'],
  ['shipTime', 'w-md'], ['diaChi', 'w-lg'], ['ghiChu', 'w-lg'],
];
// Bảng Đến hẹn: đủ các trường bắt buộc để nhập nốt phần thiếu ngay tại chỗ.
const COT_HEN: [TruongSuaDuoc, string][] = [
  ['ngayHen', 'w-date'], ['ten', 'w-ten'], ['tuoi', 'w-sm'], ['sdt', 'w-md'], ['mp', 'w-rx'], ['mt', 'w-rx'],
  ['hang', 'w-md'], ['loai', 'w-lg'], ['nguon', 'w-md'], ['ttTrong', 'w-lg'], ['ttKinh', 'w-lg'],
  ['tuVan', 'w-md'], ['cat', 'w-md'], ['phanHoi', 'w-ph'], ['ghiChu', 'w-lg'],
];
// Trang Kính hẹn: chỉ các cột cần thiết; trường còn thiếu khi Hoàn thành được hiện thêm.
const COT_KINH_HEN: [TruongSuaDuoc, string][] = [
  ['ngayHen', 'w-date'], ['ten', 'w-ten'], ['sdt', 'w-md'], ['mp', 'w-rx'], ['mt', 'w-rx'], ['hang', 'w-md'],
  ['loai', 'w-lg'], ['ttTrong', 'w-lg'], ['ttKinh', 'w-lg'], ['cat', 'w-md'], ['phanHoi', 'w-ph'], ['ghiChu', 'w-lg'],
];
const RONG = Object.fromEntries(COT_NHAP) as Record<TruongSuaDuoc, string>;

type Trang = 'hom-nay' | 'kinh-hen' | 'su-co' | 'thung-rac';
const TRANG: [Trang, string][] = [['hom-nay', 'Hôm nay'], ['kinh-hen', 'Kính hẹn'], ['su-co', 'Sự cố'], ['thung-rac', 'Thùng rác']];
type Bang = 'nhap' | 'hen' | 'kh' | 'sc' | 'tr';

const DO_KINH = new Set<TruongSuaDuoc>(['mp', 'mt', 'add']);

type ThongBao = { loai: 'ok' | 'loi'; noiDung: string; hoanTac?: () => Promise<void> };

const S = {
  homNay: homNayTheoMay(),
  don: [] as DonKinh[],
  denHen: [] as DonKinh[],
  kinhHen: [] as DonKinh[],
  suCo: [] as DonKinh[],
  thungRac: [] as DonKinh[],
  trang: trangTuHash(),
  trangThai: '' as '' | 'dang' | 'ok' | 'loi',
  thongBao: null as ThongBao | null,
  thieu: null as { id: string; bang: Bang; truong: TruongSuaDuoc[] } | null,
  focusSau: null as string | null,
  ds: null as (DanhSach & { goiYLoai: string[] }) | null,
  /** Ô đang gõ giá trị mới sau khi chọn "Khác…" (data-k của ô đó). */
  khac: null as string | null,
};

function trangTuHash(): Trang {
  const h = location.hash.slice(1);
  return TRANG.some(([t]) => t === h) ? (h as Trang) : 'hom-nay';
}

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
  const [don, denHen, kinhHen, suCo, thungRac, ds] = await Promise.all([
    goi<DonKinh[]>('GET', `/api/don-kinh?ngayDat=${S.homNay}`),
    goi<DonKinh[]>('GET', '/api/den-hen'),
    goi<DonKinh[]>('GET', '/api/kinh-hen'),
    goi<DonKinh[]>('GET', '/api/su-co'),
    goi<DonKinh[]>('GET', '/api/thung-rac'),
    goi<DanhSach & { goiYLoai: string[] }>('GET', '/api/danh-sach'),
  ]);
  S.don = don;
  S.denHen = denHen;
  S.kinhHen = kinhHen;
  S.suCo = suCo;
  S.thungRac = thungRac;
  S.ds = ds;
  if (S.thieu && !kinhHen.some((d) => d.id === S.thieu!.id)) S.thieu = null;
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

async function hoanThanh(id: string, bang: Bang) {
  const truoc = S.kinhHen.find((d) => d.id === id);
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
      S.thieu = { id, bang, truong: thieu };
      S.thongBao = { loai: 'loi', noiDung: `Chưa hoàn thành được “${truoc.ten}”. ${e.message}. Nhập ngay trên dòng tô đỏ rồi bấm Hoàn thành lại.` };
      S.focusSau = thieu[0] ? `${bang}:${id}:${thieu[0]}` : null;
    } else {
      S.thongBao = { loai: 'loi', noiDung: `Chưa hoàn thành được: ${(e as Error).message}` };
    }
    render();
  }
}

async function themGiaTriMoi(k: string, id: string, f: TruongSuaDuoc, loai: LoaiDanhSach, giaTri: string) {
  S.khac = null;
  if (!giaTri.trim()) return render();
  const ds = await luu(() => goi<string[]>('POST', `/api/danh-sach/${loai}`, { giaTri }));
  if (!ds) return;
  const v = ds.find((x) => x.toLocaleLowerCase('vi-VN') === giaTri.trim().replace(/\s+/g, ' ').toLocaleLowerCase('vi-VN'));
  if (v) {
    S.focusSau = k;
    await suaO(id, f, v);
    S.thongBao = { loai: 'ok', noiDung: `Đã thêm “${v}” vào danh sách ${NHAN[f]}. Từ giờ chọn được ở mọi đơn.` };
    render();
  }
}

function o(bang: Bang, don: DonKinh, f: TruongSuaDuoc) {
  const k = `${bang}:${don.id}:${f}`;
  const loai = DANH_SACH_CUA_TRUONG[f];
  const nhan = `aria-label="${NHAN[f]} của ${esc(don.ten)}"`;
  if (f === 'phanHoi') {
    const nut = (S.ds?.phanHoi ?? []).map((x) => {
      const on = don.phanHoi === x;
      return `<button type="button" class="ph ${on ? 'on' : ''} ${x === 'Sự cố' ? 'su-co' : ''}" data-act="phan-hoi" data-id="${don.id}" data-val="${esc(x)}" aria-pressed="${on}">${esc(x)}</button>`;
    }).join('');
    return `<div class="ph-nhom" role="group" ${nhan} data-k="${k}">${nut}</div>`;
  }
  if (loai) {
    const thuoc = `data-id="${don.id}" data-f="${f}" data-k="${k}" ${nhan}`;
    if (S.khac === k) {
      return `<input class="cell" ${thuoc} data-khac="${loai}" placeholder="Gõ ${NHAN[f].toLowerCase()} mới rồi Enter">`;
    }
    const ds = S.ds?.[loai] ?? [];
    const v = don[f];
    const lechDs = v && !ds.includes(v) ? `<option selected>${esc(v)}</option>` : '';
    const khac = DANH_SACH_THEM_DUOC.includes(loai) ? '<option value="__khac">Khác…</option>' : '';
    return `<select class="cell" ${thuoc}><option value=""></option>${ds.map((x) => `<option ${x === v ? 'selected' : ''}>${esc(x)}</option>`).join('')}${lechDs}${khac}</select>`;
  }
  const type = f === 'ngayDat' || f === 'ngayHen' ? 'date' : 'text';
  const extra = f === 'tuoi' ? 'inputmode="numeric"' : f === 'sdt' ? 'inputmode="tel"' : '';
  const goiY = f === 'loai' ? 'list="goi-y-loai"' : '';
  return `<input class="cell ${DO_KINH.has(f) ? 'mono' : ''}" type="${type}" ${extra} ${goiY} data-id="${don.id}" data-f="${f}" data-k="${k}" ${nhan} value="${esc(don[f])}">`;
}

function bangNhap() {
  const hang = S.don.map((d) => `<tr>${COT_NHAP.map(([f, w]) => `<td class="${w}">${o('nhap', d, f)}</td>`).join('')}${oXoa(d)}</tr>`).join('');
  return `<div class="grid-wrap"><table>
    <thead><tr>${COT_NHAP.map(([f]) => `<th>${NHAN[f]}</th>`).join('')}</tr></thead>
    <tbody>${hang}
      <tr class="new"><td class="w-ten"><input class="cell" data-new="1" data-k="new:ten" placeholder="+ Gõ tên bệnh nhân…" aria-label="Tên bệnh nhân mới"></td>
      <td colspan="${COT_NHAP.length}" class="muted" style="padding-left:10px;font-size:12px">Gõ tên rồi Enter để tạo Đơn kính · Ngày đặt = ${ngayNgan(S.homNay)}</td></tr>
    </tbody></table></div>`;
}

function nhanMuc(d: DonKinh) {
  const n = soNgay(S.homNay, d.ngayHen);
  const gap = mucGap(d, S.homNay);
  const chu = n < 0 ? `quá ${-n} ngày` : n === 0 ? 'hôm nay' : n === 1 ? 'ngày mai' : `còn ${n} ngày`;
  return `<span class="chip ${gap || 'xa'}">${chu}</span>`;
}

/** Bảng Kính hẹn dùng cho cả hai nơi: bảng Đến hẹn ở trang Hôm nay và trang Kính hẹn. */
function bangHen(bang: Bang, rows: DonKinh[], cotGoc: [TruongSuaDuoc, string][], trong: string) {
  if (!rows.length) return `<div class="empty">${trong}</div>`;
  const thieuO = S.thieu?.bang === bang ? S.thieu : null;
  const them = (thieuO?.truong ?? [])
    .filter((f) => !cotGoc.some(([c]) => c === f))
    .map((f) => [f, RONG[f]] as [TruongSuaDuoc, string]);
  const cot = [...cotGoc, ...them];
  const hang = rows
    .map((d) => {
      const thieu = thieuO?.id === d.id ? thieuO.truong : [];
      return `<tr class="u-${mucGap(d, S.homNay)}">
        <td class="act"><button class="btn small" data-act="hoan-thanh" data-bang="${bang}" data-id="${d.id}">✓ Hoàn thành</button></td>
        <td class="act">${nhanMuc(d)}</td>
        ${cot.map(([f, w]) => `<td class="${w} ${f === 'ngayHen' ? 'hen' : ''} ${thieu.includes(f) ? 'thieu' : ''}">${o(bang, d, f)}</td>`).join('')}${oXoa(d)}</tr>`;
    })
    .join('');
  return `<div class="grid-wrap"><table>
    <thead><tr><th>Hoàn thành</th><th>Mức</th>${cot.map(([f]) => `<th>${NHAN[f]}</th>`).join('')}<th></th></tr></thead>
    <tbody>${hang}</tbody></table></div>`;
}

function trangHomNay() {
  const quaHen = S.denHen.filter((d) => mucGap(d, S.homNay) === 'qua').length;
  return `<h2 class="sec-h">Nhập đơn hôm nay <span class="muted">${S.don.length} đơn</span></h2>
      ${bangNhap()}
      <h2 class="sec-h">Đến hẹn và quá hẹn <span class="muted">${S.denHen.length} đơn chờ trả${quaHen ? ` · <span class="do">${quaHen} quá hẹn</span>` : ''}</span></h2>
      ${bangHen('hen', S.denHen, COT_HEN, 'Không có đơn nào đến hẹn hoặc quá hẹn. Mọi Kính hẹn đã trả xong.')}`;
}

function oXoa(d: DonKinh) {
  return d.thungRac
    ? `<td class="act"><button class="btn small" data-act="khoi-phuc" data-id="${d.id}">Khôi phục</button></td>`
    : `<td class="act"><button class="btn small ghost" data-act="thung-rac" data-id="${d.id}" title="Đưa vào Thùng rác" aria-label="Đưa ${esc(d.ten)} vào Thùng rác">🗑</button></td>`;
}

function bangDayDu(bang: Bang, rows: DonKinh[], trong: string) {
  if (!rows.length) return `<div class="empty">${trong}</div>`;
  const hang = rows.map((d) => `<tr>${COT_NHAP.map(([f, w]) => `<td class="${w}">${o(bang, d, f)}</td>`).join('')}${oXoa(d)}</tr>`).join('');
  return `<div class="grid-wrap"><table>
    <thead><tr>${COT_NHAP.map(([f]) => `<th>${NHAN[f]}</th>`).join('')}<th></th></tr></thead>
    <tbody>${hang}</tbody></table></div>`;
}

async function datThungRac(id: string, vao: boolean) {
  const don = [...S.don, ...S.kinhHen, ...S.suCo, ...S.thungRac].find((d) => d.id === id);
  const kq = await luu(() => goi<DonKinh>('POST', `/api/don-kinh/${encodeURIComponent(id)}/${vao ? 'thung-rac' : 'khoi-phuc'}`));
  if (!kq) return;
  S.thongBao = vao
    ? { loai: 'ok', noiDung: `Đã đưa “${don?.ten ?? ''}” vào Thùng rác.`, hoanTac: () => datThungRac(id, false) }
    : { loai: 'ok', noiDung: `Đã khôi phục “${don?.ten ?? ''}”.` };
  render();
}

function trangSuCo() {
  return bangDayDu('sc', S.suCo, 'Không có đơn nào đang bị Sự cố.');
}

function trangKinhHen() {
  return bangHen('kh', S.kinhHen, COT_KINH_HEN, 'Không còn Kính hẹn nào chưa trả.');
}

function render() {
  const app = document.getElementById('app')!;
  const dangFocus = document.activeElement as HTMLElement | null;
  const k = S.focusSau ?? dangFocus?.dataset?.k;

  const trangThai = { '': '', dang: 'Đang lưu…', ok: 'Đã lưu ✓', loi: 'Chưa lưu' }[S.trangThai];
  const quaHen = S.kinhHen.filter((d) => mucGap(d, S.homNay) === 'qua').length;
  const tb = S.thongBao;
  const tieuDe = {
    'hom-nay': `<h1>Hôm nay</h1><span class="muted">${ngayNgan(S.homNay)}</span>`,
    'kinh-hen': `<h1>Kính hẹn</h1><span class="muted">${S.kinhHen.length} đơn có ngày hẹn chưa trả${quaHen ? ` · <span class="do">${quaHen} quá hẹn</span>` : ''}</span>`,
    'su-co': `<h1>Sự cố</h1><span class="muted">${S.suCo.length} đơn có Phản hồi = Sự cố</span>`,
    'thung-rac': `<h1>Thùng rác</h1><span class="muted">${S.thungRac.length} đơn · khôi phục được bất cứ lúc nào</span>`,
  }[S.trang];
  const tabs = TRANG.map(([t, nhan]) => {
    const so = t === 'kinh-hen' ? S.kinhHen.length : t === 'su-co' ? S.suCo.length : t === 'thung-rac' ? S.thungRac.length : 0;
    const doNen = (t === 'kinh-hen' && quaHen) || t === 'su-co';
    const dem = so ? `<span class="count ${doNen ? 'do-nen' : ''}">${so}</span>` : '';
    return `<a href="#${t}" class="${S.trang === t ? 'on' : ''}" ${S.trang === t ? 'aria-current="page"' : ''}>${nhan}${dem}</a>`;
  }).join('');
  app.innerHTML = `
    <div class="top"><div class="wrap row"><span class="brand">Sổ Đơn Kính</span><nav class="tabs">${tabs}</nav></div></div>
    <main class="wrap">
      <div class="page-h">${tieuDe}<span class="grow"></span>
        <span class="saving ${S.trangThai}" aria-live="polite">${trangThai}</span></div>
      ${tb ? `<div class="flash ${tb.loai}" role="${tb.loai === 'loi' ? 'alert' : 'status'}"><span>${esc(tb.noiDung)}</span>
        ${tb.hoanTac ? '<button class="btn small" data-act="hoan-tac">Hoàn tác</button>' : ''}
        <button class="btn small ghost" data-act="dong-tb" aria-label="Đóng thông báo">✕</button></div>` : ''}
      ${{ 'hom-nay': trangHomNay, 'kinh-hen': trangKinhHen, 'su-co': trangSuCo, 'thung-rac': () => bangDayDu('tr', S.thungRac, 'Thùng rác trống.') }[S.trang]()}
    </main>
    <datalist id="goi-y-loai">${(S.ds?.goiYLoai ?? []).map((x) => `<option value="${esc(x)}">`).join('')}</datalist>`;

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
  if (t.dataset.khac) return; // xử lý bằng Enter / rời ô bên dưới
  if (t.value === '__khac') {
    S.khac = t.dataset.k!;
    S.focusSau = S.khac;
    render();
    return;
  }
  const don = [...S.don, ...S.kinhHen, ...S.suCo, ...S.thungRac].find((d) => d.id === id);
  if (don && don[f as TruongSuaDuoc] === t.value) return;
  // lưu sau khi trình duyệt đã chuyển focus sang ô kế tiếp
  setTimeout(() => void suaO(id, f as TruongSuaDuoc, t.value), 0);
});

document.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
  if (!b) return;
  const act = b.dataset.act;
  if (act === 'hoan-thanh' && b.dataset.id) void hoanThanh(b.dataset.id, (b.dataset.bang as Bang) ?? 'hen');
  if (act === 'phan-hoi' && b.dataset.id) {
    const don = [...S.don, ...S.kinhHen, ...S.suCo, ...S.thungRac].find((d) => d.id === b.dataset.id);
    const v = b.dataset.val ?? '';
    // bấm lại vào lựa chọn đang chọn thì bỏ chọn
    void suaO(b.dataset.id, 'phanHoi', don?.phanHoi === v ? '' : v);
  }
  if ((act === 'thung-rac' || act === 'khoi-phuc') && b.dataset.id) void datThungRac(b.dataset.id, act === 'thung-rac');
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

function xongKhac(t: HTMLInputElement) {
  const { k, id, f, khac } = t.dataset;
  if (!k || !id || !f || !khac || S.khac !== k) return;
  void themGiaTriMoi(k, id, f as TruongSuaDuoc, khac as LoaiDanhSach, t.value);
}

document.addEventListener('focusout', (e) => {
  const t = e.target as HTMLInputElement;
  if (t.dataset?.khac) xongKhac(t);
});

document.addEventListener('keydown', (e) => {
  const t = e.target as HTMLInputElement;
  if (t.dataset?.khac && e.key === 'Escape') {
    S.khac = null;
    render();
    return;
  }
  if (t.dataset?.khac && e.key === 'Enter') {
    e.preventDefault();
    xongKhac(t);
    return;
  }
  if (e.key === 'Enter' && t.matches?.('input.cell')) {
    e.preventDefault();
    t.blur();
  }
});

window.addEventListener('hashchange', () => {
  S.trang = trangTuHash();
  S.thongBao = null;
  S.thieu = null;
  render();
});

void taiLai();
