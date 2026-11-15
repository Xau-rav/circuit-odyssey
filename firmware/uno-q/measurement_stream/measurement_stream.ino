/**
 * Circuit Odyssey — UNO Q measurement sketch (protocol v1)
 *
 * CRITICAL (UNO Q): use Monitor via Arduino_RouterBridge — NOT Serial.
 * Host USB CDC goes: MCU Monitor → RouterBridge → Linux → USB gadget → Web Serial.
 *
 * Safety: A0 is NOT 5 V tolerant. Use the probe front-end divider so ADC ≤ 3.3 V.
 * MVP claim: ≥1 kS/s continuous; do not advertise 100 kS/s until measured.
 */

#include <Arduino_RouterBridge.h>

// Protocol framing (must match src/engines/measurement/protocol.ts)
static const uint8_t MAGIC0 = 0xC0;
static const uint8_t MAGIC1 = 0xAD;

static bool streaming = false;
static uint32_t sampleRateHz = 1000;
static uint16_t seq = 0;
static const int ADC_CHANNEL = A0;
static const int RESOLUTION_BITS = 14;
static const float VREF = 3.3f;
static const float DIVIDER_RATIO = 1.5f; // circuit volts = adcVolts * ratio (e.g. 5/3.3≈1.5)

static String lineBuf;

uint16_t crc16_update(const uint8_t *data, size_t len) {
  uint16_t crc = 0xFFFF;
  for (size_t i = 0; i < len; i++) {
    crc ^= data[i];
    for (int b = 0; b < 8; b++) {
      crc = (crc & 1) ? (crc >> 1) ^ 0xA001 : (crc >> 1);
    }
  }
  return crc;
}

void sendLine(const String &s) {
  Monitor.println(s);
}

void sendCapabilities() {
  sendLine(
    "CAPABILITIES protocolVersion=1 channels=A0 maxSampleRateHz=5000 "
    "resolutions=12,14 vref=3.3 maxStreamHz=5000 dividerRatio=1.5");
}

void sendFrame(const uint16_t *samples, uint16_t count, uint8_t flags) {
  // Layout: magic(2) ver type seq(2) flags reserved count(2) payload crc(2)
  const size_t header = 10;
  const size_t payload = count * 2;
  uint8_t buf[header + payload + 2];
  buf[0] = MAGIC0;
  buf[1] = MAGIC1;
  buf[2] = 1;
  buf[3] = 1;
  buf[4] = seq & 0xFF;
  buf[5] = (seq >> 8) & 0xFF;
  buf[6] = flags;
  buf[7] = 0;
  buf[8] = count & 0xFF;
  buf[9] = (count >> 8) & 0xFF;
  for (uint16_t i = 0; i < count; i++) {
    buf[header + i * 2] = samples[i] & 0xFF;
    buf[header + i * 2 + 1] = (samples[i] >> 8) & 0xFF;
  }
  uint16_t crc = crc16_update(buf, header + payload);
  buf[header + payload] = crc & 0xFF;
  buf[header + payload + 1] = (crc >> 8) & 0xFF;
  Monitor.write(buf, header + payload + 2);
  seq++;
}

void handleLine(String line) {
  line.trim();
  if (line.length() == 0) return;

  if (line.startsWith("HELLO")) {
    sendLine("HELLO device=UNO-Q firmware=circuit-odyssey-mvp");
    return;
  }
  if (line.startsWith("GET_CAPABILITIES")) {
    sendCapabilities();
    return;
  }
  if (line.startsWith("GET_STATUS")) {
    sendLine(String("STATUS streaming=") + (streaming ? "true" : "false") +
             " dropped=0");
    return;
  }
  if (line.startsWith("GET_CALIBRATION")) {
    sendLine("CALIBRATION gain=1 offset=0 dividerRatio=1.5 vref=3.3");
    return;
  }
  if (line.startsWith("SET_SAMPLE_RATE")) {
    int idx = line.indexOf("hz=");
    if (idx >= 0) {
      uint32_t hz = line.substring(idx + 3).toInt();
      if (hz < 1 || hz > 5000) {
        sendLine("ERR_RATE");
        return;
      }
      sampleRateHz = hz;
      sendLine(String("ACK SET_SAMPLE_RATE hz=") + sampleRateHz);
    }
    return;
  }
  if (line.startsWith("START_STREAM")) {
    streaming = true;
    sendLine("ACK START_STREAM");
    return;
  }
  if (line.startsWith("STOP_STREAM")) {
    streaming = false;
    sendLine("ACK STOP_STREAM");
    return;
  }
  if (line.startsWith("CAPTURE")) {
    int n = 256;
    int idx = line.indexOf("samples=");
    if (idx >= 0) n = constrain(line.substring(idx + 8).toInt(), 16, 2048);
    uint16_t tmp[2048];
    uint32_t periodUs = 1000000UL / max(sampleRateHz, 1UL);
    for (int i = 0; i < n; i++) {
      tmp[i] = (uint16_t)analogRead(ADC_CHANNEL);
      delayMicroseconds(periodUs);
    }
    sendFrame(tmp, (uint16_t)n, 0);
    sendLine("ACK CAPTURE");
    return;
  }
  sendLine("ERR_UNKNOWN");
}

void setup() {
  Monitor.begin(115200);
  analogReadResolution(RESOLUTION_BITS);
  sendLine("BOOT circuit-odyssey measurement_stream");
  sendCapabilities();
}

void loop() {
  while (Monitor.available()) {
    char c = (char)Monitor.read();
    if (c == '\n') {
      handleLine(lineBuf);
      lineBuf = "";
    } else if (c != '\r') {
      lineBuf += c;
      if (lineBuf.length() > 200) lineBuf = "";
    }
  }

  if (streaming) {
    const int chunk = 32;
    uint16_t tmp[chunk];
    uint32_t periodUs = 1000000UL / max(sampleRateHz, 1UL);
    for (int i = 0; i < chunk; i++) {
      tmp[i] = (uint16_t)analogRead(ADC_CHANNEL);
      delayMicroseconds(periodUs);
    }
    sendFrame(tmp, chunk, 0);
  }
}
