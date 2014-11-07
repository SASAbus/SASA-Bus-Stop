var busstop = angular.module('busstop', ['ngRoute','ngAnimate','ngSanitize']);
busstop.config(['$routeProvider',
  function($routeProvider) {
    $routeProvider.
      when('/', {
        templateUrl: 'partials/bus.html',
        controller: 'BusStopCtrl'
      }).
      when('/:lineId', {
        templateUrl: 'partials/bus.html',
        controller: 'BusStopCtrl'
      }).
      otherwise({
        redirectTo: '/'
      });
  }]);
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
busstop.controller('BusStopCtrl', function BusStopCtrl($scope,$interval,$http,$routeParams,$timeout) {
	var self= $scope;
	var numberOfLines = 1000;
 	var lineId = 5029;
	var scrollFactor=4;
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
	if ($routeParams.lineId != null)
		lineId = $routeParams.lineId;
	self.lines = new Array();
	self.refreshLines = function(){
		$http.jsonp("http://stationboard.opensasa.info/?ORT_NR="+lineId+"&type=jsonp&jsonp=JSON_CALLBACK").success(function(data, status, headers, config) {
			if (status != 200 || data == null || data.length===0){
				self.warning=true;
			}else{
				console.log(data);
				self.elaborateData(data);
			}					
		});
	}
	self.refreshInfos = function(){
		$http.jsonp("http://www.sasabz.it/android/android_json.php?callback=JSON_CALLBACK").success(function(data, status, headers, config) {
			self.notes = self.assembleNotes(data);
		});
	};
	self.assembleNotes = function(data){
		for (i in data){
			data[i]['text']=data[i].titel_de+':&nbsp'+data[i].nachricht_de+'&nbsp;&nbsp;&nbsp;'+data[i].titel_it+':&nbsp '+data[i].nachricht_it;
		}
		return data;
	}
	self.$watch('notes', function() {
		self.moveNote();
   	});
	self.elaborateData = function(data)	{
		data=data.slice(0,numberOfLines);
		self.calcArrival(data);
		if(self.lines.length===0)
			self.lines=data;
		else{
			var now = moment();
			var newLines = self.arr_diff(data,self.lines);
			var departedLines = self.arr_diff(self.lines,data);
			for(i in departedLines){
				self.lines.splice(departedLines[i],1);
			}
			for (i in newLines){
				self.lines.push(data[newLines[i]]);
			}
		}
	}
	self.calcArrival = function(data){
		var now = moment();
		for (i in data){
			var arrivalTime = moment();
			var delay = data[i].delay;
			var arrivalString = data[i].arrival.toString();
			if (arrivalString.length===4)
				arrivalString = "0"+arrivalString;
			arrivalTime.hour(arrivalString.substring(0,2));
			arrivalTime.minute(arrivalString.substring(3,5));
			if (delay!=null)
				arrivalTime.add(data[i].delay,'minutes');
			var comesIn = Math.round(arrivalTime.diff(now)/60/1000);
			if (comesIn<1)
				comesIn=1;
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
	$interval(self.refreshLines,20000);
	$interval(self.refreshInfos,300000);
});
