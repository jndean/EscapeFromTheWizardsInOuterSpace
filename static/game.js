var state_transistions = [];

game = {
	phase: 'login',
	players: {},
	player_order: [],
	current_player: null,
	sigils: [],
	moved_this_turn: false,
	decoy_choice_required: false,
	player_col: undefined,
	player_row: undefined,
	log: "",
}


function Player(name, colour_id) {
	this.name = name;
	this.colour_id = colour_id;
	this.mouseGhost = undefined;
	this.num_sigils = 0;
	this.history = Array(HISTORY_LENGTH).fill(null);
	this.currently_marked_cells = new Set();
	this.alive = true;
}


// ------------------------------ Setup -------------------------- //

function setupMousePointers() {

	for (const [name_, player] of Object.entries(game.players)) {
		player.mouseGhost = new AnimationGhostMouse(COLOURS[player.colour_id], name_);
		player.mouseGhost.register();
	};

	// Send my mouse positions to the server
	setInterval(function() {
		if (!board.selection_in_progress) {
			socket.emit('mouse_update', {
				mouseX: mouseX,
				mouseY: mouseY,
				name: player_name,
			});
		}
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
	board.begin_cell_selector(moveHexSelectedCallback, game.movement_speed);
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
	board.begin_cell_selector(
		attackHexSelectedCallback,
		game.movement_speed,
		all_hexes_unsafe=true
	);
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

// ----- Decoy ----- //

actionBtnHandlers['decoy'] = function () {
	board.begin_cell_selector(
		decoyHexSelectedCallback,
		null,
		all_hexes_unsafe=true
	);
	actionBox.update('choose_decoy_hex');
}

function decoyHexSelectedCallback() {
	actionBtnHandlers['confirm'] = confirmDecoyButtonHandler;
	actionBox.update('choose_decoy_hex_confirm');
}

function confirmDecoyButtonHandler () {
	socket.emit('request_noise', {
		row: board.current_selection.row,
		col: board.current_selection.col,
	});
	board.end_cell_selector();
	actionBox.update('choose_decoy_hex');
}

// ----- Discard ----- //

actionBtnHandlers['discard'] = function () {
	actionBox.update('choose_discard');
	sigilBox.begin_selection(discardCallback);
}

function discardCallback(selection) {
	socket.emit('request_discard', selection);
	// actionBox.update('choose_action'); // Show a cancel button or something here?
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
	game.decoy_choice_required = new_state.decoy_choice_required;
	game.movement_speed = new_state.movement_speed;
	game.log = new_state.log;

	for (const [name, player] of Object.entries(new_state.players)) {
		game.players[name].alive = player.alive;
		game.players[name].history = player.history;
		game.players[name].num_sigils = player.num_sigils;
	}

	if (game.player_changed) {
		game.player_changed = false;
		if (player_name == game.player_order[game.current_player]) {
			actionBox.update('choose_action');
			if (!game.moved_this_turn) {
				board.begin_cell_selector(moveHexSelectedCallback, game.movement_speed);
			}
		}
	}
	if (player_name != game.player_order[game.current_player]) {
		actionBox.update('notmyturn');
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
	const transition_cap = 3;
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
	'player_rejoined',
]);

const transition_functions = {
	start_game_init_state: start_game_init_state_transition,
	start_game_animation: start_game_animation_transition,
	player_rejoined: player_rejoined_transition,
	move: move_transition,
	choose_noise: choose_noise_transition,
	attack: attack_transition,
	discard: discard_transition,
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
	game.current_player = game_state.current_player;
	game.player_row = game_state.player_row;
	game.player_col = game_state.player_col;
	game.player_changed = true;

	setupMousePointers();
	create_ui_components(game);

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

function player_rejoined_transition(args, new_state) {
	if (player_name != args.player_name) return 0;
	start_game_init_state_transition(args, new_state);

	destroy(join_div);
	destroy(lore_field);
	map_image.src = 'static/maps/galilei_map_tests.png';
	map_image.style.animation = 'rectifiedFadeIn ease 1s';
	wallsTexture = galileiWallsTexture;
	show(map_image);
	UI_div.style.display = 'block';
	UI_div.style.animation = 'fadeIn ease 1s';

	mousePointer.color = COLOURS[args.player_to_colour[args.player_name]];
	mousePointer.down = true;
	update_fluid_sim();

	return 1000;
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
	if ((data.moving_player == player_name) && !data.already_moved) {
		board.end_cell_selector();
		var move_delay = 2000;
		board.move_player_token(new_state.player_row, new_state.player_col);
		let next_actionBox_state = 'choose_action';
		duration = Math.max(duration, move_delay);
		if (data.sigil != null) {
			sigilBox.addSigil(data.sigil);
			game.sigils.push(data.sigil); // So tehre isn't a race condition for actionBox behaviour
			let msg = 'You move carefully, and find a <font color="' + SIGIL_COLOURS[data.sigil]
						+ '"> Sigil of ' + data.sigil + '</font>';
			let msg_duration = 5500;
			if (new_state.sigils.length > MAX_SIGILS) {
				msg += '<br> <font size=6>You have too many sigils, ';
				if (game.is_warlock) {
					msg += 'discard one before continuing. </font>';
					sigilBox.begin_selection(discardCallback);
					next_actionBox_state = 'choose_discard';
				} else {
					msg += 'use or discard one before continuing. </font>';
				}
			}
			displayBannerMessage(msg, msg_duration);
			duration = Math.max(duration, msg_duration);
		} else if (data.danger_result == 'silent') {
			let msg_duration = 4000; // Do we want these common messages to be faster?
			displayBannerMessage('You move carefully, but find nothing...', msg_duration);
			duration = Math.max(duration, msg_duration);
		}
		actionBox.transitionUpdate('You are moving...', move_delay, next_actionBox_state);
	} else if ((data.moving_player == player_name) && data.already_moved) {
		game.decoy_choice_required = new_state.decoy_choice_required;
		actionBox.update('choose_action');
	} else {
		var move_delay = 0;
	}

	// Everybody does noise animation
	let moving_player = game.players[data.moving_player];
	if (data.noise_coords != null) {
		let [r, c] = data.noise_coords;
		let [x, y] = board.cells[r][c].center_coords;
		setTimeout(() => {
			createNoiseAnimation(x, y, COLOURS[moving_player.colour_id]);
		}, move_delay);
		duration = Math.max(duration, 3000 + move_delay);
	}

	// Everybody animates noise tokens updating now (or after the player token moves)
	moving_player.history = new_state.players[moving_player.name].history;
	setTimeout(() => {board.display_player_history(moving_player);}, move_delay);

	return duration;
}


function choose_noise_transition(_, new_state) {
	board.move_player_token(new_state.player_row, new_state.player_col);
	var move_delay = 2000;
	var msg_delay = 3000;
	game.moved_this_turn = new_state.moved_this_turn;
	game.decoy_choice_required = new_state.decoy_choice_required;
	actionBox.transitionUpdate('You are moving...', move_delay, 'choose_decoy_hex');
	setTimeout(
		() => {
			displayBannerMessage("Choose a hex to disturb", msg_delay);
			board.begin_cell_selector(decoyHexSelectedCallback, null, all_hexes_unsafe=true);
		},
		move_delay
	);
	return move_delay;
}

function attack_transition(data, _) {
	game.moved_this_turn = true;

	let move_time = 0;
	let attack_time = 3000;
	let msg1_time = 6000;
	let msg2_time = 0;

	let attacking_player = game.players[data.attacker];
	if (data.attacker == player_name) {
		move_time = 2000;
		board.move_player_token(data.row, data.col);
		actionBox.transitionUpdate('You attack!', move_time, 'choose_action');
	}

	let [x, y] = board.cells[data.row][data.col].center_coords;
	let attack_colour = COLOURS[attacking_player.colour_id];
	let msg1 = data.attacker + " attacks, ";
	if (data.killed.length > 0) {
		// TODO: multikill => multicolour
		var killed_colour = COLOURS[game.players[data.killed[0]].colour_id];
		msg1 += "killing " + data.killed.join(' and ');
		if (data.killed.includes(player_name)) {
			msg2_time = 6000;
			msg2 = "<font color=\"#a00\">You are Dead</font>"
			board.fade_player_token();
			// TODO: show player dead in UI panel
		} else if (data.killed_warlocks.length > 0) {
			msg2_time = 6000;
			msg2 = "<font color=\"#a00\">Even a Warlock can be Killed</font>"
		}
	} else {
		var killed_colour = {r:0, g:0, b:0};
		msg1 += "but hits nothing...";
	}

	// Animation
	setTimeout(() => {
		createAttackAnimation(x, y, killed_colour, attack_colour);
	}, move_time);

	// TODO: Possibly killed player's token should fade during attack animation?
	// Or not, if I get around to making tokens interact with the fluid sim.
	// Banner msg
	setTimeout(() => {
		displayBannerMessage(msg1, msg1_time);}, move_time + attack_time);
	if (msg2_time) setTimeout(() => {
		displayBannerMessage(msg2, msg2_time);}, move_time + attack_time + msg1_time);

	return move_time + attack_time + msg1_time + msg2_time;
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


function discard_transition(data, _) {
	if (data.discarding_player != player_name)
		return 0;

	let sigil_fade_delay = 900;
	sigilBox.removeSigil(data.sigil_idx);
	game.sigils.splice(data.sigil_idx, 1); // So that the action box definitely shows the right options
	actionBox.transitionUpdate("", sigil_fade_delay, 'choose_action');

	return sigil_fade_delay;
}