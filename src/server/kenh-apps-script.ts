// Kênh đồng bộ thật: gọi Web App của Apps Script gắn với Google Sheet (#13 cài đặt phía Sheet).
//
// Giao kèo HTTP: POST JSON tới URL Web App
//   { hanhDong: 'day', khoa, thayDoi: ThayDoiO[] }  →  { ok: true }
//   { hanhDong: 'keo', khoa, moc: number }          →  { ok: true, thayDoi: ThayDoiO[], moc: number }
//   lỗi                                             →  { ok: false, loi: string }
// `khoa` là khóa bí mật trong tab Cài đặt của Sheet, chỉ Máy quầy biết.
import type { KenhSheet, ThayDoiO } from '../core/dong-bo.js';

export interface CauHinhSheet {
  url: string;
  khoa: string;
}

export class KenhAppsScript implements KenhSheet {
  constructor(private ch: CauHinhSheet, private hetGioMs = 20_000) {}

  async day(thayDoi: ThayDoiO[]) {
    await this.goi({ hanhDong: 'day', thayDoi });
  }

  async keo(moc: number) {
    const r = await this.goi({ hanhDong: 'keo', moc });
    return { thayDoi: (r.thayDoi ?? []) as ThayDoiO[], moc: Number(r.moc) };
  }

  private async goi(body: Record<string, unknown>): Promise<Record<string, unknown>> {
    // Apps Script trả 302 sang googleusercontent.com; fetch tự theo (POST → GET) và nhận JSON.
    const res = await fetch(this.ch.url, {
      method: 'POST',
      headers: { 'content-type': 'text/plain;charset=utf-8' }, // text/plain để Apps Script không đòi CORS preflight
      body: JSON.stringify({ ...body, khoa: this.ch.khoa }),
      signal: AbortSignal.timeout(this.hetGioMs),
    });
    if (!res.ok) throw new Error(`Apps Script trả lỗi HTTP ${res.status}`);
    const data = (await res.json()) as Record<string, unknown>;
    if (data.ok !== true) throw new Error(String(data.loi ?? 'Apps Script trả lỗi không rõ'));
    return data;
  }
}
