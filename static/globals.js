
var socket = io();
var player_name = null;
var holding_breath = false;
var board_scale = 1;
var game_view = document.getElementById("game_view");

var debug_mode = true;


function show(x) {x.style.display = 'block';}
function hide(x) {x.style.display = 'none';}
function destroy(x) {x.parentNode.removeChild(x);}

// Fit game to window
function rescale_game_board(e) {
    let w_scale = document.body.clientWidth / game_view.clientWidth;
    let h_scale = document.body.clientHeight / game_view.clientHeight;
    board_scale = Math.max(0.5, Math.min(w_scale, h_scale, 1.4));
    game_view.style.transform = 'translate(-50%, -50%) scale(' + board_scale.toString() + ')';
}
window.addEventListener('resize', rescale_game_board);
window.addEventListener('load', (e) => {
    rescale_game_board();
    game_view.style.opacity = '1';
    if (!debug_mode) game_view.style.animation = 'fadeIn ease 2s';
});



function HSVtoRGB (h, s, v) {
    let r, g, b, i, f, p, q, t;
    i = Math.floor(h * 6);
    f = h * 6 - i;
    p = v * (1 - s);
    q = v * (1 - f * s);
    t = v * (1 - (1 - f) * s);

    switch (i % 6) {
        case 0: r = v, g = t, b = p; break;
        case 1: r = q, g = v, b = p; break;
        case 2: r = p, g = v, b = t; break;
        case 3: r = p, g = q, b = v; break;
        case 4: r = t, g = p, b = v; break;
        case 5: r = v, g = p, b = q; break;
    }

    return {
        r,
        g,
        b
    };
}

function colourFromHSV (h, s, v) {
    let c = HSVtoRGB(h, s, v);
    c.r *= 0.15;
    c.g *= 0.15;
    c.b *= 0.15;
    return c;
}

function colourFromHue (hue) {
	return colourFromHSV(hue, 1.0, 1.0);
}


var COLOURS = [
	0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875
].map(colourFromHue);
// var COLOURS = [
// 	0, 238/360, 25/360, 58/360, 220/360, 172/360, 103/360, 298/360
// ].map(colourFromHue);
