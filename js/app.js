'use strict';

/* InfoWindow photo dimensions */
var INFO_PHOTO = {
	maxWidth: 200,
	maxHeight: 200
};

/* Initial places data. */
var locationData = {
	rental1: {
		name: "Memorial Park",
		address: "6005 Underwood Ave, Omaha, NE 68132"
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
		name: "Amsterdam Falafel and Kabob",
		address: "620 N 50th St, Omaha, NE 68132"
	}
};

/* Template used format data into infoWindow DOM elements */
var contentTemplate = {
	sun: '<p>Sunrise: %sunrise%<br>Solar noon: %noon%<br>Sunset: %sunset%</p>',
	website: '<a href="%href%">Website</a>',
	photo: '<div><img src="%src%" alt="Picture of %alt%"></div>',
	name: '<h3>%text%</h3>',
	start: '<div id="info-window">',
	end: '</div>'
};

/* Neighborhood data */
var neighborhood = {
	name: "Midtown",
	center: {
		lat: 41.263218,
		lng: -95.987867
	},
	locality: "Omaha, NE",
	weather: {}
};

/* Used to calculate local area time offset from UTC */
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


/* Place class to create all the place objects for the map */
var Place = function(data) {
	var self = this;

	/* Can have extra properties, but must include name and address */
	for (var item in data) {
		if (data.hasOwnProperty(item)){
			self[item] = data[item];
		}
	}

	self.active = ko.observable(true);
	self.status = ko.observable('deselected');

	/* Loading message in case of user click before content is built */
	self.content = 'Loading...';

	/* Skip the geocode request if latLng property was already passed in */
	if (self.hasOwnProperty('latLng')) {
		self.createDetails();
	} else {
		self.getLatLng();
	}
};

/* Populate properties with Geocoderesults, add a marker and try to get additional details via a series of AJAX requests. */
Place.prototype.getLatLng = function() {
	/* Set self = this as a way to make the object's methods available to the callback function. */
	var self = this;
	geocoder.geocode({address: self.address}, function(results, status) {
		if (status == google.maps.GeocoderStatus.OK) {
			self.latLng = results[0].geometry.location;
			self.createDetails();
		} else {
			$(document).ajaxStop(function(){
				self.buildContent();
			});
		}
	});
};

Place.prototype.createDetails = function(){
	var self = this;

	/* Create map marker */
	self.marker = new google.maps.Marker({
		position: self.latLng,
		map: map,
		title: self.name
	});

	/* Allow selected place to also be changed by clicking map markers */
	self.marker.addListener('click', function(){
		vm.changePlace(self);
	});

	/* AJAX request for sunrise/set etc */
	var AJAXrequestStr = 'http://api.sunrise-sunset.org/json?lat=' + self.latLng.lat() + '&lng=' + self.latLng.lng();
	$.getJSON(AJAXrequestStr, function(data){
		self.applySunTimes(data);
	})
	.fail(function(){
		console.log('error');
	});

	/* Skip finding google place id if it was passed in on place initialization */
	if (self.hasOwnProperty('details')) {
		if (self.details.hasOwnProperty('place_id')) {
			self.getMoreDetails();
			return;
		}
	}

	/* Search immediate vicinity to see if location is in Google Places and then get place id for the Ajax call in getMoreDetails.
	*  Otherwise no more ajax calls, so build content when existing ones complete */
	detailService.nearbySearch({location: self.latLng, radius: '500', name: self.name}, function(results, status){
		if (status == google.maps.places.PlacesServiceStatus.OK) {
			self.details = results[0];
			self.getMoreDetails();
		} else {
			$(document).ajaxStop(function(){
				self.buildContent();
			});
		}
	});
};

/* Use place id to get any additional details that might be available from Google Places API.
*  Specifically place website and photos will be used in buildContent if they exist. */
Place.prototype.getMoreDetails = function() {
	var self = this;
	detailService.getDetails({placeId: self.details.place_id}, function(results, status){
		if (status == google.maps.places.PlacesServiceStatus.OK) {
			self.details = results;
			if (results.hasOwnProperty('photos')){
				self.photoUrl = results.photos[0].getUrl(INFO_PHOTO);
			}
		}
	});

	$(document).ajaxStop(function(){
		self.buildContent();
	});
};

/* Callback for sunrise/set API */
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

/* Check for what data has been successfully retrieved and build content for infoWindow by plugging it into the template */
Place.prototype.buildContent = function() {
	this.content = contentTemplate.start;
	this.content += contentTemplate.name.replace('%text%', this.name);

	/* Use google streetview image if no place photo exists */
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

	/* Update infoWindow content if currently selected */
	if (this.status() == 'selected') {
		infoWindow.setContent(this.content);
	}
};

Place.prototype.activate = function() {
	if (!this.active()) {
		this.active(true);
		this.marker.setMap(map);
		if (this.status() == 'selected') {
			this.marker.setAnimation(google.maps.Animation.BOUNCE);
		}
	}
};

Place.prototype.deactivate = function() {
	if (this.active()) {
		this.active(false);
		if (! this.hasOwnProperty('marker')) {
			console.log(this);
			return;
		}
		this.marker.setMap(null);
	}
};

Place.prototype.select = function() {
	this.status('selected');
	if (this.hasOwnProperty('marker')) {
		this.marker.setAnimation(google.maps.Animation.BOUNCE);
		infoWindow.setContent(this.content);
		infoWindow.open(map, this.marker);
	}
};

Place.prototype.deselect = function() {
	this.status('deselected');
	this.marker.setAnimation(null);
};

/* Declare variables that need to be global (mostly necessary due to Ajax callback functions) */
var map;
var geocoder;
var infoWindow;
var detailService;
var panorama;
var vm;


var viewModel = function() {
	vm = this;

	vm.activePlaces = ko.observableArray([]);

	/* Initialize new array of places for map */
	vm.createPlaces = function(placesArray) {
		vm.places = [];
		for (var i in placesArray) {
			vm.places.push(new Place(placesArray[i]));
		}

		/* Copy to active places to immediately display list */
		vm.activePlaces(vm.places);

		/* Call search when data loaded to update activePlaces list and map markers */
		$(document).ajaxStop(function(){
			vm.searchPlaces();
		});
	};

	/* Use hard-coded data for initial set of places */
	vm.createPlaces(locationData);

	vm.menuStatus = ko.observable('closed');

	/* Toggle menu nav-bar open and closed */
	vm.openMenu = function() {
		if (vm.menuStatus() == 'closed'){
			vm.menuStatus('open');
		} else {
			vm.menuStatus('closed');
		}
	};

	vm.selectedPlace = ko.observable();

	/* Toggle or change selected place */
	vm.changePlace = function(place) {
		if (typeof vm.selectedPlace() == 'object') {
			vm.selectedPlace().deselect();
			if (place === vm.selectedPlace()) {
				vm.selectedPlace = ko.observable();
				infoWindow.close();
				return;
			}
		}
		vm.selectedPlace(place);
		vm.selectedPlace().select();
		/* Allow default click action as well by returning true */
		return true;
	}

	vm.searchTerm = ko.observable("");
	/* Search responds immediately to any change in the input element, so this limits the rate of updates */
	vm.searchTerm.extend({ rateLimit: {timeout: 400, method: "notifyWhenChangesStop"}});

	/* Filter current set of places by the searchTerm */
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

	/* Run search places anytime the searchTerm changes */
	vm.searchTerm.subscribe(vm.searchPlaces);

	/* Run a Google search for nearby places with current searchTerm */
	vm.googleSearch = function(obj, evt) {
		if (evt.keyCode == 13 && evt.shiftKey == true) {
			vm.removePlaces();
			vm.createPlaces(locationData);
		} else if (evt.keyCode == 13) {
			vm.removePlaces();
			detailService.nearbySearch({location: neighborhood.center, radius: '2000', name: vm.searchTerm()}, function(results, status){
				if (status == google.maps.places.PlacesServiceStatus.OK) {
					var workingArray = [];
					for (var i in results) {
						workingArray.push({
							address: results[i].vicinity,
							name: results[i].name,
							latLng: results[i].geometry.location,
							details: results[i]
						});
					}
					vm.createPlaces(workingArray);
				}
			});
		}
	};

	/* Used to remove all traces of current set of places in preparation for intializing another */
	vm.removePlaces = function() {
		for (var i in vm.places) {
			vm.places[i].deselect();
			vm.places[i].deactivate();
		}
	}
};

/* Callback function for the initial Google Maps API request */
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

	/* Initiate the view-model */
	ko.applyBindings(new viewModel());
};