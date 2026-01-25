#include <Arduino.h>
#include "esp_camera.h"
#include <WiFi.h>
#include "app_httpd.h" // Memanggil library yang kita buat di folder lib
#include <HTTPClient.h>
#include <WiFiClientSecure.h>

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

// ===========================
// SUPABASE SETTING
// ===========================
const char* supabase_url = "https://sravjzvbepyrbbzwuooo.supabase.co"; // URL Project
const char* supabase_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...."; // Anon Key
const char* bucket_name = "Camera"; // Nama Bucket yang dibuat tadi

unsigned long lastCaptureTime = 0;
const int captureInterval = 10000; // 10 Detik

void configCamera();
String uploadImageToSupabase(camera_fb_t* fb);

void setup() {
  Serial.begin(115200);
  Serial.setDebugOutput(true);
  Serial.println();

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
  config.frame_size = FRAMESIZE_VGA;
  config.pixel_format = PIXFORMAT_JPEG; 
  config.grab_mode = CAMERA_GRAB_WHEN_EMPTY;
  config.fb_location = CAMERA_FB_IN_PSRAM;
  config.jpeg_quality = 12; // 10-12 Kualitas bagus, 63 Buruk
  config.fb_count = 2;

  // Optimasi jika PSRAM terdeteksi (Harusnya terdeteksi di board ini)
  if (config.pixel_format == PIXFORMAT_JPEG) {
    if (psramFound()) {
      Serial.println("PSRAM Found! Optimizing config...");
      config.jpeg_quality = 10;
      config.fb_count = 2; // Double buffering
      config.grab_mode = CAMERA_GRAB_LATEST;
      config.frame_size = FRAMESIZE_SVGA; // Bisa naik ke 800x600
    } else {
      Serial.println("Warning: PSRAM not found/configured correctly!");
      config.frame_size = FRAMESIZE_SVGA;
      config.fb_location = CAMERA_FB_IN_DRAM;
    }
  }

  // Init Kamera
  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("Camera init failed with error 0x%x", err);
    return;
  }

  // Adjust Sensor (Opsional: Memperbaiki warna OV2640)
  sensor_t *s = esp_camera_sensor_get();
  if (s->id.PID == OV3660_PID) {
    s->set_vflip(s, 1);
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

  // Jalankan Server Kamera
  startCameraServer();

  Serial.print("Camera Ready! Use 'http://");
  Serial.print(WiFi.localIP());
  Serial.println("' to connect");
}

void loop() {
  delay(10000);
}