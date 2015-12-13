// Hello.
//
// This is JSHint, a tool that helps to detect errors and potential
// problems in your JavaScript code.
//
// To start, simply enter some JavaScript anywhere on this page. Your
// report will appear on the right side.
//
// Additionally, you can toggle specific options in the Configure
// menu.

'use strict';

var INFO_PHOTO = {
	maxWidth: 200,
	maxHeight: 200
};

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
	sun: '<p>Sunrise: %sunrise%<br>Solar noon: %noon%<br>Sunset: %sunset%</p>',
	website: '<a href="%href%">Website</a>',
	photo: '<div><img src="%src%" alt="Picture of %alt%"></div>',
	name: '<h3>%text%</h3>',
	start: '<div id="info-window">',
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

	/* Set self = this as a way to make the object's methods available to the callback function.
	*  Same strategy is utilized in some of the object methods. */
	var self = this;
	/* Get info from geocoder and call function to populate properties with results and add a marker*/
	geocoder.geocode({address: this.address}, function(results, status) {
		self.applyGeocode(results, status);
	});
	$(document).ajaxStop(function(){self.buildContent();});
};

/* Populate properties with Geocoderesults, add a marker and try to get additional details via a series of AJAX requests. */
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

		detailService.nearbySearch({location: this.latLng, radius: '100', name: this.name}, function(results, status){
			self.applyDetails(results, status);
		});

		var APIrequestStr = 'http://api.sunrise-sunset.org/json?lat=' + this.latLng.lat() + '&lng=' + this.latLng.lng();
		$.getJSON(APIrequestStr, function(data){self.applySunTimes(data)});
	}
};

/* Temporarily assign results from nearbySearch() then assign results from getDetails()*/
Place.prototype.applyDetails = function(results, status){
	var self = this;
	if (status == google.maps.places.PlacesServiceStatus.OK) {
		this.details = results[0];
		detailService.getDetails({placeId: this.details.place_id}, function(results, status){
			if (status == google.maps.places.PlacesServiceStatus.OK) {
				self.details = results;
				if (results.hasOwnProperty('photos')){
					self.photoUrl = results.photos[0].getUrl(INFO_PHOTO);
				}
			}
		});
	}
};

Place.prototype.applySunTimes = function(data) {
	if (data.status != 'OK') {
		return;
	}

	this.sun = {
		rise: data.results.sunrise,
		set: data.results.sunset,
		noon: data.results.solar_noon
	};
};

/* Builds the content the place displays in the infoWindow*/
Place.prototype.buildContent = function() {
	this.content = contentTemplate.start;
	this.content += contentTemplate.name.replace('%text%', this.name);

	if (! this.photoUrl) {
		this.photoUrl = 'https://maps.googleapis.com/maps/api/streetview?fov=120&key=AIzaSyB7LiznjiujsNwqvwGu7jMg6xVmnVTVSek&size=' +
			INFO_PHOTO.maxWidth + 'x' + INFO_PHOTO.maxHeight +'&location=' + this.address;
	}
	this.content += contentTemplate.photo.replace('%src%', this.photoUrl).replace('%alt%', 'Photo of ' + this.name);

	if (this.hasOwnProperty('details')) {
		if (this.details.hasOwnProperty('website')) {
			this.content += contentTemplate.website.replace('%href%', this.details.website);
		}
	}

	if (this.hasOwnProperty('sun')) {
		/* Adjust times for timezone offset */
		for (var i in this.sun) {
			var origAMorPM = this.sun[i].split(' ')[1];
			var newAMorPM = origAMorPM;
			var origHour = Number(this.sun[i].split(':')[0]);
			var newHour = origHour + neighborhood.weather.utcOffset;
			if (origAMorPM == 'PM') {
				newHour += 12;
			}
			if (newHour < 1) {
				newHour += 12;
			}
			if (newHour < 12){
				newAMorPM = 'AM';
				if (newHour === 0) {
					newHour = 12;
				}
			} else {
				newAMorPM = 'PM';
			}
			if (newHour > 12) {
				newHour = newHour - 12;
			}
			this.sun[i] = this.sun[i].replace(origHour, newHour).replace(origAMorPM, newAMorPM);
		}

		this.content += contentTemplate.sun.replace('%sunrise%', this.sun.rise).replace('%noon%', this.sun.noon).replace('%sunset%', this.sun.set);
	}

	this.content += contentTemplate.end;
};

Place.prototype.activate = function() {
	if (!this.active()) {
		this.active(true);
		this.marker.setMap(map);
		if (this.status == 'selected') {
			this.marker.setAnimation(google.maps.Animation.BOUNCE);
		}
	}
};

Place.prototype.deactivate = function() {
	if (this.active()) {
		this.active(false);
		this.marker.setMap(null);
	}
};

var map;
var geocoder;
var infoWindow;
var detailService;
var panorama;
var vm;


var viewModel = function() {
	vm = this;

	vm.places = [];
	for (var i in locationData) {
		vm.places.push(new Place(locationData[i]));
	}

	vm.activePlaces = ko.observableArray(vm.places);

	vm.menuStatus = ko.observable('closed');
	vm.openMenu = function() {
		if (vm.menuStatus() == 'closed'){
			vm.menuStatus('open');
		} else {
			vm.menuStatus('closed');
		}
	};

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
		infoWindow.open(map, vm.selectedPlace().marker);

	}

	vm.searchTerm = ko.observable("");
	/* Search is dynamic, so this limits the rate of updates */
	vm.searchTerm.extend({ rateLimit: {timeout: 400, method: "notifyWhenChangesStop"}});

	vm.searchPlaces = function() {
		var workingArray = [];
		var workingPlace = '';
		var workingSearchTerm = vm.searchTerm().toLowerCase();
		for (var i in vm.places) {
			workingPlace = vm.places[i].name.toLowerCase();
			if (workingPlace.indexOf(workingSearchTerm) > -1) {
				vm.places[i].activate();
				workingArray.push(vm.places[i]);
			} else {
				vm.places[i].deactivate();
			}
		}
		vm.activePlaces(workingArray);
	};

	vm.searchTerm.subscribe(vm.searchPlaces);
};

var initMap = function() {
	/* Initiate google map object */
	map = new google.maps.Map(document.getElementById('map'), {
		center: neighborhood.center,
		zoom: 14,
		mapTypeControlOptions: {
			position: google.maps.ControlPosition.TOP_RIGHT
	    }
	});

	/* Setup a streetview object in order to set the position of the address controls */
	panorama = map.getStreetView();
    panorama.setOptions({
		options: {
			addressControlOptions: {
				position: google.maps.ControlPosition.BOTTOM_CENTER
			}
		}
	});

    /* Initiate the various google maps objects that will be used */
	geocoder = new google.maps.Geocoder();
	infoWindow = new google.maps.InfoWindow();
	detailService = new google.maps.places.PlacesService(map);

	/* Use an API to get local weather info and call function to calculate the local time offset from UTC **/
	$.getJSON('https://api.apixu.com/v1/forecast.json?key=f7fc2a0c018f47c688b200705150412&q=' + neighborhood.center.lat + ',' + neighborhood.center.lng, function(results){
		neighborhood.weather = results;
		neighborhood.calcTimeOffset();
	});

	ko.applyBindings(new viewModel());
};

/* Used to calculate local time offset from UTC */
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