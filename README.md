# 🚀 URTC Web Studio

![URTC Web Studio Header](./docs/images/urtc_web_dashboard_1785850890887.jpg)

Welcome to **URTC Web Studio**, the ultimate web-based companion for the **Universal Robot Tool Controller (URTC)**. This application provides a modern, sleek, and highly interactive interface to monitor, control, and update your URTC hardware directly from your browser.

---

## ✨ Features

- **🎛️ Live Hardware Monitoring:** View real-time status of your tools, pinout states, and OLED display output.
- **📡 CAN Bus Analyzer:** Intercept, analyze, and inject CAN bus frames on the fly.
- **🔄 Firmware OTA (Over-The-Air) Flasher:** Update your URTC tool heads directly over the CAN bus or via SWD.
- **🌡️ Thermal IR Inspection:** Real-time thermal camera integration for monitoring tool temperatures.
- **🛠️ Tester Studio:** Comprehensive diagnostics, self-tests, and debugging tools.
- **📖 BOM & Pinouts:** Interactive Bill of Materials and hardware reference diagrams.

---

## 📸 Screenshots

### 🎛️ Dashboard & Live Control
Monitor active tools, override setpoints, and interact with the hardware in real time.
![Live Control](./docs/images/urtc_web_dashboard_1785850890887.jpg)

### 📡 CAN Bus Protocol Analyzer
A low-latency, real-time telemetry analyzer and watchdog pinger.
![CAN Bus Analyzer](./docs/images/urtc_web_can_analyzer_1785850905220.jpg)

### 🔄 Flasher Studio
Update your URTC nodes securely and quickly.
![Flasher Studio](./docs/images/urtc_web_flasher_1785850922698.jpg)

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- npm or bun

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/JuanenRac/URTC-Web-Studio.git
   cd URTC-Web-Studio
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to `http://localhost:3000`.

---

## 🛠️ Technology Stack
- **Frontend Framework:** React 18
- **Build Tool:** Vite
- **Styling:** Tailwind CSS
- **Icons:** Lucide React
- **Typography:** Inter / JetBrains Mono

---

## 📄 License
URTC Web Studio is licensed under the **GNU General Public License v3.0 (GPL-3.0)**. 
See the [LICENSE](LICENSE) file for more details.

---
**Author:** JuanenRac (Electro Hobby 3D)  
**Contact:** electrohobby3d@gmail.com
