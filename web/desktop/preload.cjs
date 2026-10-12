const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('overdrive', {
  catalog: () => ipcRenderer.invoke('overdrive:catalog'),
  importCatalog: () => ipcRenderer.invoke('overdrive:import'),
  settings: () => ipcRenderer.invoke('overdrive:settings'),
  pickFolder: () => ipcRenderer.invoke('overdrive:folder'),
  downloads: () => ipcRenderer.invoke('overdrive:downloads'),
  download: id => ipcRenderer.invoke('overdrive:download', id),
  cancel: id => ipcRenderer.invoke('overdrive:cancel', id),
  retry: id => ipcRenderer.invoke('overdrive:retry', id),
  reveal: id => ipcRenderer.invoke('overdrive:reveal', id),
  onDownloads: callback => {
    const listener = (_event, rows) => callback(rows);
    ipcRenderer.on('overdrive:progress', listener);
    return () => ipcRenderer.removeListener('overdrive:progress', listener);
  },
});
