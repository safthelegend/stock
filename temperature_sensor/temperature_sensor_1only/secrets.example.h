// Copy this file to secrets.h (same folder) and fill it in.
// secrets.h is in .gitignore, so passwords never end up on GitHub.

// Wi-Fi isn't set here: hotspots are added from your phone on the sensor's
// setup page (hold BOOT for 3 seconds). See README.md.

// Same public key as assets/firebase-init.js (it's not a secret on its own).
#define FIREBASE_API_KEY "AIzaSyCPqXATeb7eYyphPoyAw6ujskAcYJHPgmY"

// The sensor's own account (Firebase console > Authentication > Add user).
#define SENSOR_EMAIL "sensor1@stocktheblock.org"
#define SENSOR_PASSWORD "a-long-random-password"
