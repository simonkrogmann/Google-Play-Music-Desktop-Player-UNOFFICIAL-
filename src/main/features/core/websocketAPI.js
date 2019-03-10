import { app } from 'electron';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import WebSocket, { Server as WebSocketServer } from 'ws';

let server;
let oldTime = {};

const changeEvents = ['track', 'state', 'shuffle', 'repeat', 'volume'];
const API_VERSION = JSON.parse(fs.readFileSync(path.resolve(`${__dirname}/../../../../package.json`))).apiVersion;

let ad;
let authCode = Math.floor(Math.random() * 9999);
authCode = '0000'.substr(0, 4 - authCode.length) + authCode;
let connectClient;
let connectClientShouldReconnect = true;

changeEvents.forEach((channel) => {
  PlaybackAPI.on(`change:${channel}`, (newValue) => {
    if (server && server.broadcast) {
      server.broadcast(channel === 'state' ? 'playState' : channel, newValue);
    }
    if (connectClient) {
      connectClient.channel(channel === 'state' ? 'playState' : channel, newValue);
    }
  });
});

const requireCode = (ws) => {
  authCode = Math.floor(Math.random() * 9999).toString();
  authCode = '0000'.substr(0, 4 - authCode.length) + authCode;
  // DEV: Always be 000 when testing
  authCode = Settings.__TEST__ ? '0000' : authCode;
  Emitter.sendToWindowsOfName('main', 'show:code_controller', {
    authCode,
  });
  ws.json({
    channel: 'connect',
    payload: 'CODE_REQUIRED',
  });
};

const sendInitialBurst = (ws) => {
  ws.channel('API_VERSION', API_VERSION);
  ws.channel('playState', PlaybackAPI.isPlaying());
  ws.channel('shuffle', PlaybackAPI.currentShuffle());
  ws.channel('repeat', PlaybackAPI.currentRepeat());
  ws.channel('volume', PlaybackAPI.getVolume());
  if (PlaybackAPI.currentSong(true)) {
    ws.channel('track', PlaybackAPI.currentSong(true));
  }
};

const addWSPrototypes = (ws) => {
  ws.json = (obj) => { // eslint-disable-line
    if (ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify(obj));
  };
  ws.channel = (channel, obj) => { // eslint-disable-line
    ws.json({
      channel,
      payload: obj,
    });
  };
};

const handleWSMessage = (ws) =>
  (data) => {
    try {
      const command = JSON.parse(data);
      if (command.type === 'disconnect') {
        connectClientShouldReconnect = false;
      }
      if (command.namespace && command.method) {
        const args = command.arguments || [];
        // Attempt to handle client connectection and authorization
        if (command.namespace === 'inital_burst') {
          sendInitialBurst(ws);
          return;
        }
        // Attempt to execute the globa magical controller
        if (!Array.isArray(args)) {
          throw Error('Bad arguments');
        }
        Emitter.sendToGooglePlayMusic('execute:gmusic', {
          namespace: command.namespace,
          method: command.method,
          args,
        });
        if (typeof command.requestID !== 'undefined') {
          Emitter.once(`execute:gmusic:result_${command.requestID}`, (event, result) => {
            ws.json(result);
          });
        }
      } else {
        throw Error('Bad command');
      }
    } catch (err) {
      console.log(err);
      Logger.error('WebSocketAPI Error: Invalid message recieved', { err, data });
    }
  };


const enableAPI = () => {
  let portOpen = true;
  if (process.platform === 'win32') {
    const testResult = spawnSync(
      'netsh',
      ['advfirewall', 'firewall', 'show', 'rule', 'name=GPMDP\ PlaybackAPI'] // eslint-disable-line
    );
    portOpen = testResult.status === 0;
  }
  if (!portOpen) {
    Emitter.once('openport:confirm', () => {
      runas(
        'netsh',
        [
          'advfirewall', 'firewall', 'add', 'rule', 'name=GPMDP\ PlaybackAPI', // eslint-disable-line
          'dir=in', 'action=allow', 'protocol=TCP', 'localport=5672',
        ],
        {
          admin: true,
        });
    });
    Emitter.sendToWindowsOfName('main', 'openport:request');
  }
  server = new WebSocketServer({
    host: process['env'].GPMDP_API_HOST || '0.0.0.0', // eslint-disable-line
    port: global.API_PORT || process['env'].GPMDP_API_PORT || 5672, // eslint-disable-line
  }, () => {
    if (ad) {
      ad.stop();
      ad = null;
    }


    server.broadcast = (channel, data) => {
      server.clients.forEach((client) => {
        client.channel(channel, data);
      });
    };

    server.on('connection', (websocket) => {
      const ws = websocket;

      addWSPrototypes(ws);

      ws.on('message', handleWSMessage(ws));

      // Send initial PlaybackAPI Values
      sendInitialBurst(ws);
    });
  });

  server.on('error', () => {
    Emitter.sendToWindowsOfName('main', 'error', {
      title: 'Could not start Playback API',
      message: 'The playback API attempted (and failed) to start on port 5672.  Another application is probably using this port',  // eslint-disable-line
    });
    server = null;
  });
};

Emitter.on('playbackapi:toggle', (event, state) => {
  if (!state.state && server) {
    server.close();
    server = null;
  }
  if (state.state) {
    if (!server) {
      enableAPI();
    }
  } else if (ad) {
    ad.stop();
    ad = null;
  }
  Settings.set('playbackAPI', state.state);
});

app.on('will-quit', () => {
  if (server) {
    server.close();
    server = null;
  }
});

if (Settings.get('playbackAPI', false)) {
  enableAPI();
}
