'use strict'

var INFO_PHOTO_MAX_DIMENSIONS = {
	maxWidth: 200,
	maxHeight: 200
}

var neighborhood = {
	name: "Midtown",
	center: {
		lat: 41.263218,
		lng: -95.987867
	},
	locality: "Omaha, NE",
	weather: {}
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

var contentTemplate = {
	website: '<a href="%href%">Website</a>',
	photo: '<div><img src="%src%" alt="Picture of %alt%"></div>',
	name: '<h3>%text%</h3>',
	start: '<div id="infoWindow">',
	end: '</div>'
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
	/* Get info from geocoder and call function to populate properties with results and add a marker*/
	geocoder.geocode({address: this.address}, function(results, status) {self.applyGeocode(results, status);});

}

/* Populate properties with Geocoderesults, add a marker and try to get additional details via a series of
*  AJAX requests. The final successful one calls the buildContent method */
Place.prototype.applyGeocode = function(results, status) {
	var self = this;
	if (status == google.maps.GeocoderStatus.OK) {
		this.latLng = results[0].geometry.location;
		this.marker = new google.maps.Marker({
			position: this.latLng,
			map: map,
			title: this.name
		});
	this.marker.addListener('click', function(){vm.changePlace(self);});
	detailService.nearbySearch({location: this.latLng, radius: '100', name: this.name}, function(results, status){self.applyDetails(results, status);});
	var requestStr = 'http://api.sunrise-sunset.org/json?lat=' + this.latLng.lat() + '&lng=' + this.latLng.lng();
	$.getJSON(requestStr, function(data){self.applySunTimes(data)});
	} else {
		this.buildContent();
	}
}

/* Temporarily assign results from nearbySearch() then assign results from getDetails()*/
Place.prototype.applyDetails = function(results, status){
	var self = this;
	if (status == google.maps.places.PlacesServiceStatus.OK) {
		this.details = results[0];
		detailService.getDetails({placeId: this.details.place_id}, function(results, status){
			if (status == google.maps.places.PlacesServiceStatus.OK) {
				self.details = results;
				if (results.hasOwnProperty('photos')){
					self.photoUrl = results.photos[0].getUrl(INFO_PHOTO_MAX_DIMENSIONS);
				}
				self.buildContent();
			} else {
				self.buildContent();
			}
		});
	} else {
		self.buildContent();
	}
}

Place.prototype.applySunTimes = function(data) {
	if (data.status == 'OK') {
		this.sun = {
			rise: data.results.sunrise,
			set: data.results.sunset,
			noon: data.results.solar_noon
		}
	}
}

/* Builds the content the place displays in the infoWindow when selected */
Place.prototype.buildContent = function() {
	this.content = contentTemplate.start;
	this.content += contentTemplate.name.replace('%text%', this.name);

	if (! this.photoUrl) {
		this.photoUrl = 'https://maps.googleapis.com/maps/api/streetview?fov=120&key=AIzaSyB7LiznjiujsNwqvwGu7jMg6xVmnVTVSek&size=' +
			INFO_PHOTO_MAX_DIMENSIONS.maxWidth + 'x' + INFO_PHOTO_MAX_DIMENSIONS.maxHeight +'&location=' + this.address;
	}
	this.content += contentTemplate.photo.replace('%src%', this.photoUrl).replace('%alt%', 'Photo of ' + this.name);

	if(this.hasOwnProperty('details')) {
		if (this.details.hasOwnProperty('website')) {
			this.content += contentTemplate.website.replace('%href%', this.details.website);
		}
	}

	this.content += contentTemplate.end;
}

var map;
var geocoder;
var infoWindow;
var detailService;
var vm;


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
		infoWindow.setContent(vm.selectedPlace().content);
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
				if (vm.places[i] === vm.selectedPlace()) {
					vm.places[i].marker.setAnimation(google.maps.Animation.BOUNCE);
				}
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

	$.getJSON('https://api.apixu.com/v1/forecast.json?key=f7fc2a0c018f47c688b200705150412&q=' + neighborhood.center.lat + ',' + neighborhood.center.lng, function(results){
		neighborhood.weather = results;
		neighborhood.calcTimeOffset();
	});

	ko.applyBindings(new viewModel());
};

neighborhood.calcTimeOffset = function(){
		var utcHour = new Date().getUTCHours();
		var utcDay = new Date().getUTCDate();

		/* Parse results into local time and date */
		var localHour = this.weather.location.localtime.split(':')[0];
		var localDay = localHour.split('-')[2].split(' ')[0];
		localHour = Number(localHour.split(' ')[1]);

		/* Factor any date difference into the hours */
		var dateDifference = localDay - utcDay;
		if (dateDifference == 1) {
			localHour += 24;
		} else if (dateDifference == -1) {
			utcHour += 24;
		} else if (dateDifference > 1) {
			utcHour += 24;
		} else if (dateDifference < -1) {
			localHour += 24;
		}

		/* Deterimine current neighborhood time offset */
		this.weather.utcOffset = (localHour - utcHour);
	};