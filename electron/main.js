/* Ứng dụng Windows (Electron) cho phần mềm Quản lý Chấm công – Ngày phép */
'use strict';
const { app, BrowserWindow, ipcMain, shell, Menu, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

const APP_NAME = 'Quản lý Chấm công – Ngày phép';
app.setAppUserModelId('vn.qlchamcong.app');

// Thư mục dữ liệu dễ tìm: Documents\QLChamCong
function dataDir() {
  const dir = path.join(app.getPath('documents'), 'QLChamCong');
  fs.mkdirSync(path.join(dir, 'SaoLuu'), { recursive: true });
  return dir;
}
const dataFile = () => path.join(dataDir(), 'du-lieu-cham-cong.json');

function writeAtomic(file, text) {
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, text, 'utf8');
  fs.renameSync(tmp, file);
}

// Sao lưu tự động mỗi ngày 1 bản, giữ 60 bản gần nhất
function dailyBackup(text) {
  const dir = path.join(dataDir(), 'SaoLuu');
  const d = new Date();
  const name = 'SaoLuu_' + d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') + '.json';
  writeAtomic(path.join(dir, name), text);
  const files = fs.readdirSync(dir).filter((f) => /^SaoLuu_\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
  while (files.length > 60) fs.unlinkSync(path.join(dir, files.shift()));
}

ipcMain.on('qlcc:read', (e) => {
  try {
    const f = dataFile();
    e.returnValue = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null;
  } catch (err) { e.returnValue = null; }
});
ipcMain.on('qlcc:write', (e, text) => {
  try {
    writeAtomic(dataFile(), text);
    dailyBackup(text);
    e.returnValue = true;
  } catch (err) { e.returnValue = false; }
});
ipcMain.on('qlcc:info', (e) => {
  e.returnValue = { dataDir: dataDir(), version: app.getVersion() };
});
ipcMain.handle('qlcc:openDataDir', () => shell.openPath(dataDir()));

let win = null;
function createWindow() {
  win = new BrowserWindow({
    width: 1366,
    height: 860,
    minWidth: 1000,
    minHeight: 640,
    title: APP_NAME,
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    backgroundColor: '#f1f5f9',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false
    }
  });
  Menu.setApplicationMenu(null);
  win.loadFile(path.join(__dirname, '..', 'index.html'));
  win.once('ready-to-show', () => { win.maximize(); win.show(); });

  // Mở liên kết ngoài bằng trình duyệt, không cho điều hướng khỏi ứng dụng
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (ev, url) => {
    if (!url.startsWith('file:')) { ev.preventDefault(); if (/^https?:/i.test(url)) shell.openExternal(url); }
  });
  // Lưu file (Excel, sao lưu): hỏi nơi lưu, mặc định thư mục Documents\QLChamCong
  win.webContents.session.on('will-download', (ev, item) => {
    item.setSaveDialogOptions({ defaultPath: path.join(dataDir(), item.getFilename()) });
  });
  // F5 tải lại, F12 công cụ kiểm tra (hỗ trợ kỹ thuật)
  win.webContents.on('before-input-event', (ev, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F5') win.webContents.reload();
    if (input.key === 'F12') win.webContents.toggleDevTools();
  });
  win.on('closed', () => { win = null; });
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
  });
  app.whenReady().then(createWindow).catch((err) => {
    dialog.showErrorBox(APP_NAME, 'Không khởi động được: ' + err.message);
  });
  app.on('window-all-closed', () => app.quit());
}
