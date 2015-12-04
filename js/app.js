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
	rental1: {
		name: "Rental 1",
		address: "1316 N 40th St, Omaha, NE 68131"
	},
	cathedral: {
		name: "St. Cecilia Cathedral",
		address: "701 N 40th St, Omaha, NE 68131"
	},
	homeyInn: {
		name: "The Homy Inn",
		address: "1510 N Saddle Creek Rd, Omaha, NE 68104"
	},
	lisas: {
		name: "Lisa's Radial Cafe",
		address: "817 N 40th St, Omaha, NE 68131"
	},
	brothers: {
		name: "Brothers",
		address: "3812 Farnam St, Omaha, NE 68131"
	},
	rental2: {
		name: "Rental 2",
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

	var selfPlace = this;
	/* Get info from geocoder and populate place properties with results and add a marker*/
	self.geocoder.geocode({address: this.address}, function(results, status) {
		if (status == google.maps.GeocoderStatus.OK) {
			selfPlace.latLng = results[0].geometry.location;
			selfPlace.placeId = results[0].place_id;
			selfPlace.marker = new google.maps.Marker({
				position: selfPlace.latLng,
				map: self.map,
				title: selfPlace.name
			});
			selfPlace.marker.addListener('click', function(){self.changePlace(selfPlace);});

	/* Search to see if Google Places has a place with a matching name, temporarily hold
	** the returned details, then replace with more detailed details from getDetails() */
			self.detailService.nearbySearch({location: selfPlace.latLng, radius: '100', name: selfPlace.name}, function(results, status){
				if (status == google.maps.places.PlacesServiceStatus.OK) {
					selfPlace.details = results[0];
					selfPlace.placeId = selfPlace.details.place_id;
					self.detailService.getDetails({placeId: selfPlace.placeId}, function(results, status){
						if (status == google.maps.places.PlacesServiceStatus.OK) {
							selfPlace.details = results;
						}
					});
				}
			});
		}

	});
}

var initMap = function() {
	var viewModel = function() {
		self = this;
		self.map = new google.maps.Map(document.getElementById('map'), {
			center: neighborhood.center,
			zoom: 14
		});
		self.geocoder = new google.maps.Geocoder();
		self.infoWindow = new google.maps.InfoWindow();
		self.detailService = new google.maps.places.PlacesService(self.map);

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
				self.selectedPlace().marker.setAnimation(null);
				if (place === self.selectedPlace()) {
					self.selectedPlace = ko.observable();
					self.infoWindow.close();
					return;
				}
			}
			self.selectedPlace(place);
			self.selectedPlace().status('selected');
			self.selectedPlace().marker.setAnimation(google.maps.Animation.BOUNCE);
			self.infoWindow.setContent(self.selectedPlace().name);
			self.infoWindow.open(self.map, self.selectedPlace().marker)

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
					self.places[i].marker.setMap(self.map);
				} else {
					self.places[i].active(false);
					self.places[i].marker.setMap(null);
				}
			}
		}
		self.searchTerm.subscribe(self.searchPlaces);
	};

	ko.applyBindings(new viewModel());
};