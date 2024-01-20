
var game_state = {
	players: [],
}


socket.on('mouse_update', player_positions => {
	console.log(player_positions);
});

function setupGame() {

	UI_div.style.display = 'block';
	UI_div.style.animation = 'fadeIn ease 10s';

	document.addEventListener('mousedown', e => {

	    let x = scaleByPixelRatio(e.offsetX) / canvas.width;
	    let y = 1.0 - scaleByPixelRatio(e.offsetY) / canvas.height;
	    // createNoiseAnimation(x, y, randomColour());
		createAttackAnimation(x, y, randomColour(), randomColour());

	});

	setInterval(function() {
		socket.emit('mouse_update', {
			mouseX: mouseX,
			mouseY: mouseY,
			name: player_name,
		});
	}, 1000);

}	