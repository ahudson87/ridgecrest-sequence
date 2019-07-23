// https://bl.ocks.org/Niekes/1c15016ae5b5f11508f92852057136b5

var j = 6.5,
	startAngle = Math.PI/5,
	startAngleY = startAngle,
	startAngleX = -startAngle / 5,
	timeUnit = 1/60/60, // Convert playback scale to hours
	bgAppended = false;

// Uninitialized variables
var quakeData,
	faultData,
	data,
	targetMag,
	magFloor,
	viz,
	timeline,
	playhead,
	grid3d,
	point3d,
	width;

var scale2d = {
	x: null,
	z: null,
	depth: null,
	color: null,
	mag: null,
	time: null
}

var scale3d = {
	x: null,
	y: null,
	z: null
}

var orbit = {
	alpha: 0,
	beta: 0,
	mx: null,
	my: null,
	mouseX: null,
	mouseY: null
}


function generateBounds() {
	xFloor = d3.min(quakeData, function(d) { return + d.x;});
	xCeil = d3.max(quakeData, function(d) { return + d.x;});

	zFloor = d3.min(quakeData, function(d) { return + d.z;});
	zCeil = d3.max(quakeData, function(d) { return + d.z;});

	xMean = d3.mean(quakeData, function(d) { return + d.x;});
	zMean = d3.mean(quakeData, function(d) { return + d.z;});

	yFloor = d3.min(quakeData, function(d) { return + d.y;});
	yCeil = d3.max(quakeData, function(d) { return + d.y;});

	magFloor = d3.min(quakeData, function(d) { return + d.mag;});
	magCeil = d3.max(quakeData, function(d) { return + d.mag;});

	timeFloor = d3.min(quakeData, function(d) { return + d.time;});
	timeCeil = d3.max(quakeData, function(d) { return + d.time;});

	absX = Math.abs(xFloor - xCeil);
	absZ = Math.abs(zFloor - zCeil);
	absY = Math.abs(yFloor - yCeil);
	largerAbs = Math.max(absX, absZ);

	rangeYRatio = absY / largerAbs;
	yScaleMax = (j * 2 - 1) * rangeYRatio;
	gridEdgeBuffer = Math.max(xMean, zMean);
}


function debounce(func, wait, immediate) {
	let timeout;
	return function() {
		const context = this, args = arguments;
		const later = function() {
			timeout = null;
			if (!immediate) func.apply(context, args);
		};
		const callNow = immediate && !timeout;
		clearTimeout(timeout);
		timeout = setTimeout(later, wait);
		if (callNow) func.apply(context, args);
	};
};


var start = null;
var progress = null;
var endtime = 20000;
function step(timestamp) {
	if (!start) start = timestamp;
		progress = timestamp - start;
		// console.log(progress);
		updateDataArray();
		movePlayhead();
	if (progress < endtime) {
		window.requestAnimationFrame(step);
	}
}


// Re-initialize visualization on window resize (debounced)
window.addEventListener('resize', debounce( function(){ init(0); } ), 250);

function init(dur) {
	start = null;
	progress = null;

	var vizHolder	= document.querySelector('#vizHolder'),
		durAnimIn = dur;

	height = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
	width = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
	var	scale	= Math.min(width * 0.045, 50);

	//Little bit of magic to get best visual center, offset 300px from top
	var origin = [width/1.86, 300],
		cnt = 0,
		colorScaleLight = "#FFE933",
		colorScaleDark = "#D60041";

	// Dump everything before initializing
	d3.select(vizHolder).selectAll("*").remove();

	targetMag = d3.min(quakeData, function(d) { return + d.mag;});

	// Programmatically rotate around centerpoint of dynamic grid
		// **TODO: Extend this for X/Z axes as well
	var rotateCenter = [-1, (yScaleMax / 2) ,0];

	var svg = d3.select(vizHolder)
				.append('svg')
				.attr('height', height)
				.attr('width', width)

	viz = svg.append('g')
				.attr('id', 'viz');

	timeline = svg.append('g')
			.attr('id', 'timeline')
			.attr("transform", "translate(0," + (height - 200) + ")")
	timelinePlayback(width);

	grid3d = d3._3d()
		.shape('GRID', j*2)
		.origin(origin)
		.rotateY( startAngleY)
		.rotateX( startAngleX)
		.scale(scale)
		.rotateCenter(rotateCenter)
		.y(function(){
			return scale2d.depth(0)
		});

	point3d = d3._3d()
		.x(function(d){ return d.x; })
		.y(function(d){ return d.y; })
		.z(function(d){ return d.z; })
		.origin(origin)
		.rotateY( startAngleY)
		.rotateX( startAngleX)
		.scale(scale)
		.rotateCenter(rotateCenter);

	scale3d.y = d3._3d()
		.shape('LINE_STRIP')
		.origin(origin)
		.scale(scale)
		.rotateCenter(rotateCenter);

	scale3d.x = d3._3d()
		.shape('LINE_STRIP')
		.origin(origin)
		.rotateY( startAngleY)
		.rotateX( startAngleX)
		.scale(scale)
		.rotateCenter(rotateCenter)
		.y(function(){
			return scale2d.depth(0)
		});

	scale3d.z = d3._3d()
		.shape('LINE_STRIP')
		.origin(origin)
		.rotateY( startAngleY)
		.rotateX( startAngleX)
		.scale(scale)
		.rotateCenter(rotateCenter)
		.y(function(){
			return scale2d.depth(0)
		});

	scale3d.fault = d3._3d()
		.shape('PLANE')
		.origin(origin)
		.rotateY( startAngleY)
		.rotateX( startAngleX)
		.scale(scale)
		.rotateCenter(rotateCenter)


	scale2d.x = d3.scaleLinear()
		.domain([xFloor - gridEdgeBuffer, xCeil + gridEdgeBuffer])
		.range([-j, j - 1]);

	scale2d.z = d3.scaleLinear()
		.domain([zFloor - gridEdgeBuffer, zCeil + gridEdgeBuffer])
		.range([-j, j - 1]);



	//Modify outpute range of radii based on viewport size
	var magModifier = scale / 50;
	scale2d.mag = d3.scaleLinear()
		.domain([magFloor, 10])
		.range([2 * magModifier, 25 * magModifier]);


	scale2d.time = d3.scaleLinear()
		.domain([timeFloor, timeCeil])
		.range([0, endtime]);



	//Build scale for depth
	var yScaleMin = 0;
	scale2d.depth = d3.scaleLinear()
		.domain([yFloor, yCeil])
		.range([yScaleMin, yScaleMax]);

	scale2d.color = d3.scaleLinear()
		.domain([yFloor, yCeil])
		.range([colorScaleLight, colorScaleDark]);

	xGrid = [], scatter = [], yLine = [], xLine = [], zLine = [], faultPlane = [];
	for(var z = -j; z < j; z++){
		for(var x = -j; x < j; x++){
			xGrid.push([x, 1, z]);
			while (cnt < quakeData.length) {
				scatter.push({
					x:		scale2d.x(quakeData[cnt].x),
					y:		scale2d.depth(quakeData[cnt].y),
					z:		scale2d.z(quakeData[cnt].z),
					mag:	quakeData[cnt].mag,
					time: quakeData[cnt].time,
					id:		'point_' + cnt++
				});
			}
		}
	}

	var yScaleBuffer	= 0.75;
	d3.range(yScaleMin, yScaleMax + yScaleBuffer, 0.8)
		.forEach(function(d) {
			yLine.push([-j, d, -j]);
		});

	d3.range(scale2d.x(xFloor), scale2d.x(xCeil), 1)
		.forEach(function(d) {
			xLine.push([d, 0, -j]);
		});

	d3.range(scale2d.z(zFloor), scale2d.z(zCeil), 1)
		.forEach(function(d) {
			zLine.push([-j, 0, d]);
		});

	// **TODO: Get real fault data into fault-data.json
	faultData.forEach(function(point){
		var arr = [scale2d.x(point.x), scale2d.depth(point.y), scale2d.z(point.z)];
		faultPlane.push(arr);
	});



	window.requestAnimationFrame(step);
}

function processData(data, tt) {
	var key	= function(d){ return d.id; };

	/* ----------- GRID ----------- */
	var xGrid = viz.selectAll('path.grid').data(data[0], key);

	xGrid.enter()
			.append('path')
			.attr('class', '_3d grid grid-panel')
			.merge(xGrid)
			.attr('d', grid3d.draw);


	xGrid.exit().remove();

	/* ----------- POINTS ----------- */
	// Filter data based on time/progress, building array over time
	var currentData = data[1].filter(quake => quake.time <= scale2d.time.invert(progress));
	var points = viz.selectAll('circle').data(currentData, key);
	points.enter()
			.append('circle')
			.attr('class', '_3d quake-point')
			.attr('cx', posPointX)
			.attr('cy', posPointY)
			.attr('r', magPoint)
			.attr('fill', function(d){
				return scale2d.color(scale2d.depth.invert(d.y));
			})
			.merge(points)
			.attr('cx', posPointX)
			.attr('cy', posPointY);

	points.exit().transition().style('opacity', 0).duration(250).delay(500).remove();

	/* ----------- Fault Plane ----------- */
	var faultPlane = viz.selectAll('path.fault').data(data[3]);
	faultPlane.enter()
			.append('path')
			.attr('class', '_3d fault')
			.merge(faultPlane)
			.attr('d', scale3d.fault.draw);

	faultPlane.exit().remove();

	/* ----------- y-Scale ----------- */
	var yScale = viz.selectAll('path.yScale').data(data[2].y);
	yScale.enter()
			.append('path')
			.attr('class', '_3d yScale')
			.merge(yScale)
			.attr('d', scale3d.y.draw);

	yScale.exit().remove();

	/* ----------- y-Scale Text ----------- */
	var yText = viz.selectAll('text.yText').data(data[2].y[0]);

	yText.enter()
			.append('text')
			.attr('class', '_3d yText')
			.attr('dx', '-1em')
			.attr('text-anchor', 'end')
			.merge(yText)
			.each(function(d){
				d.centroid = {x: d.rotated.x, y: d.rotated.y, z: d.rotated.z};
			})
			.attr('x', function(d){
				return d.projected.x;
			})
			.attr('y', function(d){
				return d.projected.y;
			})
			.text(function(d){
				//Round and invert Y labels
				return -(Math.round(scale2d.depth.invert(d[1]) / 1000 * 10) / 10);
			});

	yText.exit().remove();


	// Debugging scale relativity
		// Should remove all calculations if we don't want to display
	/* ----------- x-Scale Text ----------- */
	var xText = viz.selectAll('text.xText').data(data[2].x[0]);

	xText.enter()
			.append('text')
			.attr('class', '_3d xText')
			.attr('dy', '-1em')
			.attr('text-anchor', 'middle')
			.style('display', function(){
				return isRangeVisible(document.querySelector('#showRangeX')) ? 'block' : 'none';
			})
			.merge(xText)
			.each(function(d){
				d.centroid = {x: d.rotated.x, y: d.rotated.y, z: d.rotated.z};
			})
			.attr('x', function(d){
				return d.projected.x;
			})
			.attr('y', function(d){
				return d.projected.y;
			})
			.text(function(d){
				//Round and invert X labels
				return (Math.round(scale2d.x.invert(d[0]) / 1000 * 10) / 10);
			});

	xText.exit().remove();

	// Debugging scale relativity
		// Should remove all calculations if we don't want to display
	/* ----------- z-Scale Text ----------- */
	var zText = viz.selectAll('text.zText').data(data[2].z[0]);

	zText.enter()
			.append('text')
			.attr('class', '_3d zText')
			.attr('dy', '-1em')
			.attr('text-anchor', 'end')
			.style('display', function(){
				return isRangeVisible(document.querySelector('#showRangeZ')) ? 'block' : 'none';
			})
			.merge(zText)
			.each(function(d){
				d.centroid = {x: d.rotated.x, y: d.rotated.y, z: d.rotated.z};
			})
			.attr('x', function(d){
				return d.projected.x;
			})
			.attr('y', function(d){
				return d.projected.y;
			})
			.text(function(d){
				//Round and invert Z labels
				return (Math.round(scale2d.z.invert(d[2]) / 1000 * 10) / 10);
			});

	zText.exit().remove();

	d3.selectAll('._3d').sort(d3._3d().sort);

	// Apply orbit controls to an overlay for better UI with playhead controls
		// Has to happen after grid is drawn
		// Just do it once since grid draws every frame
	if (!bgAppended) {
		viz.append('rect')
		.attr('x', 0)
		.attr('y', 0)
		.attr('height', height)
		.attr('width', width)
		.attr('class', 'viz-hit')
		.call(d3.drag()
			.on('drag', dragged)
			.on('start', dragStart)
			.on('end', dragEnd));

		bgAppended = true;
	}
}


function timelinePlayback(width) {
	timelinePadding = width * .1;
	scale2d.timeline = d3.scaleLinear()
		.domain([timeFloor * timeUnit, timeCeil * timeUnit])
		.range([0, width - timelinePadding * 2]);

	var axisTime = d3.axisBottom(scale2d.timeline);
	var timelinebgPad = timelinePadding * 0.2;
	timeline.append('rect')
			.attr('x', timelinePadding - timelinebgPad)
			.attr('y', -35)
			.attr('height', 100)
			.attr('width', width - (timelinePadding * 2) + (timelinebgPad * 2))
			.attr('class', 'timeline-bg')
	timeline.append('text')
				.text('Hours from primary event')
				.attr('x', width / 2)
				.attr('y', '50')
				.attr('text-anchor', 'middle')
	timeline.append('g')
			.attr("id", "timeAxis")
			.attr('transform', 'translate(' + timelinePadding + ', 0)')
			.call(axisTime);

	playhead = timeline.append('g')
							.attr('id', 'playhead')
	playhead.append('path').attr('d', 'M5,21.38a1.5,1.5,0,0,1-1.15-.54l-3-3.6a1.5,1.5,0,0,1-.35-1V3A2.5,2.5,0,0,1,3,.5H7A2.5,2.5,0,0,1,9.5,3V16.28a1.5,1.5,0,0,1-.35,1l-3,3.6A1.5,1.5,0,0,1,5,21.38Z')
					.attr('class', 'playhead-body')
	playhead.append('path').attr('d', 'M3,7.5H7')
					.attr('class', 'playhead-stroke')
	playhead.append('path').attr('d', 'M3,9.5H7')
					.attr('class', 'playhead-stroke')
	playhead.append('path').attr('d', 'M3,11.5H7')
					.attr('class', 'playhead-stroke')
}

function movePlayhead(){
	var playheadW = 10;
	var hoursElapsed = scale2d.time.invert(progress) * timeUnit;
	var playheadPosX = (timelinePadding - (playheadW/2)) + scale2d.timeline(hoursElapsed);
	var playheadPosY = -30;
	playhead.attr('transform', 'translate(' + playheadPosX + ', ' + playheadPosY + ')')
}

function posPointX(d) { return d.projected.x; }
function posPointY(d) { return d.projected.y; }
function magPoint (d) { return scale2d.mag(d.mag); }

function dragStart(){
	orbit.mx = d3.event.x;
	orbit.my = d3.event.y;
}

function dragged(){
	orbit.mouseX = orbit.mouseX || 0;
	orbit.mouseY = orbit.mouseY || 0;
	orbit.beta   = (d3.event.x - orbit.mx + orbit.mouseX) * Math.PI / 230 ;
	orbit.alpha  = (d3.event.y - orbit.my + orbit.mouseY) * Math.PI / 230  * (-1);
	updateDataArray();
}

function updateDataArray() {
	var axes = {
		x: scale3d.x.rotateY(orbit.beta + startAngleY).rotateX(orbit.alpha + startAngleX)([xLine]),
		y: scale3d.y.rotateY(orbit.beta + startAngleY).rotateX(orbit.alpha + startAngleX)([yLine]),
		z: scale3d.z.rotateY(orbit.beta + startAngleY).rotateX(orbit.alpha + startAngleX)([zLine])
	};
	var fault = scale3d.fault.rotateY(orbit.beta + startAngleY).rotateX(orbit.alpha + startAngleX)([faultPlane])
	data = [
		grid3d.rotateY(orbit.beta + startAngleY).rotateX(orbit.alpha + startAngleX)(xGrid),
		point3d.rotateY(orbit.beta + startAngleY).rotateX(orbit.alpha + startAngleX)(scatter),
		axes,
		fault
	];
	processData(data, 0);
}

function dragEnd(){
	orbit.mouseX = d3.event.x - orbit.mx + orbit.mouseX;
	orbit.mouseY = d3.event.y - orbit.my + orbit.mouseY;
}



// UI Operations
var magInput = document.querySelector('#magInput');
var btnViewBottom = document.querySelector('#btnViewBottom');
var btnViewFront = document.querySelector('#btnViewFront');
var btnReplay = document.querySelector('#btnReplay');
var toggleRanges = document.querySelectorAll('[data-range]');

btnViewBottom.addEventListener('click', rBottom);
btnViewFront.addEventListener('click', rFront);

btnReplay.addEventListener('click', function(){
	init(0);
});

magInput.addEventListener('change', function(e){
	if (magInput.value < magInput.min) { magInput.value = magInput.min; }
	fetchQuakeData(magInput.value);
});

toggleRanges.forEach(function(range){
	range.addEventListener('change', function(e) {
		handleToggleRange(e.target)
	});
});

function handleToggleRange(target) {
	var targetClass = '.' + target.dataset.range + 'Text';
	if (isRangeVisible(target)) {
		document.querySelectorAll(targetClass).forEach(function(el){
			el.style.display = "block";
		});
	} else {
		document.querySelectorAll(targetClass).forEach(function(el){
			el.style.display = "none";
		});
	}
}

function isRangeVisible(el) { return el.checked; }

//Quick debug to rotate to visual bottom
function rBottom() {
	orbit.alpha  = 1.6937282132397145;
	orbit.beta   = -0.6283185307179586;
	updateDataArray();
}

//Quick debug to rotate to visual bottom
function rFront() {
	orbit.alpha  = 0.12293188644481799;
	orbit.beta   = -0.6283185307179586;
	updateDataArray();
}

//Data fetch
fetchQuakeData(magInput.value);
function fetchQuakeData(targetMag){
	var request	= new XMLHttpRequest(),
			datapath	= './data.json';
	request.open('GET', datapath, true);
	request.onload = function() {
		if (request.status >= 200 && request.status < 400) {
			console.log('Quake data received');
			quakeData = JSON.parse(request.responseText).quakes;
			// Get max/min bounds for all datapoints from full dataset
			generateBounds();

			// Limit active dataset based on GUI input
			quakeData = quakeData.filter(function(quake) {
				return quake.mag >= targetMag;
			});


			fetchFaultData();
		} else { console.log('Reached our target server, but it returned an error'); }
	};
	request.onerror = function() { console.log('There was a connection error of some sort'); };
	request.send();
}


function fetchFaultData(targetMag){
	var request	= new XMLHttpRequest(),
			datapath	= './fault-data.json';
	request.open('GET', datapath, true);
	request.onload = function() {
		if (request.status >= 200 && request.status < 400) {
			console.log('Fault data received');
			faultData = JSON.parse(request.responseText).fault;

			if (quakeData.length > 1) {
				init(1000);
			} else { alert("Only one or fewer earthquake events found. This visualization requires at least two events. Please lower minimum magnitude"); }


		} else { console.log('Reached our target server, but it returned an error'); }
	};
	request.onerror = function() { console.log('There was a connection error of some sort'); };
	request.send();
}