var state_transistions = [];

game = {
	phase: 'login',
	players: {},
	player_order: [],
	current_player: null,
	sigils: new Set(),
	moved_this_turn: false,
	player_col: undefined,
	player_row: undefined,
}


function Player(name, colour_id) {
	this.name = name;
	this.colour_id = colour_id;
	this.mouseGhost = undefined;
	this.num_sigils = 0;
	this.history = Array(HISTORY_LENGTH).fill(null);
	this.currently_marked_cells = new Set();
}


// ------------------------------ Setup -------------------------- //

function setupMousePointers() {

	for (const [name_, player] of Object.entries(game.players)) {
		player.mouseGhost = new AnimationGhostMouse(COLOURS[player.colour_id], name_);
		player.mouseGhost.register();
	};

	// Send my mouse positions to the server
	setInterval(function() {
		socket.emit('mouse_update', {
			mouseX: mouseX,
			mouseY: mouseY,
			name: player_name,
		});
	}, 100);

	// Receive all players mouse positions
	socket.on('mouse_update', player_positions => {
		for (const [name_, [X, Y]] of Object.entries(player_positions)) {
			game.players[name_].mouseGhost.setTarget(X, Y);
		}
	});
}


// ---------------------------- Player Actions ----------------------------- //

var actionBtnHandlers = {};


actionBtnHandlers['move'] = function () {
	board.begin_cell_selector(moveHexSelectedCallback);
	actionBox.update('choose_move_hex');
	actionBtnHandlers['confirm'] = confirmMoveButtonHandler;
}

function moveHexSelectedCallback() {
	actionBox.update('choose_move_hex_confirm');
}

// Specific handler for different confirm buttons.
function confirmMoveButtonHandler () {
	socket.emit('request_move', {
		row: board.current_selection.row,
		col: board.current_selection.col,
	});
	board.end_cell_selector();
	actionBox.update('choose_move_hex');
}

actionBtnHandlers['cancel'] = function () {
	board.end_cell_selector();
	actionBox.update('choose_action');
}


// ---------------------------- Transition System ----------------------------- //


function setGameState(new_state) {
	if (new_state === null) {
		return; // For when transitions are just used to queue animtions, not modify game state.
	}
	let player_changed = (game.current_player != new_state.current_player);
	game.current_player = new_state.current_player;
	game.sigils = new Set(new_state.sigils);
	game.is_warlock = new_state.is_warlock;
	game.player_col = new_state.player_col;
	game.player_row = new_state.player_row;
	game.phase = new_state.phase;
	game.moved_this_turn = new_state.moved_this_turn;

	for (const [name, player] of Object.entries(new_state.players)) {
		game.players[name].history = player.history;
		game.players[name].num_sigils = player.num_sigils;
	}

	if (player_changed) {
		if (player_name == game.player_order[game.current_player]) {
			actionBox.update('choose_action');
		} else {
			actionBox.update('notmyturn');
		}
	}

	updateUI(game);
}


socket.on('state_transition', (args) => {
	state_transistions.push({
		unskippable: unskippable_transitions.has(args.name),
		final_state: args.new_state,
		transition_data: args.data,
		transition_func: transition_functions[args.name],
	});
	runTransitions();
});


var transition_in_progress = false;

function runTransitions() {
	if (transition_in_progress)
		return;
	if (state_transistions.length == 0)
		return;
	
	/// Algorithm for catching up: skip some
	const transition_cap = 2;
	let skipped_transition = null;
	while ((state_transistions.length > transition_cap) &&
			(!state_transistions[0].unskippable)) {
		skipped_transition = state_transistions.shift();
	}
	if (skipped_transition !== null) {
		setGameState(skipped_transition.final_state);
	}
	let t = state_transistions.shift();
	
	transition_in_progress = true;
	let duration = t.transition_func(t.transition_data, t.final_state);
	setTimeout(() => {
		transition_in_progress = false;
		setGameState(t.final_state);
		runTransitions();
	}, duration);
}


// ------------------------------- Transitions! -------------------------------- //

const unskippable_transitions = new Set([
	'start_game_init_state',
	'start_game_animation',
])

const transition_functions = {
	start_game_init_state: start_game_init_state_transition,
	start_game_animation: start_game_animation_transition,
	move: move_transition,
	noise: noise_transition,
	attack: attack_transition,
}


function start_game_init_state_transition(start_args, game_state) {
	game.player_order = start_args.player_order;
	start_args.player_order.forEach((name_) => {
		game.players[name_] = new Player(
			name_, 
			start_args.player_to_colour[name_],
		);
	});
	game.current_player = 0;
	game.player_row = game_state.player_row;
	game.player_col = game_state.player_col;

	setupMousePointers();
	actionBox = new ActionBox(game);
	create_ui_components(game);
	updateUI(game);

	return 0; // No delay
}

function start_game_animation_transition(_, _) {
	lobbyFluidCurrentsAnimation.unregister();
	lobbyFluidCurrentsAnimation = null;
	gameStartAnimation(character_selection_options);
	
	for (opt of character_selection_options) {
		opt.animation.unregister();
		destroy(opt.name_box);
	}

	// Map swirls into view, the lobby text fades
	map_image.src = 'static/maps/galilei_map_tests.png';
	map_image.style.animation = 'rectifiedFadeIn ease 4s';
	show(map_image);
	wallsTexture = galileiWallsTexture;
	lore_field.style.animation = 'fadeOut ease 5s';
	
	// UI fades in
	setTimeout(() => {
		destroy(lore_field);
		UI_div.style.display = 'block';
		UI_div.style.animation = 'fadeIn ease 11s';
	}, 5000);

	// Starting message banner
	setTimeout(() => {
		if (game.is_warlock) {
			displayBannerMessage("You are a <font color=\"#a00\">Warlock</font>", 10000);
			displayBannerMessage("Don't let them escape", 5000);
		} else {
			displayBannerMessage("You are a <font color=\"#0aa\">Wizard</font>", 10000);
			displayBannerMessage("Run", 5000);
		}
	}, 4000);

	return 19000;
}

function noise_transition(data, _) {
	let player = game.players[data.player_name];

	// Noise animation
	let [x, y] = board.cells[data.cell_row][data.cell_col].center_coords;
	let bounds = overlay.getBoundingClientRect();
	x = scaleByPixelRatio(x) / canvas.width;
	y = 1.0 - scaleByPixelRatio(y) / canvas.height;
	createNoiseAnimation(x, y, COLOURS[player.colour_id]);

	// Update noise token that are in use
	let marked_cells = new Set();
	for (let i = data.history.length - 1; i >= 0 ; --i) {
		let event = data.history[i];
		if (event === null) 
			continue;
		let [event_type, cell_row, cell_col] = event;
		let cell = board.cells[cell_row][cell_col];
		cell.transition_noise_token(player.colour_id, i, 'blank');
		marked_cells.add(1000*cell_row + cell_col); // 2D coord "hash"
	}

	// Remove disused noise tokens
	let disused = player.currently_marked_cells.difference(marked_cells);
	disused.forEach((k) => {
		let cell = board.cells[Math.floor(k / 1000)][k % 1000];
		cell.transition_noise_token(player.colour_id, null);
	});
	player.currently_marked_cells = marked_cells;

	return 3000;
}


function move_transition(args, _) {
	board.end_cell_selector();
	game.moved_this_turn = true;
	actionBox.update('choose_action');
	board.move_player_token(args.row, args.col);
	return 0;
}

function attack_transition(transition_data, _) {
	
	return 4000;
}