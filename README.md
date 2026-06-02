# HabitBud 🌱 - Frontend Mobile App

This repository contains the **React Native (Expo)** client application for HabitBud, featuring premium gamified user interfaces, 3D avatar customization, and real-time social loops.

## 🌟 Core UI/UX Features

- **🐻 3D Avatar Studio (`AvatarStudio.js` & `Avatar3D.js`)**:
  - Immersive 3D interactive viewer utilizing **Expo GL** and **React Three Fiber (R3F)** to render generated animal characters (`.glb`).
  - **Plushify Material Processor**: Dynamically filters materials (roughness `0.85`, metalness `0`) and recalculates vertex normals to generate high-quality matte animal meshes under virtual studio lighting.
  - **Inertial Rotation**: Drag-to-rotate gesture handler with a custom PanResponder that lets the 3D model drift and settle naturally according to spin velocity.
  - **Natural Idle Sways**: Dynamic sine-wave sways simulating breathing, bouncing, and neck tilt.
  - **Attachment Anchors**: Accessories (beanies, wands, badges, glasses) placed precisely on local points (`head`, `face`, `hand`, `back`, `neck`) based on inventory purchases.
- **✨ Micro-animations & Visual Rewards (`RewardOverlay.js`)**:
  - **Floating Reward Chips**: Sprung-animated notifications flying out of actions (`+15 XP` in amber, `+5 💎` in premium cyan) using spring physics and quadratic easing curves.
  - **Pulsing Totals**: XP and Diamond indicators at the bottom right pulse with spring scales when new coins or experience are added.
  - **Milestone Confetti**: Fullscreen celebration bursts utilizing the `confetti.json` Lottie layer.
- **🎬 Rich Lottie Animations**:
  - `success.json` (animated checkmark for daily completions), `fire.json` (streak flame loop), `trophy_unlock.json`/`badge_unlock.json` (achievements and milestone triggers).
- **📳 Haptic Micro-feedbacks**:
  - Multi-tier haptics (`light`, `medium`, `success`, `error`, `selection`) mapped to inputs like incrementing counts, model selections, saving configurations, and error handlers.
- **📸 Snapchat-like Proof Submit & Undo Bar (`SubmitProof.js`)**:
  - Camera/gallery upload interface with a **4.5-second Undo countdown bar** to easily recall or cancel check-in submissions.
- **💬 Profile-Linked Messengers**:
  - Premium messaging layout (`Chat.js`) where clicking on users' avatar/chat headers redirects you instantly to their public statistics and habits profile page.

> [!IMPORTANT]
> For the **Backend** implementation, database seeds, and ASGI setups, please visit the [habitbud-backend](https://github.com/isobed18/habitbud-backend) repository.

## 🛠️ Installation

### Prerequisites
- **Node.js** (v16 or higher)
- **npm** or **yarn**
- **Expo Go** app (for physical device testing)
- **Backend server** running on port 8000

#### 🚀 Quick Setup (Automated - Recommended)

**One command to rule them all!** The setup script will automatically:
- Find your local IP address (prioritizing Wi-Fi)
- Configure the backend URL
- Install dependencies
- Start the Expo development server

```bash
# Clone the repository
git clone https://github.com/isobed18/habitbud-frontend.git
cd habitbud-frontend

# Run automated setup
npm run setup
```

**Manual IP Configuration (If automatic detection fails):**
If the script can't find your correct Wi-Fi IP (e.g., if you have many virtual adapters), you can provide it manually:

1.  Run `ipconfig` in your terminal.
2.  Find the **IPv4 Address** under your **Wireless LAN adapter Wi-Fi**.
3.  Run the setup with the IP as a parameter:
    ```bash
    npm run setup -- 192.168.1.10
    ```

**Note**: Make sure your backend server is running on port 8000 before starting.

---

### 📝 Manual Setup (Alternative)

If you prefer to set up manually or the automated script doesn't work:

#### Step 1: Clone the Repository
```bash
git clone https://github.com/isobed18/habitbud-frontend.git
cd habitbud-frontend
```

#### Step 2: Install Dependencies
```bash
npm install
```

#### Step 3: Find Your Local IP Address

**⚠️ Important**: When using Expo Go on a physical device, you cannot use `localhost`. You must use your computer's local IP address.

#### Windows:
1. Open Command Prompt or PowerShell
2. Run: `ipconfig`
3. Look for **IPv4 Address** under your active network adapter (usually "Wireless LAN adapter Wi-Fi")
4. Copy the IP address (e.g., `192.168.1.6`)

#### Mac/Linux:
1. Open Terminal
2. Run: `ifconfig` (Mac) or `ip addr` (Linux)
3. Look for `inet` address under `en0` (Wi-Fi) 
4. Copy the IP address (e.g., `192.168.1.6`)

Edit `services/axiosInstance.js` and replace the IP address in `baseURL` with your **Wireless IPv4 address** (found in Step 3):

```javascript
// services/axiosInstance.js
const axiosInstance = axios.create({
  baseURL: 'http://YOUR_IPV4_ADDRESS:8000/', // e.g., 'http://192.168.1.6:8000/'
  timeout: 30000,
});
```

#### Step 5: Start the Development Server
```bash
npx expo start
```

### Run on Device/Emulator

#### Option A: Physical Device (Recommended for Testing)
1. Install **Expo Go** from App Store (iOS) or Play Store (Android)
2. **Important**: Make sure your phone and computer are on the same Wi-Fi network
3. Scan the QR code from the terminal using:
   - **iOS**: Use the built-in Camera app to scan the QR code
   - **Android**: Use the Expo Go app's built-in QR scanner
4. The app will load on your device
5. If connection fails, verify:
   - Your IP address in `axiosInstance.js` matches your current network IP
   - Your backend server is running and accessible
   - Both devices are on the same network

#### Option B: iOS Simulator (Mac only)
```bash
# Press 'i' in the terminal after expo start
```

#### Option C: Android Emulator
```bash
# Press 'a' in the terminal after expo start
# Make sure Android Studio emulator is running
```

## 🐛 Troubleshooting

### Connection Issues

**Problem**: Expo Go can't connect to the development server
- **Solution**: 
  - Verify both devices are on the same Wi-Fi network
  - Check that your firewall isn't blocking the connection
  - Try restarting the Expo development server

**Problem**: App can't reach the backend API
- **Solution**:
  - Verify the IP address in `services/axiosInstance.js` matches your current network IP
  - Run `ipconfig` (Windows) or `ifconfig` (Mac/Linux) to check your current IP
  - Make sure your backend server is running
  - Test the backend URL in a browser: `http://YOUR_IP:8000/`

**Problem**: IP address keeps changing
- **Solution**: 
  - Consider setting a static IP on your router for your development machine
  - Or use a tool like `ngrok` for a stable tunnel (for testing only)

### Expo Go Issues

**Problem**: QR code doesn't work
- **Solution**:
  - Try typing the connection URL manually in Expo Go
  - Use `npx expo start --tunnel` for a tunnel connection (slower but more reliable)
  - Check that Expo Go app is up to date

## 📄 License

MIT License - feel free to use this project for learning or building your own habit tracker!

---

**Built with ❤️ for people who want to build better habits together.**

