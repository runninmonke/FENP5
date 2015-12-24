'use strict';

/* InfoWindow photo dimensions */
var INFO_PHOTO = {
	maxWidth: 200,
	maxHeight: 200
};

/* Radius in meters to search for Google Place object of locationData */
var IMMEDIATE_SEARCH_RADIUS = 500;
/* Radius to for near by places Google search */
var NEARBY_SEARCH_RADIUS = 2000;
/* Delay before filter refresh */
var FILTER_TIMEOUT = 400;

/* Initial places data. */
var locationData = [{
		name: "Memorial Park",
		address: "6005 Underwood Ave, Omaha, NE 68132"
	}, {
		name: "St. Cecilia Cathedral",
		address: "701 N 40th St, Omaha, NE 68131"
	}, {
		name: "The Homy Inn",
		address: "1510 N Saddle Creek Rd, Omaha, NE 68104"
	}, {
		name: "Lisa's Radial Cafe",
		address: "817 N 40th St, Omaha, NE 68131"
	}, {
		name: "Brothers",
		address: "3812 Farnam St, Omaha, NE 68131"
	}, {
		name: "Amsterdam Falafel and Kabob",
		address: "620 N 50th St, Omaha, NE 68132"
	}
];

/* Template used format data into infoWindow DOM elements */
var contentTemplate = {
    sun: '<p>Sunrise: %sunrise%<br>Solar noon: %noon%<br>Sunset: %sunset%</p>',
    website: '<a href="%href%">Website</a>',
    photo: '<div><img src="%src%" alt="Picture of %alt%"></div>',
    name: '<h3>%text%</h3>',
    start: '<div class="info-window">',
    end: '</div>'
};

/* Neighborhood data */
var neighborhood = {
    name: "Midtown",
    center: {
        lat: 41.266,
        lng: -95.987867
    },
    locality: "Omaha, NE",
    weather: {}
};

/* Used to calculate local area time offset from UTC */
neighborhood.calcTimeOffset = function() {
    var utcHour = new Date().getUTCHours();
    var utcDay = new Date().getUTCDate();

    /* Parse data into local time and date */
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
        if (data.hasOwnProperty(item)) {
            self[item] = data[item];
        }
    }

    self.active = ko.observable(true);
    self.status = ko.observable('deselected');
    self.firstClick = true;

    /* Loading message in case content is slow to build */
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
    /* Set self = this as a way to make the object's methods available to the callback function. This strategy used in other methods as well */
    var self = this;
    geocoder.geocode({
        address: self.address
    }, function(results, status) {
        if (status == google.maps.GeocoderStatus.OK) {
            self.latLng = results[0].geometry.location;
            self.createDetails();
        } else {
            alert('Location data unavailable. Geocoder failed:' + status);
        }
    });
};

/* Use latLng data to create map marker and get additional details */
Place.prototype.createDetails = function() {
    var self = this;

    /* Create map marker */
    self.marker = new google.maps.Marker({
        position: self.latLng,
        map: map,
        title: self.name
    });

    /* Allow selected place to be changed by clicking map markers */
    self.marker.addListener('click', function() {
        vm.changePlace(self);
    });

    /* AJAX request for sunrise/set etc */
    var AJAXrequestStr = 'http://api.sunrise-sunset.org/json?lat=' + self.latLng.lat() + '&lng=' + self.latLng.lng();
    $.getJSON(AJAXrequestStr, function(data) {
            self.applySunTimes(data);
        })
        .fail(function() {
            alert('Sunset/sunrise times unavailable. Error accessing sunset-sunrise.org');
        });

    /* Skip getting details from google if they were passed in on place initialization and include the place id*/
    if (self.hasOwnProperty('details')) {
        if (self.details.hasOwnProperty('place_id')) {
            return;
        }
    }

    /* Search immediate vicinity to see if location is in Google Places and get details, mainly to use the place id
     *  for the Ajax call in getMoreDetails. */
    detailService.nearbySearch({
        location: self.latLng,
        radius: IMMEDIATE_SEARCH_RADIUS,
        name: self.name
    }, function(results, status) {
        if (status == google.maps.places.PlacesServiceStatus.OK) {
            self.details = results[0];
        }
    });
};

/* Callback for sunrise/set API */
Place.prototype.applySunTimes = function(data) {
    if (data.status != 'OK') {
        alert('Problem with sunset/sunrise data:' + data.status);
        return;
    }

    this.sun = {
        rise: data.results.sunrise,
        set: data.results.sunset,
        noon: data.results.solar_noon
    };

    /* Calculate sunrise/set times in local time. Otherwise indicate they're in UTC */
    for (var i in this.sun) {
        if (neighborhood.hasOwnProperty('weather')) {
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
            if (newHour < 12) {
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
        } else {
            this.sun[i] = this.sun[i] + " UTC";
        }
    }
};

/* Use place id to get any additional details that might be available from Google Places API and call buildContent when finished.
 *  Specifically place website and photos will be used in buildContent if they exist. */
Place.prototype.getMoreDetails = function() {
    var self = this;

    detailService.getDetails({
        placeId: self.details.place_id
    }, function(results, status) {
        if (status == google.maps.places.PlacesServiceStatus.OK) {
            self.details = results;
            if (results.hasOwnProperty('photos')) {
                self.photoUrl = results.photos[0].getUrl(INFO_PHOTO);
            }
        }

        self.buildContent();
    });
};

/* Check for what data has been successfully retrieved and build content for infoWindow by plugging it into the template */
Place.prototype.buildContent = function() {
    this.content = contentTemplate.start;
    this.content += contentTemplate.name.replace('%text%', this.name);

    /* Use google streetview image if no place photo exists */
    if (!this.photoUrl) {
        this.photoUrl = 'https://maps.googleapis.com/maps/api/streetview?fov=120&key=AIzaSyB7LiznjiujsNwqvwGu7jMg6xVmnVTVSek&size=' +
            INFO_PHOTO.maxWidth + 'x' + INFO_PHOTO.maxHeight + '&location=' + this.address;
    }

    this.content += contentTemplate.photo.replace('%src%', this.photoUrl).replace('%alt%', 'Photo of ' + this.name);

    if (this.hasOwnProperty('details')) {
        if (this.details.hasOwnProperty('website')) {
            this.content += contentTemplate.website.replace('%href%', this.details.website);
        }
    }

    if (this.hasOwnProperty('sun')) {
        this.content += contentTemplate.sun.replace('%sunrise%', this.sun.rise).replace('%noon%', this.sun.noon).replace('%sunset%', this.sun.set);
    }

    this.content += contentTemplate.end;

    /* Update infoWindow content when done if currently selected */
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
        if (!this.hasOwnProperty('marker')) {
            console.log(this);
            return;
        }
        this.marker.setMap(null);
    }
};


Place.prototype.select = function() {
    var self = this;
    self.status('selected');

    /* If first time being selected, get more details if possible and build content. The getDetails request
     *  is delayed until now when the content is actually needed due to small query limits. */
    if (self.firstClick) {

        /* Make sure content will get rebuilt if unfinished ajax requests complete. */
        $(document).ajaxStop(function() {
            self.buildContent();
        });

        self.firstClick = false;

        if (self.details.place_id) {
            self.getMoreDetails();
        } else {
            self.buildContent();
        }
    }

    /* Adjust map marker and infoWindow to show place is selected */
    if (self.hasOwnProperty('marker')) {
        self.marker.setAnimation(google.maps.Animation.BOUNCE);
        infoWindow.setContent(self.content);
        infoWindow.open(map, self.marker);
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
        for (var i = 0; i < placesArray.length; i++) {
            vm.places.push(new Place(placesArray[i]));
        }

        /* Copy to active places to immediately display list */
        vm.activePlaces(vm.places);

        /* Call filter when data loaded to update activePlaces list and map markers */
        $(document).ajaxStop(function() {
            vm.filterPlaces();
        });
    };

    /* Use hard-coded data for initial set of places */
    vm.createPlaces(locationData);

    /* Show nav-bar and increase map zoom level on large displays */
    if (window.matchMedia("(min-width: 700px)").matches) {
        vm.menuStatus = ko.observable('open');
        map.setZoom(14);
    } else {
        vm.menuStatus = ko.observable('closed');
    }

    /* Toggle menu nav-bar open and closed */
    vm.openMenu = function() {
        if (vm.menuStatus() == 'closed') {
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
    };

    vm.filterTerm = ko.observable("");

    /* Filter responds immediately to any change in the input element, so limit the rate of updates */
    vm.filterTerm.extend({
        rateLimit: {
            timeout: FILTER_TIMEOUT,
            method: "notifyWhenChangesStop"
        }
    });

    vm.noResultsMsg = ko.observable('hidden');

    /* Filter current set of places by the filterTerm */
    vm.filterPlaces = function() {
        var workingArray = [];
        var workingPlace = '';
        var workingfilterTerm = vm.filterTerm().toLowerCase();
        for (var i = 0; i < vm.places.length; i++) {
            workingPlace = vm.places[i].name.toLowerCase();
            if (workingPlace.indexOf(workingfilterTerm) > -1) {
                vm.places[i].activate();
                workingArray.push(vm.places[i]);
            } else {
                vm.places[i].deactivate();
            }
        }
        vm.activePlaces(workingArray);

        /* Show search tip if no filter results */
        if (vm.activePlaces().length < 1) {
            vm.noResultsMsg('visible');
        } else {
            vm.noResultsMsg('hidden');
        }
    };

    /* Run filter places anytime the filterTerm changes */
    vm.filterTerm.subscribe(vm.filterPlaces);

    vm.searchMsg = ko.observable('Search nearby');

    /* Run a Google search for nearby places with current filterTerm */
    vm.keyHandler = function(obj, evt) {
        if (evt.keyCode == 13 && evt.shiftKey === true) {
            vm.reloadMyNeighborhood();
        } else if (evt.keyCode == 13) {
            vm.googleSearch();
        }
    };

    /* Call function depending on status of the search button */
    vm.clickHandler = function() {
        if (vm.searchMsg() == 'Search nearby') {
            vm.googleSearch();
        } else {
            vm.reloadMyNeighborhood();
        }
    };

    /* Reload hard-code place data and toggle search button message */
    vm.reloadMyNeighborhood = function() {
        vm.removePlaces();
        vm.createPlaces(locationData);
        vm.searchMsg('Search nearby');
    };

    /* Iniate a new set of places from the results of a nearBy Google Maps search and toggle search button message */
    vm.googleSearch = function() {
        vm.removePlaces();
        detailService.nearbySearch({
            location: neighborhood.center,
            radius: NEARBY_SEARCH_RADIUS,
            name: vm.filterTerm()
        }, function(results, status) {
            if (status == google.maps.places.PlacesServiceStatus.OK) {
                var workingArray = [];
                for (var i = 0; i < results.length; i++) {
                    workingArray.push({
                        address: results[i].vicinity,
                        name: results[i].name,
                        latLng: results[i].geometry.location,
                        details: results[i]
                    });
                }
                vm.createPlaces(workingArray);
            } else {
            	vm.createPlaces([]);
            }
        });
        vm.searchMsg('Reload Neighborhood');
    };

    /* Used to remove all traces of current set of places in preparation for intializing another */
    vm.removePlaces = function() {
        for (var i = 0; i < vm.places.length; i++) {
            vm.places[i].deselect();
            vm.places[i].deactivate();
        }
    };

    /* Variables for weather section display */
    vm.conditionImg = ko.observable('');
    vm.currentCondition = ko.observable('');
    vm.currentTemp = ko.observable('');
    vm.maxTemp = ko.observable('');
    vm.minTemp = ko.observable('');

    /* Display neighborhood weather in nav bar */
    vm.displayWeather = function() {
        vm.conditionImg('http://' + neighborhood.weather.current.condition.icon);
        vm.currentCondition(neighborhood.weather.current.condition.text);
        vm.currentTemp(neighborhood.weather.current.temp_f + '°F');
        vm.maxTemp(neighborhood.weather.forecast.forecastday[0].day.maxtemp_f + '°F');
        vm.minTemp(neighborhood.weather.forecast.forecastday[0].day.mintemp_f + '°F');
    };
};

/* Callback function for the initial Google Maps API request */
var initMap = function() {
    /* Initiate google map object */
    map = new google.maps.Map(document.getElementById('map'), {
        center: neighborhood.center,
        zoom: 13,
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
    $.getJSON('https://api.apixu.com/v1/forecast.json?key=f7fc2a0c018f47c688b200705150412&q=' + neighborhood.center.lat + ',' + neighborhood.center.lng, function(results) {
        neighborhood.weather = results;
        neighborhood.calcTimeOffset();
        vm.displayWeather();
    }).fail(function() {
        alert('Local time and weather data not available');
    });

    /* Initiate the view-model */
    ko.applyBindings(new viewModel());
};