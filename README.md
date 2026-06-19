# PoB Injector

A tool to seamlessly evaluate Path of Exile 2 items directly from your browser into Path of Building.

## Features

### 🔍 Automatic Item Evaluation
- Hover over any item on the PoE2 trade site to instantly see its PoB impact compared to your active build.
- Evaluations appear inline, without leaving the page.
- Results are cached and survive pagination; pressing Search invalidates the cache automatically.

### ⚙️ Rune Overrides (Sockets section)
- **All sockets** — Apply a single rune to all available sockets on the hovered item.
- **Per socket** — Assign a specific rune to each socket individually.
- **Fill sockets** — Simulate adding missing sockets up to the item's maximum before evaluation.
- A **Clear** button (✕) appears in the section header whenever any socket configuration is active, resetting all settings in one click.
- Socket overrides are **saved per item type** and restored automatically when switching between different categories.

### 💎 Amulet Anointments (Amulets section)
- Visible only when the hovered item is an Amulet.
- **Override enchant** — Select an anointment from the full list served by the backend and apply it before evaluation; takes effect immediately without pressing Apply.
- If the amulet is **Corrupted**, the override is silently skipped and a warning is shown in the item wrapper.

### 🎯 Other Adjustments section
- **Max quality** — Normalize the item's quality to 20% before evaluation, stripping raw damage/defence numbers so PoB calculates from a clean baseline.

### 🔢 Item Impact Display
- PoB output is shown inline next to each item with stat deltas (DPS gain, defence changes, etc.).
- Stats are **clickable** — click any stat line to sort all visible results by that value (ascending/descending toggle).
- Sorting automatically loads all available pages before ranking.

### 📥 Import to Build
- Each item includes an **"Add this item to your build as unused"** button that imports it directly into PoB via the local server.

### 🌐 Server Status
- The extension monitors the local server continuously.
- If the server goes offline, an overlay is shown and evaluations are paused until it recovers.

### 🔄 ON / OFF Toggle
- Globally enable or disable automatic evaluation without reloading the page.

## Prerequisites

- **Python 3.x**: If you don't have it, the installer (`install.bat`) will automatically download and set up Python 3.13 for you.
- **Path of Building Community (PoB)**: Installed on your system.

## 1. Local Server Setup

1. Run `install.bat` located in the root directory.
2. The script will automatically detect or ask for your Path of Building installation directory.

*Note: The server automatically detects your currently active PoB build profile from `Settings.xml`.*

4. The script will set up a virtual environment (`.venv`) and install all required dependencies.
5. At the end of the script, you can choose to start the server immediately. To start it later, run `start.bat`.

## 2. Extension Installation (Chrome / Brave)

1. Open your browser and navigate to `chrome://extensions/` (Chrome) or `brave://extensions/` (Brave).
2. Enable **Developer mode** in the top right corner.
3. Click on **Load unpacked**.
4. Select the `extension` folder located in the root directory of this project.
5. The extension will be installed and enabled.

## Usage

1. Run `start.bat` to start the local server.
2. Browse items on trade site [https://www.pathofexile.com/trade2/](https://www.pathofexile.com/trade2/).
3. The extension will automatically compare the items in the market with your items equipped in your active Path of Building build.

## Credits

- **[Sargas09/ChrometoPob2](https://github.com/Sargas09/ChrometoPob2)**: Developer of this Path of Exile 2 adaptation.
- **[unremem/PoBTradeHelper](https://github.com/unremem/PoBTradeHelper)**: Original idea and tool for Path of Exile 1.

> **Disclaimer**: The code for this fork has been generated using AI agents.