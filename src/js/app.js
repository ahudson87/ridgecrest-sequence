var	vizHolder = document.querySelector('#vizHolder'),
		request = new XMLHttpRequest(),
		datapath = '../data/data.json',
		padding = 40,
		height,
		width,
		data;

//Data fetch
request.open('GET', datapath, true);
request.onload = function() {
	if (request.status >= 200 && request.status < 400) {
		console.log('Data received');
		data = JSON.parse(request.responseText);
		init();
	} else { console.log('Reached our target server, but it returned an error'); }
};
request.onerror = function() { console.log('There was a connection error of some sort'); };
request.send();


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

function init() {
	drawViz();

	window.addEventListener('resize', debounce( function(){
		drawViz();
	} ), 250);
}

function drawViz() {
	//Configure size, dump any existing SVG/elements (mainly for resize function)
	height = vizHolder.offsetHeight;
	width = vizHolder.offsetWidth;
	d3.select(vizHolder).selectAll("*").remove();

	//Draw it all
	var n = d3.max(d3.values(data.dataset)) + 10;

	var xScale = d3.scaleLinear()
		.domain([0, n])
		.range([0, width - (padding * 2)]);

	var yScale = d3.scaleLinear()
		.domain([0, n])
		.range([height - (padding * 2), 0]);

	var rScale = d3.scaleLinear()
		.domain([0, n])
		.range([5, 40]);

	var svg = d3.select(vizHolder)
				.append('svg')
				.attr('height', height)
				.attr('width', width);

	var viz = svg.append('g')
				.attr('id', 'viz')
				.attr('transform', 'translate(' + padding + ', ' + padding + ')');

	viz.append("g")
		.attr("class", "x axis")
		.attr("transform", "translate(0," + (height - (padding * 2)) + ")")
		.call(d3.axisBottom(xScale));

	viz.append("g")
		.attr("class", "y axis")
		.call(d3.axisLeft(yScale));

	var circles = viz.selectAll("circle")
		.data(data.dataset)
		.enter()
		.append("circle")
		.attr('r', function(d, i){
			return rScale(d)
		})
		.attr('cx', function(d, i){
			return xScale(d)
		})
		.attr('cy', function(d, i){
			return yScale(d)
		});
}