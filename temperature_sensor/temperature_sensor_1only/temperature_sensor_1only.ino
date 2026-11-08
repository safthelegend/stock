// Stock the Block - box temperature sensor (ESP32 + DS18B20)
// *** POWER BUTTON VERSION: for the ESP32 using a momentary push button as on/off ***
// (Once a real on/off switch is installed, use the normal version instead.)
//
// Once a minute this reads the DS18B20 and sends the reading to our Firebase
// database, through the delivery person's phone hotspot. The website (member
// portal, "Log a delivery") shows the readings live, and keeps the ones between
// Start and Stop with that delivery.
//
// If there's no Wi-Fi for a while (subway, dead zone), readings wait in memory
// and go out as soon as the hotspot is back. Each one keeps the time it was
// taken, not the time it was sent.
//
// Wi-Fi: no passwords in the code. Hold the BOOT button for 3 seconds (or
// power it on with no networks saved) and the sensor makes its own Wi-Fi,
// "StockTheBlock-Sensor". Join it from your phone and a page opens where you
// pick your hotspot and type its password. Up to 5 networks are remembered.
//
// Power button: GPIO 33 to one leg, GND to the other. Press = off (deep sleep),
// press again = on. Before going off it tries to send waiting readings.
//
// Setup: see README.md in this folder. You need secrets.h (copy
// secrets.example.h) and the ArduinoJson library (Library Manager).
//
// MAP OF THIS FILE
//   1.  Libraries
//   2.  Settings (pins, timing, project name)
//   3.  Waiting list (holds readings while offline)
//   4.  Firebase: signing in
//   5.  Clock (real time from the internet)
//   6.  Firebase: sending one reading
//   7.  Saved Wi-Fi networks
//   8.  Setup mode (the phone page for adding networks)
//   9.  BOOT button check (hold 3 s = setup mode)
//   9b. POWER BUTTON (press = off/on)
//  10.  setup()  - runs once at power-on / wake-up
//  11.  loop()   - runs forever: read, stay online, send


// =====================================================================
// 1. LIBRARIES
//    Pre-written code we borrow. Each line pulls in one toolbox.
// =====================================================================
#include <WiFi.h>              // basic Wi-Fi
#include <WiFiMulti.h>         // remembers several networks, joins whichever is near
#include <WebServer.h>         // serves the setup page (section 8)
#include <DNSServer.h>         // makes the setup page pop up on phones (section 8)
#include <Preferences.h>       // saves Wi-Fi networks in flash (section 7)
#include <WiFiClientSecure.h>  // https connections
#include <HTTPClient.h>        // sending web requests to Firebase
#include <ArduinoJson.h>       // building/reading JSON messages
#include <time.h>              // the clock (section 5)
#include <OneWire.h>           // the 1-wire protocol the DS18B20 talks
#include <DallasTemperature.h> // easy DS18B20 reading
#include <driver/rtc_io.h>     // lets a pin stay "awake" during deep sleep (section 9b)

#include "secrets.h"   // the sensor's Firebase login


// =====================================================================
// 2. SETTINGS
//    Pin numbers and timing. Change wiring? Change it here.
// =====================================================================
#define ONE_WIRE_BUS 4                         // DS18B20 data wire
#define LED_PIN 25                             // on = connected and signed in; fast blink = setup mode
#define BOOT_PIN 0                             // the BOOT button on the ESP32 board
#define POWER_PIN 33                           // on/off button: one leg to GPIO 33, other leg to GND
const unsigned long READ_EVERY_MS = 60000;     // one reading a minute

const char* PROJECT_ID = "stock-the-block";    // our Firebase project

// Create the objects the libraries need
OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature sensors(&oneWire);
WiFiMulti wifiMulti;


// =====================================================================
// 3. WAITING LIST (the "queue")
//    What: holds readings until they can be sent.
//    Used by: loop() adds a reading every minute, removes it once sent.
// =====================================================================
// A "ring buffer": a fixed list that wraps around. 720 readings = 12 hours
// with no Wi-Fi. If it fills up, the oldest reading is dropped.
// We store millis() (time since power-on) because the real time isn't known
// until the ESP32 has been online once; it's converted when the reading is sent.
struct Reading {
  unsigned long ms;   // millis() when it was taken
  float tempC;
};
const int QUEUE_SIZE = 720;
Reading queue[QUEUE_SIZE];
int queueStart = 0;   // index of the oldest reading
int queueCount = 0;   // how many are waiting

// Add a reading to the end of the list
void queuePush(float tempC) {
  if (queueCount == QUEUE_SIZE) {             // full: forget the oldest
    queueStart = (queueStart + 1) % QUEUE_SIZE;
    queueCount--;
  }
  int i = (queueStart + queueCount) % QUEUE_SIZE;
  queue[i].ms = millis();
  queue[i].tempC = tempC;
  queueCount++;
}

// Remove the oldest reading (after it's been sent)
void queuePop() {
  queueStart = (queueStart + 1) % QUEUE_SIZE;
  queueCount--;
}


// =====================================================================
// 4. FIREBASE: SIGNING IN
//    What: logs in as the sensor and gets a "pass" (ID token).
//    Used by: loop(), before sending.
// =====================================================================
// The sensor has its own account (email + password in secrets.h). Signing in
// gives an "ID token" that proves who we are; it lasts an hour.
String idToken = "";
String uid = "";                 // the sensor account's user ID
unsigned long tokenTakenAt = 0;

bool signIn() {
  // --- open a secure connection to Google's login service ---
  WiFiClientSecure client;
  client.setInsecure();          // skips checking Google's certificate (keeps setup simple)
  HTTPClient http;
  String url = String("https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=") + FIREBASE_API_KEY;
  http.begin(client, url);
  http.addHeader("Content-Type", "application/json");

  // --- build the login message: {email, password} ---
  JsonDocument body;
  body["email"] = SENSOR_EMAIL;
  body["password"] = SENSOR_PASSWORD;
  body["returnSecureToken"] = true;
  String out;
  serializeJson(body, out);

  // --- send it and get the reply ---
  int code = http.POST(out);
  String reply = http.getString();
  http.end();

  // --- 200 = success. Anything else = failed ---
  if (code != 200) {
    Serial.printf("Sign-in failed (%d): %s\n", code, reply.c_str());
    return false;
  }

  // --- pull the token and user ID out of the reply ---
  JsonDocument res;
  deserializeJson(res, reply);
  idToken = res["idToken"].as<String>();
  uid = res["localId"].as<String>();
  tokenTakenAt = millis();
  Serial.println("Signed in as sensor " + uid);
  return true;
}

// Is the token still good? (renew after 50 minutes, before the hour runs out)
bool tokenFresh() {
  return idToken.length() > 0 && millis() - tokenTakenAt < 50UL * 60UL * 1000UL;
}


// =====================================================================
// 5. CLOCK
//    What: checks whether we've gotten the real time from the internet yet.
//    Used by: loop() won't send until this is true.
// =====================================================================
bool timeKnown() {
  return time(nullptr) > 1700000000;   // any time after 2023 means NTP has answered
}


// =====================================================================
// 6. FIREBASE: SENDING ONE READING
//    What: uploads one reading to the database.
//    Returns true = done with it (remove from list), false = try again later.
//    Used by: loop() step 3, and goToSleep() in section 9b.
// =====================================================================
bool sendReading(const Reading& r) {
  // --- work out the real time it was taken: now minus how long ago ---
  time_t takenAt = time(nullptr) - (time_t)((millis() - r.ms) / 1000);
  struct tm t;
  gmtime_r(&takenAt, &t);
  char iso[25];
  strftime(iso, sizeof(iso), "%Y-%m-%dT%H:%M:%SZ", &t);

  // --- the address to send to ---
  // The document ID is the time in seconds, so if a send is retried it can't
  // create a second copy of the same reading.
  String url = String("https://firestore.googleapis.com/v1/projects/") + PROJECT_ID +
               "/databases/(default)/documents/sensors/" + uid +
               "/readings?documentId=" + String((unsigned long)takenAt);

  // --- build the message: {c: temperature, at: time} ---
  JsonDocument body;
  body["fields"]["c"]["doubleValue"] = round(r.tempC * 100) / 100.0;
  body["fields"]["at"]["timestampValue"] = iso;
  String out;
  serializeJson(body, out);

  // --- send it, with our token as proof of who we are ---
  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;
  http.begin(client, url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", "Bearer " + idToken);
  int code = http.POST(out);
  String reply = http.getString();
  http.end();

  // --- what the reply code means ---
  if (code == 200) {                                   // 200 = saved
    Serial.printf("Sent %.2f C taken at %s\n", r.tempC, iso);
    return true;
  }
  if (code == 409) return true;                        // 409 = already there from an earlier try
  if (code == 401) { idToken = ""; return false; }     // 401 = token expired: sign in again
  if (code == 403) {                                   // 403 = database rules said no
    // Retrying won't change that, so drop it.
    Serial.println("Rejected by the database rules: " + reply);
    return true;
  }
  Serial.printf("Send failed (%d), will retry\n", code); // anything else: try later
  return false;
}


// =====================================================================
// 7. SAVED WI-FI NETWORKS
//    What: load / save / add / remove up to 5 hotspots.
//    Kept in flash memory ("Preferences"), so they survive power-offs,
//    deep sleep, and uploading new code.
//    Used by: setup() loads them; the setup page adds/removes them.
// =====================================================================
const int MAX_NETS = 5;
String netSsid[MAX_NETS], netPass[MAX_NETS];   // names and passwords
int netCount = 0;
Preferences prefs;

// Read saved networks out of flash
void loadNetworks() {
  prefs.begin("wifi", true);              // true = read-only
  netCount = min((int)prefs.getInt("n", 0), MAX_NETS);
  for (int i = 0; i < netCount; i++) {
    netSsid[i] = prefs.getString(("s" + String(i)).c_str(), "");
    netPass[i] = prefs.getString(("p" + String(i)).c_str(), "");
  }
  prefs.end();
}

// Write the current list into flash
void saveNetworks() {
  prefs.begin("wifi", false);
  prefs.clear();
  prefs.putInt("n", netCount);
  for (int i = 0; i < netCount; i++) {
    prefs.putString(("s" + String(i)).c_str(), netSsid[i]);
    prefs.putString(("p" + String(i)).c_str(), netPass[i]);
  }
  prefs.end();
}

// Add a network (or update its password if we already know it)
void addNetwork(const String& ssid, const String& pass) {
  for (int i = 0; i < netCount; i++) {
    if (netSsid[i] == ssid) { netPass[i] = pass; saveNetworks(); return; }   // known: new password
  }
  if (netCount == MAX_NETS) {             // full: forget the oldest
    for (int i = 1; i < MAX_NETS; i++) { netSsid[i - 1] = netSsid[i]; netPass[i - 1] = netPass[i]; }
    netCount--;
  }
  netSsid[netCount] = ssid;
  netPass[netCount] = pass;
  netCount++;
  saveNetworks();
}

// Remove network number i
void removeNetwork(int i) {
  if (i < 0 || i >= netCount) return;
  for (int j = i + 1; j < netCount; j++) { netSsid[j - 1] = netSsid[j]; netPass[j - 1] = netPass[j]; }
  netCount--;
  saveNetworks();
}


// =====================================================================
// 8. SETUP MODE (the phone page for adding networks)
//    What: the ESP32 becomes its own Wi-Fi network and shows a web page.
//    The DNS server answers every web address with the ESP32's own address,
//    which is what makes phones pop the page open (like hotel Wi-Fi).
//    Readings pause in this mode.
//    Used by: setup() if no networks saved; BOOT button held 3 s.
// =====================================================================
WebServer server(80);
DNSServer dns;
String scanned = "";   // <option>s for the networks nearby

// --- helper: makes network names safe to put in a web page (< > & ") ---
String esc(const String& in) {
  String out;
  for (char c : in) {
    if (c == '<') out += "&lt;"; else if (c == '>') out += "&gt;";
    else if (c == '&') out += "&amp;"; else if (c == '"') out += "&quot;"; else out += c;
  }
  return out;
}

// --- look for nearby networks, for the dropdown ---
void scanNearby() {
  int n = WiFi.scanNetworks();
  scanned = "";
  for (int i = 0; i < n; i++) {
    String name = WiFi.SSID(i);
    if (name.length() && scanned.indexOf(">" + esc(name) + "<") < 0) scanned += "<option>" + esc(name) + "</option>";
  }
}

// --- build the web page (HTML + styling) ---
void handleRoot() {
  String page = F("<!doctype html><html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'>"
    "<title>Box sensor Wi-Fi</title><style>body{font-family:-apple-system,system-ui,sans-serif;max-width:440px;margin:0 auto;padding:20px;color:#1d1d1f}"
    "h1{font-size:22px;color:#2E5A22}h2{font-size:16px;margin-top:28px}li{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #ddd}"
    "label{display:block;margin:12px 0 4px;font-weight:600;font-size:14px}input,select{width:100%;box-sizing:border-box;font-size:16px;padding:10px;border:1px solid #bbb;border-radius:8px}"
    "button{font-size:16px;padding:10px 16px;border-radius:8px;border:1px solid #2E5A22;background:#fff;color:#2E5A22}.go{background:#2E5A22;color:#fff;width:100%;margin-top:16px}"
    "p{color:#555;font-size:14px}ul{list-style:none;padding:0}</style></head><body><h1>Box sensor Wi-Fi</h1>");
  if (server.hasArg("saved")) page += F("<p><b>Saved.</b> Add another, or press Done.</p>");
  page += F("<h2>Saved networks</h2>");
  if (!netCount) page += F("<p>None yet.</p>");
  page += F("<ul>");
  for (int i = 0; i < netCount; i++) {
    page += "<li>" + esc(netSsid[i]) + "<form method='post' action='/remove'><input type='hidden' name='i' value='" + String(i) +
            "'><button>Remove</button></form></li>";
  }
  page += F("</ul><h2>Add a network</h2><p>For a phone hotspot: turn on Maximize Compatibility (iPhone) or 2.4 GHz (Android).</p>"
    "<form method='post' action='/add'><label>Nearby</label><select name='ssid'><option value=''>Pick one</option>");
  page += scanned;
  page += F("</select><label>Or type the name</label><input name='typed' autocapitalize='off' autocorrect='off'>"
    "<label>Password</label><input name='pass' type='password'><button class='go'>Save network</button></form>"
    "<p><a href='/scan'>Scan again</a></p><form method='post' action='/done'><button class='go'>Done, start measuring</button></form></body></html>");
  server.send(200, "text/html", page);
}

// --- start setup mode: make the network, set up what each button does ---
void runSetupMode() {
  Serial.println("Setup mode: join the Wi-Fi \"StockTheBlock-Sensor\" on your phone");
  WiFi.disconnect();
  WiFi.mode(WIFI_AP_STA);                 // its own network + able to scan for others
  WiFi.softAP("StockTheBlock-Sensor");
  dns.start(53, "*", WiFi.softAPIP());
  scanNearby();

  // What happens at each page address:
  server.on("/", handleRoot);                                   // main page
  server.on("/scan", []() { scanNearby(); server.sendHeader("Location", "/"); server.send(302); });  // "Scan again"
  server.on("/add", HTTP_POST, []() {                           // "Save network"
    String ssid = server.arg("typed");
    ssid.trim();
    if (!ssid.length()) ssid = server.arg("ssid");
    if (ssid.length()) addNetwork(ssid, server.arg("pass"));
    server.sendHeader("Location", ssid.length() ? "/?saved=1" : "/");
    server.send(302);
  });
  server.on("/remove", HTTP_POST, []() { removeNetwork(server.arg("i").toInt()); server.sendHeader("Location", "/"); server.send(302); });  // "Remove"
  server.on("/done", HTTP_POST, []() {                          // "Done" -> restart
    server.send(200, "text/html", "<meta name='viewport' content='width=device-width'><p style='font-family:sans-serif'>Done. The sensor is restarting and will join your hotspot.</p>");
    delay(1000);
    ESP.restart();
  });
  // Anything else (like the phone checking for a login page) gets sent to the page.
  server.onNotFound([]() { server.sendHeader("Location", "http://" + WiFi.softAPIP().toString() + "/"); server.send(302); });
  server.begin();

  // --- stay here until Done restarts the board ---
  while (true) {
    dns.processNextRequest();
    server.handleClient();
    digitalWrite(LED_PIN, (millis() / 150) % 2);   // fast blink
    delay(2);
  }
}


// =====================================================================
// 9. BOOT BUTTON CHECK
//    What: if BOOT is held for 3 seconds, go to setup mode.
//    Used by: start of every loop().
// =====================================================================
void checkSetupButton() {
  if (digitalRead(BOOT_PIN) != LOW) return;    // not pressed: do nothing
  unsigned long pressed = millis();
  while (digitalRead(BOOT_PIN) == LOW) {
    if (millis() - pressed > 3000) runSetupMode();
    delay(20);
  }
}


// =====================================================================
// 9b. POWER BUTTON (push button acting as an on/off switch)
//     What: press = "off" (deep sleep). Press again = "on" (wakes up and
//     restarts from setup()).
//     "Off" is really deep sleep: the chip uses almost nothing, but the
//     board's regulator/LED still slowly drain the battery.
//     Deep sleep ERASES the waiting list, so we try to send it first.
//     Used by: start of every loop().
// =====================================================================
void goToSleep() {
  Serial.println("Turning off...");

  // --- try to send whatever's waiting (max 15 seconds) ---
  unsigned long start = millis();
  if (WiFi.status() == WL_CONNECTED && timeKnown() && (tokenFresh() || signIn())) {
    while (queueCount > 0 && millis() - start < 15000) {
      if (!sendReading(queue[queueStart])) break;
      queuePop();
    }
  }
  if (queueCount > 0) Serial.printf("%d reading(s) couldn't be sent and are lost\n", queueCount);

  // --- 3 blinks = "going off" ---
  for (int i = 0; i < 3; i++) {
    digitalWrite(LED_PIN, HIGH); delay(150);
    digitalWrite(LED_PIN, LOW);  delay(150);
  }

  // --- keep the button pin held HIGH while asleep (normal pull-up turns off in sleep) ---
  rtc_gpio_pullup_en(GPIO_NUM_33);
  rtc_gpio_pulldown_dis(GPIO_NUM_33);

  // --- wake up when the pin goes LOW (button pressed) ---
  esp_sleep_enable_ext0_wakeup(GPIO_NUM_33, 0);
  esp_deep_sleep_start();          // the code stops here until the next press
}

void checkPowerButton() {
  if (digitalRead(POWER_PIN) != LOW) return;    // not pressed: do nothing
  delay(50);                                    // ignore tiny electrical "bounce"
  if (digitalRead(POWER_PIN) != LOW) return;    // was just noise
  while (digitalRead(POWER_PIN) == LOW) delay(10);   // wait for release, or it wakes right back up
  goToSleep();
}


// =====================================================================
// 10. SETUP() — runs ONCE at power-on, and again every time it wakes up
// =====================================================================
unsigned long lastRead = 0;
bool firstRead = true;

void setup() {
  // --- start serial monitor, LED, sensor ---
  Serial.begin(9600);
  pinMode(LED_PIN, OUTPUT);
  sensors.begin();
  Serial.printf("Sensors found: %d\n", sensors.getDeviceCount());

  // --- BOOT button ---
  pinMode(BOOT_PIN, INPUT_PULLUP);

  // --- power button ---
  rtc_gpio_deinit(GPIO_NUM_33);                 // after waking, turn the pin back into a normal pin
  pinMode(POWER_PIN, INPUT_PULLUP);
  while (digitalRead(POWER_PIN) == LOW) delay(10);   // the press that woke us: wait for release

  // --- load saved Wi-Fi; none saved = go to setup mode ---
  loadNetworks();
  if (netCount == 0) runSetupMode();
  WiFi.mode(WIFI_STA);
  for (int i = 0; i < netCount; i++) wifiMulti.addAP(netSsid[i].c_str(), netPass[i].c_str());
  Serial.printf("%d saved network(s). Hold BOOT for 3 s to add more.\n", netCount);

  // --- ask the internet for the time (UTC). Happens in the background once online ---
  configTime(0, 0, "pool.ntp.org", "time.google.com");
}


// =====================================================================
// 11. LOOP() — runs FOREVER
//     Step 0a: check power button
//     Step 0b: check BOOT button
//     Step 1:  take a reading (once a minute)
//     Step 2:  stay on Wi-Fi
//     Step 3:  send what's waiting
// =====================================================================
void loop() {
  // --- STEP 0a: power button pressed? -> off ---
  checkPowerButton();

  // --- STEP 0b: BOOT button held? -> setup mode ---
  checkSetupButton();

  // --- STEP 1: once a minute, take a reading and add it to the waiting list ---
  // No delay(60000) here: the loop keeps running in between so it can stay
  // on Wi-Fi and send what's waiting.
  if (firstRead || millis() - lastRead >= READ_EVERY_MS) {
    firstRead = false;
    lastRead = millis();
    sensors.requestTemperatures();
    float tempC = sensors.getTempCByIndex(0);
    if (tempC == DEVICE_DISCONNECTED_C) {
      Serial.println("Error: Could not read temperature data");
    } else {
      Serial.printf("Temperature: %.2f C (%.2f F), %d waiting to send\n", tempC, tempC * 9 / 5 + 32, queueCount + 1);
      queuePush(tempC);
    }
  }

  // --- STEP 2: stay on Wi-Fi. No Wi-Fi = LED off, skip the rest, try again ---
  static bool wasOnline = false;
  if (wifiMulti.run(5000) != WL_CONNECTED) {
    if (wasOnline) Serial.println("Lost Wi-Fi, readings will wait in memory");
    wasOnline = false;
    digitalWrite(LED_PIN, LOW);
    delay(1000);
    return;
  }
  if (!wasOnline) {
    Serial.println("Joined Wi-Fi: " + WiFi.SSID() + " (IP " + WiFi.localIP().toString() + ")");
    wasOnline = true;
  }

  // --- STEP 3: send what's waiting, oldest first ---
  // Need the real time and a fresh login first.
  if (!timeKnown()) { delay(200); return; }
  if (!tokenFresh() && !signIn()) { digitalWrite(LED_PIN, LOW); delay(10000); return; }
  digitalWrite(LED_PIN, HIGH);   // LED on = online and signed in

  int sentThisLoop = 0;
  while (queueCount > 0 && sentThisLoop < 20) {   // max 20 at a time, so readings keep happening
    if (!sendReading(queue[queueStart])) break;   // failed: stop, try next loop
    queuePop();                                   // sent: remove from list
    sentThisLoop++;
  }
  delay(200);
}