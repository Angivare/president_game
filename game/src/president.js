var app         = require('express')(),
    http        = require('http').Server(app),
    io          = require('socket.io')(http),
    $logger     = require('./logger.js')(),
    $gameServer = require('./game-server.js')($logger, io),
    $routes     = require('./routes.js')($logger, app, $gameServer);

$gameServer.start();

const port = 3000;

http.listen(port, function() {
  console.log('http server listening on port ' + port);
});

io.listen(http);
