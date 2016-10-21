var Camera = require('./sony-camera').Camera,
	camera = new Camera();

camera.connect() // Connect to the camera
.then(() => camera.picture()) // Take a picture
.then(Camera.display); // Print out the image link - Use the link returned to view the image