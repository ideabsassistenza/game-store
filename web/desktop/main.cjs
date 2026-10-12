const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { normalizeCatalog, DownloadManager, readJson, writeJson } = require('./core.cjs');
let win, manager, games = [], settings;
if (!app.requestSingleInstanceLock()) { app.quit(); } else {
  app.on('second-instance', () => { win?.show(); win?.focus(); });
  app.whenReady().then(() => {
    const data = app.getPath('userData');
    const catalogFile = path.join(data, 'catalog.json');
    const settingsFile = path.join(data, 'settings.json');
    const saved = readJson(settingsFile, {});
    settings = { folder: typeof saved.folder === 'string' && path.isAbsolute(saved.folder) ? saved.folder : path.join(app.getPath('downloads'), 'Overdrive') };
    try { games = normalizeCatalog(readJson(catalogFile, [])); } catch { games = []; }
    win = new BrowserWindow({ width: 1440, height: 900, minWidth: 1000, minHeight: 650, backgroundColor: '#080808', title: 'Overdrive Windows', autoHideMenuBar: true, webPreferences: { preload: path.join(__dirname, 'preload.cjs'), sandbox: true, contextIsolation: true, nodeIntegration: false } });
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.webContents.on('will-navigate', (event, url) => { if (url.split('#')[0] !== win.webContents.getURL().split('#')[0]) event.preventDefault(); });
    win.webContents.session.setPermissionRequestHandler((_wc, _p, callback) => callback(false));
    manager = new DownloadManager(path.join(data, 'downloads.json'), rows => { if (win && !win.isDestroyed()) win.webContents.send('overdrive:progress', rows); });
    const handle = (name, fn) => ipcMain.handle(`overdrive:${name}`, (event, ...args) => {
      if (event.sender !== win.webContents || event.senderFrame !== win.webContents.mainFrame) throw new Error('Unknown sender.');
      return fn(...args);
    });
    handle('catalog', () => games);
    handle('import', async () => {
      const picked = await dialog.showOpenDialog(win, { title: 'Import your catalog', properties: ['openFile'], filters: [{ name: 'Game catalog', extensions: ['json'] }] });
      if (picked.canceled) return false;
      if (fs.statSync(picked.filePaths[0]).size > 32 * 1024 * 1024) throw new Error('Catalog exceeds 32 MB.');
      const next = normalizeCatalog(JSON.parse(fs.readFileSync(picked.filePaths[0], 'utf8')));
      writeJson(catalogFile, next); games = next; return true;
    });
    handle('settings', () => settings);
    handle('folder', async () => {
      if (manager.active.size) throw new Error('Finish or cancel active downloads before changing folders.');
      const picked = await dialog.showOpenDialog(win, { title: 'Choose download folder', properties: ['openDirectory', 'createDirectory'] });
      if (!picked.canceled) { settings.folder = picked.filePaths[0]; writeJson(settingsFile, settings); } return settings;
    });
    handle('downloads', () => manager.list());
    handle('download', id => { const game = games.find(g => g.id === id); if (!game) throw new Error('Game is not in your catalog.'); return manager.start(game, settings.folder); });
    handle('cancel', id => manager.cancel(id)); handle('retry', id => manager.retry(id));
    handle('reveal', id => { const task = manager.tasks.find(t => t.id === id); if (!task || task.status !== 'completed' || !fs.existsSync(task.destination)) throw new Error('Completed file is missing.'); shell.showItemInFolder(task.destination); });
    win.on('close', event => {
      if (manager.active.size && dialog.showMessageBoxSync(win, { type: 'question', message: 'Downloads are running. Quit and interrupt them?', buttons: ['Keep downloading', 'Quit'], defaultId: 0, cancelId: 0 }) === 0) event.preventDefault();
    });
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }).catch(err => { dialog.showErrorBox('Overdrive could not start', err.message); app.quit(); });
}
app.on('window-all-closed', () => app.quit());
