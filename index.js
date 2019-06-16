const electron = require('electron')
const { ipcMain, app, BrowserWindow } = require('electron');
const iohook = require('iohook');
const robot = require("robotjs");
const WebSocketServer = require('websocket').server;
const http = require('http');
const machineUuid = require("machine-uuid");


let win;
let screens = [];



function createWindow() {
    win = new BrowserWindow({ width: 1100, height: 600 });
    win.loadFile('index.html');

    win.webContents.on('did-finish-load', () => {
        screens = electron.screen.getAllDisplays();

        machineUuid().then(uuid => {
            screens = screens.map(screen => {
                console.log(screen);
                return {
                    Id: uuid + screen.id,
                    X: screen.bounds.x,
                    Y: screen.bounds.y,
                    Width: screen.size.width * screen.scaleFactor,
                    Height: screen.size.height * screen.scaleFactor
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

ipcMain.on('update_screens', function(event, updatedScreens) {
    console.log("update screens")
    screens = updatedScreens;
})


let connections = {};

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

    wsServer.getUniqueID = function() {
        function s4() {
            return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
        }
        return s4() + s4() + '-' + s4();
    };


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

        connection.id = wsServer.getUniqueID();
        connections[connection.id] = connection;

        connection.on('message', function(message) {
            console.log(connection.id, message);
            //console.log(JSON.parse(message.utf8Data));
            message = JSON.parse(message.utf8Data);

            switch (message.type) {
                case "current_screens":
                    let newScreens = message.data;
                    newScreens = newScreens.map(newScreen => {
                        newScreen.connectionId = connection.id;
                        return newScreen;
                    });
                    console.log(newScreens);
                    win.webContents.send('new_screens', newScreens);
                    break;
            }
        });

        ipcMain.on('update_screens', function(event, updatedScreens) {
            connection.send(JSON.stringify({
                "type": "update_screens",
                "data": updatedScreens
            }))
            screens = updatedScreens;

            allowMouseHooks = true;

            console.log("screen update", screens);
        })

        connection.on('close', function(reasonCode, description) {
            console.log((new Date()) + ' Peer ' + connection.remoteAddress + ' disconnected.');
        });
    });
}

let clientId;

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

            if (message.type == "auth") {
                clientId = message.data;
            } else if (message.type == "update_screens") {
                let screens = message.data;
                win.webContents.send('update_screens', screens);
            } else if (message.type == "mouse_update") {
                let mouse = message.data;

                robot.moveMouse(
                    mouse.x,
                    mouse.y
                );
            } else if (message.type == "mouse_click") {
                let mouse = message.data;

                robot.mouseClick();
            } else if (message.type == "mouse_wheel") {
                let mouse = message.data;

                robot.scrollMouse(0, mouse.amount * mouse.rotation * 10);
            }
        });

        connection.send(JSON.stringify({
            "type": "current_screens",
            "clientId": clientId,
            "data": screens
        }));
    });

    client.connect(`ws://${ip}:${port}/`, 'echo-protocol');
}

let findCurrentScreen = (mouse) => {
    return screens.find(screen => {
        return screen.X < mouse.x && mouse.x < (screen.X + screen.Width) &&
            screen.Y < mouse.y && mouse.y < (screen.Y + screen.Height);
    }) || null;
}

let mouseOnDomesticScreen = true;
let mouseEmulated = null;
let mouseEmulatedLast = null;
let mouseLast = null;
let lastEmulatedScreen = null;
let currentScreen = null;
let allowMouseHooks = false;

iohook.on('mouseclick', event => {
    if (currentScreen == null || currentScreen.ConnectionId == null) {
        return;
    }
    connections[currentScreen.ConnectionId].send(JSON.stringify({
        "type": "mouse_click",
        "data": event
    }));
});

iohook.on('mousewheel', event => {
    if (currentScreen == null || currentScreen.ConnectionId == null) {
        return;
    }
    connections[currentScreen.ConnectionId].send(JSON.stringify({
        "type": "mouse_wheel",
        "data": event
    }));
});

iohook.on('mousemove', event => {
    if (!allowMouseHooks) {
        return;
    }

    if (mouseEmulated == null) {
        mouseEmulated = { x: event.x, y: event.y }
        mouseLast = { x: event.x, y: event.y }
    }

    if (currentScreen == null) {
        currentScreen = findCurrentScreen(event);
    }

    if (currentScreen == null) {
        return;
    }

    if (mouseOnDomesticScreen) {

        if (isNaN(mouseEmulated.x) || isNaN(mouseEmulated.y)) {
            mouseEmulated = { x: event.x, y: event.y }
        }

        let mouseCorrected = {
            x: event.x - currentScreen.RealX,
            y: event.y - currentScreen.RealY
        }

        mouseEmulated = {
            x: mouseCorrected.x + currentScreen.X,
            y: mouseCorrected.y + currentScreen.Y
        }

        console.log("domestic", [mouseEmulated, event, currentScreen])
    } else {
        let centerX = currentScreen.RealX + currentScreen.Width / 2;
        let centerY = currentScreen.RealY + currentScreen.Height / 2;
        let bounds = 200;

        let mouseDelta = { x: event.x - mouseLast.x, y: event.y - mouseLast.y }
        mouseLast = { x: event.x, y: event.y }

        if (Math.abs(event.x - centerX) > bounds || Math.abs(event.y - centerY) > bounds) {
            robot.moveMouse(centerX, centerY);
            mouseLast = { x: centerX, y: centerY }
        }

        mouseEmulated.x += mouseDelta.x;
        mouseEmulated.y += mouseDelta.y;

        console.log("foreign", mouseEmulated)
    }

    let viableScreens = screens.filter(screen => {
        return screen.X < mouseEmulated.x && mouseEmulated.x < (screen.X + screen.Width) &&
            screen.Y < mouseEmulated.y && mouseEmulated.y < (screen.Y + screen.Height);
    }) || [];

    //console.log(viableScreens);

    if (viableScreens.length > 0 && viableScreens[0] != lastEmulatedScreen) {
        let mouseReal = {
            x: viableScreens[0].RealX + (mouseEmulated.x - viableScreens[0].X),
            y: viableScreens[0].RealY + (mouseEmulated.y - viableScreens[0].Y)
        }
        console.log("hop");

        lastEmulatedScreen = viableScreens[0]
        currentScreen = viableScreens[0];
        mouseOnDomesticScreen = currentScreen.ConnectionId == null;

        if (mouseOnDomesticScreen) {
            robot.moveMouse(mouseReal.x, mouseReal.y);
        } else {
            connections[currentScreen.ConnectionId].send(JSON.stringify({
                "type": "mouse_update",
                "data": mouseReal
            }));
        }

        console.log(mouseOnDomesticScreen)
    }
});

setInterval(() => {
    if (currentScreen == null || currentScreen.ConnectionId == null) {
        return;
    }

    if (mouseEmulatedLast != null && mouseEmulatedLast.x == mouseEmulated.x && mouseEmulatedLast.y == mouseEmulated.y) {
        return;
    }

    if (!mouseOnDomesticScreen) {
        let mouseReal = {
            x: currentScreen.RealX + (mouseEmulated.x - currentScreen.X),
            y: currentScreen.RealY + (mouseEmulated.y - currentScreen.Y)
        }

        mouseEmulatedLast = {
            x: mouseEmulated.x,
            y: mouseEmulated.y
        }

        connections[currentScreen.ConnectionId].send(JSON.stringify({
            "type": "mouse_update",
            "data": mouseReal
        }));
    }

}, 1000 / 60)


iohook.start(false)