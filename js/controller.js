
var busstop = angular.module('busstop', ['ngRoute','ngAnimate','ngSanitize']);
busstop.config(function($routeProvider) {
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
busstop.directive('myClock', ['$interval', 'dateFilter', function($interval, dateFilter) {

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
busstop.controller('BusStopCtrl', function BusStopCtrl($scope,$interval,$http,$routeParams,$timeout,$sce) {
	var self= $scope;
	var numberOfRides = 15;			// max number of rides to display
 	var rideId = 5029;  			//id of the busstop (e.g. id 1 = trainstation Merano)
	var scrollFactor=8; 			//bigger is slower(decimal can be used)
	var ridesUpdateIntervall = 10000;	// time in milliseconds
	var infosUpdateIntervall = 108000000;	// time in milliseconds


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
		$http.jsonp("http://stationboard.opensasa.info/?ORT_NR="+rideId+"&LINES="+numberOfRides+"&type=jsonp&jsonp=JSON_CALLBACK").success(function(data, status, headers, config) {
			if (status != 200 || data == null || data.length===0){
				self.warning=true;
			}else{
				self.german_stationname=self.getFirstPart(data.stationname);
				self.italian_stationname=self.getSecondPart(data.stationname);
				self.elaborateData(data.rides);
			}					
		});
		},ridesUpdateIntervall);
	}
	self.initRides = function(){
		$http.jsonp("http://stationboard.opensasa.info/?ORT_NR="+rideId+"&LINES="+numberOfRides+"&type=jsonp&jsonp=JSON_CALLBACK").success(function(data, status, headers, config) {
                        if (status != 200 || data == null || data.length===0){
                                self.warning=true;
                        }else{
				self.german_stationname=self.getFirstPart(data.stationname);
				self.italian_stationname=self.getSecondPart(data.stationname);
                                self.elaborateData(data.rides);
                        }    
                });
	}
	self.refreshInfos = function(){
		$http.jsonp("http://www.sasabz.it/android/android_json.php?callback=JSON_CALLBACK&city=2").success(function(data, status, headers, config) {
			self.notes = [];
			self.notes = self.assembleNotes(data);
			self.moveNote();
		});
	};
	self.assembleNotes = function(data){
		for (i in data){
			var htmlString='<div>'+data[i].titel_de+':&nbsp'+data[i].nachricht_de+'&nbsp;&nbsp;&nbsp;'+data[i].titel_it+':&nbsp '+data[i].nachricht_it+'</div>';
			data[i]['text']=$(htmlString).text();
		}
		return data;
	}
	self.elaborateData = function(data)	{
		data=data.slice(0,numberOfRides);
		self.calcArrival(data);
		if(self.rides.length===0)
			self.rides=data;
		else{
			var now = moment();
			var newRides = self.arr_diff(data,self.rides);
			var departedRides = self.arr_diff(self.rides,data);
			for(i in departedRides){
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
				if (arr2[j].lidname === arr1[i].lidname && arr2[j].arrival === arr1[i].arrival){
					busExists=true;
					arr2[j].comesIn= arr1[i].comesIn;
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
		if ( i==undefined || self.notes==undefined || i> self.notes.length){
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
		$timeout(function() {
			self.moveNote(i);
   		}, scrollSpeed);   
	};
});
