var state_transistions = [];

game = {
	phase: 'login',
	players: {},
	player_order: [],
	current_player: null,
	sigils: [],
	moved_this_turn: false,
	player_col: undefined,
	player_row: undefined,
	player_changed_flag: false,
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

// ----- Move ----- //

actionBtnHandlers['move'] = function () {
	board.end_cell_selector(); // Keepme
	board.begin_cell_selector(moveHexSelectedCallback);
	actionBox.update('choose_move_hex');
}

function moveHexSelectedCallback() {
	actionBtnHandlers['confirm'] = confirmMoveButtonHandler;
	actionBox.update('choose_move_hex_confirm');
}

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

// ----- Attack ----- //

actionBtnHandlers['attack'] = function () {
	board.end_cell_selector(); // Keepme
	board.begin_cell_selector(attackHexSelectedCallback);
	actionBox.update('choose_attack_hex');
}

function attackHexSelectedCallback() {
	actionBtnHandlers['confirm'] = confirmAttackButtonHandler;
	actionBox.update('choose_attack_hex_confirm');
}

function confirmAttackButtonHandler () {
	socket.emit('request_attack', {
		row: board.current_selection.row,
		col: board.current_selection.col,
	});
	board.end_cell_selector();
	actionBox.update('choose_attack_hex');
}

// ----- Finish ----- //

actionBtnHandlers['finish'] = function () {
	socket.emit('finish_actions', {});
	actionBox.update('notmyturn');
}


// ---------------------------- Transition System ----------------------------- //


function setGameState(new_state) {
	if (new_state === null) {
		return; // For when transitions are just used to queue animtions, not modify game state.
	}
	game.player_changed |= (game.current_player != new_state.current_player);
	game.current_player = new_state.current_player;
	game.sigils = new_state.sigils;
	game.is_warlock = new_state.is_warlock;
	game.player_col = new_state.player_col;
	game.player_row = new_state.player_row;
	game.phase = new_state.phase;
	game.moved_this_turn = new_state.moved_this_turn;

	for (const [name, player] of Object.entries(new_state.players)) {
		game.players[name].history = player.history;
		game.players[name].num_sigils = player.num_sigils;
	}

	if (game.player_changed) {
		game.player_changed = false;
		if (player_name == game.player_order[game.current_player]) {
			board.begin_cell_selector(moveHexSelectedCallback);
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
	next_player: next_player_transition,
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
	game.player_changed = true;

	setupMousePointers();
	actionBox = new ActionBox(game);
	create_ui_components(game);
	updateUI(game);

	return 0; // No delay
}

function start_game_animation_transition(_, _) {
	let fadeout_delay = 5000;
	let msg_delay = 4000;
	let msg1_t = 10000;
	let msg2_t = 5000;
	if (debug_mode) {
		msg_delay = 500;
		msg1_t = 500;
		msg2_t = 500;
		fadeout_delay = 1000;
	}
	let duration = Math.max(fadeout_delay, msg_delay + msg1_t + msg2_t);

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
	}, fadeout_delay);


	// Starting message banner
	setTimeout(() => {
		if (game.is_warlock) {
			displayBannerMessage("You are a <font color=\"#a00\">Warlock</font>", msg1_t);
			displayBannerMessage("Don't let them escape", msg2_t);
		} else {
			displayBannerMessage("You are a <font color=\"#0aa\">Wizard</font>", msg1_t);
			displayBannerMessage("Run", msg2_t);
		}
	}, msg_delay);

	return duration;
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


function move_transition(data, new_state) {
	game.moved_this_turn = true;
	let duration = 0;

	// Non moving players, silent movemnt
	if ((data.moving_player != player_name) && (data.noise_coords === null)) {
		displayBannerMessage(data.moving_player + " moves silently...", 6000);
		duration = Math.max(duration, 6000);
	}

	// Moving player updates player token position
	if (data.moving_player == player_name) {
		board.end_cell_selector();
		actionBox.update('choose_action');
		board.move_player_token(new_state.player_row, new_state.player_col);
		var move_delay = 2000;
		duration = Math.max(duration, move_delay);
		if (data.sigil != null) {
			sigilBox.addSigil(data.sigil);
			let msg = 'Found a Sigil of ' + data.sigil;
			if (new_state.sigils.length > MAX_SIGILS) {
				msg += '<br> <font size=6>You have too many sigils, and must discard one before continuing. </font>'
			}
			displayBannerMessage(msg, 5500);
			duration = Math.max(duration, 5500);
		}
	} else {
		var move_delay = 0;
	}

	// Everybody does noise animation
	if (data.noise_coords != null) {
		let [r, c] = data.noise_coords;
		let [x, y] = board.cells[r][c].center_coords;
		x = scaleByPixelRatio(x) / canvas.width;
		y = 1.0 - scaleByPixelRatio(y) / canvas.height;
		setTimeout(() => {
			createNoiseAnimation(x, y, COLOURS[game.players[data.moving_player].colour_id]);
		}, move_delay);
		duration = Math.max(duration, 3000 + move_delay);
	}

	// Everybody animated noise tokens updating now
	let marked_cells = new Set();
	let player = game.players[data.moving_player];
	for (let i = HISTORY_LENGTH - 1; i >= 0 ; --i) {
		let event = new_state.players[data.moving_player].history[i];
		if (event === null) 
			continue;
		let [event_type, cell_row, cell_col] = event;
		let cell = board.cells[cell_row][cell_col];
		cell.transition_noise_token(player.colour_id, i, 'blank');
		marked_cells.add(1000 * cell_row + cell_col); // 2D coord "hash"
	}
	let disused = player.currently_marked_cells.difference(marked_cells);
	disused.forEach((k) => {
		let cell = board.cells[Math.floor(k / 1000)][k % 1000];
		cell.transition_noise_token(player.colour_id, null);
	});
	player.currently_marked_cells = marked_cells;

	return duration;
}

function attack_transition(data, _) {
	
	return 4000;
}

function next_player_transition(data, _) {
	game.player_changed = true;
	if (data.player_name == player_name) {
		displayBannerMessage("Your turn...", 4500);
		return 3000;
	} else {
		actionBox.update('notmyturn');
		return 0;
	}
}