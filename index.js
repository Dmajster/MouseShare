const { app: electronApp, BrowserWindow } = require('electron');
const ioHook = require('iohook');
const robot = require("robotjs");
const WebSocketServer = require('websocket').server;
const http = require('http');
const ipc = require('electron').ipcMain;

var mouse = {
    position: {
        x:0,
        y:0
    },
    oldPosition: {
        x:0,
        y:0
    },
    delta:{
        x:0,
        y:0
    }
}

ipc.on('serverStart', function (event, arg) {
    console.log(arg);
    startServer(arg.port);
})

ipc.on('serverConnect', function (event, arg) {
    console.log(arg);
    startClient(arg.ip, arg.port);
})

ioHook.on('mousedrag', event => onMouseDrag(event));
ioHook.on('keydown', event => onKeyDown(event));
ioHook.on('mousemove', event => onMouseMove(event));
ioHook.start();

function createWindow () {    
    win = new BrowserWindow({ width: 800, height: 600 });
    win.loadFile('index.html');
}
electronApp.on('ready', createWindow);


const onMouseDrag = async (event) => {
    //console.log(event);c
}
const onMouseMove = async (event) => {
    mouse = {
        delta : {
            x: mouse.position.x - event.x,
            y: mouse.position.y - event.y
        },
        position : {
            x: event.x,
            y: event.y
        }
    };

    //console.log(mouse.delta);

    if(!locked){
        return;
    }

    let center = {
        x: robot.getScreenSize().width/2,
        y: robot.getScreenSize().height/2
    } ;

    let boundary = 200;

    if( Math.abs(mouse.position.x - center.x) > boundary || Math.abs(mouse.position.y - center.y) > boundary ){
        robot.moveMouse(center.x, center.y );
    }
}



var locked = false;


const onKeyDown = async (event) => {}


function startServer(port){
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

        });
        connection.on('close', function(reasonCode, description) {
            console.log((new Date()) + ' Peer ' + connection.remoteAddress + ' disconnected.');
        });

        setInterval( () => {
            console.log("mouse", mouse);
            connection.send(JSON.stringify(mouse));
        }, 1000/60);
    });
    

}

function startClient(ip, port){
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
            let mouse = JSON.parse(message.utf8Data);
            robot.moveMouse(mouse.position.x,mouse.position.y);
        });
    });
     
    client.connect(`ws://${ip}:${port}/`, 'echo-protocol');
}
