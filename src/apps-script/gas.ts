// Lớp nối phần xử lý (xu-ly.ts) vào Google Apps Script thật. Chỉ chạy trên Google, không có test tự động;
// mọi logic nằm ở xu-ly.ts đã được test trên máy.
import { CAI_DAT, TAB, docCaiDat, ghiNhanSuaTay, khoiTao, xuLyYeuCau, type BangTinh } from './xu-ly.js';

/* eslint-disable @typescript-eslint/no-explicit-any */
declare const SpreadsheetApp: any;
declare const LockService: any;
declare const ContentService: any;
declare const DriveApp: any;
declare const ScriptApp: any;
declare const Utilities: any;

const THU_MUC_SAO_LUU = 'Sổ Đơn Kính - sao lưu';
const GIU_BAN_SAO = 30;

class BangTinhGas implements BangTinh {
  private ss = SpreadsheetApp.getActiveSpreadsheet();
  private tab(ten: string) {
    return this.ss.getSheetByName(ten);
  }
  coTab(ten: string) {
    return !!this.tab(ten);
  }
  taoTab(ten: string, tieuDe: string[], an = false) {
    const sh = this.ss.insertSheet(ten);
    // '@' = định dạng chữ: Sheets không tự đổi "2026-11-30" thành ngày hay "0912…" thành số
    sh.getRange(1, 1, sh.getMaxRows(), Math.max(tieuDe.length, sh.getMaxColumns())).setNumberFormat('@');
    sh.getRange(1, 1, 1, tieuDe.length).setValues([tieuDe]).setFontWeight('bold');
    sh.setFrozenRows(1);
    if (an) sh.hideSheet();
  }
  doc(ten: string): string[][] {
    return this.tab(ten).getDataRange().getDisplayValues();
  }
  ghiO(ten: string, hang: number, cot: number, giaTri: string) {
    this.tab(ten).getRange(hang + 1, cot + 1).setNumberFormat('@').setValue(giaTri);
  }
  themHang(ten: string, giaTri: string[]) {
    const sh = this.tab(ten);
    sh.getRange(sh.getLastRow() + 1, 1, 1, giaTri.length).setNumberFormat('@').setValues([giaTri]);
  }
}

const json = (o: unknown) => ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
const bayGio = () => new Date().toISOString();

/** Web App: Máy quầy gọi để đồng bộ (giao kèo trong src/core/dong-bo.ts). */
export function doPost(e: any) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20_000);
  try {
    const body = JSON.parse(e?.postData?.contents ?? '{}');
    return json(xuLyYeuCau(new BangTinhGas(), body, bayGio()));
  } catch (loi) {
    return json({ ok: false, loi: String(loi) });
  } finally {
    lock.releaseLock();
  }
}

export function doGet() {
  return json({ ok: true, ten: 'Sổ Đơn Kính' });
}

/** Trigger đơn giản: ghi nhật ký khi ai đó sửa thẳng ô ở tab Đơn kính, để Máy quầy kéo về. */
export function onEdit(e: any) {
  const r = e?.range;
  if (!r || r.getSheet().getName() !== TAB.don) return;
  const b = new BangTinhGas();
  const giaTri: string[][] = r.getDisplayValues();
  for (let i = 0; i < giaTri.length; i++) {
    for (let j = 0; j < giaTri[i]!.length; j++) {
      ghiNhanSuaTay(b, TAB.don, r.getRow() - 1 + i, r.getColumn() - 1 + j, giaTri[i]![j]!, bayGio());
    }
  }
}

/** Chạy một lần bằng tay trong trình soạn Apps Script: tạo tab, khóa, mật khẩu và lịch sao lưu 23:00 hằng đêm. */
export function caiDat() {
  const b = new BangTinhGas();
  khoiTao(b, () => Utilities.getUuid().replace(/-/g, '').slice(0, 12));
  if (!ScriptApp.getProjectTriggers().some((t: any) => t.getHandlerFunction() === 'saoLuuHangDem')) {
    ScriptApp.newTrigger('saoLuuHangDem').timeBased().everyDays(1).atHour(23).create();
  }
  const cd = docCaiDat(b);
  return `Đã cài đặt. Khóa Máy quầy: ${cd[CAI_DAT.khoa]} (chép vào config.local.json của Máy quầy).`;
}

/** Sao lưu hằng đêm: chép cả file vào thư mục sao lưu, giữ 30 bản mới nhất, bản cũ hơn vào thùng rác Drive. */
export function saoLuuHangDem() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ds = DriveApp.getFoldersByName(THU_MUC_SAO_LUU);
  const thuMuc = ds.hasNext() ? ds.next() : DriveApp.createFolder(THU_MUC_SAO_LUU);
  const ten = `${ss.getName()} - ${Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'yyyy-MM-dd HH:mm')}`;
  DriveApp.getFileById(ss.getId()).makeCopy(ten, thuMuc);
  const tep: any[] = [];
  const it = thuMuc.getFiles();
  while (it.hasNext()) tep.push(it.next());
  tep.sort((a, c) => c.getDateCreated().getTime() - a.getDateCreated().getTime());
  tep.slice(GIU_BAN_SAO).forEach((f) => f.setTrashed(true));
}
