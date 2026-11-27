// Kho Đơn kính trên Máy quầy: một file Excel, Desktop\Sổ Đơn Kính\So-don-kinh.xlsx (ADR 0004).
//
// Dữ liệu nằm trong bộ nhớ; mỗi thay đổi ghi lại cả file (file tạm rồi đổi tên), tuần tự từng lần một.
// File đang mở trong Excel thì Windows không cho đổi tên đè lên: thay đổi bị hoàn tác, báo LoiFileDangMo.
// Nhân viên sửa thẳng trong Excel rồi Lưu: docLaiNeuDoi() thấy file đổi, đọc lại tab TỔNG (bố cục src/core/bo-cuc.ts) và
// Danh sách, đưa các ô đổi vào hàng chờ đồng bộ. Các tab ẩn (hàng chờ, trạng thái, phiên) chỉ app ghi.
import { randomUUID } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import ExcelJS from 'exceljs';
import {
  DANH_SACH_MAC_DINH, NHAN_DANH_SACH, TRUONG_SUA_DUOC, donMoi, goiYLoaiTrong,
  type DanhSach, type DonKinh, type LoaiDanhSach, type TruongSuaDuoc,
} from '../core/don-kinh.js';
import type { ThayDoiO, TruongDongBo } from '../core/dong-bo.js';
import { COT_TONG, RONG_COT, donTuHang, oCua } from '../core/bo-cuc.js';

/** Một ô đã sửa ở Máy quầy nhưng chưa đẩy lên Sheet; `luc` tăng dần để biết ô có bị sửa tiếp không. */
export interface OChoDay extends ThayDoiO {
  luc: number;
}

export const TAB_FILE = {
  don: 'TỔNG', danhSach: 'Danh sách', choDay: '_Chờ đẩy', trangThai: '_Trạng thái', phien: '_Phiên',
} as const;

const GIU_SAO_LUU = 30;
const MAU_SAO_LUU = /^So-don-kinh-\d{4}-\d{2}-\d{2}\.xlsx$/;

export class LoiFileDangMo extends Error {
  constructor(readonly duongDan: string) {
    super('File Excel Sổ Đơn Kính đang mở nên chưa lưu được. Đóng Excel rồi thử lại');
  }
}

interface DuLieu {
  don: DonKinh[];
  danhSach: DanhSach;
  choDay: OChoDay[];
  trangThai: Record<string, string>;
  phien: Record<string, number>;
}

export interface TuyChonKho {
  /** Đổi tên file tạm thành file chính; test tiêm vào để giả lập file đang mở. */
  doiTen?: (tu: string, den: string) => void;
}

export class KhoExcel {
  private hangDoi: Promise<unknown> = Promise.resolve();
  /** mtime + kích thước của file lúc app đọc/ghi lần cuối; khác đi nghĩa là ai đó đã Lưu từ Excel. */
  private dauVet = '';
  /** Mã đã cấp cho các dòng không có Mã đơn nhưng chưa ghi được vào file (file đang mở), theo thứ tự dòng. */
  private maChuaGhi: string[] = [];

  private constructor(
    readonly duongDan: string,
    private d: DuLieu,
    private doiTen: (tu: string, den: string) => void,
  ) {}

  static async mo(duongDan: string, tuyChon: TuyChonKho = {}): Promise<KhoExcel> {
    mkdirSync(dirname(duongDan), { recursive: true });
    const kho = new KhoExcel(duongDan, duLieuTrong(), tuyChon.doiTen ?? renameSync);
    if (existsSync(duongDan)) {
      const wb = await docFile(duongDan);
      kho.d.choDay = docChoDay(wb);
      kho.d.trangThai = Object.fromEntries(docBang(wb, TAB_FILE.trangThai).map((h) => [h[0] ?? '', h[1] ?? '']));
      kho.d.phien = Object.fromEntries(docBang(wb, TAB_FILE.phien).map((h) => [h[0] ?? '', Number(h[1]) || 0]));
      await kho.apDungFile(wb, true);
    } else {
      await kho.ghi();
    }
    return kho;
  }

  // ---- Đọc (từ bộ nhớ) ----

  danhSach(): DanhSach & { goiYLoai: string[] } {
    return { ...structuredClone(this.d.danhSach), goiYLoai: goiYLoaiTrong(this.d.don) };
  }

  lay(id: string): DonKinh | undefined {
    const d = this.d.don.find((x) => x.id === id);
    return d && { ...d };
  }

  /** Mọi đơn theo thứ tự dòng trong file, kể cả trong Thùng rác. */
  tatCa(): DonKinh[] {
    return this.d.don.map((d) => ({ ...d }));
  }

  thungRac(): DonKinh[] {
    return this.tatCa().filter((d) => d.thungRac);
  }

  theoNgayDat(ngay: string): DonKinh[] {
    return this.tatCa().filter((d) => d.ngayDat === ngay && !d.thungRac);
  }

  choDay(): OChoDay[] {
    return [...this.d.choDay].sort((a, b) => a.luc - b.luc).map((o) => ({ ...o }));
  }

  trangThai(khoa: string): string | undefined {
    return this.d.trangThai[khoa];
  }

  phienConHan(maBam: string, bayGio: number): boolean {
    for (const [k, het] of Object.entries(this.d.phien)) if (het <= bayGio) delete this.d.phien[k];
    return maBam in this.d.phien;
  }

  // ---- Ghi (phải lưu được vào file, không thì hoàn tác và ném LoiFileDangMo) ----

  tao(ten: string, ngayDat: string): Promise<DonKinh> {
    return this.capNhat(() => {
      const don = donMoi(randomUUID(), ten, ngayDat);
      this.d.don.push(don);
      for (const f of TRUONG_SUA_DUOC) this.ghiCho(don.id, f, don[f]);
      return { ...don };
    });
  }

  sua(id: string, field: TruongSuaDuoc, value: string): Promise<DonKinh | undefined> {
    return this.capNhat(() => {
      const d = this.d.don.find((x) => x.id === id);
      if (!d) return undefined;
      d[field] = value;
      this.ghiCho(id, field, value);
      return { ...d };
    });
  }

  datThungRac(id: string, thungRac: boolean): Promise<DonKinh | undefined> {
    return this.capNhat(() => {
      const d = this.d.don.find((x) => x.id === id);
      if (!d) return undefined;
      d.thungRac = thungRac;
      this.ghiCho(id, 'thungRac', thungRac ? '1' : '');
      return { ...d };
    });
  }

  themVaoDanhSach(loai: LoaiDanhSach, giaTri: string): Promise<void> {
    return this.capNhat(() => {
      if (!this.d.danhSach[loai].includes(giaTri)) this.d.danhSach[loai].push(giaTri);
    });
  }

  /** Nhập các Đơn kính có sẵn mã (chuyển dữ liệu cũ) trong một lần ghi; mã đã có thì bỏ qua. */
  nhapNhieu(ds: DonKinh[]): Promise<{ moi: number; daCo: number }> {
    return this.capNhat(() => {
      const co = new Set(this.d.don.map((d) => d.id));
      let moi = 0;
      for (const don of ds) {
        if (co.has(don.id)) continue;
        co.add(don.id);
        this.d.don.push({ ...don });
        for (const f of TRUONG_SUA_DUOC) this.ghiCho(don.id, f, don[f]);
        if (don.thungRac) this.ghiCho(don.id, 'thungRac', '1');
        moi++;
      }
      return { moi, daCo: ds.length - moi };
    });
  }

  /** Bỏ các ô đã đẩy xong; ô bị sửa tiếp trong lúc đẩy (luc khác) vẫn giữ lại để đẩy lần sau. */
  xoaChoDay(da: OChoDay[]): Promise<void> {
    const xong = new Set(da.map((o) => `${o.id}\t${o.truong}\t${o.luc}`));
    return this.capNhat(() => {
      this.d.choDay = this.d.choDay.filter((o) => !xong.has(`${o.id}\t${o.truong}\t${o.luc}`));
    });
  }

  /** Ghi các ô kéo về từ Sheet cùng mốc mới trong một lần ghi; bỏ qua ô đang chờ đẩy (local thắng). */
  apDungTuSheet(ds: ThayDoiO[], mocMoi: number): Promise<void> {
    return this.capNhat(() => {
      for (const o of ds) {
        if (this.d.choDay.some((c) => c.id === o.id && c.truong === o.truong)) continue;
        let d = this.d.don.find((x) => x.id === o.id);
        if (!d) {
          d = { ...donMoi(o.id, '', ''), ttTrong: '', ttKinh: '' };
          this.d.don.push(d);
        }
        if (o.truong === 'thungRac') d.thungRac = !!o.giaTri;
        else d[o.truong] = o.giaTri;
      }
      this.d.trangThai.mocKeo = String(mocMoi);
    });
  }

  // ---- Ghi khi được (phiên, trạng thái): file đang mở thì giữ trong bộ nhớ, ghi cùng lần lưu sau ----

  datTrangThai(khoa: string, giaTri: string): Promise<void> {
    return this.capNhatKhiDuoc(() => {
      this.d.trangThai[khoa] = giaTri;
    });
  }

  taoPhien(maBam: string, hetHan: number): Promise<void> {
    return this.capNhatKhiDuoc(() => {
      this.d.phien[maBam] = hetHan;
    });
  }

  xoaPhien(maBam: string): Promise<void> {
    return this.capNhatKhiDuoc(() => {
      delete this.d.phien[maBam];
    });
  }

  // ---- File ----

  /** Nếu file đã được Lưu từ Excel (hoặc bị xóa) kể từ lần cuối, đọc lại cho khớp. Gọi trước mỗi yêu cầu. */
  docLaiNeuDoi(): Promise<void> {
    return this.noiTiep(() => this.docLaiTrongHang());
  }

  /** Chép file vào `thuMuc` thành bản của ngày `ngay` (ghi đè trong ngày), giữ 30 bản mới nhất. */
  saoLuu(thuMuc: string, ngay: string): Promise<string> {
    return this.noiTiep(async () => {
      mkdirSync(thuMuc, { recursive: true });
      const dich = join(thuMuc, `So-don-kinh-${ngay}.xlsx`);
      copyFileSync(this.duongDan, dich);
      const cu = readdirSync(thuMuc).filter((f) => MAU_SAO_LUU.test(f)).sort().reverse().slice(GIU_SAO_LUU);
      for (const f of cu) rmSync(join(thuMuc, f), { force: true });
      return dich;
    });
  }

  /** Chờ các lần ghi đang dở xong. */
  async dong(): Promise<void> {
    await this.noiTiep(async () => {});
  }

  // ---- Bên trong ----

  private noiTiep<T>(viec: () => Promise<T>): Promise<T> {
    const p = this.hangDoi.then(viec, viec);
    this.hangDoi = p.catch(() => {});
    return p;
  }

  private capNhat<T>(doi: () => T): Promise<T> {
    return this.noiTiep(async () => {
      await this.docLaiTrongHang();
      const truoc = structuredClone(this.d);
      const kq = doi();
      try {
        await this.ghi();
      } catch (e) {
        this.d = truoc;
        throw e;
      }
      return kq;
    });
  }

  private capNhatKhiDuoc(doi: () => void): Promise<void> {
    return this.noiTiep(async () => {
      await this.docLaiTrongHang();
      doi();
      await this.ghiKhiDuoc();
    });
  }

  private async ghiKhiDuoc() {
    try {
      await this.ghi();
    } catch (e) {
      if (!(e instanceof LoiFileDangMo)) throw e;
    }
  }

  private dauVetFile(): string {
    try {
      const s = statSync(this.duongDan);
      return `${s.mtimeMs}:${s.size}`;
    } catch {
      return '';
    }
  }

  private async docLaiTrongHang() {
    if (!existsSync(this.duongDan)) return this.ghiKhiDuoc();
    if (this.dauVetFile() === this.dauVet) return;
    await this.apDungFile(await docFile(this.duongDan));
  }

  /**
   * Lấy tab TỔNG và Danh sách của file làm chuẩn, ghi nhận các ô khác bộ nhớ vào hàng chờ đồng bộ.
   * `lanDau` (mở app): bộ nhớ còn trống, chỉ dòng mới chưa có Mã đơn mới vào hàng chờ.
   */
  private async apDungFile(wb: ExcelJS.Workbook, lanDau = false) {
    this.dauVet = this.dauVetFile();
    const cu = new Map(this.d.don.map((d) => [d.id, d]));
    const daGap = new Set<string>();
    const maMoi: string[] = [];
    let canGhiLai = false;
    const ds: DonKinh[] = [];

    for (const dong of docDongDon(wb)) {
      let id = dong.id;
      const moi = !id || daGap.has(id);
      if (moi) {
        // Dòng mới gõ trong Excel (hoặc chép cả Mã đơn của dòng khác): cấp mã, giữ mã qua các lần đọc lại
        id = this.maChuaGhi[maMoi.length] ?? randomUUID();
        maMoi.push(id);
        canGhiLai = true;
      }
      daGap.add(id);
      const don: DonKinh = { ...dong, id };
      const truoc = lanDau && !moi ? don : cu.get(id);
      for (const f of TRUONG_DONG_BO_FILE) {
        const v = f === 'thungRac' ? (don.thungRac ? '1' : '') : don[f];
        const vTruoc = truoc ? (f === 'thungRac' ? (truoc.thungRac ? '1' : '') : truoc[f]) : '';
        if (v !== vTruoc) this.ghiCho(id, f, v);
      }
      ds.push(don);
    }
    // Dòng bị xóa hẳn trong Excel: đưa vào Thùng rác thay vì mất
    for (const d of this.d.don) {
      if (daGap.has(d.id)) continue;
      if (!d.thungRac) this.ghiCho(d.id, 'thungRac', '1');
      ds.push({ ...d, thungRac: true });
      canGhiLai = true;
    }
    this.d.don = ds;
    this.maChuaGhi = maMoi;

    const dsFile = docDanhSach(wb);
    if (dsFile) this.d.danhSach = dsFile;
    if (canGhiLai) await this.ghiKhiDuoc();
  }

  private ghiCho(id: string, truong: TruongDongBo, giaTri: string) {
    const luc = this.d.choDay.reduce((m, o) => Math.max(m, o.luc), 0) + 1;
    const o = this.d.choDay.find((x) => x.id === id && x.truong === truong);
    if (o) Object.assign(o, { giaTri, luc });
    else this.d.choDay.push({ id, truong, giaTri, luc });
  }

  /** Ghi cả file: file tạm rồi đổi tên, để mất điện giữa chừng không hỏng file cũ. */
  private async ghi() {
    const wb = taoFile(this.d);
    const tam = `${this.duongDan}.tmp`;
    await wb.xlsx.writeFile(tam);
    try {
      this.doiTen(tam, this.duongDan);
    } catch (e) {
      rmSync(tam, { force: true });
      const ma = (e as NodeJS.ErrnoException).code;
      if (ma === 'EBUSY' || ma === 'EPERM' || ma === 'EACCES') throw new LoiFileDangMo(this.duongDan);
      throw e;
    }
    this.dauVet = this.dauVetFile();
    this.maChuaGhi = [];
  }
}

const TRUONG_DONG_BO_FILE: TruongDongBo[] = [...TRUONG_SUA_DUOC, 'thungRac'];

function duLieuTrong(): DuLieu {
  return { don: [], danhSach: structuredClone(DANH_SACH_MAC_DINH) as DanhSach, choDay: [], trangThai: {}, phien: {} };
}

async function docFile(duongDan: string) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(duongDan);
  return wb;
}

// ---- Đọc file ----

const p2 = (n: number) => String(n).padStart(2, '0');

/** Giá trị ô → chữ. Excel hay tự đổi: ngày → Date, số → number; đưa về dạng app dùng. */
function chu(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return `${v.getUTCFullYear()}-${p2(v.getUTCMonth() + 1)}-${p2(v.getUTCDate())}`;
  if (typeof v !== 'object') return String(v).trim();
  if ('richText' in v) return v.richText.map((t) => t.text).join('').trim();
  if ('result' in v) return chu(v.result as ExcelJS.CellValue);
  if ('text' in v) return String(v.text).trim();
  return '';
}

/** Ngày gõ tay kiểu 30/11/2026 → 2026-11-30; ngày Excel lưu dạng số thứ tự ngày (46356) → 2026-11-30. */
function chuanNgay(s: string): string {
  const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (m) return `${m[3]}-${p2(Number(m[2]))}-${p2(Number(m[1]))}`;
  if (/^\d{5}(\.\d+)?$/.test(s)) return chu(new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(s)) * 864e5));
  return s;
}

function docBang(wb: ExcelJS.Workbook, tab: string): string[][] {
  const ws = wb.getWorksheet(tab);
  if (!ws) return [];
  const hang: string[][] = [];
  ws.eachRow((r, i) => {
    if (i > 1) hang.push(Array.from({ length: ws.columnCount }, (_, c) => chu(r.getCell(c + 1).value)));
  });
  return hang;
}

function docChoDay(wb: ExcelJS.Workbook): OChoDay[] {
  return docBang(wb, TAB_FILE.choDay)
    .filter((h) => h[0] && TRUONG_DONG_BO_FILE.includes(h[1] as TruongDongBo))
    .map((h) => ({ id: h[0]!, truong: h[1] as TruongDongBo, giaTri: h[2] ?? '', luc: Number(h[3]) || 0 }));
}

/** Các dòng của tab TỔNG (file cũ: "Đơn kính"), theo tiêu đề cột (đổi thứ tự cột vẫn đọc đúng). */
function docDongDon(wb: ExcelJS.Workbook): DonKinh[] {
  const ws = wb.getWorksheet(TAB_FILE.don) ?? wb.getWorksheet('Đơn kính');
  if (!ws) return [];
  const rong = ws.columnCount;
  const tieuDe = Array.from({ length: rong }, (_, c) => chu(ws.getRow(1).getCell(c + 1).value));
  const ds: DonKinh[] = [];
  ws.eachRow((r, i) => {
    if (i === 1) return;
    const d = donTuHang(tieuDe, Array.from({ length: rong }, (_, c) => chu(r.getCell(c + 1).value)));
    d.ngayDat = chuanNgay(d.ngayDat);
    d.ngayHen = chuanNgay(d.ngayHen);
    if (!d.id && !TRUONG_SUA_DUOC.some((f) => d[f])) return; // dòng trống
    ds.push(d);
  });
  return ds;
}

function docDanhSach(wb: ExcelJS.Workbook): DanhSach | undefined {
  const ws = wb.getWorksheet(TAB_FILE.danhSach);
  if (!ws) return undefined;
  const ds = Object.fromEntries(Object.keys(NHAN_DANH_SACH).map((k) => [k, [] as string[]])) as DanhSach;
  ws.getRow(1).eachCell((c, cot) => {
    const loai = (Object.keys(NHAN_DANH_SACH) as LoaiDanhSach[]).find((k) => NHAN_DANH_SACH[k] === chu(c.value));
    if (!loai) return;
    ws.getColumn(cot).eachCell((o, i) => {
      const v = chu(o.value);
      if (i > 1 && v && !ds[loai].includes(v)) ds[loai].push(v);
    });
  });
  return ds;
}

// ---- Ghi file ----

function taoFile(d: DuLieu): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Sổ Đơn Kính';
  const chuoi = { numFmt: '@' };

  const ws = wb.addWorksheet(TAB_FILE.don, { views: [{ state: 'frozen', ySplit: 1 }] });
  // Cùng bố cục với tab TỔNG của Google Sheet (giống file mẫu cũ); ô tick nguồn tròng ghi đúng/sai thật
  ws.columns = COT_TONG.map((c) => ({ header: c.tieuDe, width: RONG_COT(c), style: c.loai === 'tick' ? {} : chuoi }));
  const tieuDe = ws.getRow(1);
  tieuDe.font = { bold: true };
  tieuDe.alignment = { wrapText: true, vertical: 'middle' };
  for (const don of d.don) {
    ws.addRow(COT_TONG.map((c) => (c.loai === 'tick' ? oCua(c, don) === 'TRUE' : oCua(c, don))));
  }
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columnCount } };

  const loai = Object.keys(NHAN_DANH_SACH) as LoaiDanhSach[];
  const wsDs = wb.addWorksheet(TAB_FILE.danhSach, { views: [{ state: 'frozen', ySplit: 1 }] });
  wsDs.columns = loai.map((k) => ({ header: NHAN_DANH_SACH[k], key: k, width: 22, style: chuoi }));
  wsDs.getRow(1).font = { bold: true };
  const dai = Math.max(0, ...loai.map((k) => d.danhSach[k].length));
  for (let i = 0; i < dai; i++) wsDs.addRow(Object.fromEntries(loai.map((k) => [k, d.danhSach[k][i] ?? ''])));

  const an = (ten: string, tieuDe: string[], hang: (string | number)[][]) => {
    const w = wb.addWorksheet(ten, { state: 'veryHidden' });
    w.addRow(tieuDe);
    for (const h of hang) w.addRow(h.map(String));
  };
  an(TAB_FILE.choDay, ['Mã đơn', 'Trường', 'Giá trị', 'Lúc'], d.choDay.map((o) => [o.id, o.truong, o.giaTri, o.luc]));
  an(TAB_FILE.trangThai, ['Khóa', 'Giá trị'], Object.entries(d.trangThai));
  an(TAB_FILE.phien, ['Mã băm', 'Hết hạn'], Object.entries(d.phien));
  return wb;
}
