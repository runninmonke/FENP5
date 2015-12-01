var neighborhood = {
	name: "Midtown",
	center: {
		lat: 41.263218,
		lng: -95.987867
	},
	locality: "Omaha, NE"
};
var locationData = {
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

var Place = function(data) {
	for (item in data) {
		if (data.hasOwnProperty(item)){
			this[item] = data[item];
		}
	}
	this.active = ko.observable(true);
	this.status = ko.observable('deselected');
	//TODO marker();
	//TODO latLong();
}

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
	self.places = [];

	for (i in locationData) {
		self.places.push(new Place(locationData[i]));
	}


	self.activePlaces = ko.computed(function() {
		var workingArray = [];
		for (i in self.places) {
			if (self.places[i].active()) {
				workingArray.push(self.places[i]);
			}
		}
		return workingArray;
	});

	self.selectedPlace = ko.observable();
	self.changePlace = function(place) {
		if (typeof self.selectedPlace() == 'object') {
			self.selectedPlace().status('deselected');
			if (place === self.selectedPlace()) {
				self.selectedPlace = ko.observable();
				return;
			}
		}
		self.selectedPlace(place);
		self.selectedPlace().status('selected');
	}

	self.searchTerm = ko.observable("");
	self.searchTerm.extend({ rateLimit: { timeout: 400, method: "notifyWhenChangesStop" } });
	self.searchPlaces = function() {
		//TODO Progam function to make only places that contain the search term be set to active
	}
	self.searchTerm.subscribe(self.searchPlaces);
};


var mapReady = function() {
	ko.applyBindings(new viewModel());
};