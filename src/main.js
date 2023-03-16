"use strict";
exports.__esModule = true;
var electron_1 = require("electron");
var discord_rpc_1 = require("@xhayper/discord-rpc");
var path = require("path");
var express = require("express");
var isSecondInstance = electron_1.app.requestSingleInstanceLock();
var loggedIn = false;
var tray = null;
var client = new discord_rpc_1.Client({
    clientId: "1083778386708676728"
});
var appServer = express();
var PORT = 3093;
var serverInstance;
client.on("ready", function () {
    updateTray();
    console.log("ready discord rpc");
});
client.on("connected", function () {
    updateTray();
    loggedIn = true;
});
client.on("disconnected", function () {
    updateTray();
    loggedIn = false;
});
function attemptConnection() {
    console.log("attempting connection");
    // log loggedIN to console and say what it is
    console.log("loggedIn: ", loggedIn);
    if (!loggedIn) {
        // where the actual login packets are sent. if log in has an error, catch it and set loggedIn to false
        client
            .login()["catch"](function (err) {
            console.log(err);
            loggedIn = false;
        })
            .then(function () {
            loggedIn = true;
        });
    }
    updateTray();
}
if (!isSecondInstance) {
    electron_1.app.quit();
}
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
    if (json.destroy) {
        client.destroy();
        res.json({ success: true });
        return;
    }
    (_a = client.user) === null || _a === void 0 ? void 0 : _a.setActivity({
        details: json.details,
        state: json.state,
        startTimestamp: json.date,
        largeImageKey: json.largeImageKey,
        largeImageText: json.largeImageText,
        smallImageKey: json.smallImageKey,
        smallImageText: json.smallImageText,
        instance: false
    });
    res.json({ success: true });
});
function updateTray() {
    var contextMenu = electron_1.Menu.buildFromTemplate([
        {
            label: "Discord Rich Presence",
            enabled: false
        },
        {
            label: "Quit",
            click: function () {
                electron_1.app.quit();
            }
        },
        {
            label: "Status: ".concat(loggedIn ? "Connected" : "Disconnected"),
            enabled: false
        },
        {
            label: "Reconnect",
            click: function () {
                attemptConnection();
            }
        },
    ]);
    tray.setToolTip("RemCord Rich Presence");
    tray.setContextMenu(contextMenu);
}
electron_1.app.whenReady().then(function () {
    // mainWindow = new BrowserWindow({
    // 	width: 800,
    // 	height: 600,
    // 	show: false,
    // 	minimizable: true,
    // 	webPreferences: {
    // 		nodeIntegration: true,
    // 	},
    // });
    // mainWindow.loadFile("src/index.html");
    electron_1.app.dock.hide();
    var iconPath = path.join(__dirname, "../public/assets/icon.png");
    var icon = electron_1.nativeImage.createFromPath(iconPath);
    icon.resize({ width: 16, height: 16 });
    tray = new electron_1.Tray(icon);
    // make a context menu that has the following,
    // - a title
    // - a quit button
    // - a status indicator to show if loggedIn is true ornot
    // - a reconnect to discord button
    // - open github repo button
    attemptConnection(); // TODO: implement RECONNECT BUTTON
    updateTray();
    serverInstance = appServer.listen(PORT, function () {
        console.log("Server listening on port ".concat(PORT));
        // mainWindow?.show();
    });
    // mainWindow.on("closed", function () {
    // 	// mainWindow = null;
    // });
});
function closeServer() {
    serverInstance.close();
}
electron_1.app.on("before-quit", function () {
    closeServer();
});
