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
let loggedIn: boolean = false;
let tray: Tray | null = null;

const client = new Client({
	clientId: "1083778386708676728",
});

const appServer = express();
const PORT = 3093;

let serverInstance: any;

let destroyed: boolean = false;
let alive: boolean = true;
let timeSinceHeartbeat: Date = new Date();

client.on("ready", () => {
	updateTray();
	console.log("ready discord rpc");
});

client.on("connected", () => {
	updateTray();
	loggedIn = true;
});

client.on("disconnected", () => {
	updateTray();
	loggedIn = false;
});

function attemptConnection(): void {
	console.log("attempting connection");
	// log loggedIN to console and say what it is
	console.log("loggedIn: ", loggedIn);
	if (!loggedIn) {
		// where the actual login packets are sent. if log in has an error, catch it and set loggedIn to false
		client
			.login()
			.catch((err) => {
				console.log(err);
				loggedIn = false;
			})
			.then(() => {
				loggedIn = true;
			});
	}
	updateTray();
}

function checkHeartbeat() {
	// console.log("Thump thump...");
	// if the time since the last heartbeat is greater than 30 seconds, set alive to false, and destroy the client
	if (new Date().getTime() - timeSinceHeartbeat.getTime() > 30000) {
		alive = false;
		client.destroy();
		destroyed = true;
		updateTray();
	}
	// console.log(`Alive: ${alive}`);
}

// Check heartbeat every 15 seconds
// setInterval(checkHeartbeat, 15000);

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

appServer.post("/heartbeat", (req, res) => {
	const json = req.body;
	console.log("heartbeat");
	if (json.heartbeat) {
		// alive is true.
		alive = true;
		// set timeSinceHeartbeat to the current time
		timeSinceHeartbeat = new Date();
	}
	res.json({ success: true });
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
	const contextMenu = Menu.buildFromTemplate([
		{
			label: "Discord Rich Presence",
			enabled: false,
		},
		{
			label: "Quit",
			click: () => {
				app.quit();
			},
		},
		{
			label: `Status: ${loggedIn ? "Connected" : "Disconnected"}`,
			enabled: false,
		},
		{
			label: "Reconnect",
			click: () => {
				attemptConnection();
			},
		},
	]);

	tray.setToolTip("RemCord Rich Presence");
	tray.setContextMenu(contextMenu);
}

app.whenReady().then(() => {
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
	app.dock.hide();

	const iconPath = path.join(__dirname, "../public/assets/icon.png");
	const icon = nativeImage.createFromPath(iconPath);
	icon.resize({ width: 16, height: 16 });
	tray = new Tray(icon);

	// make a context menu that has the following,
	// - a title
	// - a quit button
	// - a status indicator to show if loggedIn is true ornot
	// - a reconnect to discord button
	// - open github repo button
	attemptConnection(); // TODO: implement RECONNECT BUTTON

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
