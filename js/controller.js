var noiDisplay = angular.module('noiDisplay', ['ngRoute','ngAnimate','ngSanitize']);
noiDisplay.config(function($routeProvider) {
  $routeProvider.
  when('/', {
    templateUrl: 'partials/bus.html',
    controller: 'BusStopCtrl'
  }).
  when('/:rideId', {
    templateUrl: 'partials/bus.html',
    controller: 'BusStopCtrl'
  }).
  otherwise({
    redirectTo: '/'
  });
});
noiDisplay.directive('myClock', ['$interval', 'dateFilter', function($interval, dateFilter) {

  function link(scope, element, attrs) {
    var format,
    timeoutId;

    format = attrs.myClock;
    updateTime();
    function updateTime() {
      element.text(dateFilter(new Date(), format));
    }

    element.on('$destroy', function() {
      $interval.cancel(timeoutId);
    });

    timeoutId = $interval(function() {
      updateTime(); // update DOM
    }, 1000);
  }
  return {
    link: link
  };
}]);
noiDisplay.filter('linename', function() {
  return function(input) {
    return input.replace("Linea","").replace("BZ","").replace("ME","").replace("ex L. 4","").replace("ex L. 2","");
  };
});
noiDisplay.controller('BusStopCtrl', function BusStopCtrl($scope,$interval,$http,$routeParams,$timeout,$sce) {
  var self= $scope;
  var numberOfRides = 100;			// max number of rides to display
  var rideId = 5029;  			//id of the busstop (e.g. id 1 = trainstation Merano)
  var scrollFactor=8; 			//bigger is slower(decimal can be used)
  var ridesUpdateIntervall = 30000;	// time in milliseconds
  var infosUpdateIntervall = 12*60*60*1000;	// time in milliseconds
  var noiColors =['f3d111','f7dd41','becf40','a8c038','de7226','e79441','bfdaee','a9cde8','517435','7c9762','b41f3b','c6526b']; 
  //                dd hh minutes 
  var eventsTill =  14*24*60*60*1000;

  self.replaceSvg= function(){
    jQuery('img.svg').each(function(){
      var $img = jQuery(this);
      var imgID = $img.attr('id');
      var imgClass = $img.attr('class');
      var imgURL = $img.attr('src');

      jQuery.get(imgURL, function(data) {
        // Get the SVG tag, ignore the rest
        var $svg = jQuery(data).find('svg');

        // Add replaced image's ID to the new SVG
        if(typeof imgID !== 'undefined') {
          $svg = $svg.attr('id', imgID);
        }
        // Add replaced image's classes to the new SVG
        if(typeof imgClass !== 'undefined') {
          $svg = $svg.attr('class', imgClass+' replaced-svg');
        }

        // Remove any invalid XML tags as per http://validator.w3.org
        $svg = $svg.removeAttr('xmlns:a');

        // Replace image with new SVG
        $img.replaceWith($svg);
      }, 'xml');

    });
  }
  if ($routeParams.rideId != null)
  rideId = $routeParams.rideId;
  self.rides = new Array();
  self.refreshRides = function(){
    $interval(function(){
	self.fetchData(self.elaborateData);
    },ridesUpdateIntervall);
  }
  self.initRides = function(){
	self.fetchData(self.elaborateData);
  }
  self.fetchData = function(callback){
		var defaultStartDate = new Date().getTime();
    		var params = {
			startdate: $routeParams.from != undefined ? $routeParams.from : defaultStartDate,
			enddate: ($routeParams.to != undefined ? $routeParams.to : defaultStartDate) + eventsTill  ,
			eventlocation: $routeParams.location != undefined ? $routeParams.location : 'NOI',
			datetimeformat:'uxtimestamp',
			onlyactive: $routeParams.active != undefined ? $routeParams.active : "" 
    		}
		$http.get("https://service.suedtirol.info/api/EventShort/GetbyRoomBooked?"+$.param(params)).then(function(response,error) {
			var data = response.data;
			if (response.status != 200 || data == null || data.length===0){
				self.warning=true;
			}else{
				callback(data);
			}
    		});
    }
    self.initInfos = function(){
    self.refreshInfos();
    self.loopInfos();
    self.moveNote();
  }
  self.refreshInfos = function(){
    $http.get("https://service.suedtirol.info/api/EventShort/GetbyRoomBooked").then(function(data, status, headers, config) {
      self.assembleNotes(data);
    });
  };
  self.loopInfos = function(){
    $interval(self.refreshInfos,infosUpdateIntervall);
  };
  self.assembleNotes = function(data){
    self.notes=[];
    for (i in data){
      var htmlString='<div>'+data[i].titel_de+':&nbsp'+data[i].nachricht_de+'&nbsp;&nbsp;&nbsp;'+data[i].titel_it+':&nbsp '+data[i].nachricht_it+'</div>';
      data[i]['text']=$(htmlString).text();
      self.notes.push(data[i]);
    }
  }
  self.elaborateData = function(data)	{
    data = data.slice(0,numberOfRides);
    for (i in data){
      data[i].from = moment(data[i].RoomStartDateUTC);
      data[i].startsIn = moment().to(data[i].from);
      data[i].to = moment(data[i].RoomEndDateUTC);
      data[i].hexcode= '#'+noiColors[(Math.trunc(Math.random() * 100) % noiColors.length)];
    }
    if(self.rides.length===0)
      self.rides=data;
    else{
      var newRides = self.arr_diff(data,self.rides);
      var departedRides = self.arr_diff(self.rides,data);
      for(i in departedRides){
	if (self.rides[departedRides[i]].RoomEndDateUTC < new Date().getTime())
	        self.rides.splice(departedRides[i],1);
      }
      for (i in newRides){
        self.rides.push(data[newRides[i]]);
      }
    }
  }
  self.calcArrival = function(data){
    var now = moment();
    for (i in data){
      var arrivalTime = moment();
      var delay = data[i].delay_sec;
      var arrivalString = data[i].arrival.toString();
      if (arrivalString.length===4)
      arrivalString = "0"+arrivalString;
      arrivalTime.hour(arrivalString.substring(0,2));
      arrivalTime.minute(arrivalString.substring(3,5));
      if (delay!=null)
      arrivalTime.add(delay,'seconds');
      var comesIn = Math.ceil(arrivalTime.diff(now)/60/1000);
      if (comesIn<=1){
        comesIn=1;
      }
      data[i]['comesIn'] = comesIn;
    }
  }
  self.arr_diff = function(arr1,arr2){
    var array = new Array();
    for (i in arr1){
      var busExists=false;
      for(j in arr2){
       	if (arr2[j].EventId === arr1[i].EventId && arr2[j].SpaceDesc === arr1[i].SpaceDesc){
          busExists=true;
	  for (key in arr2[j]){
		if (arr2[j][key]!=arr1[i][key])
			arr2[j][key]=arr1[i][key];
	  }
        }
      }
      if(!busExists)
      array.push(i);
    }
    return array;
  }
  self.getFirstPart = function(text){
    if (text == undefined)
    return "";
    var substr = text.substring(0,text.indexOf('-'));
    if (substr.length<=0){
      var alt= self.getSecondPart(text);
      if (alt.length!=0)
      substr = alt;
    }
    return substr;
  }
  self.getSecondPart = function(text){
    if (text == undefined)
    return "";
    var substr = text.substring(text.indexOf('-')+1,text.length);
    if (substr.length<=0){
      var alt= self.getFirstPart(text);
      if (alt.length!=0)
      substr = alt;
    }
    return substr;
  }

  self.moveNote = function(i){
    if ( i==undefined || self.notes==undefined || i>= self.notes.length){
      i=0;
    }
    var element = angular.element("#element"+i);
    var deviceWidth = $( document ).width();
    var elementWidth = element.width();
    var scrollSpeed = Math.floor(elementWidth*scrollFactor);
    var googleEffect = '@-webkit-keyframes element' +i+ ' {0% { left:'+deviceWidth+';} 100% { left: -' + (elementWidth + 100) + 'px; top:0px;}}';
    var effect = '@keyframes element' +i+ ' {0% { left:'+deviceWidth+';} 100% { left: -' + (elementWidth + 100) + 'px; top:0px;}}'+googleEffect;
    var googleScroll  = '#element'+i+ '{-webkit-animation: element' +i+ ' ' +scrollSpeed+'ms linear;}';
    var scroll  = '#element'+i+ '{animation: element' +i+ ' ' +scrollSpeed+'ms linear;}'+googleScroll;
    i++;
    $('head').find('#animationStyles').remove();
    $('head').append('<style id="animationStyles" type="text/css">' + effect +scroll+ '</style>');
    var noteTimeout = $timeout(function() {
      self.moveNote(i);
    }, scrollSpeed);
  }
});
