var map_canvas = document.getElementById('map_canvas');
var map_counters_layer = document.getElementById('map_counters');
var overlay = document.getElementById('overlay');
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

const NOISE_TOKEN_SIZE = 17;  // pixels


function GridCell(row, column) {
	this.row = row;
	this.col = column;
	this.id = row.toString() + ',' + column.toString();
	this.x = HEX_X_START + column * (HEX_SIDE + HEX_WIDTH);
	this.y = HEX_Y_START + row * HEX_RECT_HEIGHT;
	if (column % 2) this.y += HEX_RAD;
	this.center_coords = [this.x + HEX_RECT_WIDTH / 2, this.y + HEX_RECT_HEIGHT / 2];

	this.is_wall = GALILEI_WALLS_BY_COL[column].includes(row+1);
	this.is_safe = GALILEI_SAFE_BY_COL[column].includes(row+1);

	this.noise_tokens = {};
	this.player_token = null;
	this.noise_token_positions = {};
	this.current_noise_symbols = {};
	this.unused_positions = [0, 1, 2, 3, 4, 5];
	shuffle(this.unused_positions);

	this.draw = function(fill, line, line_width) {
	    map_canvas_ctx.lineWidth = line_width;

		map_canvas_ctx.beginPath();
	    map_canvas_ctx.moveTo(this.x, this.y + HEX_RAD);
	    map_canvas_ctx.lineTo(this.x + HEX_WIDTH, this.y + HEX_RECT_HEIGHT);
	    map_canvas_ctx.lineTo(this.x + HEX_WIDTH + HEX_SIDE, this.y + HEX_RECT_HEIGHT);
	    map_canvas_ctx.lineTo(this.x + HEX_RECT_WIDTH, this.y + HEX_RAD);
	    map_canvas_ctx.lineTo(this.x + HEX_SIDE + HEX_WIDTH, this.y);
	    map_canvas_ctx.lineTo(this.x + HEX_WIDTH, this.y);
	    map_canvas_ctx.closePath();

	    if (fill != null) {
	    	map_canvas_ctx.fillStyle = fill;
			map_canvas_ctx.fill();
	    }
	    if (line != null) {
	    	map_canvas_ctx.strokeStyle = line;
			map_canvas_ctx.stroke();
	    }
	}

	this.draw_base = function() {
		if (this.is_wall) 
			return;
		var fill = '#000000';
		var line = '#aaaaaa';
		var line_width = 0.2;
		if (this.is_safe) {
			line_width = 0.3;
			fill = '#292929';
		}
		this.draw(fill, line, line_width);
	}

	this.colour_to_position = function(colour_id) {
		if (!(colour_id in this.noise_token_positions)) {
			const r = 0.6;
			let angle = 2 * HEX_ANGLE * this.unused_positions.pop();
			let x = this.x + (HEX_RECT_WIDTH - NOISE_TOKEN_SIZE) / 2;
			let y = this.y + (HEX_RECT_HEIGHT - NOISE_TOKEN_SIZE) / 2;
			x += r * HEX_SIDE * Math.cos(angle);
			y += r * HEX_SIDE * Math.sin(angle);
			this.noise_token_positions[colour_id] = [x, y];
		}
		return this.noise_token_positions[colour_id];
	}

	this.transition_noise_token = function(colour_id, value, type='blank') {
		let token_id = 'noisetoken_' + this.row + '_' + this.col + '_' + colour_id;
		let token = document.getElementById(token_id);

		if (token === null) {
			token = document.createElement('img');
			token.className = 'noise-token';
			token.id = token_id;
			token.src = 'static/symbols/' + ACADEMIC_NAMES[colour_id] + '_' + type +'.png';
			let [x, y] = this.colour_to_position(colour_id);
			token.style.left = x + 'px';
			token.style.top = y + 'px';
			token.style.opacity = 0;
			map_counters_layer.appendChild(token);
		}

		// TODO: Record in this.current_noise_symbols, always fade out current symbol then fade in new symbol
		let symbol_id = token_id + '_symbol';
		let symbol = document.getElementById(symbol_id);
		if (symbol === null) {
			symbol = document.createElement('img');
			symbol.className = 'noise-token';
			symbol.id = symbol_id;
			symbol.style.opacity = 0.0;
			symbol.style.left = token.style.left;
			symbol.style.top = token.style.top;
			map_counters_layer.appendChild(symbol);
		}
		
		
		if (value == null) {
			token.style.opacity = 0;
			token.id += 'beingdeletedleavemealone';
			setTimeout(() => {map_counters_layer.removeChild(token);}, 1000);
			symbol.style.opacity = 0;
			symbol.id += 'beingdeletedleavemealone';
			setTimeout(() => {map_counters_layer.removeChild(symbol);}, 1000);
		} else {	
			let min_opacity = 0.1;
			let opacity = min_opacity + (HISTORY_LENGTH - value) * ((1 - min_opacity) / HISTORY_LENGTH);
			setTimeout(() => {
				token.style.opacity = opacity;
				symbol.style.opacity = 0.8;
			}, 100); // Makes sure ther's aneough time for the opacity=0 to take effect

			if (0 <= value || value <= 9) {
				symbol.src = 'static/symbols/' + value + '.png';
			}
		}
	}
}


function Board() {
	this.num_rows = 14;
	this.num_cols = 23;
	this.cells = [];

	for (var y= 0 ; y < this.num_rows; ++y) {
		let row = [];
		for (var x=0; x < this.num_cols; ++x) {
			row.push(new GridCell(y, x));
		}
		this.cells.push(row);
	}

	// Given global mouse coords, returns the corresponding board cell, or null.
	this.mouse_coords_to_cell = function(clientX, clientY) {
		let bounds = overlay.getBoundingClientRect();
		let posX = clientX - bounds.x;
		let posY = clientY - bounds.y;
		posX /= board_scale;
		posY /= board_scale;

		let col = (posX - HEX_X_START - HEX_RECT_WIDTH / 2) / (HEX_SIDE + HEX_WIDTH);
		let col1 = Math.floor(col);
		let col2 = Math.ceil(col);

		let row = (posY - HEX_Y_START - HEX_RECT_HEIGHT / 2) / (HEX_RECT_HEIGHT);
		let row1 = Math.floor(row);
		let row2 = Math.ceil(row);

		let options = [[row1, col1], [row1, col2]];
		if (col1 % 2) options.push([row2, col2]);
		else          options.push([row2, col1]);
		
		let min_distance = map_canvas.width * map_canvas.width;
		for (let i = 0; i < options.length; ++i) {
			let [r, c] = options[i];
			let o_x = HEX_X_START + (HEX_RECT_WIDTH) / 2 + c * (HEX_SIDE + HEX_WIDTH);
			let o_y = HEX_Y_START + (HEX_RECT_HEIGHT) / 2 + r * HEX_RECT_HEIGHT + HEX_RAD * (c % 2);
			let dx = o_x - posX;
			let dy = o_y - posY;
			let distance = dx*dx + dy*dy;
			if (distance < min_distance) {
				row = r;
				col = c;
				min_distance = distance;
			}
		}
		if (row < 0 || col < 0 || row >= this.num_rows || col >= this.num_cols)
			return null;
		return this.cells[row][col];
	}

	this.begin_cell_selector = function() {

		this.epoch = performance.now();
		// requestAnimationFrame(()=>this.cell_pulse());

		this.cell_select_mousemove_handle = overlay.addEventListener('mousemove', e => {
			map_canvas_ctx.clearRect(0, 0, map_canvas.width, map_canvas.height);

			let cell = this.mouse_coords_to_cell(e.clientX, e.clientY);
			if (cell === null) return;

			if (cell.is_safe)
				cell.draw('#00ff0020', '#00ff0050', 3);
			else if (!cell.is_wall)
				cell.draw('#ff000018', '#ff000050', 3);
				
		});

		// this.tmp_count = 0;
		this.cell_select_mousedown_handle = overlay.addEventListener('mousedown', e => {
			let cell = this.mouse_coords_to_cell(e.clientX, e.clientY);
			if (cell === null) return;
			// console.log('cell:', [cell.row, cell.col]);

			socket.emit('tmp_mouseclick', [cell.row, cell.col]);
		});

		this.cell_select_mouseout_handle = overlay.addEventListener('mouseout', e => {
			map_canvas_ctx.clearRect(0, 0, map_canvas.width, map_canvas.height);
		});
	}

	this.end_cell_selector = function() {
		overlay.removeEventListener('mousemove', this.cell_select_mousemove_handle);
		overlay.removeEventListener('mousedown', this.cell_select_mousedown_handle);
		overlay.removeEventListener('mouseout', this.cell_select_mouseout_handle);
	}

	// this.cell_pulse = function() {
	// 	map_canvas_ctx.clearRect(0, 0, map_canvas.width, map_canvas.height);
	// 	let alpha = Math.floor(128 + 64 * Math.sin((performance.now() - this.epoch) / 1000));
	// 	let colour = '#00ffff' + alpha.toString(16).padStart(2, '0');
	// 	this.cells[1][1].draw('#00000000', colour, 3);
	// 	requestAnimationFrame(()=>this.cell_pulse());
	// }

	this.get_cell_neighbours = function(cell) {
		if (cell.col % 2) {
			var directions = ODD_COL_HEX_NEIGHBOURS;
		} else {
			var directions = EVEN_COL_HEX_NEIGHBOURS;
		}
		let neighbours = [];
		for (let i = 0; i < directions.length; ++i) {
			let [dy, dx] = directions[i];
			let [r, c] = [cell.row + dy, cell.col + dx];
			if (r < 0 || c < 0 || r >= this.num_rows || c >= this.num_cols) 
				continue;
			let neighbour_cell = this.cells[r][c];
			if (!neighbour_cell.is_wall) {
				neighbours.push(neighbour_cell);
			}
		}
		return neighbours;
	}

	this.get_nhop_neighbours = function(cell, nhops) {
		let neighbours = [cell];
		let already_visited = new Set();

		for (let hop = 0; hop < nhops; ++hop) {
			let next_neighbours = [...neighbours];
			neighbours.forEach(n => {
				this.get_cell_neighbours(n).forEach(nn => {
					if (already_visited.has(nn.id)) 
						return;
					next_neighbours.push(nn);
				});
			});
			neighbours = next_neighbours;
		}

		return neighbours;
	}
}

var board = new Board();
board.begin_cell_selector();
