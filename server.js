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

var GameData = require('./static/game_data');
console.log(GameData.GALILEI_WIZARD_SPAWN);


// ----------------- State ---------------- //

var game = {
	phase: 'lobby',
	sockets: {},
	players: {},
	player_order: [],
	current_player: null,
	moved_this_turn: false,
};

var lobby = {
	sockets: {},
	taken_colours: new Set(),
	player_to_colour: {}	
}

function Player(name, colour_id, warlock) {
	this.name = name;
	this.colour_id = colour_id;
	this.is_warlock = warlock;
	this.mouseX = 0.5;
	this.mouseY = 0.5;
	if (warlock) {
		this.current_row = GameData.GALILEI_WARLOCK_SPAWN[0];
		this.current_col = GameData.GALILEI_WARLOCK_SPAWN[1];
	} else {
		this.current_row = GameData.GALILEI_WIZARD_SPAWN[0];
		this.current_col = GameData.GALILEI_WIZARD_SPAWN[1];
	}
	this.sigils = [];

	this.history = Array(GameData.HISTORY_LENGTH).fill(null);

	this.update_history = function(update) { 
		this.history.pop();
		this.history.unshift(update);
	}
}


// ----------------- Networking ---------------- //

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
		} else if (game.phase == 'game') {
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
			broadcast_game_state_transition('player_rejoined', {
				player_name: player_name,
				player_order: game.player_order,
				player_to_colour: lobby.player_to_colour,
			}); 
			// socket.emit('rejoin_success', player_name);
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

	socket.on('request_move', (args) => {
		if (game.phase != 'game') return;
		if (player_name != game.player_order[game.current_player]) return;
		if (game.moved_this_turn) return;
		
		let player = game.players[player_name];
		if ((player.current_row == args.row) && (player.current_col == args.col)) return;
		
		// Move player
		player.current_row = args.row;
		player.current_col = args.col;
		game.moved_this_turn = true;

		// Figure out what happens
		let noise_coords = null;
		let sigil = null;
		let noise_result = undefined;
		if (GameData.GALILEI_SAFE_BY_COL[args.col].includes(args.row+1)) {
			noise_result = 'safe_space';
			player.update_history(null);
		} else {
			if (game.dangerous_hex_deck.length == 0) new_dangerous_hex_deck();
			noise_result = game.dangerous_hex_deck.pop();
		}
		console.log(player_name, 'get result', noise_result);
		if (noise_result == 'silent') {
			player.update_history(null);
			// If silent on a dangerous hex, player can find a sigil
			if (game.sigil_deck.length == 0) 
				new_sigil_deck();
			sigil = game.sigil_deck.pop();
			if (sigil !== null) {
				player.sigils.push(sigil);
			}
		} else if (noise_result == 'no_choice') {
			noise_coords = [player.current_row, player.current_col];
			player.update_history(['noise', player.current_row, player.current_col]);
		}

		// Communicate the result
		if (noise_result != 'choice') {
			broadcast_game_state_transition('move', {
					moving_player: player_name,
					noise_coords: noise_coords,
				}, 
				private_data={[player_name]: {
					sigil: sigil,
					noise_result: noise_result,
				}}
			);
		} else {
			// Need to ask player where they want to make a noise
			//TODO: emit 'choose_noise', which should include the current_pos so player can move token during the transition
			//TMP:
			player.update_history(['noise', 7, 11]);
			broadcast_game_state_transition('move', {
					moving_player: player_name,
					noise_coords: [7, 11],
				}, 
				private_data={[player_name]: {
					sigil: null,
					noise_result: noise_result,
				}}
			);
		}
	
	});

	
	socket.on('request_attack', (args) => {
		if (game.phase != 'game') return;
		if (player_name != game.player_order[game.current_player]) return;
		if (game.moved_this_turn) return;
		
		let player = game.players[player_name];
		if ((player.current_row == args.row) && (player.current_col == args.col)) return;

		// Move player
		player.current_row = args.row;
		player.current_col = args.col;
		game.moved_this_turn = true;

		// TODO: attack the space
	});


	socket.on('finish_actions', args => {
		if (game.phase != 'game') return;
		if (player_name != game.player_order[game.current_player]) return;
		if (!game.moved_this_turn) return;
		if (game.players[player_name].sigils.length > GameData.MAX_SIGILS) return;

		game.current_player = (game.current_player + 1) % game.player_order.length;	
		game.moved_this_turn = false;

		broadcast_game_state_transition('next_player', {
			player_name: game.player_order[game.current_player]
		});
	});
});


server.listen(port, () => {console.log('listening on port ' + port.toString());});


// ----------- Actions ------------ //

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
	
	// Shuffle role cards
	var roles = new Array(lobby.taken_colours.size).fill(false);
	for (let i = 0; i < Math.ceil(roles.length / 2); ++i) {
		roles[i] = true;
	}
	shuffle(roles);
	
	// Create Players
	for (const [name_, colour_id] of Object.entries(lobby.player_to_colour)) {
		game.players[name_] = new Player(name_, colour_id, roles.pop());
		game.player_order.push(name_);
		game.sockets[name_] = lobby.sockets[name_];
	}
	shuffle(game.player_order);
	lobby.sockets = {};

	// Create decks
	new_dangerous_hex_deck();
	new_sigil_deck();
	
	// Starting the game is a 2-part, 2-message process
	game.phase = 'starting';
	game.current_player = 0;
	broadcast_game_state_transition('start_game_init_state', {
		map_name: map_name,
		player_order: game.player_order,
		player_to_colour: lobby.player_to_colour,
	});
	game.phase = 'game';
	broadcast_game_state_transition('start_game_animation', {});

	mousePollHandle = setInterval(broadcast_mouse_positions, 100);
}

function new_dangerous_hex_deck() {
	game.dangerous_hex_deck = 
		new Array(27).fill('no_choice').concat(
			new Array(27).fill('choice')).concat(
				new Array(23).fill('silent'));
	shuffle(game.dangerous_hex_deck);
}

function new_sigil_deck() {
	// There are some dud (null) items
	game.sigil_deck = new Array(5).fill(null).concat([
		'Aggression',
		'Aggression',
		'Transposition',
		'Silence',
		'Silence',
		'Silence',
		'Detection',
		'Detection',
		'Resilience',
		'Momentum',
		'Momentum',
		'Momentum',
	]);
	shuffle(game.sigil_deck);
}


// -------------- Utilities -------------- //


function broadcast_game_state_transition(
	transition_name, 
	data, 
	private_data={},
) {
	// Serialise the game state.
	// Start with state given to all players
	let common_state = {
		phase: game.phase,
		current_player: game.current_player,
		players: {},
		moved_this_turn: game.moved_this_turn,
	};
	for (const [name, player] of Object.entries(game.players)) {
		common_state.players[name] = {
			num_sigils: player.sigils.length,
			history: player.history,
		}
	}

	// Next customise the state with player-specific (secret) data
	for (const [name, socket] of Object.entries(game.sockets)) {
		if (socket == null) continue;
		
		let player = game.players[name];
		let player_state = {...common_state};
		player_state.sigils = player.sigils;
		player_state.is_warlock = player.is_warlock;
		player_state.player_row = player.current_row;
		player_state.player_col = player.current_col;

		if (private_data.hasOwnProperty(name)) {
			data = Object.assign({...private_data[name]}, data);
		}

		socket.emit('state_transition', {
			name: transition_name,
			data: data,
			new_state: player_state,
		});
	}
}

function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}