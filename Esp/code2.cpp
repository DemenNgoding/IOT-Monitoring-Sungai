#include <Arduino.h>

#include <WiFi.h>
#include "app_httpd.h" // Memanggil library yang kita buat di folder lib
#include <HTTPClient.h>
#include <WiFiClientSecure.h>

#define TINY_GSM_MODEM_A7672X 
#define TINY_GSM_MODEM_HAS_SSL

#include <TinyGsmClient.h>

// const char server[]   = "iot-river-monitoringsungai-omirwb-3a79f4-84-247-174-148.traefik.me"; 
const char server[]   = "idaho-resumes-ipaq-partners.trycloudflare.com"; 

// Localtunnel support PORT 80 (HTTP Biasa) -> Solusi anti ribet!
const int  port       = 443; 
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
TinyGsmClientSecure  client(modem); // Client Polos (Non-Secure)

// ==========================================
// PIN MAPPING: WAVESHARE ESP32-S3-SIM7670G
// ==========================================
#define PWDN_GPIO_NUM     -1
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM     34
#define SIOD_GPIO_NUM     15
#define SIOC_GPIO_NUM     16
#define Y9_GPIO_NUM       14
#define Y8_GPIO_NUM       13
#define Y7_GPIO_NUM       12
#define Y6_GPIO_NUM       11
#define Y5_GPIO_NUM       10
#define Y4_GPIO_NUM       9
#define Y3_GPIO_NUM       8
#define Y2_GPIO_NUM       7
#define VSYNC_GPIO_NUM    36
#define HREF_GPIO_NUM     35
#define PCLK_GPIO_NUM     37

// ===========================
// WIFI SETTINGS
// ===========================
const char *ssid = "Alfian";
const char *password = "alfian12";

// const char *ssid = "Workshop";
// const char *password = "workshop525";

// ===========================
// SUPABASE SETTING
// ===========================
const char* supabase_url = "https://sravjzvbepyrbbzwuooo.supabase.co";
const char* supabase_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNyYXZqenZiZXB5cmJiend1b29vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyMDQ2MzMsImV4cCI6MjA4MDc4MDYzM30.fQHfy_Url5VDa24SXpKWiM33H9clNGhHsy90f_4yN70";
const char* bucket_name = "Camera"; // Nama Bucket yang dibuat tadi

unsigned long lastCaptureTime = 0;
const int captureInterval = 10000; // 10 Detik

String uploadImageToSupabase(camera_fb_t* fb);

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

  // ========================================================
  // PENGGANTI setStrictSSL (Manual Command)
  // ========================================================
  Serial.println("Configuring SSL Manual...");
  
  // Set SSL Version ke TLS 1.2
  modem.sendAT(GF("+CSSLCFG=\"sslversion\",0,3"));
  modem.waitResponse();

  // Matikan Verifikasi Sertifikat (Supaya Cloudflare mau terima)
  modem.sendAT(GF("+CSSLCFG=\"ignore invalid cert\",0,1"));
  modem.waitResponse();
}

void loop() {
  int waterLevel = random(0, 250);
  String payload = "{\"level\":" + String(waterLevel) + "}";

  Serial.println("\n------------------------------------------------");
  Serial.print("Connecting to: "); Serial.println(server);

  // 1. KONEKSI TCP (Port 80)
  if (!client.connect(server, port, 30)) {
    Serial.println("❌ Gagal Connect. Pastikan URL Localtunnel benar.");
    delay(5000);
    return;
  }

  Serial.println("Terhubung! Mengirim Data...");

  // 2. RAKIT PAKET HTTP MANUAL
  String httpRequest = "";
  httpRequest += "POST " + resource + " HTTP/1.1\r\n";
  httpRequest += "Host: " + String(server) + "\r\n";
  httpRequest += "Content-Type: application/json\r\n";
  httpRequest += "Connection: close\r\n";
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