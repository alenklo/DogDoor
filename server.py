import cv2
import time
import threading
import numpy as np
import RPi.GPIO as GPIO
import requests
import base64
import json
import os
from flask import Flask, Response, jsonify, request, render_template

# --- CONSTANTS & SETUP ---
CONFIG_FILE = "config.json"
GPIO.setmode(GPIO.BCM)
GPIO.setwarnings(False)

app = Flask(__name__, 
            static_folder="dist/assets", 
            template_folder="dist", 
            static_url_path="/assets")

# Default Config
default_config = {
    "doorMode": "AUTO",    # AUTO, MANUAL, LOCKED
    "motorSpeed": 3,       # 1-5
    "holdOpenTime": 10,    # Seconds
    "cameraEnabled": True,
    # GPIO Pinout
    "gpio": {
        "dir": 20, "step": 21, "enable": 16,
        "limitOpen": 19, "limitClose": 26,
        "safety": 13,
        "btnOpen": 5, "btnClose": 6,
        "proxOutside": 23, "proxInside": 24
    },
    # AI Settings
    "confidenceThreshold": 0.5,
    "gracePeriod": 1.5,
    "detectionZone": { "x": 0.0, "y": 0.0, "w": 1.0, "h": 1.0 },
    "aiFallbackEnabled": False,
    "geminiApiKey": "",
    "notifications": { "enabled": False, "apiKey": "" }
}

# Global State
config = default_config.copy()
status = {
    "state": "CLOSED", # CLOSED, OPEN, OPENING, CLOSING, LOCKED, OBSTRUCTED, DETECTING
    "elapsed_time": 0, 
    "last_log": "System Initialized"
}
sim_state = {
    "enabled": False,
    "overrides": {}
}

# Locks
frame_lock = threading.Lock()
state_lock = threading.RLock()
output_frame = None

# --- CONFIG MANAGEMENT ---
def load_config():
    global config
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, 'r') as f:
                saved = json.load(f)
                for k, v in saved.items():
                    if k in ["gpio", "notifications", "detectionZone"] and isinstance(v, dict):
                        config[k].update(v)
                    else:
                        config[k] = v
                print("[INFO] Configuration loaded.")
        except Exception as e:
            print(f"[ERR] Config load failed: {e}")

def save_config():
    try:
        with open(CONFIG_FILE, 'w') as f:
            json.dump(config, f, indent=4)
        print("[INFO] Configuration saved.")
    except Exception as e:
        print(f"[ERR] Config save failed: {e}")

load_config()

# --- CONTROLLER CLASS ---
class DoorController:
    def __init__(self):
        self.running = True
        self.command_queue = None
        self.open_start_time = 0
        
        # Setup GPIO
        self.setup_gpio()
        
        # Homing Sequence: Ensure door is CLOSED on boot
        # Run this in a separate short-lived thread so we don't block initialization
        threading.Thread(target=self.home_door_on_boot).start()
        
        # Start Main Control Thread
        self.thread = threading.Thread(target=self.control_loop)
        self.thread.daemon = True
        self.thread.start()

    def setup_gpio(self):
        pins = config["gpio"]
        GPIO.setup(pins["dir"], GPIO.OUT)
        GPIO.setup(pins["step"], GPIO.OUT)
        GPIO.setup(pins["enable"], GPIO.OUT)
        GPIO.output(pins["enable"], GPIO.LOW) # Enable Driver
        
        inputs = [pins["limitOpen"], pins["limitClose"], pins["safety"], 
                  pins["btnOpen"], pins["btnClose"], pins["proxOutside"], pins["proxInside"]]
        for p in inputs:
            GPIO.setup(p, GPIO.IN, pull_up_down=GPIO.PUD_UP)

    def log(self, msg):
        print(f"[DOOR] {msg}")
        with state_lock:
            status["last_log"] = msg

    def get_delay(self):
        speeds = {1: 0.0030, 2: 0.0020, 3: 0.0012, 4: 0.0008, 5: 0.0004}
        return speeds.get(config.get("motorSpeed", 3), 0.0012)

    def read_input(self, pin_key):
        """Reads physical pin OR checks simulation overrides."""
        if sim_state["enabled"]:
            if pin_key in sim_state["overrides"]:
                return GPIO.LOW if sim_state["overrides"][pin_key] else GPIO.HIGH
        
        pin = config["gpio"].get(pin_key)
        if pin is None: return GPIO.HIGH 
        return GPIO.input(pin)

    def is_triggered(self, pin_key):
        return self.read_input(pin_key) == GPIO.LOW

    def step_motor(self, direction_open):
        pins = config["gpio"]
        GPIO.output(pins["dir"], GPIO.HIGH if direction_open else GPIO.LOW)
        GPIO.output(pins["step"], GPIO.HIGH)
        time.sleep(self.get_delay() / 2)
        GPIO.output(pins["step"], GPIO.LOW)
        time.sleep(self.get_delay() / 2)

    def home_door_on_boot(self):
        """Slowly closes the door until limit hit to ensure known state."""
        time.sleep(2) # Wait for system to settle
        self.log("Homing... Checking Close Limit")
        
        # If already closed, done.
        if self.is_triggered("limitClose"):
            self.log("Door is CLOSED (Limit Hit)")
            return

        # Move towards close gently
        self.log("Closing door to Home Position...")
        # We manually step here to avoid State Machine interference
        pins = config["gpio"]
        GPIO.output(pins["dir"], GPIO.LOW) # Close direction
        
        for _ in range(20000): # Safety max steps
            if self.is_triggered("limitClose"):
                self.log("Homing Complete: Closed")
                break
            if self.is_triggered("safety"):
                self.log("Homing Aborted: Obstruction")
                break
            
            GPIO.output(pins["step"], GPIO.HIGH)
            time.sleep(0.002) # Slow speed
            GPIO.output(pins["step"], GPIO.LOW)
            time.sleep(0.002)

    def control_loop(self):
        while self.running:
            mode = config["doorMode"]
            current_state = status["state"]
            
            # --- INPUT PROCESSING ---
            # 1. Emergency/Outside Override
            if self.is_triggered("proxOutside"):
                if current_state not in ["OPEN", "OPENING"]:
                    self.log("Outside Sensor -> Opening")
                    self.command_queue = 'open'

            # 2. Inside Sensor (Auto only)
            if self.is_triggered("proxInside") and mode == "AUTO":
                 if current_state not in ["OPEN", "OPENING"]:
                    self.log("Inside Sensor -> Opening")
                    self.command_queue = 'open'
            
            # 3. Physical Buttons
            if mode != "LOCKED":
                if self.is_triggered("btnOpen"): self.command_queue = 'open'
                if self.is_triggered("btnClose"): self.command_queue = 'close'

            # --- STATE MACHINE ---
            if mode == "LOCKED":
                if self.command_queue != 'open': 
                    if current_state not in ["CLOSED", "CLOSING", "LOCKED"]:
                        self.command_queue = 'close'
                    with state_lock:
                        if current_state == "CLOSED": status["state"] = "LOCKED"

            # Execute Commands
            if self.command_queue == 'open':
                self.perform_move(open_dir=True)
                self.command_queue = None
            
            elif self.command_queue == 'close':
                self.perform_move(open_dir=False)
                self.command_queue = None
            
            # Auto Close Timer
            elif current_state == "OPEN" and mode == "AUTO":
                elapsed = time.time() - self.open_start_time
                with state_lock: status["elapsed_time"] = elapsed
                
                if elapsed > config["holdOpenTime"]:
                    if not self.is_triggered("safety"):
                        self.log("Timer Expired -> Closing")
                        self.command_queue = 'close'
                    else:
                        self.log("Obstruction! Holding open...")
                        self.open_start_time = time.time()

            time.sleep(0.05)

    def perform_move(self, open_dir):
        target_limit = "limitOpen" if open_dir else "limitClose"
        state_str = "OPENING" if open_dir else "CLOSING"
        final_state = "OPEN" if open_dir else "CLOSED"
        
        self.log(f"Starting {state_str}...")
        with state_lock: status["state"] = state_str
        
        if not open_dir and self.is_triggered("safety"):
            self.log("Cannot Close - Obstacle Detected")
            with state_lock: status["state"] = "OBSTRUCTED"
            return

        start_time = time.time()
        MAX_MOVE_TIME = 30.0 # Safety Timeout in seconds

        while True:
            # 1. Safety Timeout
            if time.time() - start_time > MAX_MOVE_TIME:
                self.log(f"TIMEOUT! Motor stopped after {MAX_MOVE_TIME}s")
                break

            # 2. Check Limit Switch
            if self.is_triggered(target_limit):
                self.log(f"Limit Reached: {final_state}")
                break
            
            # 3. Check Interrupts (Reverse Direction)
            if open_dir and self.command_queue == 'close':
                self.log("Interrupt: Reversing to Close")
                return 
            if not open_dir and self.command_queue == 'open':
                self.log("Interrupt: Reversing to Open")
                return 

            # 4. Safety Checks (During Closing)
            if not open_dir:
                # Pinch / Safety
                if self.is_triggered("safety"):
                    self.log("SAFETY SENSOR HIT! Reversing...")
                    time.sleep(0.5)
                    self.perform_move(open_dir=True) # Recursive Open
                    return # Exit this close loop completely

                # Sensors triggering reopen
                if self.is_triggered("proxOutside") or (config["doorMode"]=="AUTO" and self.is_triggered("proxInside")):
                    self.log("Sensor Hit! Reopening...")
                    self.perform_move(open_dir=True)
                    return

            self.step_motor(open_dir)
        
        with state_lock:
            status["state"] = final_state
            if final_state == "OPEN":
                self.open_start_time = time.time()

# Init Controller
door_ctrl = DoorController()

# --- AI / CAMERA ---
def verify_with_gemini(frame):
    key = config.get("geminiApiKey", "")
    if not key: return False
    try:
        retval, buffer = cv2.imencode('.jpg', frame)
        b64 = base64.b64encode(buffer).decode('utf-8')
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={key}"
        pl = {"contents": [{"parts": [{"text": "Is there a dog? YES/NO"}, {"inline_data": {"mime_type": "image/jpeg", "data": b64}}]}]}
        resp = requests.post(url, json=pl, headers={'Content-Type': 'application/json'}, timeout=5)
        if resp.status_code == 200:
            return "YES" in resp.json()['candidates'][0]['content']['parts'][0]['text'].upper()
    except Exception as e:
        print(f"[GEMINI] Error: {e}")
    return False

def camera_loop():
    global output_frame
    print("[INFO] Camera Thread Started")
    
    try:
        net = cv2.dnn.readNetFromCaffe("MobileNetSSD_deploy.prototxt", "MobileNetSSD_deploy.caffemodel")
        CLASSES = ["background", "aeroplane", "bicycle", "bird", "boat", "bottle", "bus", "car", "cat", "chair", "cow", "diningtable", "dog", "horse", "motorbike", "person", "pottedplant", "sheep", "sofa", "train", "tvmonitor"]
    except:
        print("[ERR] AI Model not found. Camera mode limited.")
        net = None

    vs = None
    last_gemini_check = 0
    backSub = cv2.createBackgroundSubtractorMOG2(history=500, varThreshold=25, detectShadows=False)

    while True:
        if not config["cameraEnabled"]:
            if vs: 
                vs.release()
                vs = None
            time.sleep(1)
            continue

        if vs is None:
            try:
                vs = cv2.VideoCapture(0)
                vs.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc('M', 'J', 'P', 'G'))
                vs.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
                vs.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
                time.sleep(2)
            except:
                time.sleep(2)
                continue

        ret, frame = vs.read()
        if not ret:
            time.sleep(0.1)
            continue

        (h, w) = frame.shape[:2]
        
        # Draw Zone
        z = config["detectionZone"]
        zx, zy, zw, zh = int(z['x']*w), int(z['y']*h), int(z['w']*w), int(z['h']*h)
        if zw<1: zw=w
        if zh<1: zh=h
        cv2.rectangle(frame, (zx, zy), (zx+zw, zy+zh), (255, 0, 0), 2)

        dog_found = False

        if net:
            blob = cv2.dnn.blobFromImage(cv2.resize(frame, (300, 300)), 0.007843, (300, 300), 127.5)
            net.setInput(blob)
            detections = net.forward()
            
            for i in range(detections.shape[2]):
                conf = detections[0, 0, i, 2]
                if conf > config["confidenceThreshold"]:
                    idx = int(detections[0, 0, i, 1])
                    if CLASSES[idx] == "dog":
                        box = detections[0, 0, i, 3:7] * np.array([w, h, w, h])
                        (startX, startY, endX, endY) = box.astype("int")
                        cX, cY = (startX + endX) / 2, (startY + endY) / 2
                        if zx < cX < zx+zw and zy < cY < zy+zh:
                            dog_found = True
                            cv2.rectangle(frame, (startX, startY), (endX, endY), (0, 255, 0), 2)
                            cv2.putText(frame, "DOG", (startX, startY-10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0,255,0), 2)
                            break
        
        # Hybrid AI Fallback
        if not dog_found and config.get("aiFallbackEnabled"):
             if time.time() - last_gemini_check > 10:
                 fgMask = backSub.apply(frame)
                 zMask = np.zeros_like(fgMask)
                 zMask[zy:zy+zh, zx:zx+zw] = 255
                 motion = cv2.countNonZero(cv2.bitwise_and(fgMask, fgMask, mask=zMask))
                 if motion > 1000:
                     last_gemini_check = time.time()
                     print("[GEMINI] Motion detected... verifying")
                     if verify_with_gemini(frame): dog_found = True

        # Trigger from AI
        if dog_found:
            if config["doorMode"] == "AUTO" and status["state"] == "CLOSED":
                 door_ctrl.log("AI Detected Dog -> Opening")
                 door_ctrl.command_queue = 'open'
            with state_lock:
                 if status["state"] == "CLOSED": status["state"] = "DETECTING"
        
        with frame_lock:
            output_frame = frame.copy()

threading.Thread(target=camera_loop, daemon=True).start()

# --- FLASK ---
@app.route("/")
def index(): return render_template("index.html")

@app.route("/video_feed")
def video_feed():
    def gen():
        while True:
            with frame_lock:
                if output_frame is None: 
                    time.sleep(0.1)
                    continue
                (flag, enc) = cv2.imencode(".jpg", output_frame)
            yield(b'--frame\r\nContent-Type: image/jpeg\r\n\r\n' + bytearray(enc) + b'\r\n')
    return Response(gen(), mimetype = "multipart/x-mixed-replace; boundary=frame")

@app.route("/api/status")
def get_status():
    with state_lock: return jsonify(status)

@app.route("/api/config", methods=["GET", "POST"])
def handle_config():
    if request.method == "POST":
        new_conf = request.json
        config.update(new_conf)
        save_config()
        return jsonify(config)
    return jsonify(config)

@app.route("/api/command", methods=["POST"])
def handle_command():
    cmd = request.json.get("command")
    if cmd in ['open', 'close']:
        door_ctrl.command_queue = cmd
        return jsonify({"status": "queued"})
    return jsonify({"status": "error"}), 400

@app.route("/api/simulate", methods=["POST"])
def handle_simulate():
    global sim_state
    sim_state = request.json
    return jsonify({"status": "ok"})

@app.route("/snapshot")
def snapshot():
    with frame_lock:
        if output_frame is None: return "No frame", 404
        (flag, enc) = cv2.imencode(".jpg", output_frame)
    return Response(bytearray(enc), mimetype="image/jpeg")

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False, use_reloader=False)
