

function Point(x, y) {
	this.x = x;
	this.y = y;
	this.distance_to = function (other) {
		var dx = this.x - other.x;
		var dy = this.y - other.y;
		return Math.sqrt(dx*dx + dy*dy);
	}
}


function AnimationLinear(points, speed, radius, colour) {
	this.points = points;
	this.speed = speed;
	this.radius = radius;

	this.pointer = new pointerPrototype()
    this.pointer.color = colour;
	this.pointer.down = true;
	this.pointer.moved = true;
    this.pointer.radius = radius;

	this.registered = false;

    this.segment_lengths = [];
    for (var i = 0; i < points.length - 1; i++) {
    	this.segment_lengths.push(
    		points[i].distance_to(points[i+1])
    	);
    }

    this.reset = function() {
		this.current_point = 0;
		this.current_progress = 0.0;
		this.finished = false;

	    this.pointer.texcoordX = points[0].x;
	    this.pointer.texcoordY = points[0].y;
	    this.pointer.prevTexcoordX = this.pointer.texcoordX;
	    this.pointer.prevTexcoordY = this.pointer.texcoordY;
	    this.pointer.deltaX = 0;
	    this.pointer.deltaY = 0;
    }
    this.reset();

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
    	CURRENT_ANIMATIONS.add(this);
    	pointers.add(this.pointer);
    	this.registered = true;
    }

    this.unregister = function() {
    	if (pointers.has(this.pointer))
	    	pointers.delete(this.pointer);
	    if (CURRENT_ANIMATIONS.has(this))
	    	CURRENT_ANIMATIONS.delete(this);
	    this.registered = false;
    }

}


function AnimationPause(T) {
	this.T = T;
	this.registered = false;

	this.reset = function() {
		this.t = 0.0;
		this.finished = (T <= 0);
	}
	this.reset();

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

    this.register = () => {
    	CURRENT_ANIMATIONS.add(this);
    	this.registered = true;
    }
    this.unregister = () => {
    	if (CURRENT_ANIMATIONS.has(this))
	    	CURRENT_ANIMATIONS.delete(this);
    	this.registered = false;
    }
}


function AnimationSequence(children) {
	this.children = children;
	this.registered = false;

	this.reset = function () {
		this.current = -1;
		this.finished = (children.length == 0);
		for (child of this.children) {
			if (child.registered)
				child.unregister();
			child.reset();
		}
	}
	this.reset()

	this.step = function(dt) {
		if (this.finished) {
			this.unregister();
			return;
		}

		if (this.current == -1 || this.children[this.current].finished) {
			this.current += 1;
			if (this.current == this.children.length) {
				this.finished = true;
				return;
			}
			this.children[this.current].register();
		}
	}

    this.register = function() {
    	CURRENT_ANIMATIONS.add(this);
    	this.registered = true;
    } 
    this.unregister = () => {
    	if (CURRENT_ANIMATIONS.has(this))
	    	CURRENT_ANIMATIONS.delete(this);
	    if (!this.finished) {
	    	for (child of this.children) {
	    		if (child.registered) {
	    			child.unregister();
	    		}
	    	}
	    }
    	this.registered = false;
    }
}


function AnimationParallel(children) {
	this.children = children;
	this.registered = false;

	this.reset = function() {
		this.finished = (children.length == 0);
		for (child of this.children) {
			if (this.registered && !child.registered) {
				child.register();
			}
			child.reset();
		}
	}
	this.reset();

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
    	CURRENT_ANIMATIONS.add(this);
		this.children.forEach(c => c.register());
		this.registered = true;
    } 
    this.unregister = () => {
    	if (CURRENT_ANIMATIONS.has(this))
	    	CURRENT_ANIMATIONS.delete(this);
	    if (!this.finished) {
	    	for (child of this.children) {
	    		if (child.registered) {
	    			child.unregister()
	    		}
	    	}
	    }
	    this.registered = false;
    }
}


function AnimationLoop(animation, repetitions=-1) {
	this.animation = animation;
	this.repetitions = repetitions;
	this.infinite = (this.repetitions == -1);
	this.finished = false;

	this.reset = function() {
		this.animation.reset();
		if (this.infinite) return;
		this.finished = (this.repetitions == 0);
		this.count = 0;
	}

	this.register = function() {
		CURRENT_ANIMATIONS.add(this);
		this.animation.register();
		this.registered = true;
	}

	this.unregister = function() {
		if (CURRENT_ANIMATIONS.has(this))
			CURRENT_ANIMATIONS.delete(this);
		if (this.animation.registered)
			this.animation.unregister()
		this.registered = false;
	}

	this.step = function() {
		if (!this.animation.finished || this.animation.registered) 
			return;
		if (this.infinite || ++this.count < this.repetitions) {
			this.animation.reset();
			this.animation.register();
		} else if (this.count >= this.repetitions) {
			this.finished = true;
			this.unregister();
		}
	}
}


function AnimationCharacterDither(x, y, colour) {
	this.x = x;
	this.y = y;
	this.colour = colour;
	this.finished = false;
	this.registered = false;
	this.animation = new AnimationPause(0.0001);

	this.reset = () => {};

	this.register = function() {
		this.animation.register()
		CURRENT_ANIMATIONS.add(this);
		this.registered = true;
	}

	this.unregister = function() {
		if (CURRENT_ANIMATIONS.has(this))
			CURRENT_ANIMATIONS.delete(this);
		if (CURRENT_ANIMATIONS.has(this.animation)) {
			this.animation.unregister();
		}
		this.registered = false;
	}

	this.step = function (dt) {
		if (!this.animation.finished) 
			return;

		var n = 1 + Math.ceil(Math.random() * 7);
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
			new AnimationPause(Math.random() * 0.2)
		])
		this.animation.register();
	}
}



function AnimationGhostMouse(colour, name) {
	this.speed = 0.6;
	this.radius = 0.00025;
	this.dead_zone = this.radius;

	this.targetX = 0.5;
	this.targetY = 0.5;

	this.colour = colour;
	this.name = name;
	this.pointer = new pointerPrototype()
	this.pointer.color = colour;
	this.pointer.down = true;
	this.pointer.moved = true;
	this.pointer.radius = this.radius;
	this.max_force = config.SPLAT_FORCE * 90;
	this.min_force = 0;

	this.registered = false;

	this.reset = () => {};

	this.setTarget = function(X, Y) {
		this.targetX = X;
		this.targetY = Y;
	};

	this.step = function(dt) {

		var colourScale = Math.random();
		this.pointer.color = {
			r: this.colour.r * colourScale,
			g: this.colour.g * colourScale,
			b: this.colour.b * colourScale,
		}

		this.pointer.prevTexcoordX = this.pointer.texcoordX;
		this.pointer.prevTexcoordY = this.pointer.texcoordY;

		var dX = correctDeltaX(this.targetX - this.pointer.texcoordX);
		var dY = correctDeltaY(this.targetY - this.pointer.texcoordY);
		var d = Math.sqrt(dX*dX + dY*dY);
		if (d < this.dead_zone) {
			this.pointer.texcoordX = this.targetX;
			this.pointer.texcoordY = this.targetY;
			return;
		}
		this.pointer.moved = this.name != player_name || holding_breath;

		let maxSpeed = this.speed * dt;
		if (d <= maxSpeed) {
			this.pointer.texcoordX = this.targetX;
			this.pointer.texcoordY = this.targetY;
			this.pointer.deltaX = dX;
			this.pointer.deltaY = dY;
		} else {
			let frac = maxSpeed / d;
			this.pointer.texcoordX += frac * dX * Math.random() * 2;
			this.pointer.texcoordY += frac * dY * Math.random();
			this.pointer.deltaX = correctDeltaX(this.pointer.texcoordX - this.pointer.prevTexcoordX);
			this.pointer.deltaY = correctDeltaY(this.pointer.texcoordY - this.pointer.prevTexcoordY);
		}
		
		let frac = 0.2 * d / maxSpeed;
		if (frac > 1) {
			this.pointer.force = this.max_force;
		} else {
			this.pointer.force = this.max_force * frac + this.min_force * (1 - frac);
		}
		
	}

	this.register = function() {
		CURRENT_ANIMATIONS.add(this);
		pointers.add(this.pointer);
		this.registered = true;
	}

	this.unregister = function() {
		if (pointers.has(this.pointer))
			pointers.delete(this.pointer);
		if (CURRENT_ANIMATIONS.has(this))
			CURRENT_ANIMATIONS.delete(this);
		this.registered = false;
	}

}


function createAnimationSpiral(
	x, y, colour, speed, rad,
	steps, 
	start_r, end_r, 
	start_theta, end_theta,
	dither=0.01
) {
	var points = [];
	var theta = start_theta;
	var r = start_r;
	var d_theta = (end_theta - start_theta) / (steps - 1);
	var d_r = (end_r - start_r) / (steps - 1);

	for (var i = 0; i < steps; ++i) {
		points.push(
			new Point(
				x + r * Math.sin(theta) + dither * (Math.random() * 2 - 1),
				y + r * Math.cos(theta) + dither * (Math.random() * 2 - 1)
			)
		);
		r += d_r;
		theta += d_theta;
	}

	return new AnimationLinear(points, speed, rad, colour);
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
			0.01 + 0.06 * Math.random(),
			colour1
		))
		anims1.push(new AnimationPause(0.06 * Math.random()));
	}

	var anims2 = [];
	anims2.push(new AnimationPause(0.4 + 0.5 * Math.random()));

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

function createCharacterSelectAnimation(x, y, colour) {

	var n = 2 + Math.random() * 5;
	var puffs = [];
	for (var i=0; i<n; ++i) {
		var speed = 0.1 + 0.3 * Math.random();
		var d = 0.015 + 0.03 * Math.random();
		var theta = Math.PI * 2 * Math.random();
		var rad = 0.005 + 0.03 * Math.random();

		var dx = d * Math.sin(theta);
		var dy = correctRadius(d * Math.cos(theta));

		puffs.push(new AnimationLinear(
			[new Point(x, y), new Point(x+dx, y+dy)],
			speed, rad, colour
		))
	}
	a = new AnimationParallel(puffs);
	a.register();
}


function gameStartAnimation(char_opts) {
	var speed = 0.6;
	var rad = 0.06;
	var steps = 70;
	var start_r = 0.0;
	var end_r = 0.3;
	var rotations = 1.5;

	var spirals = [];
	for (var i = 0; i < COLOURS.length; ++i) {
		var opt = char_opts[i];

		var start_theta = Math.random() * 2 * Math.PI;
		var end_theta = rotations * ((Math.random() > 0.5) * 2 - 1) * (Math.PI * 2) + start_theta;

		spirals.push(createAnimationSpiral(
			x=opt.x, 
			y=opt.y, 
			colour=COLOURS[i],
			speed=speed, 
			rad=rad,
			steps=steps, 
			start_r=start_r, end_r=end_r, 
			start_theta=start_theta, end_theta=end_theta
		));
	}

	(new AnimationParallel(spirals)).register();
}


function createLobbyCurrentsAnimation() {
	var rad = 0.6;
	var speed = 0.01;
	var colour = colourFromHSV(0, 0, 0);

	return new AnimationLoop(
		new AnimationParallel([
			new AnimationLinear(
				[new Point(0.9, 0.9), new Point(0.1, 0.9), new Point(0.9, 0.9)],
				speed, rad, colour
			),
			new AnimationLinear(
				[new Point(0.1, 0.5), new Point(0.9, 0.5), new Point(0.1, 0.5)],
				speed, rad, colour
			),
			new AnimationLinear(
				[new Point(0.5, 0.1), 
				 new Point(0.1, 0.1), 
				 new Point(0.9, 0.1),
				 new Point(0.5, 0.1)],
				speed, rad, colour
			),
		])
	);
}

document.addEventListener('mousedown', e => {

    let x = scaleByPixelRatio(e.offsetX) / canvas.width;
    let y = 1.0 - scaleByPixelRatio(e.offsetY) / canvas.height;
    //createNoiseAnimation(x, y, randomColour());
    // createAttackAnimation(x, y, randomColour(), randomColour());
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


var animation_handlers = {};
socket.on('do_animation', params => {
	if (player_name == null) return;
	if (!params.type in animation_handlers) {
		console.log('Unhandled animation request:' + params.type);
		return;
	}
	animation_handlers[params.type](params);
});