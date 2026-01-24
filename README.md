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
- **Expo CLI**: `npm install -g expo-cli`
- **iOS Simulator** (Mac) or **Android Studio** (for emulators)
- **Expo Go** app (for physical device testing)

### Step 1: Clone the Repository
```bash
git clone https://github.com/isobed18/habitbud-frontend.git
cd habitbud-frontend
```

### Step 2: Install Dependencies
```bash
npm install
# or
yarn install
```

### Step 3: Configure Backend URL
Create or edit `services/axiosInstance.js` and set your backend URL:

```javascript
const axiosInstance = axios.create({
  baseURL: 'YOUR_BACKEND_URL', // e.g., 'http://localhost:8000/api/'
  timeout: 10000,
});
```

### Step 4: Start the Development Server
```bash
npx expo start
```

### Step 5: Run on Device/Emulator

#### Option A: Physical Device
1. Install **Expo Go** from App Store (iOS) or Play Store (Android)
2. Scan the QR code from the terminal
3. App will load on your device

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

### Environment Setup
The app requires a backend API. Key endpoints include:

- `/habits/` - Habit CRUD operations
- `/chat/proof/ai/` - AI verification (Ionet integration)
- `/chat/stories/feed/` - Story feed
- `/chat/ai-agent/` - AI coaching and habit creation
- `/users/reminders/` - Reminder management

### Camera Permissions
The app requires camera and media library permissions for proof submission. These are automatically requested on first use.

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
