# Box temperature sensor

An ESP32 with a DS18B20 sensor rides in the box. Once a minute it measures the
temperature and sends it to our Firebase database through the delivery
person's phone hotspot. In the member portal, **Log a delivery → Temperature**
has Start and Stop buttons. The readings between them are shown live and saved
with the delivery. Temperature logs are private (only the member and admins
see them) until an admin ticks **Show the temperature log on the public
delivery log** in the Review tab.

```
DS18B20 ──► ESP32 ──Wi-Fi──► phone hotspot ──► Firebase ◄── member portal (Start / Stop)
                                                         ◄── public log (only if an admin publishes it)
```

## Wiring

| DS18B20 wire | ESP32 |
|---|---|
| Red (VDD) | 3.3V |
| Black (GND) | GND |
| Yellow (DATA) | GPIO 4 |

The DS18B20 adapter board has the 4.7 kΩ pull-up built in, so no extra
resistor is needed.

The LED on GPIO 25 is on while the sensor is online and signed in, and blinks
fast in setup mode.

## One-time setup for each sensor (an admin does this)

1. **Make the sensor an account.** Firebase console → Authentication → Users →
   Add user. Use an email like `sensor1@stocktheblock.org` and a long random
   password. Copy the **User UID** it shows.
2. **Give it the sensor role.** Firestore → `roles` collection → Add document.
   Document ID = that UID, field `role` (string) = `sensor`.
3. **Name it for the portal.** Firestore → Start collection `sensors` (first
   time only) → Add document. Document ID = the same UID, field `name`
   (string) = `Box sensor 1`. This is the name members pick in the portal.
4. **Publish the rules.** Copy `firestore.rules` from the repo into Firestore →
   Rules → Publish. (Only needed once, after this feature lands.)

## Flashing the ESP32

1. In the Arduino IDE, install from Library Manager: **OneWire**,
   **DallasTemperature** and **ArduinoJson** (version 7).
2. Copy `secrets.example.h` to `secrets.h` in this folder and fill in the
   sensor's email and password from step 1. `secrets.h` is git-ignored.
3. Board: your ESP32 board. Upload, then open the Serial Monitor at 9600 baud.
4. Add your hotspot (below). Then you should see `Joined Wi-Fi: …`,
   `Signed in as sensor …` and `Sent 3.50 C taken at …` every minute.

## Adding a phone hotspot (no code editing)

The first time it powers on with no networks saved, or any time you **hold
the BOOT button for 3 seconds** (until the LED blinks fast), the sensor goes
into setup mode:

Turn your hotspot on **before** you press BOOT: the sensor looks for nearby
networks the moment it enters setup mode, and a phone's hotspot switches off
while the phone is joined to the sensor.

1. On your phone, join the Wi-Fi network **StockTheBlock-Sensor**.
2. A page opens by itself (if not, open a browser and go to `192.168.4.1`).
3. Pick your hotspot from the list, or type its name exactly, and enter its
   password.
4. Add more if you like (up to 5; the oldest is replaced), then press
   **Done, start measuring**. The sensor restarts and joins whichever saved
   network is around.

Saved networks survive power-offs and uploading new code. Readings pause
while the sensor is in setup mode.

## On a delivery

1. Turn on the phone's hotspot. **The ESP32 only sees 2.4 GHz Wi-Fi**:
   on an iPhone, Settings → Personal Hotspot → turn on *Allow Others to Join*
   and *Maximize Compatibility*; on Android, set the hotspot band to 2.4 GHz.
2. Power the sensor: a USB power bank, or 4×AA NiMH on VIN. Wait for the LED.
3. In the portal, press **Start recording** at pickup and **Stop recording** at
   drop-off, then save the delivery.

If the hotspot drops, the sensor keeps measuring and holds up to 12 hours of
readings, sending them when it's back online. Each reading keeps the time it
was taken.

## Good to know

- The phone's clock and the sensor's clock (from the internet) are both real
  time, which is how Start/Stop line up with the readings.
- A delivery holds up to 500 readings (about 8 hours at one a minute).
- The sensor skips checking Google's HTTPS certificate (`setInsecure()`) to
  keep setup simple. The connection is still encrypted.
- Power: a USB power bank, or 4×AA NiMH (about 4.8 V) on VIN and GND. With
  Wi-Fi on, the ESP32 draws roughly 50–100 mA, so either lasts many
  deliveries. Some power banks switch off when the draw is this small; if the
  LED goes dark mid-walk, try another bank. There's no deep sleep on purpose:
  it would wipe the readings waiting in memory and the sign-in token, and
  deliveries are short.
- If the sensor powers on before the hotspot is up, it doesn't know the time
  yet. Each reading is stored with the ESP32's own uptime clock (`millis()`),
  and only sent once the internet time is known, as "now minus how long ago
  it was taken". So early readings still get the right time. Unplugging it
  before it's been online loses those readings, since they live in memory.
