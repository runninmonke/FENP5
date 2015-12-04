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
	/* Get info from geocoder and call function to populate properties with results and add a marker*/
	geocoder.geocode({address: this.address}, function(results, status) {selfPlace.applyGeocode(results, status);});

}

/* Populate properties with Geocoderesults, add a marker and try to get additional details*/
Place.prototype.applyGeocode = function(results, status) {
	var selfPlace = this;
	if (status == google.maps.GeocoderStatus.OK) {
		this.latLng = results[0].geometry.location;
		this.placeId = results[0].place_id;
		this.marker = new google.maps.Marker({
			position: this.latLng,
			map: map,
			title: this.name
		});
	this.marker.addListener('click', function(){vm.changePlace(selfPlace);});
	detailService.nearbySearch({location: this.latLng, radius: '100', name: this.name}, function(results, status){selfPlace.applyDetails(results, status);});
	}
}

/* Temporarily assign results from nearbySearch() then assign results from getDetails()*/
Place.prototype.applyDetails = function(results, status){
	var selfPlace = this;
	if (status == google.maps.places.PlacesServiceStatus.OK) {
		this.details = results[0];
		this.placeId = this.details.place_id;
		detailService.getDetails({placeId: this.placeId}, function(results, status){
			if (status == google.maps.places.PlacesServiceStatus.OK) {
				selfPlace.details = results;
			}
		});
	}
}

var map;
var geocoder;
var infoWindow;
var detailService;
var vm;

//https://api.apixu.com/v1/current.json?key=f7fc2a0c018f47c688b200705150412&q=Paris
var viewModel = function() {
	vm = this;

	vm.places = [];
	for (var i in locationData) {
		vm.places.push(new Place(locationData[i]));
	}

	vm.activePlaces = ko.computed(function() {
		var workingArray = [];
		for (var i in vm.places) {
			if (vm.places[i].active()) {
				workingArray.push(vm.places[i]);
			}
		}
		return workingArray;
	});

	vm.selectedPlace = ko.observable();
	vm.changePlace = function(place) {
		if (typeof vm.selectedPlace() == 'object') {
			vm.selectedPlace().status('deselected');
			vm.selectedPlace().marker.setAnimation(null);
			if (place === vm.selectedPlace()) {
				vm.selectedPlace = ko.observable();
				infoWindow.close();
				return;
			}
		}
		vm.selectedPlace(place);
		vm.selectedPlace().status('selected');
		vm.selectedPlace().marker.setAnimation(google.maps.Animation.BOUNCE);
		infoWindow.setContent(vm.selectedPlace().name);
		infoWindow.open(map, vm.selectedPlace().marker)

	}

	vm.searchTerm = ko.observable("");
	vm.searchTerm.extend({ rateLimit: { timeout: 400, method: "notifyWhenChangesStop" } });
	vm.searchPlaces = function() {
		var workingPlace = '';
		var workingSearchTerm = vm.searchTerm().toLowerCase();
		for (var i in vm.places) {
			workingPlace = vm.places[i].name.toLowerCase();
			if (workingPlace.indexOf(workingSearchTerm) > -1) {
				vm.places[i].active(true);
				vm.places[i].marker.setMap(map);
			} else {
				vm.places[i].active(false);
				vm.places[i].marker.setMap(null);
			}
		}
	}
	vm.searchTerm.subscribe(vm.searchPlaces);
};

var initMap = function() {
	map = new google.maps.Map(document.getElementById('map'), {
		center: neighborhood.center,
		zoom: 14
	});
	geocoder = new google.maps.Geocoder();
	infoWindow = new google.maps.InfoWindow();
	detailService = new google.maps.places.PlacesService(map);

	ko.applyBindings(new viewModel());
};