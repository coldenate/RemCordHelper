import {
	app,
	BrowserWindow,
	nativeImage,
	Tray,
	Menu,
	NativeImage,
} from "electron";
import { Client } from "@xhayper/discord-rpc";
const path = require("path");
const express = require("express");

const isSecondInstance = app.requestSingleInstanceLock();
let discordRPCLoggedIn: boolean = null;
let remnotePluginAlive: boolean = null;
let tray: Tray | null = null;
let destroyed: boolean = false;
let timeSinceHeartbeat: Date = new Date();

const client = new Client({
	clientId: "1083778386708676728",
});

const appServer = express();
const PORT = 3093;

let serverInstance: any;

// TODO: ADD NEW LOGO

client.on("ready", () => {
	updateTray();
	console.log("ready discord rpc");
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
	console.log("attempting connection");
	// log loggedIN to console and say what it is
	console.log("loggedIn: ", discordRPCLoggedIn);
	if (!discordRPCLoggedIn) {
		// where the actual login packets are sent. if log in has an error, catch it and set loggedIn to false
		client
			.login()
			.catch((err) => {
				console.log(err);
				discordRPCLoggedIn = false;
			})
			.then(() => {
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
			label: "Quit",
			click: () => {
				app.quit();
			},
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
			label: "Reconnect to Discord",
			click: () => {
				attemptConnection();
			},
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

	const iconPath = path.join(__dirname, "../public/assets/icon.png");
	const icon = nativeImage.createFromPath(iconPath);
	icon.resize({ width: 16, height: 16 });
	tray = new Tray(icon);

	attemptConnection();

	updateTray();

	serverInstance = appServer.listen(PORT, () => {
		console.log(`Server listening on port ${PORT}`);
	});
});

function closeServer() {
	serverInstance.close();
}

app.on("before-quit", () => {
	closeServer();
});
