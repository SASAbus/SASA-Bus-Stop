var busstop = angular.module('busstop', ['ngRoute','ngAnimate']);
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

busstop.controller('BusStopCtrl', function BusStopCtrl($scope,$interval,$http,$routeParams,$timeout) {
	var self= $scope;
	var notes=[{text:"Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua. At vero eos et accusam et"},
	{
        text:"Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt"},
{
        text:"Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua. At vero eos et accusam et"},
{
        text:"Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua. At vero eos et accusam et"}
	];
	var numberOfLines = 1000;
 	var lineId = 5029;
	if ($routeParams.lineId != null)
		lineId = $routeParams.lineId;
	self.lines = new Array();
	self.refreshLines = function(){
		$http.jsonp("http://stationboard.opensasa.info/?ORT_NR="+lineId+"&type=jsonp&jsonp=JSON_CALLBACK").success(function(data, status, headers, config) {
			if (status != 200 || data == null || data.length===0){
				self.warning=true;
			}else{
				self.elaborateData(data);
			}					
		});
	}
	self.refreshInfos = function(){
		$http.jsonp("http://stationboard.opensasa.info/?ORT_NR="+lineId+"&type=jsonp&jsonp=JSON_CALLBACK").success(function(data, status, headers, config) {
			self.notes=notes;	
			self.$watch('notes', function() {
       				$timeout(self.moveNote(),2000);
			});
		});
	};

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
			arrivalTime.hour(data[i].arrival.substring(0,2));
			arrivalTime.minute(data[i].arrival.substring(3,5));
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
		if (i> self.notes.length||i==undefined){
			angular.element(".notes").removeClass("move-note");	
			i=0;
		}
		console.log(i);
     		angular.element("#element"+i).addClass("move-note");
		i++;
		$timeout(function() {
			self.moveNote(i);
   		}, 20000);   
	};
	$interval(function() {self.clock=moment().format("HH:mm:ss");}, 1000);
	$interval(self.refreshLines,5000);
	$interval(self.refreshInfos,300000);
});
