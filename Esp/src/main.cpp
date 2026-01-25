#include <Arduino.h>

// 1. DEFINISI MODEM
#define TINY_GSM_MODEM_SIM7600
#include <TinyGsmClient.h>

// =================================================================
// 2. KONFIGURASI LOCALTUNNEL (GANTI BAGIAN INI!)
// =================================================================
// Masukkan domain Localtunnel Anda (TANPA https:// dan TANPA /)
const char server[]   = "mmgfo-125-160-229-11.a.free.pinggy.link"; 

// Localtunnel support PORT 80 (HTTP Biasa) -> Solusi anti ribet!
const int  port       = 80; 
const String resource = "/api/water-levels";

// 3. PIN WAVESHARE ESP32-S3
#define MODEM_TX      18
#define MODEM_RX      17
#define MODEM_PWRKEY  4

const char apn[] = "redir.tri.co.id"; 
const char user[] = "3gprs"; 
const char pass[] = "3gprs";

HardwareSerial SerialAT(1);
TinyGsm        modem(SerialAT);
TinyGsmClient  client(modem); // Client Polos (Non-Secure)

void modemPowerOn() {
  pinMode(MODEM_PWRKEY, OUTPUT);
  digitalWrite(MODEM_PWRKEY, LOW); delay(100);
  digitalWrite(MODEM_PWRKEY, HIGH); delay(1000);
  digitalWrite(MODEM_PWRKEY, LOW); delay(3000);
}

void setup() {
  Serial.begin(115200);
  delay(1000);
  modemPowerOn();
  SerialAT.begin(115200, SERIAL_8N1, MODEM_RX, MODEM_TX);

  Serial.println("\n--- SYSTEM START (LOCALTUNNEL MODE) ---");
  
  if (!modem.restart()) {
    Serial.println("GAGAL RESTART MODEM");
    while(true);
  }

  Serial.print("Konek APN... ");
  if (!modem.gprsConnect(apn, user, pass)) {
    Serial.println("Gagal");
    while(true);
  }
  Serial.println("Terhubung!");
}

void loop() {
  int waterLevel = random(0, 250);
  String payload = "{\"level\":" + String(waterLevel) + "}";

  Serial.println("\n------------------------------------------------");
  Serial.print("Connecting to: "); Serial.println(server);

  // 1. KONEKSI TCP (Port 80)
  if (!client.connect(server, port)) {
    Serial.println("❌ Gagal Connect. Pastikan URL Localtunnel benar.");
    delay(5000);
    return;
  }

  Serial.println("Terhubung! Mengirim Data...");

  // 2. RAKIT PAKET HTTP MANUAL
  // Header bypass-tunnel-reminder penting untuk Localtunnel
  String httpRequest = "";
  httpRequest += "POST " + resource + " HTTP/1.1\r\n";
  httpRequest += "Host: " + String(server) + "\r\n";
  httpRequest += "Content-Type: application/json\r\n";
  httpRequest += "Connection: close\r\n";
  httpRequest += "Bypass-Tunnel-Reminder: true\r\n"; // Header Khusus Localtunnel
  httpRequest += "Content-Length: " + String(payload.length()) + "\r\n";
  httpRequest += "\r\n";
  httpRequest += payload;

  // 3. KIRIM
  client.print(httpRequest);

  // 4. BACA RESPON
  unsigned long timeout = millis();
  while (client.connected() && millis() - timeout < 10000) {
    if (client.available()) {
      String line = client.readStringUntil('\n');
      Serial.println(line); // Tampilkan respon server
      timeout = millis();
      
      // Jika muncul "HTTP/1.1 200 OK", berarti sukses!
    }
  }
  
  client.stop();
  Serial.println("Selesai. Tunggu 5 detik...");
  delay(5000);
}