// Stock the Block - box temperature sensor (ESP32 + DS18B20)
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
// Setup: see README.md in this folder. You need secrets.h (copy
// secrets.example.h) and the ArduinoJson library (Library Manager).

#include <WiFi.h>
#include <WiFiMulti.h>
#include <WebServer.h>
#include <DNSServer.h>
#include <Preferences.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <time.h>
#include <OneWire.h>
#include <DallasTemperature.h>

#include "secrets.h"   // the sensor's Firebase login

// ---------- pins and timing ----------
#define ONE_WIRE_BUS 4                         // DS18B20 data wire
#define LED_PIN 25                             // on = connected and signed in; fast blink = setup mode
#define BOOT_PIN 0                             // the BOOT button on the ESP32 board
const unsigned long READ_EVERY_MS = 60000;     // one reading a minute

// ---------- Firebase ----------
const char* PROJECT_ID = "stock-the-block";

OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature sensors(&oneWire);
WiFiMulti wifiMulti;

// ---------- readings waiting to be sent ----------
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

void queuePop() {
  queueStart = (queueStart + 1) % QUEUE_SIZE;
  queueCount--;
}

// ---------- signing in to Firebase ----------
// The sensor has its own account (email + password in secrets.h). Signing in
// gives an "ID token" that proves who we are; it lasts an hour.
String idToken = "";
String uid = "";                 // the sensor account's user ID
unsigned long tokenTakenAt = 0;

bool signIn() {
  WiFiClientSecure client;
  client.setInsecure();          // skips checking Google's certificate (keeps setup simple)
  HTTPClient http;
  String url = String("https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=") + FIREBASE_API_KEY;
  http.begin(client, url);
  http.addHeader("Content-Type", "application/json");

  JsonDocument body;
  body["email"] = SENSOR_EMAIL;
  body["password"] = SENSOR_PASSWORD;
  body["returnSecureToken"] = true;
  String out;
  serializeJson(body, out);

  int code = http.POST(out);
  String reply = http.getString();
  http.end();

  if (code != 200) {
    Serial.printf("Sign-in failed (%d): %s\n", code, reply.c_str());
    return false;
  }
  JsonDocument res;
  deserializeJson(res, reply);
  idToken = res["idToken"].as<String>();
  uid = res["localId"].as<String>();
  tokenTakenAt = millis();
  Serial.println("Signed in as sensor " + uid);
  return true;
}

bool tokenFresh() {
  // Renew after 50 minutes, before the hour runs out.
  return idToken.length() > 0 && millis() - tokenTakenAt < 50UL * 60UL * 1000UL;
}

// ---------- the clock ----------
bool timeKnown() {
  return time(nullptr) > 1700000000;   // any time after 2023 means NTP has answered
}

// ---------- sending one reading ----------
// Returns true if the reading is done with (sent, or already there), false to
// try again later.
bool sendReading(const Reading& r) {
  // When was it taken, in real time? Now, minus how long ago it was taken.
  time_t takenAt = time(nullptr) - (time_t)((millis() - r.ms) / 1000);
  struct tm t;
  gmtime_r(&takenAt, &t);
  char iso[25];
  strftime(iso, sizeof(iso), "%Y-%m-%dT%H:%M:%SZ", &t);

  // The document ID is the time in seconds, so if a send is retried it can't
  // create a second copy of the same reading.
  String url = String("https://firestore.googleapis.com/v1/projects/") + PROJECT_ID +
               "/databases/(default)/documents/sensors/" + uid +
               "/readings?documentId=" + String((unsigned long)takenAt);

  JsonDocument body;
  body["fields"]["c"]["doubleValue"] = round(r.tempC * 100) / 100.0;
  body["fields"]["at"]["timestampValue"] = iso;
  String out;
  serializeJson(body, out);

  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;
  http.begin(client, url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", "Bearer " + idToken);
  int code = http.POST(out);
  String reply = http.getString();
  http.end();

  if (code == 200) {
    Serial.printf("Sent %.2f C taken at %s\n", r.tempC, iso);
    return true;
  }
  if (code == 409) return true;            // already there from an earlier try
  if (code == 401) { idToken = ""; return false; }   // token expired: sign in again
  if (code == 403) {
    // The database rules said no. Retrying won't change that, so drop it.
    Serial.println("Rejected by the database rules: " + reply);
    return true;
  }
  Serial.printf("Send failed (%d), will retry\n", code);
  return false;
}

// ---------- saved Wi-Fi networks ----------
// Kept in the ESP32's flash memory ("Preferences"), so they survive power-offs
// and uploading new code.
const int MAX_NETS = 5;
String netSsid[MAX_NETS], netPass[MAX_NETS];
int netCount = 0;
Preferences prefs;

void loadNetworks() {
  prefs.begin("wifi", true);              // true = read-only
  netCount = min((int)prefs.getInt("n", 0), MAX_NETS);
  for (int i = 0; i < netCount; i++) {
    netSsid[i] = prefs.getString(("s" + String(i)).c_str(), "");
    netPass[i] = prefs.getString(("p" + String(i)).c_str(), "");
  }
  prefs.end();
}

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

void removeNetwork(int i) {
  if (i < 0 || i >= netCount) return;
  for (int j = i + 1; j < netCount; j++) { netSsid[j - 1] = netSsid[j]; netPass[j - 1] = netPass[j]; }
  netCount--;
  saveNetworks();
}

// ---------- setup mode: the phone page for adding networks ----------
// The ESP32 becomes a Wi-Fi network itself. The DNS server answers every web
// address with the ESP32's own address, which is what makes phones pop the
// page open on their own (like hotel Wi-Fi). Readings pause in this mode.
WebServer server(80);
DNSServer dns;
String scanned = "";   // <option>s for the networks nearby

String esc(const String& in) {            // network names can contain < > & "
  String out;
  for (char c : in) {
    if (c == '<') out += "&lt;"; else if (c == '>') out += "&gt;";
    else if (c == '&') out += "&amp;"; else if (c == '"') out += "&quot;"; else out += c;
  }
  return out;
}

void scanNearby() {
  int n = WiFi.scanNetworks();
  scanned = "";
  for (int i = 0; i < n; i++) {
    String name = WiFi.SSID(i);
    if (name.length() && scanned.indexOf(">" + esc(name) + "<") < 0) scanned += "<option>" + esc(name) + "</option>";
  }
}

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

void runSetupMode() {
  Serial.println("Setup mode: join the Wi-Fi \"StockTheBlock-Sensor\" on your phone");
  WiFi.disconnect();
  WiFi.mode(WIFI_AP_STA);                 // its own network + able to scan for others
  WiFi.softAP("StockTheBlock-Sensor");
  dns.start(53, "*", WiFi.softAPIP());
  scanNearby();

  server.on("/", handleRoot);
  server.on("/scan", []() { scanNearby(); server.sendHeader("Location", "/"); server.send(302); });
  server.on("/add", HTTP_POST, []() {
    String ssid = server.arg("typed");
    ssid.trim();
    if (!ssid.length()) ssid = server.arg("ssid");
    if (ssid.length()) addNetwork(ssid, server.arg("pass"));
    server.sendHeader("Location", ssid.length() ? "/?saved=1" : "/");
    server.send(302);
  });
  server.on("/remove", HTTP_POST, []() { removeNetwork(server.arg("i").toInt()); server.sendHeader("Location", "/"); server.send(302); });
  server.on("/done", HTTP_POST, []() {
    server.send(200, "text/html", "<meta name='viewport' content='width=device-width'><p style='font-family:sans-serif'>Done. The sensor is restarting and will join your hotspot.</p>");
    delay(1000);
    ESP.restart();
  });
  // Anything else (like the phone checking for a login page) gets sent to the page.
  server.onNotFound([]() { server.sendHeader("Location", "http://" + WiFi.softAPIP().toString() + "/"); server.send(302); });
  server.begin();

  while (true) {                          // stays here until Done restarts the board
    dns.processNextRequest();
    server.handleClient();
    digitalWrite(LED_PIN, (millis() / 150) % 2);   // fast blink
    delay(2);
  }
}

// Held for 3 seconds? Then go to setup mode.
void checkSetupButton() {
  if (digitalRead(BOOT_PIN) != LOW) return;
  unsigned long pressed = millis();
  while (digitalRead(BOOT_PIN) == LOW) {
    if (millis() - pressed > 3000) runSetupMode();
    delay(20);
  }
}

// ---------- setup and loop ----------
unsigned long lastRead = 0;
bool firstRead = true;

void setup() {
  Serial.begin(9600);
  pinMode(LED_PIN, OUTPUT);
  sensors.begin();
  Serial.printf("Sensors found: %d\n", sensors.getDeviceCount());

  pinMode(BOOT_PIN, INPUT_PULLUP);

  // Every network saved from the setup page. It joins whichever one is around.
  loadNetworks();
  if (netCount == 0) runSetupMode();      // nothing saved yet: ask for one
  WiFi.mode(WIFI_STA);
  for (int i = 0; i < netCount; i++) wifiMulti.addAP(netSsid[i].c_str(), netPass[i].c_str());
  Serial.printf("%d saved network(s). Hold BOOT for 3 s to add more.\n", netCount);

  // Ask the internet for the time, in UTC. Happens in the background once online.
  configTime(0, 0, "pool.ntp.org", "time.google.com");
}

void loop() {
  checkSetupButton();

  // 1. Once a minute, take a reading. No delay(60000) here: the loop keeps
  //    running in between so it can stay on Wi-Fi and send what's waiting.
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

  // 2. Stay on Wi-Fi (the phone's hotspot).
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

  // 3. Send what's waiting, oldest first, once we know the time and are signed in.
  if (!timeKnown()) { delay(200); return; }
  if (!tokenFresh() && !signIn()) { digitalWrite(LED_PIN, LOW); delay(10000); return; }
  digitalWrite(LED_PIN, HIGH);

  int sentThisLoop = 0;
  while (queueCount > 0 && sentThisLoop < 20) {   // a few at a time, so readings keep happening
    if (!sendReading(queue[queueStart])) break;
    queuePop();
    sentThisLoop++;
  }
  delay(200);
}
