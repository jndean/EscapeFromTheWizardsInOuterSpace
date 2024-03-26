var state_transistions = [];

var game = {
	phase: 'login',
	players: {},
	player_order: [],
	current_player: 0,
	sigils: new Set(),
}


function Player(name, colour_id) {
	this.name = name;
	this.colour_id = colour_id;
	this.mouseGhost = undefined;
	this.num_sigils = 0;
	this.history = Array(HISTORY_LENGTH).fill(null);
	this.currently_marked_cells = new Set();
}


// ------------------------------ Game Start -------------------------- //

function setupGame(start_args) {
	game.phase = 'game'; // Change me later

	start_args.player_order.forEach((name_) => {
		game.players[name_] = new Player(
			name_, 
			start_args.player_to_colour[name_],
		);
	});
	game.current_player = 0;


	setupMousePointers();

	// document.addEventListener('mousedown', e => {
	//     let x = scaleByPixelRatio(e.offsetX) / canvas.width;
	//     let y = 1.0 - scaleByPixelRatio(e.offsetY) / canvas.height;
	//     // createNoiseAnimation(x, y, randomColour());
	//     createAttackAnimation(x, y, randomColour(), randomColour());

	// });
}	

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

// ---------------------------- Transition System ----------------------------- //


function setGameState(new_state) {
	if (new_state === null) {
		return; // For when transitiosn are just used to queue animtions, not modify game state.
	}
	game.current_player = new_state.current_player;
	game.sigils = new Set(new_state.sigils);
	game.is_warlock = new_state.is_warlock;
	for (const [name, player] of Object.entries(new_state.players)) {
		game.players[name].history = player.history;
		game.players[name].num_sigils = player.num_sigils;
	}
}


socket.on('state_transition', (args) => {
	state_transistions.push({
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
	if (state_transistions.length > transition_cap) {
		state_transistions = state_transistions.slice(-transition_cap - 1);
		let new_state = state_transistions.shift().final_state; // = popleft
		setGameState(new_state);
	}
	let t = state_transistions.shift();
	
	transition_in_progress = true;
	let duration = t.transition_func(t.transition_data);
	setTimeout(() => {
		setGameState(t.final_state);
		transition_in_progress = false;
		// updateUIpanel();   <----------------- TODO: update UI panel here?
		runTransitions();
	}, duration);
}


// ------------------------------- Transitions! -------------------------------- //

const transition_functions = {
	start_game_init_state: start_game_init_state_transition,
	start_game_animation: start_game_animation_transition,
	noise: noise_transition,
	attack: attack_transition,
}


function start_game_init_state_transition(start_args) {
	// setupGame(start_args);
	game.phase = 'game'; // Change me later

	start_args.player_order.forEach((name_) => {
		game.players[name_] = new Player(
			name_, 
			start_args.player_to_colour[name_],
		);
	});
	game.current_player = 0;

	setupMousePointers();

	return 0; // No delay
}

function start_game_animation_transition(_) {
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

function noise_transition(data) {
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



function attack_transition(transition_data) {

	return 4000;
}