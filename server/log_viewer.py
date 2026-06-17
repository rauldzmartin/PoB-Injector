import tkinter as tk
import time
import os
import threading

def tail_file(filename, text_widget):
    with open(filename, 'r', encoding='utf-8', errors='replace') as f:
        # Read the last 1000 lines if file is huge, else read all
        text_widget.insert(tk.END, f.read())
        text_widget.see(tk.END)
        while True:
            line = f.readline()
            if not line:
                time.sleep(0.2)
                continue
            text_widget.insert(tk.END, line)
            text_widget.see(tk.END)

root = tk.Tk()
root.title("PoB Injector - Server Logs")
root.geometry("800x500")
root.configure(bg="#1e1e1e")

text = tk.Text(root, bg="#1e1e1e", fg="#d4d4d4", font=("Consolas", 10), borderwidth=0, highlightthickness=0)
text.pack(expand=True, fill="both", padx=10, pady=10)

log_path = os.path.join(os.path.dirname(__file__), "server.log")
if not os.path.exists(log_path):
    open(log_path, 'w').close()

t = threading.Thread(target=tail_file, args=(log_path, text), daemon=True)
t.start()

root.mainloop()
