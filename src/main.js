"use strict";
exports.__esModule = true;
var electron_1 = require("electron");
var discord_rpc_1 = require("@xhayper/discord-rpc");
var path = require("path");
var express = require("express");
var isSecondInstance = electron_1.app.requestSingleInstanceLock();
var discordRPCLoggedIn = null;
var remnotePluginAlive = null;
var tray = null;
var destroyed = false;
var timeSinceHeartbeat = new Date();
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
    discordRPCLoggedIn = true;
});
client.on("disconnected", function () {
    updateTray();
    discordRPCLoggedIn = false;
});
function attemptConnection() {
    console.log("attempting connection");
    // log loggedIN to console and say what it is
    console.log("loggedIn: ", discordRPCLoggedIn);
    if (!discordRPCLoggedIn) {
        // where the actual login packets are sent. if log in has an error, catch it and set loggedIn to false
        client
            .login()["catch"](function (err) {
            console.log(err);
            discordRPCLoggedIn = false;
        })
            .then(function () {
            discordRPCLoggedIn = true;
        });
    }
    updateTray();
}
function checkHeartbeat() {
    // console.log("Thump thump...");
    // if the time since the last heartbeat is greater than 30 seconds, set alive to false, and destroy the client
    if (new Date().getTime() - timeSinceHeartbeat.getTime() > 30000) {
        remnotePluginAlive = false;
        client.destroy();
        destroyed = true;
        updateTray();
    }
    // console.log(`Alive: ${alive}`);
}
// Check heartbeat every 15 seconds
setInterval(checkHeartbeat, 15000);
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
appServer.get("/version", function (req, res) {
    res.json({ version: electron_1.app.getVersion() });
});
appServer.post("/heartbeat", function (req, res) {
    var json = req.body;
    if (json.heartbeat) {
        // alive is true.
        remnotePluginAlive = true;
        // set timeSinceHeartbeat to the current time
        timeSinceHeartbeat = new Date();
    }
    res.json({ success: true });
    attemptConnection();
});
appServer.post("/activity", function (req, res) {
    var _a;
    var json = req.body;
    // if json.destory is true or all of the values are empty strings and date is 0, destroy the client
    if (json.destroy ||
        (json.details === "" &&
            json.state === "" &&
            json.date === 0 &&
            json.largeImageKey === "" &&
            json.largeImageText === "" &&
            json.smallImageKey === "" &&
            json.smallImageText === "")) {
        client.destroy();
        destroyed = true;
        updateTray();
        res.json({ success: true });
        return;
    }
    if (destroyed) {
        attemptConnection();
        destroyed = false;
        // wait 5 seconds before setting the activity
        setTimeout(function () {
            var _a;
            (_a = client.user) === null || _a === void 0 ? void 0 : _a.setActivity({
                details: json.details,
                state: json.state,
                startTimestamp: new Date(json.date),
                largeImageKey: json.largeImageKey,
                largeImageText: json.largeImageText,
                smallImageKey: json.smallImageKey,
                smallImageText: json.smallImageText,
                instance: false
            });
        }, 3000);
        res.json({ success: true });
        return;
    }
    (_a = client.user) === null || _a === void 0 ? void 0 : _a.setActivity({
        details: json.details,
        state: json.state,
        startTimestamp: new Date(json.date),
        largeImageKey: json.largeImageKey,
        largeImageText: json.largeImageText,
        smallImageKey: json.smallImageKey,
        smallImageText: json.smallImageText,
        instance: false
    });
    res.json({ success: true });
});
function updateTray() {
    // if a value is true, it is Connected, if it is false, it is Disconnected, if it is null, it is Connecting...
    var contextMenu = electron_1.Menu.buildFromTemplate([
        {
            label: "Discord Rich Presence v".concat(electron_1.app.getVersion()),
            enabled: false
        },
        {
            label: "Quit",
            click: function () {
                electron_1.app.quit();
            }
        },
        {
            label: "Discord RPC Status: ".concat(discordRPCLoggedIn === null
                ? "Connecting..."
                : discordRPCLoggedIn
                    ? "Connected"
                    : "Disconnected"),
            enabled: false
        },
        {
            label: "Reconnect to Discord",
            click: function () {
                attemptConnection();
            }
        },
        {
            label: "RemNote Connection Status: ".concat(remnotePluginAlive === null
                ? "Connecting..."
                : remnotePluginAlive
                    ? "Connected"
                    : "Disconnected"),
            enabled: false
        },
    ]);
    // if tray is null, return
    if (tray === null) {
        return;
    }
    tray.setToolTip("RemCord Rich Presence");
    tray.setContextMenu(contextMenu);
}
electron_1.app.whenReady().then(function () {
    if (process.platform === "darwin") {
        electron_1.app.dock.hide();
    }
    var iconPath = path.join(__dirname, "../public/assets/icon.png");
    var icon = electron_1.nativeImage.createFromPath(iconPath);
    icon.resize({ width: 16, height: 16 });
    tray = new electron_1.Tray(icon);
    attemptConnection();
    updateTray();
    serverInstance = appServer.listen(PORT, function () {
        console.log("Server listening on port ".concat(PORT));
    });
});
function closeServer() {
    serverInstance.close();
}
electron_1.app.on("before-quit", function () {
    closeServer();
});
