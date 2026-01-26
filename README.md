# HabitBud 🌱

A **socialized habit tracker** that combines accountability with authentic social interaction. Inspired by BeReal and Snapchat, HabitBud makes habit building a shared, verifiable experience.

## 🎯 What Makes HabitBud Different?

Unlike traditional habit trackers that rely on self-reporting, HabitBud introduces **proof-based verification** as a core mechanic:

### 🔐 Proof Submission System (Powered by Ionet)
- **AI Verification**: Submit photo proof of your habits, verified by AI through Ionet's decentralized compute network
- **Friend Validation**: Send proof to friends for peer accountability
- **Story Sharing**: Share your progress BeReal-style with time-limited stories
- **No Cheating**: Authentic habit building through visual evidence

### 🤝 Social-First Design
Inspired by Snapchat's engagement model:
- **Story Feed**: Instagram/Snapchat-style stories grouped by user
- **Friend Challenges**: Compete and collaborate with friends
- **Real-time Chat**: Discuss habits and share motivation
- **Leaderboards**: Gamified XP and streak systems

### 🤖 AI Action Agent
- **Smart Habit Creation**: AI analyzes your goals and creates actionable habits
- **Proposal System**: Review and approve AI suggestions before creation
- **Recurring Reminders**: AI schedules personalized notifications
- **Contextual Coaching**: Get advice tailored to your specific habits

## 🚀 Features

### Core Functionality
- ✅ **Habit Tracking**: Count-based and time-based habits
- 🔥 **Streak System**: Build momentum with daily streaks and multipliers
- 📊 **Analytics**: Detailed stats and heatmaps
- 🎨 **Customization**: Color themes and personalized habit icons

### Social Features
- 👥 **Friend System**: Add friends and share progress
- 💬 **Chat**: Direct messaging with proof attachments
- 📸 **Stories**: 24-hour story feed with likes
- 🏆 **Challenges**: Join or create habit challenges

### Gamification
- ⭐ **XP System**: Earn experience points for completing habits
- 🎖️ **Levels**: Progress through levels as you build consistency
- 🎁 **Inventory**: Collect items and rewards
- 🏅 **Achievements**: Unlock badges for milestones

## 📱 Tech Stack

### Frontend
- **React Native** with Expo
- **React Navigation** for routing
- **Axios** for API communication
- **Expo Haptics** for tactile feedback
- **Ionicons** for UI icons

### Key Integrations
- **Ionet AI Compute**: Decentralized AI verification for proof submissions
- **Expo Camera**: Photo capture for habit proof
- **Expo Image Picker**: Gallery access for proof selection

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
3. Look for **IPv4 Address** under your active network adapter (usually "Wireless LAN adapter Wi-Fi" or "Ethernet adapter")
4. Copy the IP address (e.g., `192.168.1.6`)

#### Mac/Linux:
1. Open Terminal
2. Run: `ifconfig` (Mac) or `ip addr` (Linux)
3. Look for `inet` address under `en0` (Wi-Fi) or `eth0` (Ethernet)
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

## 🔧 Configuration

### Backend API Setup
The app requires a backend API running on your local network. Key endpoints include:

- `/habits/` - Habit CRUD operations
- `/chat/proof/ai/` - AI verification (Ionet integration)
- `/chat/stories/feed/` - Story feed
- `/chat/ai-agent/` - AI coaching and habit creation
- `/users/remissions/` - Reminder management

**Backend URL Configuration**:
- The backend URL is configured in `services/axiosInstance.js`
- Use your local IP address (not `localhost`) when testing on physical devices
- Format: `http://YOUR_IP_ADDRESS:8000/`
- Make sure your backend server is running before starting the Expo app

### Camera Permissions
The app requires camera and media library permissions for proof submission. These are automatically requested on first use.

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

## 📸 Core Feature: Proof Submission

The proof submission system is what sets HabitBud apart:

### How It Works
1. **Capture**: Take a photo of yourself completing the habit
2. **AI Verification**: Ionet's decentralized AI analyzes the image
3. **Validation**: Get instant feedback on whether the proof is valid
4. **Share**: Send to friends or post to your story
5. **Earn**: Receive XP and maintain your streak

### Ionet Integration
We use **Ionet's decentralized compute network** for AI verification:
- **Privacy-First**: Images are processed on decentralized nodes
- **Fast**: Sub-second verification times
- **Accurate**: Advanced computer vision models
- **Scalable**: No single point of failure

### Proof Flow
```
User → Camera → SubmitProof.js → Backend → Ionet AI → Verification Result → UI Update
```

## 🎨 UI/UX Philosophy

### BeReal Inspiration
- **Authenticity**: No filters, no editing - just real progress
- **Time-Limited**: Stories expire after 24 hours
- **Spontaneous**: Capture habits in the moment

### Snapchat Inspiration
- **Streaks**: Visual streak counters with flame icons
- **Stories**: Swipeable story viewer with progress bars
- **Chat**: Ephemeral messaging with proof attachments
- **Friend List**: Simple, visual friend management

## 📂 Project Structure

```
habitchatF/
├── App.js                 # Root navigation
├── services/
│   └── axiosInstance.js   # API client
├── utils/
│   ├── auth.js           # Token management
│   ├── colors.js         # Theme system
│   └── gamification.js   # XP/streak calculations
├── Home.js               # Main habit dashboard
├── SubmitProof.js        # Proof submission (Ionet integration)
├── AICoach.js            # AI agent interface
├── Conversations.js      # Story feed & chat list
├── Chat.js               # Direct messaging
├── Profile.js            # User profile & settings
├── Challenges.js         # Challenge system
└── Leaderboard.js        # XP rankings
```

## 🤝 Contributing

We welcome contributions! Key areas:

- **UI/UX**: Improve the social experience
- **AI Features**: Enhance proof verification
- **Gamification**: New reward systems
- **Performance**: Optimize image handling

## 📄 License

MIT License - feel free to use this project for learning or building your own habit tracker!

## 🙏 Acknowledgments

- **Ionet** for decentralized AI compute
- **BeReal** for authenticity-first social design
- **Snapchat** for streak mechanics and engagement patterns
- **Expo** for cross-platform development tools

---

**Built with ❤️ for people who want to build better habits together.**
