'use strict';
const { contextBridge, ipcRenderer } = require('electron');

// Cầu nối an toàn: trang web chỉ dùng được các hàm lưu/đọc dữ liệu này
contextBridge.exposeInMainWorld('QLCCDesktop', {
  read: () => ipcRenderer.sendSync('qlcc:read'),
  write: (text) => ipcRenderer.sendSync('qlcc:write', text),
  info: () => ipcRenderer.sendSync('qlcc:info'),
  openDataDir: () => ipcRenderer.invoke('qlcc:openDataDir')
});
