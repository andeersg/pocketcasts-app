'use strict';
const path = require('path');
const fs = require('fs');
const URL = require('url').URL;
const electron = require('electron');
const log = require('electron-log');
const {autoUpdater} = require('electron-updater');
const isDev = require('electron-is-dev');
const config = require('./config');

const {app, ipcMain, Menu, globalShortcut} = electron;

app.setAppUserModelId('com.andersgrendstadbakk.pocketcasts');
app.disableHardwareAcceleration();

require('electron-debug')({enabled: true});
require('electron-dl')();
require('electron-context-menu')();

let mainWindow;
let isQuitting = false;
let isPlayingPodcast = false;

const isAlreadyRunning = app.makeSingleInstance(() => {
	if (mainWindow) {
		if (mainWindow.isMinimized()) {
			mainWindow.restore();
		}

		mainWindow.show();
	}
});

if (isAlreadyRunning) {
	app.quit();
}

function registerGlobalMediaButtons() {
	globalShortcut.register('MediaPlayPause', () => {
    mainWindow.send('playPause');
  });
	globalShortcut.register('MediaPreviousTrack', () => {
    mainWindow.send('skipBack');
  });
	globalShortcut.register('MediaNextTrack', () => {
    mainWindow.send('skipForward');
  });
}


function createMainWindow() {
	console.log("Creating MainWindow");
	const lastWindowState = config.get('lastWindowState');
	const mainURL = 'https://play.pocketcasts.com/users/sign_in';
	const titlePrefix = 'PocketCasts';

	const win = new electron.BrowserWindow({
		title: app.getName(),
		show: false,
		x: lastWindowState.x,
		y: lastWindowState.y,
		width: lastWindowState.width,
		height: lastWindowState.height,
		icon: process.platform === 'linux' && path.join(__dirname, 'static/Icon.png'),
		minWidth: 400,
		minHeight: 200,
		alwaysOnTop: config.get('alwaysOnTop'),
		titleBarStyle: process.platform === 'darwin' && Number(require('os').release().split('.')[0]) >= 17 ? null : 'hidden-inset',
		autoHideMenuBar: true,
		webPreferences: {
			preload: path.join(__dirname, 'browser.js'),
			nodeIntegration: false,
			plugins: true
		}
	});

	if (process.platform === 'darwin') {
		win.setSheetOffset(40);
	}

	win.loadURL(mainURL);

	win.on('close', e => {
		console.log("Window close event");

		if (!mainWindow.isMaximized() && !mainWindow.isFullScreen()) {
			config.set('lastWindowState', mainWindow.getBounds());
		}

		// Workaround for electron/electron#10023
		win.blur();

		if (process.platform === 'darwin') {
			app.hide();
		} else {
			app.quit();
		}
	});

	win.on('focus', () => {
		registerGlobalMediaButtons();
	});

	return win;
}

if (!isDev && process.platform !== 'linux') {
	autoUpdater.logger = log;
	autoUpdater.logger.transports.file.level = 'info';
	autoUpdater.checkForUpdates();
}

app.on('ready', () => {
	mainWindow = createMainWindow();

	const {webContents} = mainWindow;

	const argv = require('minimist')(process.argv.slice(1));

	webContents.on('dom-ready', () => {
		if (argv.minimize) {
			mainWindow.minimize();
		} else {
			mainWindow.show();
		}
	});

	if (process.platform === 'darwin') {
		const dockMenu = Menu.buildFromTemplate([
		  {label: 'Play/pause', click: () => { webContents.send('playPause'); }},
		  {label: 'Skip forward', click: () => { webContents.send('skipForward'); }},
		  {label: 'Skip back', click: () => { webContents.send('skipBack'); }}
		])
		app.dock.setMenu(dockMenu);
	}
	else if (process.platform === 'win32') {
		// Add buttons to preview.
		mainWindow.setThumbarButtons([
			{
		    tooltip: 'Skip back',
		    icon: path.join(__dirname, 'static/step-backward.png'),
		    click: () => { webContents.send('skipBack'); }
		  },
			{
		    tooltip: 'Play',
		    icon: path.join(__dirname, 'static/play.png'),
		    click: () => { webContents.send('playPause'); },
				flags: [(isPlayingPodcast ? 'hidden' : 'enabled')]
		  },
			{
		    tooltip: 'Pause',
		    icon: path.join(__dirname, 'static/pause.png'),
		    click: () => { webContents.send('playPause'); },
				flags: [(isPlayingPodcast ? 'enabled' : 'hidden')]
		  },
		  {
		    tooltip: 'Skip foward',
		    icon: path.join(__dirname, 'static/step-forward.png'),
		    click: () => { webContents.send('skipForward'); }
		  }
		]);
	}

	ipcMain.on('playPause', () => {
		isPlayingPodcast = !isPlayingPodcast;
	});

	registerGlobalMediaButtons();
});

app.on('activate', () => {
	mainWindow.show();
});

