
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

const GALILEI_WIZARD_SPAWN = [5, 11];
const GALILEI_WARLOCK_SPAWN = [7, 11];



// This file is loaded by both nodejs and the browser. Only define exports for nodejs
if (typeof exports !== 'undefined') {
	exports.GALILEI_WIZARD_SPAWN = GALILEI_WIZARD_SPAWN;
	exports.GALILEI_WARLOCK_SPAWN = GALILEI_WARLOCK_SPAWN;
	exports.GALILEI_SAFE_BY_COL = GALILEI_SAFE_BY_COL;
	exports.GALILEI_WALLS_BY_COL = GALILEI_WALLS_BY_COL;
	exports.ACADEMIC_NAMES = ACADEMIC_NAMES;
}