import { app, nativeImage, Tray, Menu, dialog } from "electron";
import { Client } from "@xhayper/discord-rpc";
const { autoUpdater, AppUpdater } = require("electron-updater");
const path = require("path");
const express = require("express");

const isSecondInstance = app.requestSingleInstanceLock();
let discordRPCLoggedIn: boolean = null;
let remnotePluginAlive: boolean = null;
let tray: Tray | null = null;
let destroyed: boolean = false;
let timeSinceHeartbeat: Date = new Date();
let isUpdate: boolean = false; // a variable to check if the app needs to be updated if null, it is currently checking
let updatePackageReady: boolean = false; // a variable to check if the update package is ready to be installed
let progress: number | string | null = null; // a variable to check the progress of the update
// var cmd = process.argv[1];

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

let firstRun = false;

const client = new Client({
	clientId: "1083778386708676728",
});

const appServer = express();
const PORT = 3093;

autoUpdater.on("update-available", () => {
	isUpdate = true;
	// if no error, set updatePackageReady to true when its done
	let pth = autoUpdater
		.downloadUpdate()
		.catch((err) => {
			console.error(err);
		})
		.then(() => {
			updatePackageReady = true;
		});

	updateTray();
});

autoUpdater.on("update-not-available", () => {
	isUpdate = false;
	updateTray();
});

autoUpdater.on("update-available", () => {
	isUpdate = true;
	updateTray();
});

autoUpdater.on("update-downloaded", () => {
	updatePackageReady = true;
	updateTray();
});

autoUpdater.on("error", () => {
	isUpdate = false;
	updateTray();
});

let serverInstance: any;
client.on("ready", () => {
	updateTray();
});

client.on("connected", () => {
	updateTray();
	discordRPCLoggedIn = true;
});

client.on("disconnected", () => {
	updateTray();
	discordRPCLoggedIn = false;
});

function attemptConnection(): void {
	if (!discordRPCLoggedIn) {
		// where the actual login packets are sent. if log in has an error, catch it and set loggedIn to false
		client.login().catch((err) => {
			// console.log(err);
			discordRPCLoggedIn = false;
		});
	}
	updateTray();
}

function checkHeartbeat() {
	// console.log("Thump thump...");
	// if the time since the last heartbeat is greater than 5 seconds, set alive to false, and destroy the client
	if (new Date().getTime() - timeSinceHeartbeat.getTime() > 5000) {
		remnotePluginAlive = false;
		client.destroy();
		destroyed = true;
		updateTray();
	}
	// console.log(`Alive: ${alive}`);
}

// Check heartbeat every 2.5 seconds
setInterval(checkHeartbeat, 2500);

if (!isSecondInstance) {
	app.quit();
}

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

appServer.get("/version", (req, res) => {
	res.json({ version: app.getVersion() });
});

appServer.post("/heartbeat", (req, res) => {
	const json = req.body;
	if (json.heartbeat) {
		// alive is true.
		remnotePluginAlive = true;
		// set timeSinceHeartbeat to the current time
		timeSinceHeartbeat = new Date();
	}
	res.json({ success: true });
	attemptConnection();
});

appServer.post("/activity", (req, res) => {
	const json = req.body;
	// if json.destory is true or all of the values are empty strings and date is 0, destroy the client
	if (
		json.destroy ||
		(json.details === "" &&
			json.state === "" &&
			json.date === 0 &&
			json.largeImageKey === "" &&
			json.largeImageText === "" &&
			json.smallImageKey === "" &&
			json.smallImageText === "")
	) {
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
		setTimeout(() => {
			client.user?.setActivity({
				details: json.details,
				state: json.state,
				startTimestamp: new Date(json.date),
				largeImageKey: json.largeImageKey,
				largeImageText: json.largeImageText,
				smallImageKey: json.smallImageKey,
				smallImageText: json.smallImageText,
				instance: false,
			});
		}, 3000);
		res.json({ success: true });
		return;
	}
	client.user?.setActivity({
		details: json.details,
		state: json.state,
		startTimestamp: new Date(json.date),
		largeImageKey: json.largeImageKey,
		largeImageText: json.largeImageText,
		smallImageKey: json.smallImageKey,
		smallImageText: json.smallImageText,
		instance: false,
	});
	res.json({ success: true });
});

function updateTray() {
	// if a value is true, it is Connected, if it is false, it is Disconnected, if it is null, it is Connecting...
	const contextMenu = Menu.buildFromTemplate([
		{
			label: `Discord Rich Presence v${app.getVersion()}`,
			enabled: false,
		},
		{
			type: "separator",
		},
		{
			label: "Quit",
			accelerator: "Command+Q",
			click: () => {
				app.quit();
			},
		},
		{
			label: "Check for Updates",
			accelerator: "Command+U",
			click: () => {
				autoUpdater.checkForUpdates();
			},
		},
		{
			label: "Install Update",
			enabled: true,
			visible: updatePackageReady,
			click: () => {
				autoUpdater.quitAndInstall();

				// app.quit();
			},
		},
		{
			type: "separator",
		},
		{
			label: `Update Status: ${
				// display if the update is available or not
				// display if the update is installing, and if it is, display the progress
				isUpdate
					? "Available"
					: progress !== null
					? `Installing (${Math.round((progress as number) * 100)}%)`
					: "Not Available"
			}`,
			enabled: false,
			visible: true,
		},
		{
			type: "separator",
		},
		{
			label: "Reconnect to Discord",
			accelerator: "Command+R",
			click: () => {
				attemptConnection();
			},
		},
		{
			type: "separator",
		},
		{
			label: `Discord RPC Status: ${
				discordRPCLoggedIn === null
					? "Connecting..."
					: discordRPCLoggedIn
					? "Connected"
					: "Disconnected"
			}`,
			enabled: false,
		},
		{
			label: `RemNote Connection Status: ${
				remnotePluginAlive === null
					? "Connecting..."
					: remnotePluginAlive
					? "Connected"
					: "Disconnected"
			}`,
			enabled: false,
		},
	]);

	// if tray is null, return
	if (tray === null) {
		return;
	}
	tray.setToolTip("RemCord Rich Presence");
	tray.setContextMenu(contextMenu);
}

app.whenReady().then(() => {
	if (process.platform === "darwin") {
		app.dock.hide();
	}

	autoUpdater.checkForUpdates();

	const iconPath = path.join(__dirname, "../public/assets/iconTemplate.png");
	const icon = nativeImage.createFromPath(iconPath);
	icon.resize({ width: 16, height: 16 });
	tray = new Tray(icon);

	attemptConnection();

	updateTray();

	serverInstance = appServer.listen(PORT, () => {}); // added const keyword
});

function closeServer() {
	serverInstance.close();
}

app.on("before-quit", () => {
	closeServer();
});
