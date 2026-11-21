// Copy this file to secrets.h (same folder) and fill it in.
// secrets.h is in .gitignore, so passwords never end up on GitHub.

// Wi-Fi isn't set here: hotspots are added from your phone on the sensor's
// setup page (hold BOOT for 3 seconds). See README.md.

// Same public key as assets/firebase-init.js (it's not a secret on its own).
#define FIREBASE_API_KEY "AIzaSyCPqXATeb7eYyphPoyAw6ujskAcYJHPgmY"

// Which sensor is this board? Change this number before each upload.
// Each sensor has its own account (Firebase console > Authentication > Users),
// so its readings stay separate from the other boxes'.
#define SENSOR_NUMBER 1

#if SENSOR_NUMBER == 1
  #define SENSOR_EMAIL "sensor1@stocktheblock.org"
#elif SENSOR_NUMBER == 2
  #define SENSOR_EMAIL "sensor2@stocktheblock.org"
#elif SENSOR_NUMBER == 3
  #define SENSOR_EMAIL "sensor3@stocktheblock.org"
#elif SENSOR_NUMBER == 4
  #define SENSOR_EMAIL "sensor4@stocktheblock.org"
#else
  #error "SENSOR_NUMBER must be 1, 2, 3 or 4"
#endif

// The password you gave these accounts in Firebase.
#define SENSOR_PASSWORD "a-long-random-password"
