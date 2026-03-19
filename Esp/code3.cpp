#include <Arduino.h>
#include "esp_camera.h"
#include "app_httpd.h" // Memanggil library yang kita buat di folder lib

#define TINY_GSM_MODEM_A7672X 
#define TINY_GSM_MODEM_HAS_SSL

#include <TinyGsmClient.h>
#include <ArduinoHttpClient.h>

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

#define MODEM_TX      18
#define MODEM_RX      17
#define MODEM_PWRKEY  4

const char apn[] = "redir.tri.co.id"; 
const char user[] = "3gprs"; 
const char pass[] = "3gprs";

// ===========================
// SUPABASE SETTING
// ===========================
const char* supabase_url = "https://sravjzvbepyrbbzwuooo.supabase.co";
const int  port          = 443; 
const char* supabase_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNyYXZqenZiZXB5cmJiend1b29vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyMDQ2MzMsImV4cCI6MjA4MDc4MDYzM30.fQHfy_Url5VDa24SXpKWiM33H9clNGhHsy90f_4yN70";
const char* bucket_name  = "Camera"; // Nama Bucket yang dibuat tadi

unsigned long lastCaptureTime = 0;
const int captureInterval = 10000; // 10 Detik

HardwareSerial SerialAT(1);
TinyGsm        modem(SerialAT);
TinyGsmClientSecure  client(modem); // Client Polos (Non-Secure)
HttpClient http(client, supabase_url, port);

String uploadImageToSupabase(camera_fb_t* fb);

void modemPowerOn() {
  pinMode(MODEM_PWRKEY, OUTPUT);
  digitalWrite(MODEM_PWRKEY, LOW); delay(100);
  digitalWrite(MODEM_PWRKEY, HIGH); delay(1000);
  digitalWrite(MODEM_PWRKEY, LOW); delay(3000);
}

void setup() {
  Serial.begin(115200);

  

  Serial.println("Inisialisasi Modem...");
  modemPowerOn();   
  SerialAT.begin(115200, SERIAL_8N1, MODEM_RX, MODEM_TX);

  // 3. PAKSA MODEM MERESPON (Manual Handshake)
  Serial.println("Sinkronisasi Baudrate...");
  int retry = 0;
  bool modemReady = false;
  
  while (retry < 15) {
    SerialAT.println("AT"); // Kirim perintah manual
    delay(500);
    if (SerialAT.available()) {
      String res = SerialAT.readString();
      if (res.indexOf("OK") != -1) {
        Serial.println("\nModem Respon OK! Melanjutkan...");
        modemReady = true;
        break;
      }
    }
    Serial.print(".");
    retry++;
  }

  if (!modemReady) {
    Serial.println("\n[FATAL] Modem tetap tidak respon. Cek Baterai!");
    while(true); // Stop di sini jika gagal
  }

  // 4. Baru jalankan restart library
  Serial.println("Menjalankan modem.restart()...");
  delay(3000);

  if (!modem.restart()) {
    Serial.println("Gagal Restart Modem!");
    while(true);
  }

  Serial.println("Menghubungkan ke GPRS...");
  if (!modem.gprsConnect(apn, user, pass)) {
    Serial.println("Gagal GPRS!");
    while(true);
  }
  Serial.println("GPRS Terhubung!");

  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_sccb_sda = SIOD_GPIO_NUM;
  config.pin_sccb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000; // 20MHz stabil untuk streaming
  
  // Konfigurasi Format
  config.frame_size = FRAMESIZE_QVGA;
  config.pixel_format = PIXFORMAT_JPEG; 
  config.grab_mode = CAMERA_GRAB_WHEN_EMPTY;
  config.fb_location = CAMERA_FB_IN_PSRAM;
  config.jpeg_quality = 12; // 10-12 Kualitas bagus, 63 Buruk
  config.fb_count = 2;

  config.frame_size = FRAMESIZE_QVGA;
  config.fb_location = CAMERA_FB_IN_DRAM;

  // Init Kamera
  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("Camera init failed with error 0x%x", err);
    return;
  }

  // Adjust Sensor (Opsional: Memperbaiki warna OV2640)
  sensor_t *s = esp_camera_sensor_get();
  if (s->id.PID == OV3660_PID) {
    // s->set_vflip(s, 1);
    // s->set_brightness(s, 1);
    // s->set_saturation(s, -2);
  }
}

void loop() {
if (millis() - lastCaptureTime > captureInterval) {

    if (!modem.isGprsConnected()) {
      Serial.println("GPRS terputus, mencoba konek ulang...");
      modem.gprsConnect(apn, user, pass);
    }
    
    // Ambil Gambar
    camera_fb_t * fb = esp_camera_fb_get();
    if (!fb) {
      Serial.println("Camera capture failed");
      return;
    }
    
    Serial.printf("Picture taken! Size: %d bytes. Uploading...\n", fb->len);

    // Upload ke Supabase
    String fileUrl = uploadImageToSupabase(fb);
    
    if (fileUrl != "") {
      Serial.println("Upload Success!");
      Serial.println("File URL: " + fileUrl);
    } else {
      Serial.println("Upload Failed.");
    }

    // Kembalikan memory
    esp_camera_fb_return(fb);
    
    lastCaptureTime = millis();
  }
}

String uploadImageToSupabase(camera_fb_t* fb) {
  
  String filename = "foto_" + String(millis()) + ".jpg";
  String url = String(supabase_url) + "/storage/v1/object/" + String(bucket_name) + "/" + filename;

  Serial.print("Target URL: ");
  Serial.println(url);

  // Mulai koneksi
  // Note: Gunakan client pointer agar settingan buffer di atas terpakai
  http.beginRequest();
  http.post(url);
  http.sendHeader("apikey", supabase_key);
  http.sendHeader("Authorization", "Bearer " + String(supabase_key));
  http.sendHeader("Content-Type", "image/jpeg");
  http.sendHeader("Content-Length", fb->len);
  http.sendHeader("x-upsert", "true");
  http.endRequest();

  // Kirim Data
  client.write(fb->buf, fb->len);

  int statusCode = http.responseStatusCode();
  String response = http.responseBody();

  if (statusCode == 200 || statusCode == 201) {
    Serial.println("Upload Berhasil!");
  } else {
    Serial.printf("Upload Gagal. Status: %d\n", statusCode);
    Serial.println("Response: " + response);
  }
}