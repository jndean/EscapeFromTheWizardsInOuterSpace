

var map_canvas = document.getElementById('map_canvas');
map_canvas.width = 1260;
map_canvas.height = 910;
var map_canvas_ctx = map_canvas.getContext('2d');

const HEX_ANGLE = 0.523598776; // 30 degrees in radians;
const HEX_SIDE = 35;
const HEX_WIDTH = Math.sin(HEX_ANGLE) * HEX_SIDE;
const HEX_RAD = Math.cos(HEX_ANGLE) * HEX_SIDE;
const HEX_RECT_WIDTH = HEX_SIDE + 2 * HEX_WIDTH;
const HEX_RECT_HEIGHT = 2 * HEX_RAD;

const HEX_Y_START = 13;
const HEX_X_START = 18;


for (var y=0; y<14; ++y) {
	for (var x=0; x<23; ++x) {
		(new GridCell(y, x)).draw_base();
	}
}

function hexXY(row, column) {
	var y = HEX_Y_START + row * HEX_RECT_HEIGHT;
	if (column % 2) y += HEX_RAD;
	
	return (x, y);
}


function Board() {

}

function GridCell(row, column, type) {
	this.row = row;
	this.col = column;
	this.type = type;
	this.id = row.toString() + ',' + column.toString();
	this.x = HEX_X_START + column * (HEX_SIDE + HEX_WIDTH);
	this.y = HEX_Y_START + row * HEX_RECT_HEIGHT;
	if (column % 2) this.y += HEX_RAD;

	this.draw = function(ctx, fill, line_colour, line_width) {
	    ctx.strokeStyle = line_colour;
	    ctx.lineWidth = line_width;

		ctx.beginPath();
	    ctx.moveTo(this.x, this.y + HEX_RAD);
	    ctx.lineTo(this.x + HEX_WIDTH, this.y + HEX_RECT_HEIGHT);
	    ctx.lineTo(this.x + HEX_WIDTH + HEX_SIDE, this.y + HEX_RECT_HEIGHT);
	    ctx.lineTo(this.x + HEX_RECT_WIDTH, this.y + HEX_RAD);
	    ctx.lineTo(this.x + HEX_SIDE + HEX_WIDTH, this.y);
	    ctx.lineTo(this.x + HEX_WIDTH, this.y);
	    ctx.closePath();

	    if (fill != null) {
	    	ctx.fillStyle = fill;
			ctx.fill();
	    }
		ctx.stroke();
	}

	this.draw_base = function() {
		this.draw(
			map_canvas_ctx,
			fill=null, // '#332244',
			line_colour='#CCCCCC',
			line_width=1
		);
	}

	
}