var noiDisplay = angular.module('noiDisplay', ['ngSanitize']);
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

noiDisplay.directive('eventDisplay',function(){
	var config = {
		tickColors :['f3d111','f7dd41','becf40','a8c038','de7226','e79441','bfdaee','a9cde8','517435','7c9762','b41f3b','c6526b'],
		numberOfRides : 100,			// max number of rides to display
		ridesUpdateIntervall : 3000,	// time in milliseconds
	};
	function link(self, element, attrs){
		if (!self.rides)
			self.rides=[];
		var elaborateData = function(data)	{
			if (!data) return;
			data = data.slice(0,config.numberOfRides);

			var newRides = arr_diff(data,self.rides);
			var departedRides = arr_diff(self.rides,data);
			for (i in data){
				data[i].from = moment(data[i].RoomStartDateUTC);
				data[i].startsIn = moment().to(data[i].from);
				data[i].to = moment(data[i].RoomEndDateUTC);
			}
			for(i in departedRides){
				if (self.rides[departedRides[i]].RoomEndDateUTC < new Date().getTime())
				self.rides.splice(departedRides[i],1);
			}
			for (i in newRides){
				data[newRides[i]].hexcode= '#'+config.tickColors[(Math.trunc(Math.random() * 100) % config.tickColors.length)];
				self.rides.push(data[newRides[i]]);
			}
		}
		var arr_diff = function(arr1,arr2){
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
		self.$watch(attrs.eventDisplay,function(value){
			elaborateData(value);
		});
	}
	return{
		link:link,
		templateUrl: 'partials/bus.html',
		restrict:'A'

	};
});

noiDisplay.controller('BusStopCtrl', function BusStopCtrl($scope,$interval,$http,$sce) {
	var self= $scope;
	const eventsTill = 14*24*60*60*1000;

	self.init = function(){
		fetchData().then(function(data){
			self.data = data;
		}).catch(function(error){
			self.warning = true;
			console.error("unable to retrieve data:" + error);
		});

		$interval(function(){
			fetchData().then(function(data){
				self.data = data;
			}).catch(function(error){
				self.warning = true;
				console.error("unable to retrieve data:" + error);
			});
		},3000);
	}

	var fetchData = function (){
		return new Promise(
			function(resolve,reject){
				var defaultStartDate = new Date().getTime();
				const params = {
					startdate:defaultStartDate,
					enddate: defaultStartDate + eventsTill,
					eventlocation: 'NOI',
					datetimeformat:'uxtimestamp',
					onlyactive: ""
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
		}
	});
