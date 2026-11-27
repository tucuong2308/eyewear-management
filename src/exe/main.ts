// Điểm chạy của SoDonKinh.exe trên Máy quầy.
//
//   SoDonKinh.exe               mở app: chạy máy chủ ngầm (nếu chưa chạy) rồi mở trình duyệt
//   SoDonKinh.exe --khoi-dong   như trên nhưng không mở trình duyệt (dùng khi Windows khởi động)
//   SoDonKinh.exe --cai-dat     tự chạy cùng Windows + mở cổng trên Windows Firewall, rồi mở app
//   SoDonKinh.exe --go-cai-dat  bỏ tự chạy và bỏ quy tắc tường lửa
//   SoDonKinh.exe --nen         (nội bộ) tiến trình máy chủ chạy ngầm + biểu tượng khay hệ thống
import { spawn, spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { startServer } from '../server/app.js';
import { diaChiMangNoiBo, docCauHinh } from '../server/cau-hinh.js';
import { KenhAppsScript } from '../server/kenh-apps-script.js';

const TEN = 'Sổ Đơn Kính';
const CONG = Number(process.env.PORT ?? 8080);
const URL_APP = `http://localhost:${CONG}`;
const DATA_DIR = process.env.DATA_DIR ?? join(process.env.LOCALAPPDATA ?? process.cwd(), 'SoDonKinh');
const QUY_TAC_TUONG_LUA = 'So Don Kinh';
const LOI_TAT = join(process.env.APPDATA ?? '', 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup', 'So Don Kinh.lnk');

mkdirSync(DATA_DIR, { recursive: true });
const FILE_LOG = join(DATA_DIR, 'so-don-kinh.log');
const ghiLog = (s: string) => {
  try {
    appendFileSync(FILE_LOG, `[${new Date().toISOString()}] ${s}\n`, 'utf8');
  } catch {
    /* không ghi được log thì thôi */
  }
};

/** Exe đóng gói (Node SEA) đọc giao diện nhúng sẵn; chạy bằng node thì đọc từ dist/web. */
function docTepNhung(): ((ten: string) => Promise<Buffer>) | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sea = require('node:sea') as typeof import('node:sea');
    if (!sea.isSea()) return undefined;
    return async (ten) => Buffer.from(sea.getAsset(ten));
  } catch {
    return undefined;
  }
}

async function dangChay(): Promise<boolean> {
  try {
    const r = await fetch(`${URL_APP}/api/phien`, { signal: AbortSignal.timeout(1500) });
    return r.status === 200 || r.status === 401;
  } catch {
    return false;
  }
}

const moTrinhDuyet = () => spawn('cmd', ['/c', 'start', '""', URL_APP], { detached: true, stdio: 'ignore', windowsHide: true }).unref();

const thamSoPs = (script: string) =>
  ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')];

/** Chạy PowerShell và chờ xong. */
const powershell = (script: string) => spawnSync('powershell.exe', thamSoPs(script), { windowsHide: true, encoding: 'utf8' });

/** Chạy PowerShell nền (biểu tượng khay sống cùng máy chủ). */
const powershellNen = (script: string) => spawn('powershell.exe', thamSoPs(script), { windowsHide: true, stdio: 'ignore' });

/** Biểu tượng khay hệ thống: bấm đúp hoặc "Mở" để mở app, "Thoát" để tắt máy chủ. */
function khayHeThong() {
  const ps = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$icon = New-Object System.Windows.Forms.NotifyIcon
$icon.Icon = [System.Drawing.SystemIcons]::Application
$icon.Text = '${TEN}'
$menu = New-Object System.Windows.Forms.ContextMenuStrip
$mo = $menu.Items.Add('Mở ${TEN}')
$mo.add_Click({ Start-Process '${URL_APP}' })
$thoat = $menu.Items.Add('Thoát')
$thoat.add_Click({ $icon.Visible = $false; [System.Windows.Forms.Application]::Exit() })
$icon.ContextMenuStrip = $menu
$icon.add_DoubleClick({ Start-Process '${URL_APP}' })
$icon.Visible = $true
[System.Windows.Forms.Application]::Run()
$icon.Dispose()
`;
  return powershellNen(ps);
}

async function chayNen() {
  if (await dangChay()) return; // chỉ một máy chủ tại một thời điểm
  const ch = docCauHinh(DATA_DIR);
  const server = await startServer({
    dbPath: join(DATA_DIR, 'so-don-kinh.db'),
    port: CONG,
    taiKhoan: ch.taiKhoan,
    docTepGiaoDien: docTepNhung(),
    kenhSheet: ch.sheet ? new KenhAppsScript(ch.sheet) : undefined,
    ghiLog,
  });
  ghiLog(ch.sheet ? 'Đồng bộ Google Sheet: bật (30 giây một lần)' : 'Đồng bộ Google Sheet: chưa cấu hình (thêm "sheet": { "url", "khoa" } vào config.local.json)');
  ghiLog(`Máy chủ chạy tại ${URL_APP}; mạng nội bộ: ${diaChiMangNoiBo().map((a) => `http://${a}:${CONG}`).join(', ')}`);
  const khay = khayHeThong();
  const tat = () => {
    khay.kill();
    void server.close().finally(() => process.exit(0));
  };
  khay.on('exit', () => {
    ghiLog('Đã thoát từ khay hệ thống');
    void server.close().finally(() => process.exit(0));
  });
  process.on('SIGINT', tat);
  process.on('SIGTERM', tat);
}

async function moApp(moTrinhDuyetSau: boolean) {
  if (!(await dangChay())) {
    spawn(process.execPath, chayLai(['--nen']), { detached: true, stdio: 'ignore', windowsHide: true }).unref();
    for (let i = 0; i < 40 && !(await dangChay()); i++) await new Promise((r) => setTimeout(r, 250));
  }
  if (moTrinhDuyetSau) moTrinhDuyet();
}

/** Tham số để chạy lại chính chương trình này: exe đóng gói chỉ cần cờ; chạy bằng node thì cần cả đường dẫn script. */
function chayLai(co: string[]) {
  const laSea = (() => {
    try {
      return (require('node:sea') as typeof import('node:sea')).isSea();
    } catch {
      return false;
    }
  })();
  return laSea ? co : [process.argv[1]!, ...co];
}

function caiDat() {
  const exe = process.execPath.replace(/'/g, "''");
  const loiTat = LOI_TAT.replace(/'/g, "''");
  powershell(
    `$s = (New-Object -ComObject WScript.Shell).CreateShortcut('${loiTat}'); $s.TargetPath = '${exe}'; $s.Arguments = '--khoi-dong'; $s.WindowStyle = 7; $s.Description = '${TEN}'; $s.Save()`,
  );
  // Mở cổng cho điện thoại trong mạng nội bộ; cần quyền quản trị nên Windows sẽ hỏi.
  powershell(
    `Start-Process netsh -Verb RunAs -WindowStyle Hidden -Wait -ArgumentList 'advfirewall firewall add rule name="${QUY_TAC_TUONG_LUA}" dir=in action=allow protocol=TCP localport=${CONG} profile=private,domain'`,
  );
  ghiLog(`Đã cài đặt: lối tắt khởi động ${existsSync(LOI_TAT) ? 'có' : 'KHÔNG tạo được'}`);
}

function goCaiDat() {
  rmSync(LOI_TAT, { force: true });
  powershell(
    `Start-Process netsh -Verb RunAs -WindowStyle Hidden -Wait -ArgumentList 'advfirewall firewall delete rule name="${QUY_TAC_TUONG_LUA}"'`,
  );
  ghiLog('Đã gỡ cài đặt (máy chủ đang chạy, nếu có, vẫn chạy tới khi Thoát ở khay)');
}

async function main() {
  const co = process.argv.slice(1);
  try {
    if (co.includes('--nen')) return await chayNen();
    if (co.includes('--go-cai-dat')) return goCaiDat();
    if (co.includes('--cai-dat')) caiDat();
    await moApp(!co.includes('--khoi-dong'));
  } catch (e) {
    ghiLog(`Lỗi: ${(e as Error).stack ?? e}`);
    process.exitCode = 1;
  }
}

void main();
