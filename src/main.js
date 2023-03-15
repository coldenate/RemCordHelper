"use strict";
exports.__esModule = true;
var electron_1 = require("electron");
var discord_rpc_1 = require("@xhayper/discord-rpc");
var express = require("express");
var isSecondInstance = electron_1.app.requestSingleInstanceLock();
if (!isSecondInstance) {
    electron_1.app.quit();
}
var client = new discord_rpc_1.Client({
    clientId: "1083778386708676728"
});
client.on("ready", function () {
    console.log("ready discord rpc");
});
client.login();
var appServer = express();
var PORT = 3093;
var mainWindow;
appServer.use(express.json());
appServer.use(function (_req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});
appServer.post("/activity", function (req, res) {
    var _a;
    var json = req.body;
    (_a = client.user) === null || _a === void 0 ? void 0 : _a.setActivity({
        details: json.details,
        state: json.state,
        startTimestamp: Date.now(),
        largeImageKey: json.largeImageKey,
        largeImageText: json.largeImageText,
        smallImageKey: json.smallImageKey,
        smallImageText: json.smallImageText,
        instance: false
    });
    res.json({ success: true });
});
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 800,
        height: 600,
        show: false,
        minimizable: true,
        webPreferences: {
            nodeIntegration: true
        }
    });
    mainWindow.loadFile("src/index.html");
    appServer.listen(PORT, function () {
        console.log("Server listening on port ".concat(PORT));
        mainWindow === null || mainWindow === void 0 ? void 0 : mainWindow.show();
    });
    mainWindow.on("closed", function () {
        mainWindow = null;
    });
}
function closeServer() {
    appServer.close();
}
electron_1.app.on("before-quit", function () {
    closeServer();
});
electron_1.app.on("quit", function () {
    closeServer();
});
electron_1.app.on("ready", createWindow);
electron_1.app.on("window-all-closed", function () {
    if (process.platform !== "darwin") {
        electron_1.app.quit();
    }
});
electron_1.app.on("activate", function () {
    if (mainWindow === null) {
        createWindow();
    }
    else {
        mainWindow.show();
    }
});
