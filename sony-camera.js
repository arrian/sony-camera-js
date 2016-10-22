var dgram = require('dgram');
var url = require('url');
var http = require('http');
var request = require('request');
var xmltojson = require('xml2json');
var _ = require('lodash');

var SONY_API = 'schemas-sony-com:service:ScalarWebAPI:1',
	SSDP_ADDRESS = '239.255.255.250',
	SSDP_PORT = 1900,
	VERSION = '1.0',

	// Some standard api calls
	GET_AVAILABLE_API = 'getAvailableApiList',
	GET_METHOD_TYPES = 'getMethodTypes',
	START_REC_MODE = 'startRecMode',
	ACT_TAKE_PICTURE = 'actTakePicture',

	Validator = {
		double: _.isNumber,
		string: _.isString,
		bool: _.isBoolean,
		int: _.isInteger
	};

class Camera {

	constructor() {
		this.messageCounter = 1;
		this.connecting = true;

		this.precondition = {};
		this.precondition[ACT_TAKE_PICTURE] = START_REC_MODE;
	}

	connect() {
		console.log(`Connecting...`);
		return this.getLocation()
		.then(location => {
			this.location = location;
			return this.getSpecification(location);
		})
		.then(specification => {
			this.specification = specification;

			var urlObject = url.parse(this.getURL(specification));

			this.host = urlObject.hostname;
			this.port = urlObject.port;
			this.path = urlObject.path;
		})
		.then(() => this.send(GET_METHOD_TYPES, [VERSION]))
		.then(methods => {
			this.setAPI(methods);
			this.connecting = false;

			console.log(`Connected to ${this.host}`);
		})
		.catch(error => {
			console.log(`An error occurred while connecting: ${error}`);
			throw error;
		});
	}

	isConnected() {
		return !this.connecting;
	}

	getLocation() {
		return new Promise(function(resolve, reject) {
			try {
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
					resolve(location);
				});

				client.send(discoverMessage, 0, discoverMessage.length, SSDP_PORT, SSDP_ADDRESS);
			} catch(error) {
				reject(error);
			}  
		});
	}

	getSpecification(location) {
		return new Promise(function(resolve, reject) {
			request.get(location, function (error, response, body) {
				if (!error && response.statusCode == 200) {
					var spec = xmltojson.toJson(body, { object: true });
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
			try {
				var data = {
					method: method,
					params: params,
					id: this.messageCounter++,
					version: VERSION
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
						result = result.result || result.results;
						resolve(result);
					});
				});

				req.write(dataString);
				req.end();
			} catch(error) {
				reject(error);
			}
		});
	}

	getAPI() {
		this.validateConnected();
		return this.api;
	}

	getAvailableAPI() {
		this.validateConnected();
		return this.send(GET_AVAILABLE_API).then(result => result[0]);
	}

	setAPI(methods) {
		var createMethod = (name, expectedParameters) => {
				return (...givenParameters) => {
					this.validateParameters(givenParameters, expectedParameters);
					return this.call(name, givenParameters);
				};
			},
			name,
			expectedParameters,
			returns;

		this.api = _.map(methods, method => `${method[0]}(${method[1]}) -> ${method[2]}`);

		_.each(methods, method => {
			this[method[0]] = createMethod(method[0], method[1]);
		});
	}

	validateParameters(givenParameters, expectedParameters) {
		if(givenParameters.length < expectedParameters.length) {
			throw new Error(`Too few parameters provided. ${expectedParameters.length} were expected but ${givenParameters.length} were given.`);
		} 

		if(givenParameters.length > expectedParameters.length) {
			throw new Error(`Too many parameters provided. ${expectedParameters.length} were expected but ${givenParameters.length} were given.`);
		}

		_.forEach(_.zip(givenParameters, expectedParameters), _.spread((given, expected) => {
			if(Validator[expected] && !Validator[expected](given)) {
				throw new Error(`Argument with value ${given} must be of type ${expected}`);
			}
		}));
	}

	validateConnected() {
		if(!this.isConnected()) {
			throw new Error('Camera not yet connected.');
		}
	}

	call(method, params) {
		return this.getAvailableAPI()
		.then(api => {
			if(!_.includes(api, method)) {
				if(!this.precondition[method]) throw new Error(`The '${method}' call is not currently available and the calls required to make it available are not known`);
				return this.call(this.precondition[method]).then(Camera.delay(3000));
			}
		})
		.then(() => this.send(method, params))
		.catch((error) => console.log(`Error while calling ${method}: ${error}`));
	}

	picture() {
		this.validateConnected();
		return this.send(ACT_TAKE_PICTURE);
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

module.exports = {
	Camera: Camera
};
