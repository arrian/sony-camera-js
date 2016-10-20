var Camera = require('./sony-camera').Camera,
	camera = new Camera();

camera.connect() // Connect to the camera
.then(() => camera.startRecMode()) // Switch the camera to the correct mode.
.then(Camera.delay(5000)) // Delay taking the picture while camera switches to rec mode.
.then(() => camera.picture()) // Take the picture.
.then(Camera.display); // Print out the response. Use the link returned to view the image.