
var socket = io();
var player_name = null;

function show(x) {x.style.display = 'block';}
function hide(x) {x.style.display = 'none';}


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

var ACADEMIC_NAMES = [
	'Adeptus Demonic',
	'Adeptus Mechanical',
	'Adeptus Natural',
	'Adeptus Chemical',
	'Adeptus Historical',
	'Adeptus Physical',
	'Adeptus Psionic',
	'Adeptus Chaotic'
]