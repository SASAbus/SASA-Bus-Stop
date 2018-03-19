var noiDisplay = angular.module('noiDisplay', ['ngAnimate','ngSanitize']);
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

noiDisplay.directive('eventDisplay',[''],function(){
	var config = {
		tickColors :['f3d111','f7dd41','becf40','a8c038','de7226','e79441','bfdaee','a9cde8','517435','7c9762','b41f3b','c6526b'],
		numberOfRides : 100,			// max number of rides to display
		ridesUpdateIntervall : 3000,	// time in milliseconds
		//                days in the future to display
		eventsTill : 14*24*60*60*1000
	};
	function link(scope, element, attrs){
		console.log(attrs);
		console.log(element);
		var self = $scope;
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
		return{
			link:link,
			templateUrl: 'partials/bus.html',

		};
	}
}

);

noiDisplay.controller('BusStopCtrl', function BusStopCtrl($scope,$interval,$http,$routeParams,$timeout,$sce) {
	var self= $scope;

	self.init = function(){
		self.fetchData().then(function(data){
			self.data = data
		}).catch(function(error){
			self.warning = true;
			console.error("unable to retrieve data:" + error);
		});
	}
	self.fetchData = new Promise(
		function(resolve,reject){
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
					reject(error);
				}else{
					resolve(data);
				}
			});
		});
	});
