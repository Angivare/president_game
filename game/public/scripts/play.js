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
}; Card.fromInt = function(i) {
  i--;
  return new Card(Math.floor(i/4), i%4);
}; Card.ranks = [
  '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'
]; Card.suits = [
  'clubs', 'diams', 'spades', 'hearts'
];

function toggleClass(el, className, show) {
  if(show)  $(el).addClass(className);
  else      $(el).removeClass(className);
}

function addMessage(msg) {
  var el = $('<div class="message">');
  el.html(msg);
  $('#messages').append(el);
  $('#messages').scrollTop($('#messages')[0].scrollHeight);
}

var prev_hand = null;

function updatePlayers(players) {
  console.log(players);
  $('#players').html('');
  players.forEach(function(player) {
    var el = $('<tr class="player" data-id="' + player.id +'">');
    el.append($('<td class="curr-score">'));
    el.append($('<td class="nick">' + player.nick + '</td>'));
    el.append($('<td class="left-cards">'));
    el.append($('<td class="prev-score">'));
    $('#players').append(el);
  });
}

function updateState(data) {
  console.log(data);
  $finished = data.finished;
  $curr_player = data.player;

  if(!prev_hand || JSON.stringify(data.hand) !== JSON.stringify(prev_hand)) {
    $('#player-hand').html('');
    $.each(data.hand, function() {
      var c = new Card(this.rank, this.suit)
      $('#player-hand').append(c.toHtml());
    });
  }
  prev_hand = data.hand;

  $('#player-hand .card').each(function() {
    var c = Card.fromInt($(this).attr('data-card'));
    toggleClass(this, 'playable', data.playable.indexOf(c.rank) > -1);
  });

  $('#table').html('');
  $.each(data.table, function() {
    var group = $('<div class="card-group">');
    $.each(this, function() {
      var subGroup = $('<div class="card-sub-group">');
      $.each(this, function() {
        var c = new Card(this.rank, this.suit);
        subGroup.append(c.toHtml());
      });
      if(!subGroup.children().length)
        subGroup.addClass('empty');
      group.append(subGroup);
    });
    $('#table').prepend(group);

    $('#table').scrollTop($('#table')[0].scrollHeight);
  });

  $('#players .player').each(function() {
    var id = $(this).attr('data-id');
    toggleClass(this, 'current', id == $curr_player);
    toggleClass($(this).find('.curr-score')[0], 'fa fa-caret-right', id == $curr_player);
    toggleClass(this, 'folded', data.folded.indexOf(+id) > -1);

    $(this).find('.curr-score').html('');
    $(this).find('.left-cards').html('');
    $(this).find('.prev-score').removeClass('special-0 special-1 special-2 special-3')
  });
  $.each(data.won, function(i, e) {
    $('#players .player[data-id="' + e + '"]')
      .find('.curr-score').html('#' + (+i+1) + ' ');
  });
  $.each(data.cards, function(i, e) {
    $('#players .player[data-id="' + i + '"]')
      .find('.left-cards').html(e);
  });
  $.each(data.specials, function(i, e) {
    $('#players .player[data-id="' + e +'"]')
      .find('.prev-score').addClass('special-' + i);
  });
}

function play() {
  var cards = [];
  $('.card.checked').each(function() {
    cards.push(+$(this).attr('data-card'));
  });
  $s.emit('play', cards);
}

$s.on('gid', function(gid) {
  window.history.replaceState({}, '', '/play-' + gid);
});
$s.on('updateReady', function() {
  $s.emit('update');
});
$s.on('redirect', function(to) {
  location.href = to;
});

$(function() {
  $uidCallback = function(uid) {
    console.log('uid: ' + uid);
    if($gid === null)
      $s.emit('create');
    else
      $s.emit('join', $gid);
  };
  $s.on('updatePlayers', updatePlayers);
  $s.on('update', updateState);
  $s.on('err', function(err) {
    addMessage(err);
  });
  $s.on('message', function(msg) {
    addMessage(msg);
  });

  $(window).on('resize', function() {
    $('#table').scrollTop($('#table')[0].scrollHeight);
  });

  $('#chat input').keyup(function(ev) {
    var code = ev.keyCode || ev.which;
    if(code == 13) {
      $s.emit('message', $('#chat input').val());
      $('#chat input').val('');
    }
  });

  $(document).on('click', '#player-hand .card', function() {
    if($(this).hasClass('checked'))
      $(this).removeClass('checked');
    else
      $(this).addClass('checked');
  });

  $(document).keydown(function(ev) {
    var code = ev.keyCode || ev.which;
    if(code == 32 && !$(ev.target).is('.no-space-event, .no-space-event *'))
      return false;
  });

  $(document).keyup(function(ev) {
    var code = ev.keyCode || ev.which;
    if(code == 32 && !$(ev.target).is('.no-space-event, .no-space-event *'))
      play();
  });
});
