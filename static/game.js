
var game = {
	state: 'login',
	players: {},
	player_order: [],
}

function Player(name, colour_id) {
	this.name = name;
	this.colour_id = colour_id;
	this.mouseGhost = undefined;
}


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


	document.addEventListener('mousedown', e => {

	    let x = scaleByPixelRatio(e.offsetX) / canvas.width;
	    let y = 1.0 - scaleByPixelRatio(e.offsetY) / canvas.height;
	    // createNoiseAnimation(x, y, randomColour());
		createAttackAnimation(x, y, randomColour(), randomColour());

	});

	setupMousePointers();
	
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