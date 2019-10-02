module.exports = function(logger, io) {
  const $game = require('./game.js');
  const htmlEncode = require('htmlencode').htmlEncode;

  function User() {
    this.uid    = null;
    this.nick   = null;
    this.gid    = null;
  } User.prototype.game = function() {
    if(this.gid === null) return null;
    return games[this.gid];
  }; User.prototype.room = function() {
    if(this.gid === null) return null;
    return 'room-' + this.gid;
  }; User.prototype.validate = function(strict_ingame) {
    if(this.uid === null) return false;
    if(strict_ingame && !this.game())
      return false;
    return true;
  };
  User.list = [];
  User.find = function(uid) {
    let ret = -1;
    User.list.some((user, i) => {
      if(user.uid === uid) {
        ret = i;
        return true;
      } else return false;
    }); return ret;
  }; User.newUid = function() {
    let ret = null;
    while(!ret || User.find(ret) > -1)
      ret = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
        return v.toString(16);
      });
    return ret;
  };

  function toRoom(gid) {
    return 'room-' + gid;
  } function err(to, err) {
    to.emit('err', err);
  } function msg(to, from, msg) {
    to.emit('message', '<b>' + from + '</b>: ' + msg);
  } function redirect(who, to) {
    if(!to) to = '/rooms';
    who.emit('redirect', to);
  } function updateGames(to) {
    const ret = [];
    games.forEach((game, gid) => {
      if(!game.started)
        ret.push({'id':gid, 'players':game.getPlayers()});
    }); to.emit('updateGames', ret);
  } function updatePlayers(gid) {
    io.to(toRoom(gid)).emit('updatePlayers', games[gid].getPlayers());
    updateGames(io);
  }

  const games = [];
  function start() {
    io.on('connection', function(s) {
      s.u = new User();
      s.on('init', function(uid, nick) {
        const i = User.find(uid);
        if(i > -1) {
          //load saved user data
          s.u = User.list[i];
          logger.info('user_connection', {user: s.u.uid});
        } else {
          //create new user
          if(!nick) return;
          if(nick.length < 4 || nick.length > 15)
            return err(s, 'Nickname too short/long');
          s.u.uid   = User.newUid();
          s.u.nick  = nick;
          User.list.push(s.u);
          logger.info('user_creation', {user: s.u});
        }
        s.emit('uid', s.u.uid);
        console.log('user ' + s.u.uid + ' connected');
      });
      s.on('getGames', () => updateGames(s) );
      s.on('message', function(mess) {
        if(!s.u.validate(true)) return;
        if(!mess) return;
        if(mess.length > 256) return err(s, 'Message too long');
        msg(io.to(s.u.room()), htmlEncode(s.u.nick), htmlEncode(mess));
      });
      s.on('create', function() {
        if(!s.u.validate()) return;
        if(s.u.validate(true)) return redirect(s, '/rooms');
        const game = new $game.Game(new $game.Player(s.u.uid, s.u.nick));
        games.push(game);
        s.u.gid = games.indexOf(game);
        s.join(s.u.room());

        logger.info('game_creation', {user: s.u.uid, game: s.u.gid});
        console.log('user ' + s.u.uid + ' created game ' + s.u.gid);
        updatePlayers(s.u.gid);

        s.emit('gid', s.u.gid);
        msg(s, 'Server', "You are the creator. Press space to start the game.")
        msg(s, 'Server', "note: game needs at least 4 players - bots will be added to fill up space if needed");
      });
      s.on('join', function(gid) {
        if(!s.u.validate()) return;
        logger.info('game_connection', {user: s.u.uid, game: s.u.gid});
        console.log('player ' + s.u.uid + ' joining room ' + gid);
        const game = games[gid],
            room = toRoom(gid);
        if(game === undefined) return redirect(s, '/rooms');

        if(!game.started) {
          if(game.getPlayer(s.u.uid) !== null) return redirect(s, '/rooms');
          if(s.u.validate(true)) return redirect(s, '/play-' + s.u.gid);
          s.u.gid = gid;
          s.join(room);
          game.addPlayer(new $game.Player(s.u.uid, s.u.nick));
          updatePlayers(gid);
          return;
        }

        const p = game.getPlayer(s.u.uid);

        if(p !== null) {
          s.u.gid = gid;
          s.join(room);
          p.present = true;
          s.emit('updateReady');
          s.emit('updatePlayers', game.getPlayers());
        } else {
          //add player to spectate mode?
          if(s.u.validate(true)) return redirect(s, '/rooms');
          s.u.gid = gid;
          s.join(room);
          s.emit('updateReady');
          s.emit('updatePlayers', game.getPlayers());
        }
      });
      s.on('play', function(cards) {
        if(!s.u.validate(true)) return;
        cards = $game.Card.fromIntDeck(cards);

        if(!s.u.game().ready) {
          if(s.u.uid != s.u.game().creator.id)
            return err(s, 'Unauthorized player');
          else if(s.u.game().players.length < 4) {
            let i = 1;
            while(s.u.game().players.length < 4)
              s.u.game().addPlayer(new $game.Player(-1, 'bot' + i++));
            updatePlayers(s.u.gid);
            //return err(s, 'Not enough players, adding bots..');
          }
          s.u.game().init();
          io.emit('updateReady');
          while(s.u.game().getPlayer().id < 0)
            s.u.game().play();
          io.emit('updateReady');
          if(s.u.game().giveAway !== false)
            msg(io.to(s.u.room()), 'Server', "Card giveaway time! Choose the cards you want to swap");
          else
            msg(io.to(s.u.room()), 'Server', "Click on cards to select, space to play them");
        } else {
          if(s.u.uid != s.u.game().getPlayer().id)
            return err(s, 'Unauthorized player');
          else if(!s.u.game().play(cards))
            return err(s, 'Unauthorized cards');
          io.emit('updateReady');
          while(s.u.game().getPlayer().id < 0 && s.u.game().ready)
            s.u.game().play(); //what happens if this returns false?
          io.emit('updateReady');
          if(s.u.game().won.reduce(count => ++count, 0))
            msg(io.to(s.u.game().creator), 'Server', "Game ended. Press space to start next game");
        }
      });
      s.on('update', function() {
        if(!s.u.validate(true)) return;
        if(!s.u.game().started) return;
        s.emit('update', s.u.game().state(s.u.uid));
      });
      s.on('disconnect', function() {
        if(!s.u.validate(true)) return;
        logger.info('game_disconnection', {user: s.u.uid, game: s.u.gid});
        console.log('user ' + s.u.uid + ' disconnected from game ' + s.u.gid);
        let delGame  = false;
        let resetGid = false;
        if(!s.u.game().started) {
          //Game didn't start: really leave it
          if(s.u.game().creator.id == s.u.uid)
            delGame = true;
          s.u.game().popPlayer(s.u.uid);
          if(!s.u.game().players.length)
            delGame = true;
          if(!delGame) updatePlayers(s.u.gid);
          resetGid = true;
        } else {
          //Game already started: temporary afk
          const player = s.u.game().getPlayer(s.u.uid);
          if(player) {
            //User was playing
            player.present = false;
            if(!s.u.game().getPlayers(true).length)
              delGame = true;
          } else //User was spectating
            resetGid = true;
        }
        if(delGame) {
          logger.info('game_deletion', {game: s.u.gid});
          console.log('delete game ' + s.u.gid);
          delete(games[s.u.gid]);
          updateGames(io);
        }
        if(resetGid) s.u.gid = null;
      });
    });
  };

  return {
    User  : User,
    start : start
  }
};
