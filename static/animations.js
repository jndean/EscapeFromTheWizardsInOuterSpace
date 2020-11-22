




// var blinkInterval = setInterval(
// 	function(){
// 		multipleSplats(parseInt(Math.random() * 20) + 5);
// 	},
// 	10000
// );

function colourFromHSV (h, s, v) {
    let c = HSVtoRGB(h, s, v);
    c.r *= 0.15;
    c.g *= 0.15;
    c.b *= 0.15;
    return c;
}

function colourFromHue (hue) {return colourFromHSV(hue, 1.0, 1.0)}

function Point(x, y) {
	this.x = x;
	this.y = y;
	this.distance_to = function (other) {
		var dx = this.x - other.x;
		var dy = this.y - other.y;
		return Math.sqrt(dx*dx + dy*dy);
	}
}

var max_animation_id = 0;
function AnimationLinear(points, speed, radius, colour) {
	this.points = points;
	this.speed = speed;
	this.radius = radius;
	this.current_point = 0;
	this.current_progress = 0.0;
	this.finished = false;

	pointer = new pointerPrototype()
	pointer.down = true;
	pointer.moved = true;
    pointer.texcoordX = points[0].x;
    pointer.texcoordY = points[0].y;
    pointer.prevTexcoordX = pointer.texcoordX;
    pointer.prevTexcoordY = pointer.texcoordY;
    pointer.deltaX = 0;
    pointer.deltaY = 0;
    pointer.radius = radius;
    pointer.color = colour;
    pointer.id = ++max_animation_id;
    this.pointer = pointer;

    this.segment_lengths = [];
    for (var i = 0; i < points.length - 1; i++) {
    	this.segment_lengths.push(
    		points[i].distance_to(points[i+1])
    	);
    }

    this.step = function(dt) {
    	if (this.finished) {
    		this.unregister();
    		return;
    	}

    	this.current_progress += dt * this.speed;
    	while (this.current_progress > this.segment_lengths[this.current_point]) {
    		this.current_progress -= this.segment_lengths[this.current_point];
    		if (++this.current_point >= this.points.length - 1) {
    			this.finished = true;
    			this.current_progress = 0;
    			break;
    		}
    	}

	    prev_x = this.pointer.texcoordX;
    	prev_y = this.pointer.texcoordY;
		var current = this.points[this.current_point];
    	if (this.finished) {
    		this.pointer.texcoordX = current.x;
    		this.pointer.texcoordY = current.y;
    	} else {
    		var next = this.points[this.current_point+1];
    		var prog = this.current_progress / this.segment_lengths[this.current_point];
    		this.pointer.texcoordX = prog * next.x + (1-prog) * current.x;
    		this.pointer.texcoordY = prog * next.y + (1-prog) * current.y;
    	}

    	this.pointer.deltaX = correctDeltaX(this.pointer.texcoordX - prev_x);
    	this.pointer.deltaY = correctDeltaY(this.pointer.texcoordY - prev_y);
    	this.pointer.moved = Math.abs(this.pointer.deltaX) > 0 || Math.abs(this.pointer.deltaY) > 0;
    }

    this.register = function() {
    	animations.add(this);
    	pointers.add(this.pointer);
    }

    this.unregister = function() {
    	pointers.delete(this.pointer);
    	animations.delete(this);
    }

}


function AnimationPause(T) {
	this.T = T;
	this.t = 0.0;
	this.finished = (T <= 0);

	this.step = function(dt) {
		if (this.finished) {
			this.unregister();
			return;
		}
		this.t += dt;
		if (this.t >= this.T) {
			this.finished = true;
		}
	}

    this.register = () => animations.add(this);
    this.unregister = () => animations.delete(this);
}


function AnimationSequence(children) {
	this.children = children;
	this.current = 0;
	this.finished = (children.length == 0);

	this.step = function(dt) {
		if (this.finished) {
			this.unregister();
			return;
		}

		var a = this.children[this.current];
		if (a.finished) {
			this.current += 1;
			if (this.current == this.children.length) {
				this.finished = true;
				return;
			}
			this.children[this.current].register();
		}
	}

    this.register = function() {
    	animations.add(this);
		this.children[0].register();
    } 
    this.unregister = () => animations.delete(this);
}


function AnimationParallel(children) {
	this.children = children;
	this.finished = (children.length == 0);

	this.step = function(dt) {
		if (this.finished) {
			this.unregister();
			return;
		}
		if (this.children.every(c => c.finished)) {
			this.finished = true;
		}
	}

    this.register = function() {
    	animations.add(this);
		this.children.forEach(c => c.register());
    } 
    this.unregister = () => animations.delete(this);
}


function AnimationInfniteDither(x, y, colour) {
	this.x = x;
	this.y = y;
	this.colour = colour;
	this.finished = false;

	this.register = function() {
		this.animation = new AnimationPause(0.1);
		this.animation.register()
		animations.add(this);
	}
	this.unregister = function() {
		animations.delete(this);
		if (animations.contains(this.animations)) {
			this.animation.unregister();
		}
	}
	this.step = function (dt) {
		if (!this.animation.finished) 
			return;

		var n = 1 + Math.ceil(Math.random() * 9);
		var points = [];
		for (var i = 0; i < n; ++i) {
			var x = this.x + (Math.random()-.5) * 0.05;
			var y = this.y + (Math.random()-.5) * 0.05;
			points.push(new Point(x, y));
		}
		this.animation = new AnimationSequence([
			new AnimationLinear(
				points, 
				0.05 + Math.random() * 0.05, 
				0.0008 + Math.random() * 0.0008,
				this.colour
			),
			new AnimationPause(Math.random(0.05))
		])
		this.animation.register();
	}
}


function createNoiseAnimation(x, y, colour) {
	var n = Math.floor(1 + Math.random() * 2.5);
	var angle = Math.random() * 2 * Math.PI;
	var anims = [];

	for (var i = 0; i < n; ++i) {
		var d = 0.003 + 0.007 * Math.random();
		angle += (1 - Math.random() * 0.3) * Math.PI;
		var dx = d * Math.sin(angle);
		var dy = d * Math.cos(angle);
		anims.push(new AnimationLinear(
			[new Point(x-dx, y-dy), new Point(x+dx, y+dy)],
			0.08,
			0.05,
			colour
		))
		anims.push(new AnimationPause(0.5 * Math.random()))
	}
	var a = new AnimationSequence(anims);
	a.register();
}


function createAttackAnimation(x, y, colour1, colour2) {
	var n = Math.floor(2 + Math.random() * 4);
	var anims1 = [];

	for (var i = 0; i < n; ++i) {
		var d = 0.02 * Math.random();
		var angle = Math.random() * 2 * Math.PI;
		var dx = d * Math.sin(angle);
		var dy = d * Math.cos(angle);
		anims1.push(new AnimationLinear(
			[new Point(x-dx, y-dy), new Point(x+dx, y+dy)],
			0.02 + 0.12 * Math.random(),
			0.02 + 0.1 * Math.random(),
			colour1
		))
		anims1.push(new AnimationPause(0.06 * Math.random()));
	}

	var anims2 = [];
	anims2.push(new AnimationPause(0.1 + 0.3 * Math.random()));

	d = 0.3;
	dx = d * Math.sin(angle - Math.PI);
	dy = d * Math.cos(angle - Math.PI);
	anims2.push(new AnimationLinear(
		[new Point(x-dx, y-dy), new Point(x-dx/4, y-dy/4)],
		0.8,
		0.2,
		colour2
	))
	anims2.push(new AnimationLinear(
		[new Point(x-dx/4, y-dy/4), new Point(x, y)],
		0.4,
		0.25,
		colour2
	))

	var a = new AnimationParallel([
		new AnimationSequence(anims1),
		new AnimationSequence(anims2)
	]);
	a.register();
}


function createEscapeAnimation(x, y, colour) {

	var d1 = 0.05;
	var d2 = 0.025
	var a = new AnimationSequence([
		new AnimationParallel([
			new AnimationLinear(
				[new Point(x, y), new Point(x, y+d1)],
				0.4,
				0.2,
				colourFromHSV(0, 0.1, 1.0)
			),
		]),
		new AnimationPause(0.1),
		new AnimationLinear(
			[new Point(x, y), new Point(x, y+d2)],
			0.015,
			0.03,
			colour
		),
	]);


	a.register();
}


dither = new AnimationInfniteDither(0.2, 0.7, colourFromHue(0));
dither.register();
dither = new AnimationInfniteDither(0.4, 0.7, colourFromHue(0.125));
dither.register();
dither = new AnimationInfniteDither(0.6, 0.7, colourFromHue(0.25));
dither.register();
dither = new AnimationInfniteDither(0.8, 0.7, colourFromHue(0.375));
dither.register();
dither = new AnimationInfniteDither(0.2, 0.4, colourFromHue(0.5));
dither.register();
dither = new AnimationInfniteDither(0.4, 0.4, colourFromHue(0.625));
dither.register();
dither = new AnimationInfniteDither(0.6, 0.4, colourFromHue(0.75));
dither.register();
dither = new AnimationInfniteDither(0.8, 0.4, colourFromHue(0.875));
dither.register();

document.addEventListener('mousedown', e => {

    let x = scaleByPixelRatio(e.offsetX) / canvas.width;
    let y = 1.0 - scaleByPixelRatio(e.offsetY) / canvas.height;
    //createNoiseAnimation(x, y, randomColour());
    createAttackAnimation(x, y, randomColour(), randomColour());
    //createEscapeAnimation(x, y, randomColour());
    return;

	let a = new AnimationParallel([
		new AnimationSequence([
			new AnimationLinear([new Point(0.2, 0), new Point(0.2, 0.4)], 1, 0.1),
			new AnimationPause(0),
			new AnimationLinear([new Point(0.2, 1), new Point(0.2, 0.6)], 1, 0.2)
		]),
		new AnimationSequence([
			new AnimationLinear([new Point(0.8, 0), new Point(0.8, 0.4)], 1, 0.3),
			new AnimationPause(0),
			new AnimationLinear([new Point(0.8, 1), new Point(0.8, 0.6)], 1, 0.3)
		])
	]);

	a.register();
});