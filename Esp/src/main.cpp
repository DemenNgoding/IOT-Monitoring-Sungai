#include <Arduino.h>
#include "esp_camera.h"
#include <WiFi.h>
#include "app_httpd.h" // Memanggil library yang kita buat di folder lib
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <WebSocketsClient.h>

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

const char* vps_host = "84.247.174.148";
const int   vps_port = 3000;
const char* stream_path = "/stream-upload";

String uploadImageToSupabase(camera_fb_t* fb);
String uploadLevelToSupabase(int level);

WebSocketsClient webSocket;

void setup() {
  Serial.begin(115200);

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
  config.grab_mode = CAMERA_GRAB_LATEST;
  config.fb_location = CAMERA_FB_IN_PSRAM;
  config.jpeg_quality = 15; // 10-12 Kualitas bagus, 63 Buruk
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

  // Setup WiFi
  WiFi.begin(ssid, password);
  WiFi.setSleep(false);

  Serial.print("WiFi connecting");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected");

  // startCameraServer();

  // Serial.print("Camera Ready! Use 'http://");
  // Serial.print(WiFi.localIP());
  // Serial.println("' to connect");
}

void loop() {
if (millis() - lastCaptureTime > captureInterval) {
    
  streamVideoToVPS();
  
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

    int currentLevel = random(10, 300);
    uploadLevelToSupabase(currentLevel);
    
    
    lastCaptureTime = millis();
  }
}

String uploadImageToSupabase(camera_fb_t* fb) {
  HTTPClient http;
  WiFiClientSecure client;
  
  // 1. Setup Client Secure
  client.setInsecure(); // Abaikan sertifikat
  client.setTimeout(30000); // Timeout diperpanjang jadi 30 detik
  
  String filename = "foto_" + String(millis()) + ".jpg";
  String url = String(supabase_url) + "/storage/v1/object/" + String(bucket_name) + "/" + filename;

  Serial.print("Target URL: ");
  Serial.println(url);

  // Mulai koneksi
  // Note: Gunakan client pointer agar settingan buffer di atas terpakai
  if (http.begin(client, url)) {
    http.addHeader("apikey", supabase_key);
    http.addHeader("Authorization", "Bearer " + String(supabase_key));
    http.addHeader("Content-Type", "image/jpeg");
    http.addHeader("x-upsert", "true");

    // Kirim Data
    int httpResponseCode = http.POST(fb->buf, fb->len);

    String payload = "";
    if (httpResponseCode > 0) {
      payload = http.getString();
    }
    
    http.end(); // Tutup koneksi segera untuk membebaskan RAM
    
    if (httpResponseCode == 200) {
      return String(supabase_url) + "/storage/v1/object/public/" + String(bucket_name) + "/" + filename;
    } else {
      Serial.printf("Error code: %d\n", httpResponseCode);
      Serial.println("Response: " + payload);
      return "";
    }
  } else {
    Serial.println("Unable to connect to Supabase");
    return "";
  }
}

// Fungsi baru untuk upload data ke Tabel Supabase
String uploadLevelToSupabase(int level) {
  HTTPClient http;
  WiFiClientSecure client;
  client.setInsecure();

  // Endpoint REST Supabase untuk tabel 'water_monitoring'
  String url = String(supabase_url) + "/rest/v1/water_level";

  if (http.begin(client, url)) {
    http.addHeader("apikey", supabase_key);
    http.addHeader("Authorization", "Bearer " + String(supabase_key));
    http.addHeader("Content-Type", "application/json");
    http.addHeader("Prefer", "return=minimal");

    // Body JSON
    String jsonBody = "{\"level\": " + String(level) + "}";
    
    int httpResponseCode = http.POST(jsonBody);
    
    if (httpResponseCode >= 200 && httpResponseCode < 300) {
      Serial.println("Level data uploaded to Supabase!");
    } else {
      Serial.printf("Failed to upload level. Error: %d\n", httpResponseCode);
    }
    http.end();
  }
  return "";
}

void streamVideoToVPS() {
  WiFiClient client;

  Serial.println("Connecting to VPS...");
  if (!client.connect(vps_host, vps_port)) {
    Serial.println("Connection failed. Retry in 3s...");
    delay(3000);
    return;
  }

  // Kirim HTTP header untuk multipart stream
  String boundary = "----ESP32Boundary";
  client.println("POST " + String(stream_path) + " HTTP/1.1");
  client.println("Host: " + String(vps_host));
  client.println("Content-Type: multipart/x-mixed-replace; boundary=" + boundary);
  client.println("Transfer-Encoding: chunked");
  client.println("Connection: keep-alive");
  client.println();

  Serial.println("Stream started.");

  while (client.connected()) {
    camera_fb_t* fb = esp_camera_fb_get();
    if (!fb) {
      Serial.println("Frame capture failed");
      delay(100);
      continue;
    }

    // Format MJPEG multipart frame
    String header = "--" + boundary + "\r\n"
                  + "Content-Type: image/jpeg\r\n"
                  + "Content-Length: " + String(fb->len) + "\r\n\r\n";

    // Kirim via chunked encoding
    client.print(String(header.length(), HEX) + "\r\n");
    client.print(header);
    client.print("\r\n");

    client.print(String(fb->len, HEX) + "\r\n");
    client.write(fb->buf, fb->len);
    client.print("\r\n");

    esp_camera_fb_return(fb);
    delay(100); // ~10 FPS, sesuaikan kebutuhan
  }

  Serial.println("Disconnected from VPS. Reconnecting...");
  client.stop();
}