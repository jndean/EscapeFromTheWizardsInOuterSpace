
var socket = io();
var player_name = null;

function show(x) {x.style.display = 'block';}
function hide(x) {x.style.display = 'none';}
function destroy(x) {x.parentNode.removeChild(x);}


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

var ACADEMIC_NAMES = [
	'Demonic',
	'Mechanical',
	'Natural',
	'Chemical',
	'Historical',
	'Physical',
	'Psionic',
	'Chaotic'
]


const GALILEI_WALLS_BY_COL = [
	[1, 7, 8],
	[7],
	[],
	[1, 4, 6, 7],
	[1, 7, 14],
	[12 ,13 ,14],
	[],
	[5, 10, 11],
	[6, 12],
	[7, 12],
	[7, 13],
	[7],
	[7],
	[7],
	[1, 3, 4],
	[],
	[],
	[10, 11, 14],
	[1, 3, 10, 11, 14],
	[1, 3, 4, 9, 10],
	[],
	[7],
	[1, 7, 8]
]

const GALILEI_SAFE_BY_COL = [
	[4, 5, 6, 9, 10, 11, 12, 13],
	[5, 10],
	[1, 14],
	[10, 14],
	[2, 12],
	[1, 10],
	[7, 12, 14],
	[1, 2, 3, 7, 14],
	[1, 9, 14],
	[1, 14],
	[2, 5, 9, 11],
	[2, 4, 9, 11, 14],
	[2, 5, 9, 11],
	[3, 14],
	[5, 9, 14],
	[1, 3, 4, 12],
	[1, 4, 6, 11, 14],
	[1, 4, 6, 7, 8, 12],
	[],
	[7, 8, 14],
	[1, 5, 12],
	[1, 8],
	[3, 4, 5, 6, 10, 11, 12]
]