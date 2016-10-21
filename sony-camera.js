var dgram = require('dgram');
var url = require('url');
var http = require('http');
var request = require('request');
var xmltojson = require('xml2json');
var _ = require('lodash');

var SONY_API = 'schemas-sony-com:service:ScalarWebAPI:1',
	SSDP_ADDRESS = '239.255.255.250',
	SSDP_PORT = 1900;

class Camera {

	constructor() {
		this.messageCounter = 1;

		this.precondition = {
			actTakePicture: 'startRecMode'
		};
	}

	connect() {
		this.searching = true;
		return this.getLocation().then((location) => {
			this.location = location;
			return this.getSpecification(location);
		}).then((specification) => {
			this.specification = specification;

			var urlObject = url.parse(this.getURL(specification));

			this.host = urlObject.hostname;
			this.port = urlObject.port;
			this.path = urlObject.path;

			this.searching = false;
		});
	}

	getLocation() {
		return new Promise(function(resolve, reject) {
			var discoverMessage = new Buffer(
				'M-SEARCH * HTTP/1.1\r\n' +
				`HOST:${SSDP_ADDRESS}:${SSDP_PORT}\r\n` +
				'MAN:"ssdp:discover"\r\n' +
				`ST:urn:${SONY_API}\r\n` +
				'MX:1\r\n' +
				'\r\n'
			);

			var client = dgram.createSocket('udp4');

			client.on('message', (message, remote) => {
				var location = /LOCATION: (.*)/.exec(message)[1];
				console.log(remote.address + ':' + remote.port +' - ' + message);
				resolve(location);
			});

			client.send(discoverMessage, 0, discoverMessage.length, SSDP_PORT, SSDP_ADDRESS);
		});
	}

	getSpecification(location) {
		return new Promise(function(resolve, reject) {
			request.get(location, function (error, response, body) {
				if (!error && response.statusCode == 200) {
					var spec = xmltojson.toJson(body, { object: true });
					console.log(JSON.stringify(spec, null, 2));
					resolve(spec);
				} else {
					reject(error);
				}
			});
		});
	}

	getURL(specification) {
		var services = specification.root.device['av:X_ScalarWebAPI_DeviceInfo']['av:X_ScalarWebAPI_ServiceList']['av:X_ScalarWebAPI_Service'];
		var cameraService = _.find(services, service => service['av:X_ScalarWebAPI_ServiceType'] === 'camera');

		return cameraService['av:X_ScalarWebAPI_ActionList_URL'] + '/camera';
	}

	send(method, params = []) {
		return new Promise((resolve, reject) => {
			var data = {
				method: method,
				params: params,
				id: this.messageCounter++,
				version: '1.0'
			};

			var dataString = JSON.stringify(data);

			var options = {
				host: this.host,
				port: this.port,
				path: this.path,
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Content-Length': dataString.length
				}
			};

			var req = http.request(options, function(res) {
				res.setEncoding('utf-8');

				var response = '';

				res.on('data', function(data) {
					response += data;
				});

				res.on('end', function() {
					var result = JSON.parse(response);
					resolve(result);
				});
			});

			req.write(dataString);
			req.end();
		});
	}

	api() {
		return this.send('getAvailableApiList').then(message => message.result[0]);
	}

	call(method, params) {
		return this.api()
		.then(api => {
			if(!_.includes(api, method)) {
				if(!this.precondition[method]) throw new Error(`'${method}' is not available and the calls required to make it available are not known`);
				return this.call(this.precondition[method]).then(Camera.delay(3000));
			}
		})
		.then(() => this.send(method, params))
		.catch((error) => console.log(`Error while calling ${method}: ${error}`));
	}

	picture() {
		return this.call('actTakePicture');
	}

	// API Methods

	actTakePicture() {
		return this.picture();
	}

	getVersions() {
		return this.call('getVersions');
	}

	startRecMode() {
		return this.call('startRecMode');
	}

	stopRecMode() {
		return this.call('stopRecMode');
	}

	// Advanced

	timelapseFrame(i, count, interval, result = []) {
		if(i >= count) return result;

		console.log(`timelapse ${i + 1} of ${count}`);

		return this.picture().then(Camera.delay(interval)).then(frame => {
			result.push(frame);
			return this.timelapseFrame(i + 1, count, interval, result);
		});
	}

	timelapse(count, interval) {
		if(count <= 1) throw new Error('Too few timelapse frames. Timelapse requires two or more frames.');
		return this.timelapseFrame(0, count, interval);
	}

	// Static Helpers

	static delay(duration) {
		return function(value){
			return new Promise(function(resolve, reject){
				setTimeout(function(){
					resolve(value);
				}, duration)
			});
		};
	};

	static display(result) {
		console.log(JSON.stringify(result, null, 2));
	}
}

// 'getVersions',
// 'getMethodTypes',
// 'getApplicationInfo',
// 'getAvailableApiList',
// 'getEvent',
// 'actTakePicture',
// 'stopRecMode',
// 'startLiveview',
// 'stopLiveview',
// 'actZoom',
// 'awaitTakePicture',
// 'setSelfTimer',
// 'getSelfTimer',
// 'getAvailableSelfTimer',
// 'getSupportedSelfTimer',
// 'setExposureCompensation',
// 'getExposureCompensation',
// 'getAvailableExposureCompensation',
// 'getSupportedExposureCompensation',
// 'setShootMode',
// 'getShootMode',
// 'getAvailableShootMode',
// 'getSupportedShootMode',
// 'getSupportedFlashMode'

module.exports = {
	Camera: Camera
};
