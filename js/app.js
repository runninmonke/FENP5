'use strict'

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
	for (var item in data) {
		if (data.hasOwnProperty(item)){
			this[item] = data[item];
		}
	}
	this.active = ko.observable(true);
	this.status = ko.observable('deselected');

	var self = this;
	geocoder.geocode({'address': this.address}, function(results, status) {
		if (status == google.maps.GeocoderStatus.OK) {
			self.latLng = {'lat': results[0].geometry.location.lat(), 'lng': results[0].geometry.location.lng()};
			self.marker = new google.maps.Marker({
				position: self.latLng,
				map: map,
				title: self.name
			});
		}
	});
}

var map;
var geocoder;
var initMap = function() {
	map = new google.maps.Map(document.getElementById('map'), {
		center: neighborhood.center,
		zoom: 15
	});
	geocoder = new google.maps.Geocoder();
	mapReady();
};

var viewModel = function() {
	self = this;
	self.places = [];

	for (var i in locationData) {
		self.places.push(new Place(locationData[i]));
	}

	self.activePlaces = ko.computed(function() {
		var workingArray = [];
		for (var i in self.places) {
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
		var workingPlace = '';
		var workingSearchTerm = self.searchTerm().toLowerCase();
		for (var i in self.places) {
			workingPlace = self.places[i].name.toLowerCase();
			if (workingPlace.indexOf(workingSearchTerm) > -1) {
				self.places[i].active(true);
			} else {
				self.places[i].active(false);
			}
		}
	}
	self.searchTerm.subscribe(self.searchPlaces);
};


var mapReady = function() {
	ko.applyBindings(new viewModel());
};