var neighborhood = {
	name: "Midtown",
	center: {
		lat: 41.263218,
		lng: -95.987867
	},
	locality: "Omaha, NE"
};
var places = {
	home: {
		name: "Home",
		address: "1316 N 40th St, Omaha, NE 68131"
	},
	cathedral: {
		name: "St. Cecilia's Catherdral",
		address: "701 N 40th St, Omaha, NE 68131"
	},
	homeyInn: {
		name: "The Homey Inn",
		address: "1510 N Saddle Creek Rd, Omaha, NE 68104"
	},
	lisas: {
		name: "Lisa's Radial Cafe",
		address: "817 N 40th St, Omaha, NE 68131"
	},
	brothers: {
		name: "Brother's Lounge",
		address: "3812 Farnam St, Omaha, NE 68131"
	},
	rental: {
		name: "Rental Property",
		address: "1037 N 33rd St, Omaha, NE 68131"
	}
};

var map;
var initMap = function() {
	map = new google.maps.Map(document.getElementById('map'), {
		center: neighborhood.center,
		zoom: 15
	});
	mapReady();
};

var marker;
var addMarker = function(){
		var marker = new google.maps.Marker({
			position: map.center,
			map: map,
			title: 'Center'
	});
	return marker;
};

var getLatLong = function(address) {
	google.maps.Geocoder.geocode();
};

var viewModel = function() {
	self = this;
	var workingArray = [];
	for (i in places) {
		workingArray.push(places[i]);
	}
	self.activePlaces = ko.observableArray(workingArray);
	console.log(workingArray, self.activePlaces());
};


var mapReady = function() {
	ko.applyBindings(new viewModel());
};