# Sony Camera Node API

This library allows interaction with Sony cameras using node.

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
.then(() => camera.picture()) // Take a picture
.then(Camera.display); // Print out the image link - Use the link returned to view the image

```

Taking a timelapse:

```javascript
var Camera = require('./sony-camera').Camera,
	camera = new Camera();

camera.connect() // Connect to the camera
.then(() => camera.timelapse(4, 2000)) // Take a timelapse of 4 images 2 seconds apart
.then(Camera.display); // Print out the timelapse image links
```

Displaying the camera's current available api:

```javascript
var Camera = require('./sony-camera').Camera,
	camera = new Camera();

camera.connect()
.then(() => camera.api())
.then(Camera.display);

```
