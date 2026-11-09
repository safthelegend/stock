#include <OneWire.h>
#include <DallasTemperature.h>

OneWire oneWire(4);                  // data wire on D4
DallasTemperature sensors(&oneWire);

void setup() {
  Serial.begin(9600);
  sensors.begin();
  Serial.printf("Sensors found: %d\n", sensors.getDeviceCount());
}

void loop() {
  sensors.requestTemperatures();
  Serial.println(sensors.getTempCByIndex(0));
  delay(2000);
}