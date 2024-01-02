
var game_state = {
	players: [],

}


function setupGame() {

	UI_div.style.display = 'block';
	UI_div.style.animation = 'fadeIn ease 8s';

	document.addEventListener('mousedown', e => {

	    let x = scaleByPixelRatio(e.offsetX) / canvas.width;
	    let y = 1.0 - scaleByPixelRatio(e.offsetY) / canvas.height;
	    // createNoiseAnimation(x, y, randomColour());
		createAttackAnimation(x, y, randomColour(), randomColour());

	});

}	