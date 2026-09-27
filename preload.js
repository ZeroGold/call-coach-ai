const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("overlay", {
  close: () => ipcRenderer.send("win-close"),
  minimize: () => ipcRenderer.send("win-minimize"),
  pin: (on) => ipcRenderer.send("win-pin", on),
  openDashboard: () => ipcRenderer.send("win-dashboard"),
  openPractice: (mode) => ipcRenderer.send("open-practice", mode),
  openSettings: (hash) => ipcRenderer.send("open-settings", hash || ""),
  useCoach: (mode, kind) => ipcRenderer.send("use-coach", mode, kind),
  openExternal: (url) => ipcRenderer.send("open-external", url),
  getSources: () => ipcRenderer.invoke("get-sources"),
  submitKey: (key, model) => ipcRenderer.send("submit-key", key, model),
});
