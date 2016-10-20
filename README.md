# Sony Camera Node API

This library allows interaction with Sony cameras using node.

Only the Sony α6300 has been tested.

## Getting Started

1.  Clone or download this project
2.  Run `npm install` in the root of the project
3.  Turn your Sony camera on
4.  Start the Smart Remote Embedded application on your camera
5.  Connect to the camera wifi from your computer. The access point SSID should be displayed on your camera screen and use the 'Connect with password' option.
6.  Run `node sony-camera-demo` in the root of the project

## Example

Taking a picture:

```javascript
var Camera = require('./sony-camera').Camera,
	camera = new Camera();

camera.connect() // Connect to the camera
.then(() => camera.startRecMode()) // Switch the camera to the rec mode.
.then(Camera.delay(5000)) // Delay taking the picture while camera switches to rec mode.
.then(() => camera.picture()) // Take the picture.
.then(Camera.display); // Print out the response. Use the link returned to view the image.

```

Displaying the camera's api:

```javascript
var Camera = require('./sony-camera').Camera,
	camera = new Camera();

camera.connect()
.then(() => camera.api())
.then(Camera.display);

```
