var express = require('express');
var http = require('http');
var path = require('path');
var socketIO = require('socket.io');

var app = express();
var server = http.Server(app);
var io = socketIO(server);
var port = 1701;

app.set('port', port);
app.use('/static', express.static(__dirname + '/static'));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});


var game = {
	phase: 'lobby',
	sockets: {},
	players: {},
	player_order: [],
};

var lobby = {
	sockets: {},
	taken_colours: new Set(),
	player_to_colour: {}	
}

function Player(name, colour_id) {
	this.name = name;
	this.colour_id = colour_id;
	this.mouseX = 0.5;
	this.mouseY = 0.5;
}


io.on('connection', (socket) => {
    var player_name = null;

	socket.on('disconnect', () => {
	    if (player_name === null) return;
	    console.log(player_name + " disconnected");
	    if (game.phase == 'lobby') {
	    	delete lobby.sockets[player_name];
	    	if (player_name in lobby.player_to_colour) {
				lobby.taken_colours.delete(lobby.player_to_colour[player_name]);
				delete lobby.player_to_colour[player_name];
	    	}
	    	broadcast_lobby_state();
	    } else {
	    	game.sockets[player_name] = null;
	    }
	});

	socket.on('join', (new_name) => {
	  	if (game.phase == 'lobby') {
		  	if (new_name in lobby.sockets) {
			    console.log(new_name + ' tried to join but someone already has that name');
			    socket.emit('join_fail', 'The name "'+new_name+'" is already taken');
			    return;
			} else {	
				player_name = new_name;
				lobby.sockets[player_name] = socket;

				console.log(player_name + ' joined the lobby');
				socket.emit('join_lobby', player_name);
				broadcast_lobby_state();
			}
		} else {
			if (!(new_name in game.sockets)) {
			    socket.emit('join_fail', 'Nobody by that name is part of the game');
			    return;
			}
			if (game.sockets[new_name] != null) {
			    socket.emit('join_fail', 'Someone is already connected with that name');
			    return;
			}
			player_name = new_name;
			game.sockets[player_name] = socket;
			console.log(player_name + ' rejoined the game');
			socket.emit('rejoin_success', player_name);
		}
	});

	socket.on('choose_colour', (colour) => {
		if (game.phase != 'lobby' || player_name == null) 
			return;
		if (lobby.taken_colours.has(colour))
			return;
		if (player_name in lobby.player_to_colour)
			lobby.taken_colours.delete(lobby.player_to_colour[player_name])
		lobby.player_to_colour[player_name] = colour;
		lobby.taken_colours.add(colour);
		broadcast_lobby_state();
		socket.emit('do_animation', {
			type : 'character_selected', 
			character_index: colour
		});
	});

	socket.on('start', (map_name) => {
		if (game.phase != 'lobby' || player_name == null) 
			return;
		var num_connections = Object.keys(lobby.sockets).length;
		if (num_connections != lobby.taken_colours.size) {
			console.log('Can\'t start the game, not all players have a colour')
			return;
		}
		start_new_game(map_name);
	});

	socket.on('mouse_update', (args) => {
		if (args.name != player_name) return;
		var player = game.players[player_name];
		player.mouseX = args.mouseX;
		player.mouseY = args.mouseY;
	});
});


server.listen(port, () => {console.log('listening on port ' + port.toString());});


function broadcast_lobby_state() {
	var lobby_state = {
		players: [],
		colour_to_player: {}
	};
	for (var name_ in lobby.sockets) {
		lobby_state.players.push(name_);
		if (name_ in lobby.player_to_colour)
 			lobby_state.colour_to_player[lobby.player_to_colour[name_]] = name_;
	}

	io.sockets.emit('lobby_state', lobby_state);
}


function broadcast_mouse_positions() {
	var positions = {};
	for (const [name_, player] of Object.entries(game.players)) {
		positions[name_] = [player.mouseX, player.mouseY];
	}

	io.sockets.emit('mouse_update', positions);
}

var mousePollHandle = undefined;
function start_new_game(map_name) {
	// Wizards & Warlocks: Trouble in the Great Library?
	console.log('Starting game with map: ' + map_name);

	for (const [name_, colour_id] of Object.entries(lobby.player_to_colour)) {
		game.players[name_] = new Player(name_, colour_id);
		game.player_order.push(name_);
		game.sockets[name_] = lobby.sockets[name_];
	}
	lobby.sockets = {};
	

	io.sockets.emit('start', map_name);

	mousePollHandle = setInterval(broadcast_mouse_positions, 1000);
}