import { app, BrowserWindow } from "electron";
import { Client } from "@xhayper/discord-rpc";
const express = require("express");

const isSecondInstance = app.requestSingleInstanceLock();

if (!isSecondInstance) {
	app.quit();
}

const client = new Client({
	clientId: "1083778386708676728",
});

client.on("ready", () => {
	console.log("ready discord rpc");
});

client.login();

const appServer = express();
const PORT = 3093;

let mainWindow: Electron.BrowserWindow | null;

appServer.use(express.json());

appServer.use((_req, res, next) => {
	res.header("Access-Control-Allow-Origin", "*");
	res.header("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE");
	res.header(
		"Access-Control-Allow-Headers",
		"Origin, X-Requested-With, Content-Type, Accept"
	);
	next();
});

appServer.post("/activity", (req, res) => {
	const json = req.body;
	if (json.destroy) {
		client.destroy();
		res.json({ success: true });
		return;
	}
	client.user?.setActivity({
		details: json.details,
		state: json.state,
		startTimestamp: json.date,
		largeImageKey: json.largeImageKey,
		largeImageText: json.largeImageText,
		smallImageKey: json.smallImageKey,
		smallImageText: json.smallImageText,
		instance: false,
	});
	res.json({ success: true });
});

function createWindow() {
	mainWindow = new BrowserWindow({
		width: 800,
		height: 600,
		show: false,
		minimizable: true,
		webPreferences: {
			nodeIntegration: true,
		},
	});
	mainWindow.loadFile("src/index.html");

	appServer.listen(PORT, () => {
		console.log(`Server listening on port ${PORT}`);
		mainWindow?.show();
	});

	mainWindow.on("closed", function () {
		mainWindow = null;
	});
}

function closeServer() {
	appServer.close();
}

app.on("before-quit", () => {
	closeServer();
});

app.on("quit", () => {
	closeServer();
});

app.on("ready", createWindow);

app.on("window-all-closed", function () {
	if (process.platform !== "darwin") {
		app.quit();
	}
});

app.on("activate", function () {
	if (mainWindow === null) {
		createWindow();
	} else {
		mainWindow.show();
	}
});
