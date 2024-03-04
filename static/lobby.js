
var character_selection_options = [];
var lobbyFluidCurrentsAnimation = createLobbyCurrentsAnimation();
var alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-!?:.,$";



// Sim Quality Selection buttons
var high_quality_btn = document.getElementById("high_quality_btn");
var low_quality_btn = document.getElementById("low_quality_btn");
function quality_button_selection(e) {
    if (this.id.startsWith("high")) {
        config.DYE_RESOLUTION = 1024;
        low_quality_btn.innerHTML = "Low";
        high_quality_btn.innerHTML = "&gt High &lt";
    }
    if (this.id.startsWith("low"))  {
        config.DYE_RESOLUTION = 512;
        low_quality_btn.innerHTML = "&gt Low &lt";
        high_quality_btn.innerHTML = "High";
    }
}
high_quality_btn.onclick = quality_button_selection;
low_quality_btn.onclick = quality_button_selection;



join_button.onclick = function() {
	var name = username_input_field.value;
	if (name.length == 0) {
		join_msg_div.innerHTML = "Name too short";
		return;
	} else if (name.length > 11) {
		join_msg_div.innerHTML = "Name too long";
		return;
	} else if (name.length != name.split('')
		                          .filter(x => alphabet.includes(x))
		                          .length) {
		join_msg_div.innerHTML = "Invalid characters in name";
		return;
	}
	join_msg_div.innerHTML = "Connecting...";
	socket.emit("join", name);
}


socket.on('join_fail', (message) => {
	join_msg_div.innerHTML = message;
});

socket.on('join_lobby', (name) => {
	// Fade transition to fullscreen
	if (!debug_mode) {
		game_view.style.opacity = '0';
		game_view.style.animation = '';
		document.body.requestFullscreen().then((_) => {
			game_view.style.opacity = '1';
			if (!debug_mode) game_view.style.animation = 'fadeIn ease 5s';
		});}
	
	player_name = name;
	destroy(join_div);
	game.state = 'lobby';
	
	for (var i = 0; i < 8; ++i) {
		create_character_selection_box(i);
	}
	
	update_fluid_sim();
	lobbyFluidCurrentsAnimation.register();
	mousePointer.down = true;
	mousePointer.color = colourFromHSV(0, 0, 0.2);
});



function create_character_selection_box(i) {
	var x = (1 + i % 4) / 5
	var y = 0.3 + Math.floor(i / 4) * 0.4;
	var a = new AnimationCharacterDither(x, 1-y, COLOURS[i]);
	a.register();

	var box = document.createElement('div');
	box.className = 'character-select-box';
	var box_width = 160;
	var box_height = 150;
	var left = Math.floor(x * overlay.clientWidth);
	var top = Math.floor(y * overlay.clientHeight - box_height/2);

	var name_box = document.createElement('div');
	name_box.className = "character-name-box";
	overlay.appendChild(name_box);
	name_box.style.left = left.toString()+'px';
	name_box.style.top = top.toString()+'px';
	name_box.style.width = box_width.toString()+'px';
	name_box.style.height = box_height.toString()+'px';
	name_box.innerHTML = ACADEMIC_NAMES[i];

	character_selection_options.push({
		animation: a,
		name_box: name_box,
		taken: false,
		x: x,
		y: 1-y
	});

	name_box.onclick = function() {
		var opts = character_selection_options[i];
		if (opts.taken) return;
		socket.emit('choose_colour', i);
	}
}

socket.on('lobby_state', state => {
	if (game.state != 'lobby') return;

	for (var colour = 0; colour < 8; ++colour) {
		var opt = character_selection_options[colour];
		if (colour in state.colour_to_player) {
			var name = state.colour_to_player[colour];
			opt.taken = true;
			opt.name_box.innerHTML = 'Adeptus ' + ACADEMIC_NAMES[colour] + '<br><br><br><br><br><br>' + name;
			if (name == player_name){
			    mousePointer.color = COLOURS[colour];
			}
		} else {
			opt.taken = false;
			opt.name_box.innerHTML = 'Adeptus ' + ACADEMIC_NAMES[colour];
		}
	}

	lore_field.innerHTML = generate_lobby_text(state);
});


animation_handlers['character_selected'] = function (params) {
	var i = params.character_index;
	var opt = character_selection_options[i];
	createCharacterSelectAnimation(opt.x, opt.y, COLOURS[i]);
}


function generate_lobby_text(lobby_state) {
	var txt = 'The Apprentice stooped, brushing ash from a charred leather satchel and picking through it\'s contents. \
	From the colourful stains on the lining and the shattered crystal vials she guessed it had belonged to a Master \
	of the Psionic Arts, or perhaps an over-eager student. Regardless, like everything else \
	of value in the Great Library, the satchel\'s contents had been destroyed by the ethereal flames that swept through \
	the University two nights before. Except... at the back, in a slim pocket that she had almost overlooked, \
	there remained a single undamaged note stamped with the sigil of the Protector. Holding the paper closer to \
	the torchlight, she read:<br><br> \
	<i><font color="#999">"Concerning the revelations by the Adeptus Demonic, the following High Magi are summoned to an emergengy \
	council at the Library:<center><br>';
	var player_to_title = {};
	for (name of lobby_state.players) {
		player_to_title[name] = null;
	}
	for (i in lobby_state.colour_to_player) {
		player_to_title[lobby_state.colour_to_player[i]] = ACADEMIC_NAMES[i];
	}

	for (name in player_to_title) {
		var title = player_to_title[name];
		if (title != null) txt += 'Adeptus ' + title + ' ';
		txt += name + ' <font color=black>-</font> ';
		if (title != null) txt += '<img src="static/symbols/' + title + '.png", style="vertical-align: middle; width: 20px; height: 20px">';
		txt += '<br>';
	}

	txt += '<br></center>Make certain you are not followed."</font></i><br><br>\
	The Apprentice frowned. Though the note confirmed the fate of all of the missing Magi, it also raised \
	questions about the silence of some of those who still remained...';

	return txt;
}


function start(map_name='Galilei') {
	socket.emit('start', map_name);
}


socket.on('start', start_args => {
	if (game.state != 'lobby') return;
	
	lobbyFluidCurrentsAnimation.unregister();
	lobbyFluidCurrentsAnimation = null;
	gameStartAnimation(character_selection_options);

	for (opt of character_selection_options) {
		opt.animation.unregister();
		destroy(opt.name_box);
	}

	map_image.src = 'static/maps/galilei_map_tests.png';
	map_image.style.animation = 'rectifiedFadeIn ease 4s';
	show(map_image);
	wallsTexture = galileiWallsTexture;
	
	lore_field.style.animation = 'fadeOut ease 5s';
	setTimeout(() => {destroy(lore_field); setupGame(start_args);}, 5000);

});


