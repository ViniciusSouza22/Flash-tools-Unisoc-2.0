const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectFirmwareFolder: () => ipcRenderer.invoke('select-firmware-folder'),
  runFirmwareFlashCMD: (folderPath) => ipcRenderer.invoke('run-firmware-flash', folderPath),
  connectDevice: (device) => ipcRenderer.invoke('connect-device', device),
  rebootDevice: () => ipcRenderer.invoke('reboot-device'),
  closeApp: () => ipcRenderer.invoke('close-app'),
  minimizeApp: () => ipcRenderer.invoke('minimize-app'),
  maximizeApp: () => ipcRenderer.invoke('maximize-app'),
  onFlashOutput: (callback) => ipcRenderer.on('flash-output', callback),
  removeFlashOutputListeners: () => ipcRenderer.removeAllListeners('flash-output')
});