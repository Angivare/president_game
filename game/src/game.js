(function(exports) {
  function Card(rank, suit) {
    this.rank = rank;
    this.suit = suit;
  } Card.prototype.toInt = function() {
    return 1 + 4 * this.rank + this.suit;
  }; Card.prototype.toStr = function() {
    return '&' + Card.suits[this.suit] + ';' + Card.ranks[this.rank];
  }; Card.prototype.text = function() {
    return Card.ranks[this.rank] + ' of ' + Card.suits[this.suit];
  }; Card.prototype.toHtml = function() {
    return '<div class="card ' + Card.suits[this.suit] + '" data-card="' + this.toInt() + '" style="'
          + 'background-position: ' + (100*this.rank/12) + '% ' + (100*this.suit/3) + '%">'
          + Card.ranks[this.rank] + '<br>&' + Card.suits[this.suit] + ';</div>';
  }; Card.prototype.in = function(deck) {
    return deck.some(card => card.toInt() == this.toInt(), this);
  }; Card.fromInt = function(i) {
    i--;
    return new Card(Math.floor(i/4), i%4);
  }; Card.fromIntDeck = function(deck) {
    const ret = [];
    deck.forEach(card => {
      ret.push(Card.fromInt(card));
    }); return ret;
  }; Card.newDeck = function(shuffle) {
    const deck = [];
    for(let r = 0; r < Card.ranks.length; r++)
      for(let s = 0; s < Card.suits.length; s++)
        deck.push(new Card(r, s));

    if(shuffle)
      for(let i = deck.length-1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i+1));
        const tmp = deck[i];
        deck[i] = deck[j];
        deck[j] = tmp;
      }

    return deck;
  }; Card.comp = function(a, b) {
    const _a = a.toInt(), _b = b.toInt();
    if(_a == _b) return 0;
    return (_a < _b) ? -1 : 1;
  }; Card.deckSize = function() {
    return Card.ranks.length * Card.suits.length;
  }; Card.two = function() {
    return Card.ranks.length - 1;
  }; Card.ranks = [
    '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'
  ]; Card.suits = [
    'clubs', 'diams', 'spades', 'hearts'
  ];

  function Player(uid, nick) {
    this.id       = uid;
    this.nick     = nick;
    this.cards    = [];
    this.present  = true;
  } Player.prototype.addCard = function(card) {
    this.cards.push(card);
  }; Player.prototype.popCard = function(card) {
    this.cards.every((c, i) => {
      if(c.toInt() == card.toInt()) {
        this.cards.splice(i, 1); return false;
      } else return true;
    }, this);
  }; Player.prototype.hasCard = function(card) {
    return this.cards.some(c => c.toInt() == card.toInt());
  };

  function Game(creator) {
    this.creator  = creator;
    this.players  = [ creator ];
    this.ready    = false;
    this.started  = false;

    this.specials = [ -1, -1, -1, -1 ];
    this.giveAway = false;
  }

  Game.prototype.addPlayer = function(player) {
    this.players.push(player);
  };

  Game.prototype.popPlayer = function(uid) {
    this.players.every((p, i) => {
      if(p.id == uid) {
        this.players.splice(i, 1); return false;
      } else return true;
    }, this);
  }

  Game.prototype.init = function() {
    this.ready    = true;
    this.started  = true;
    this.deck     = Card.newDeck(true);
    this.table    = [[]];
    this.folded   = [];
    this.won      = [];
    this.skipped  = [];

    //Deal cards
    for(let i = 0; i < Math.floor(Card.deckSize()/this.players.length); i++)
      for(let j = 0; j < this.players.length; j++)
        this.players[j].addCard(this.deck.shift());

    this.players.forEach(player => {
      player.cards.sort(Card.comp);
    });

    //Set first player
    if(this.specials[3] != -1)
      this.curr_player = this.specials[3];
    else this.players.forEach((player, index) => {
      if((new Card(9, 2)).in(player.cards))
        this.curr_player = index;
    }, this);

    this.last_played = this.curr_player;
  };

  Game.prototype._playerHasCards = function(cards) {
    return cards.every(card => this.getPlayer().hasCard(card), this);
  };

  Game.prototype._arePlayable = function(cards) {
    //check group count
    if( this.getGroupCount()  != 0 &&
        cards.length          != 0 &&
        this.getGroupCount()  != cards.length)
      return false;
      //check if group is valid
      if(cards.length > 1)
        if(!cards.every(function(card) {
          return card.rank == cards[0].rank;
        })) return false;
    if(cards.length)
      if(cards[0].rank < this.getHighestRank())
        return false;
    return true;
  };

  Game.prototype.play = function(cards) {
    if(cards === undefined)
      return this._autoPlay();
    if(!this._playerHasCards(cards))
      return false;
    if(this.giveAway === false)
      return this._playCards(cards);
    else
      return this._giveCards(cards);
  };

  Game.prototype._autoPlay = function() {
    const cards = this.getPlayer().cards;

    let batch_sz = 1;

    //must give away 2 cards
    if(this.giveAway !== false && [0, 3].includes(this.specials.indexOf(this.curr_player)))
      batch_sz = 2;

    //people played doubles/triples
    const group_count = this.getGroupCount();
    if(this.giveAway === false && group_count != 0)
      batch_sz = group_count;

    for(let i = 0; i <= cards.length - batch_sz; i++) {
      const to_play = [... Array(batch_sz).keys()].map(j => cards[i+j]);
      if(this.giveAway !== false || this._arePlayable(to_play))
        if(this.play(to_play))
          return true;
    }
    return this.play([]);
  };

  Game.prototype._giveCards = function(cards) {
    const player  = this.curr_player,
          hand    = this.getPlayer().cards,
          k       = this.specials.indexOf(player),
          giveto  = this.specials[3-k];
    if(k < 0) {
      this._nextPlayer(); return true;
    }

    const n = k == 0 || k == 3 ? 2 : 1;
    if(cards.length != n) return false;
    //check if best cards were given
    if(k > 1 && !cards.every((card, i) => {
      for(let k = hand.length-n; k < hand.length; k++)
        if(hand[k].rank == card.rank) return true;
      return false;
    })) return false;

    cards.forEach(card => {
      this.getPlayer().popCard(card);
      this.players[giveto].addCard(card);
    }, this);
    this.players[giveto].cards.sort(Card.comp);

    this.giveAway++;
    if(this.giveAway >= 4) {
      this.giveAway = false;
      this.curr_player = this.specials[3];
    } else this._nextPlayer();
    return true;
  };

  Game.prototype._playCards = function(cards) {
    if(!this.getPlayer().cards.length) {
      this._nextPlayer(); return true;
    }
    if(!this._arePlayable(cards)) return false;

    if( this.getLastPlayed()        != 0 &&
        this.getLastPlayed(2, true) != 0 &&
        this.getLastPlayed()[0].rank == this.getLastPlayed(2, true)[0].rank ) {
      if(cards.length) {
        if(cards[0].rank != this.getLastPlayed()[0].rank)
          return false;
      } else if(this.skipped.indexOf(this.curr_player) < 0) {
        this.table[0].push([]);
        this.skipped.push(this.curr_player);
        this._nextPlayer();
        return true;
      } else {
        this.table[0].push([]);
        this.folded.push(this.curr_player);
        this._nextPlayer();
        return true;
      }
    } else this.skipped = [];

    if(cards.length) this.last_played = this.curr_player
    else this.folded.push(this.curr_player);

    this.table[0].push(cards);
    cards.forEach(card => {
      this.getPlayer().popCard(card);
    }, this);

    let close = false;

    if(!this.getPlayer().cards.length) {
      if(cards[0].rank == Card.two()) {
        let n = this.players.length-1;
        while(this.won[n] !== undefined) n--;
        this.won[n] = this.curr_player;
      } else {
        let n = 0;
        while(this.won[n] !== undefined) n++;
        this.won[n] = this.curr_player;
      }
    }

    const wonCount = this.won.reduce(count => ++count, 0);

    if(wonCount == this.players.length)
      return this._finish();

    if(wonCount + this.folded.length == this.players.length)
      close = true;

    if(cards.length && cards[0].rank == Card.two())
      close = true;

    const ranks = [];
    this.table[0].forEach(cards => {
      cards.forEach(card => {
        if(ranks[card.rank] === undefined)
          ranks[card.rank] = 1;
        else ranks[card.rank]++;
      });
    });
    if(ranks.some(rank => rank == 4))
      close = true;

    if(close) {
      this._clearTable();
      this.curr_player = this.last_played;
      if(!this.getPlayer().cards.length)
        this._nextPlayer();
    } else this._nextPlayer();

    return true;
  };

  Game.prototype.getPlayer = function(i) {
    if(i === undefined) return this.players[this.curr_player];
    let ret = null;
    this.players.forEach(player => {
      if(player.id == i) ret = player;
    }); return ret;
  };

  Game.prototype.getLastPlayed = function(n, ignore_empty) {
    if(!n) n = 1;
    if(ignore_empty)
      for(let i = 1; i <= n; i++)
        if( this.table[0][this.table[0].length-i] !== undefined
        &&  !this.table[0][this.table[0].length-i].length)
        n++;
    if(this.table[0].length < n) return [];
    return this.table[0][this.table[0].length-n];
  };

  Game.prototype.getHighestRank = function() {
    let ret = -1;
    this.table[0].forEach(cards => {
      if(cards.length) ret = Math.max(cards[0].rank, ret);
    }); return ret;
  };

  Game.prototype.getGroupCount = function() {
    let ret = 0;
    this.table[0].some(cards => {
      if(cards.length) ret = cards.length;
      return cards.length;
    }); return ret;
  };

  Game.prototype.getPlayableRanks = function() {
    if( this.getLastPlayed()        != 0 &&
        this.getLastPlayed(2, true) != 0 &&
        this.getLastPlayed()[0].rank == this.getLastPlayed(2, true)[0].rank )
      return [ this.getLastPlayed()[0].rank ];
    let min = this.getHighestRank();
    const ret = [];
    if(min < 0) min = 0;
    for(let i = min; i < Card.ranks.length; i++)
      ret.push(i);
    return ret;
  };

  Game.prototype.hint = function(i) {
    if(i === undefined) i = this.curr_player;
    if(this.giveAway === false) {
      return null;
    } else {
      const n = this.specials.indexOf(i);
      if(n < 0)
        return "You are neutral so you don't have to give any cards. Just skip.";
      else if(n == 0)
        return "Give any two cards to the scum";
      else if(n == 1)
        return "Give any card to the vice-scum";
      else if(n == 2)
        return "Give your best card to the vice-president";
      else if(n == 3)
        return "Give your two best cards to the president";
    }
  };

  Game.prototype._nextPlayer = function() {
    this.curr_player++;
    if(this.curr_player >= this.players.length)
      this.curr_player = 0;

    if( this.folded.indexOf(this.curr_player) > -1 ||
        this.won.indexOf(this.curr_player)    > -1)
      this._nextPlayer();
  };

  Game.prototype._clearTable = function() {
    this.table.unshift([]);
    this.folded = [];
  };

  Game.prototype._finish = function() {
    this.specials[0] = this.won[0];
    this.specials[1] = this.won[1];
    this.specials[2] = this.won[this.won.length-2];
    this.specials[3] = this.won[this.won.length-1];

    this.giveAway = 0;
    this.ready    = false;
    this._clearTable();

    return true;
  };

  Game.prototype.getPlayers = function(strict_present) {
    const ret = [];
    this.players.forEach((player, i) => {
      if(strict_present && (!player.present || player.id < 0))
        return;
      ret.push({'id':i,'nick':player.nick});
    }); return ret;
  }

  Game.prototype.state = function(player) {
    const cards = [];
    this.players.forEach((p, i) => {
      cards.push(p.cards.length);
    });
    const p = this.getPlayer(player);
    return {
      'hand'    : p ? p.cards : [],
      'playable': this.getPlayableRanks(),
      'table'   : this.table,
      'cards'   : cards,
      'player'  : this.curr_player,
      'won'     : this.won,
      'folded'  : this.folded,
      'specials': this.specials
    }
  }

  Game.prototype.toGlobal = function(array) {
    const ret = [];
    array.forEach((id, i) => {
      if(id == -1) ret.push(-1);
      else ret.push(this.players[id].id);
    }, this); return ret;
  };

  exports.Card    = Card;
  exports.Player  = Player;
  exports.Game    = Game;
})(module.exports);
