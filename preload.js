const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("overlay", {
  close: () => ipcRenderer.send("win-close"),
  minimize: () => ipcRenderer.send("win-minimize"),
  pin: (on) => ipcRenderer.send("win-pin", on),
  openDashboard: () => ipcRenderer.send("win-dashboard"),
  getSources: () => ipcRenderer.invoke("get-sources"),
  submitKey: (key, model) => ipcRenderer.send("submit-key", key, model),
});
