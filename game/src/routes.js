module.exports = function(logger, app, $gameServer) {
  app.use(require('express').static('public'));
  app.use(require('cookie-parser')());

  app.set('views', './views');
  app.set('view engine', 'jade');

  function finish(res, to) {
    res.redirect(to);
    res.end();
    return false;
  } function pre(req, res) {
    if(req.cookies.uid === undefined)
      return finish(res, '/login');
    var uid = req.cookies.uid;
    if($gameServer.User.find(uid) < 0)
      return finish(res, '/login');
    return true;
  }

  app.get('/', function(req, res) {
    if(!pre(req, res)) return;
    res.redirect('/rooms');
    res.end();
  });

  app.get('/login', function(req, res) {
    res.render('login.jade');
  });

  app.get('/rooms', function(req, res) {
    if(!pre(req, res)) return;
    res.render('rooms.jade');
  });

  app.get('/play', function(req, res) {
    if(!pre(req, res)) return;
    res.render('play.jade', {
      gid : 'null',
      nick: $gameServer.User.find(req.cookies.uid).nick
    });
  });

  app.get('/play-:gid', function(req, res) {
    if(!pre(req, res)) return;
    res.render('play.jade', {
      gid : req.params.gid,
      nick: $gameServer.User.find(req.cookies.uid).nick
    });
  });

  app.use(function(req, res) {
    res.status(404).send('not found');
  });

  return {};
};
