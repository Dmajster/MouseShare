const electron = require('electron')
const { ipcMain, app, BrowserWindow } = require('electron');
const iohook = require('iohook');
const robot = require("robotjs");
const WebSocketServer = require('websocket').server;
const http = require('http');
const machineUuid = require("machine-uuid");


let win;
let screens;

function createWindow() {
    win = new BrowserWindow({ width: 1100, height: 600 });
    win.loadFile('index.html');

    win.webContents.on('did-finish-load', () => {
        screens = electron.screen.getAllDisplays();

        machineUuid().then(uuid => {
            screens = screens.map(screen => {
                return {
                    Id: uuid + screen.id,
                    X: screen.bounds.x,
                    Y: screen.bounds.y,
                    Width: screen.size.width,
                    Height: screen.size.height
                }
            });

            win.webContents.send('current_screens', screens);
        });
    })
}

app.on('ready', createWindow);


ipcMain.on('serverStart', function(event, arg) {
    console.log(arg);
    startServer(arg.port);
})

ipcMain.on('serverConnect', function(event, arg) {
    console.log(arg);
    startClient(arg.ip, arg.port);
})

function startServer(port) {
    console.log(`starting server on port ${port}`);

    const server = http.createServer(function(request, response) {
        console.log((new Date()) + ' Received request for ' + request.url);
        response.writeHead(404);
        response.end();
    });
    server.listen(port, function() {
        console.log((new Date()) + ` Server is listening on port ${port}`);
    });

    wsServer = new WebSocketServer({
        httpServer: server,
        // You should not use autoAcceptConnections for production
        // applications, as it defeats all standard cross-origin protection
        // facilities built into the protocol and the browser.  You should
        // *always* verify the connection's origin and decide whether or not
        // to accept it.
        autoAcceptConnections: false
    });

    function originIsAllowed(origin) {
        // put logic here to detect whether the specified origin is allowed.
        return true;
    }

    wsServer.on('request', function(request) {
        if (!originIsAllowed(request.origin)) {
            // Make sure we only accept requests from an allowed origin
            request.reject();
            console.log((new Date()) + ' Connection from origin ' + request.origin + ' rejected.');
            return;
        }

        var connection = request.accept('echo-protocol', request.origin);
        console.log((new Date()) + ' Connection accepted.');

        connection.on('message', function(message) {
            console.log(JSON.parse(message.utf8Data));
            message = JSON.parse(message.utf8Data);

            switch (message.type) {
                case "current_screens":
                    let newScreens = message.data;
                    win.webContents.send('new_screens', newScreens);
                    break;
            }
        });

        ipcMain.on('update_screens', function(event, screens) {
            connection.send(JSON.stringify({
                "type": "update_screens",
                "data": screens
            }))
        })

        connection.on('close', function(reasonCode, description) {
            console.log((new Date()) + ' Peer ' + connection.remoteAddress + ' disconnected.');
        });
    });


}

function startClient(ip, port) {
    console.log(`connecting to ws://${ip}:${port}/`);

    var WebSocketClient = require('websocket').client;

    var client = new WebSocketClient();

    client.on('connectFailed', function(error) {
        console.log('Connect Error: ' + error.toString());
    });

    client.on('connect', function(connection) {

        console.log('WebSocket Client Connected');
        connection.on('error', function(error) {
            console.log("Connection Error: " + error.toString());
        });
        connection.on('close', function() {
            console.log('Connection Closed');
        });
        connection.on('message', function(message) {
            console.log(JSON.parse(message.utf8Data));
            message = JSON.parse(message.utf8Data);

            if (message.type == "update_screens") {
                let screens = message.data;
                win.webContents.send('update_screens', screens);
            }
        });

        connection.send(JSON.stringify({
            "type": "current_screens",
            "data": screens
        }));
    });

    client.connect(`ws://${ip}:${port}/`, 'echo-protocol');
}