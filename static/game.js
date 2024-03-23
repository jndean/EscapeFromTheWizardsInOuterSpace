var state_transistions = [];

var game = {
	state: 'login',
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
	UI_div.style.display = 'block';
	UI_div.style.animation = 'fadeIn ease 6s';
	game.state = 'game'; // Change me later

	start_args.player_order.forEach((name_) => {
		game.players[name_] = new Player(
			name_, 
			start_args.player_to_colour[name_],
		);
	});
	console.log(game.players);
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

// ---------------------------- Transitions? ----------------------------- //

const transition_functions = {
	noise: noise_transition,
	attack: attack_transition,
}
var transition_in_progress = false;


function setGameState(new_state) {
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


function runTransitions() {
	if (transition_in_progress)
		return;
	if (state_transistions.length == 0)
		return;
	
	/// Algorithm for catcing up: skip some
	const transition_cap = 2;
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
		runTransitions();
	}, duration);
}


function noise_transition(data) {
	let player = game.players[data.player_name];
	createNoiseAnimation(data.x, data.y, COLOURS[player.colour_id]);

	let marked_cells = new Set();
	for (let i = data.history.length - 1; i >= 0 ; --i) {
		let event = data.history[i];
		if (event === null) 
			continue;
		let [event_type, cell_row, cell_col] = event;
		let cell = board.cells[cell_row][cell_col];
		cell.transition_noise_token(player.colour_id, i, 'blank');
		marked_cells.add(1000*cell_row + cell_col);
	}

	let disused = player.currently_marked_cells.difference(marked_cells);
	disused.forEach((k) => {
		let row = Math.floor(k / 1000);
		let col = k % 1000;
		let cell = board.cells[row][col];
		cell.transition_noise_token(player.colour_id, null);
	});
	player.currently_marked_cells = marked_cells;

	return 3000;
}

function attack_transition(transition_data) {

	return 4000;
}