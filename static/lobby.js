

var alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-!?#[]~:.,$";

join_button.onclick = function() {
	var name = username_input_field.value;
	if (name.length == 0) {
		join_msg_div.innerHTML = "Name too short";
		return;
	} else if (name.length > 15) {
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

socket.on('join_success', (name) => {
	player_name = name;
	hide(join_div);

	for (var i = 0; i < 8; ++i) {
		create_character_selection_box(i);
	}

	update_fluid_sim();
	//updatePointerDownData(mousePointer, -1, 0, 0);


});


var character_selection_options = [];

function create_character_selection_box(i) {
	var x = (1 + i % 4) / 5
	var y = 0.3 + Math.floor(i / 4) * 0.4;
	var a = new AnimationCharacterDither(x, 1-y, COLOURS[i]);
	a.register();

	var box_rad = 100;
	var box = document.createElement('div');
	box.className = 'character-select-box';
	overlay.appendChild(box);
	rad = box.clientWidth / 2;
	var left = Math.floor(x * overlay.clientWidth - rad);
	var top = Math.floor(y * overlay.clientHeight - rad);
	box.style.left = left.toString()+'px';
	box.style.top = top.toString()+'px';

	var name_box = document.createElement('div');
	overlay.appendChild(name_box);
	name_box.style.left = (left + rad).toString()+'px';
	name_box.style.top = (top - 20).toString()+'px';
	name_box.style.position = 'absolute';
	name_box.style.transform = 'translateX(-50%)';
	name_box.style.fontFamily = 'magic_font';
	name_box.style.fontSize = '20px';
	name_box.style.color = '#bbb';
	name_box.style.userSelect = 'none';
	name_box.style.textAlign = 'center';
	name_box.innerHTML = ACADEMIC_NAMES[i];

	character_selection_options.push({
		animation: a,
		zone: box,
		name_box: name_box,
		taken: false,
		x: x,
		y: 1-y
	});

	box.onclick = function() {
		var opts = character_selection_options[i];
		if (opts.taken) return;
		socket.emit('choose_colour', i);
	}
}

socket.on('lobby_state', state => {

	for (var colour = 0; colour < 8; ++colour) {
		var opt = character_selection_options[colour];
		if (colour in state.colour_to_player) {
			var name = state.colour_to_player[colour];
			opt.taken = true;
			hide(opt.zone);
			opt.name_box.innerHTML = '<font color="#555">' + ACADEMIC_NAMES[colour] + '</font><br><br><br><br><br>' + name;
			if (name == player_name){
				mousePointer.down = true;
			    mousePointer.color = COLOURS[colour];
			}
		} else {
			opt.taken = false;
			show(opt.zone);
			opt.name_box.innerHTML = ACADEMIC_NAMES[colour];
		}
	}

	lore_field.innerHTML = generate_lobby_text(state);
});


animation_handlers['character_selected'] = function (params) {

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
		var title = ACADEMIC_NAMES[i];
		player_to_title[lobby_state.colour_to_player[i]] = title;
	}

	for (name in player_to_title) {
		var title = player_to_title[name];
		if (title != null) txt += title + ' ';
		txt += name + '<br>';
	}

	txt += '<br></center>Make certain you are not followed."</font></i><br><br>\
	The Apprentice frowned. Though the note confirmed the fate of all of the missing Magi, it also raised \
	questions about the silence of some of those who still remained...';

	return txt;
}