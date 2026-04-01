# 🐝 RISE

> Your personal life management companion — organize, plan, and thrive.

RISE is a comprehensive personal productivity and life management application built with modern web technologies. Designed specifically for professionals in the UAE, it combines task management, goal tracking, financial planning, wellness habits, and AI-powered insights into one cohesive platform.

![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js)
![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=flat-square&logo=typescript)
![Firebase](https://img.shields.io/badge/Firebase-11-FFCA28?style=flat-square&logo=firebase)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.0-38B2AC?style=flat-square&logo=tailwind-css)

---

## ✨ Features

### 📋 **Task Management**
- **Smart Organization**: Priority levels (P1-P4), GTD contexts, Eisenhower matrix quadrants
- **Projects & Labels**: Group tasks into projects with custom colors and icons
- **Flexible Views**: Today, Inbox, Upcoming, and Project-based task lists
- **Recurring Tasks**: Daily, weekly, monthly, and yearly recurrence patterns
- **Life Areas**: Organize tasks across Personal, Professional, Financial, Wellness, and Relationship domains

### 🎯 **Goals & Milestones**
- **NICE Framework**: Structured goal-setting methodology
- **Timeline Planning**: 1-year, 3-year, and 5-year goal horizons
- **Milestone Tracking**: Break down goals into actionable milestones
- **Progress Visualization**: Track completion and momentum

### 💰 **Finance Management**
- **AED Currency Support**: Built for UAE banking and transactions
- **Expense Tracking**: Categorized income and expenses
- **Budget Planning**: Set and monitor monthly budgets
- **Debt Management**: Track debts and repayment schedules
- **Transaction History**: Comprehensive financial records with status tracking

### 🌱 **Wellness & Habits**
- **Habit Tracking**: Build daily, weekly, or custom frequency habits
- **Streak Counting**: Visualize consistency and progress
- **Pomodoro Timer**: Focus sessions with break management
- **Energy & Mood Logging**: Track physical and mental well-being

### 💼 **Professional CRM**
- **UAE Banking Focus**: Pre-configured with 13 major UAE banks and 7 emirates
- **Lead Management**: Track prospects through qualification stages
- **Deal Pipeline**: Monitor opportunities from processing to success
- **Relationship Tracking**: Manage professional connections and important dates

### 📝 **Reviews & Journal**
- **GPS Framework**: Goals, Progress, Strategy structured reviews
- **Daily Journaling**: Capture thoughts with energy and mood indicators
- **Historical Insights**: Look back on personal growth and reflections

### 🤖 **AI Integration**
- **Personalized Chat**: Context-aware AI assistant powered by Google Gemini 2.5 Flash
- **Daily Motivation**: AI-generated tips based on your data and progress
- **Smart Insights**: Receive personalized recommendations across all life areas

### 📱 **Modern UX**
- **Responsive Design**: Desktop sidebar, mobile bottom navigation
- **Dark Mode**: Full theme support with system preference detection
- **Smooth Animations**: Framer Motion powered transitions
- **Offline Support**: Real-time sync with offline persistence

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+ and npm/yarn
- **Firebase Project** (with Firestore & Authentication enabled)
- **Google Gemini API Key** (from [Google AI Studio](https://aistudio.google.com))

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/rise.git
   cd rise
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**

   Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

   Fill in your credentials:
   ```env
   # Firebase Configuration (from Firebase Console → Project Settings → Web App)
   NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

   # Google Gemini AI (from Google AI Studio)
   GEMINI_API_KEY=your_gemini_api_key

   # App Configuration
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

4. **Set up Firebase Security Rules**

   Deploy the included `firestore.rules` and `storage.rules` to your Firebase project:
   ```bash
   firebase deploy --only firestore:rules,storage:rules
   ```

5. **Run the development server**
   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📁 Project Structure

```
rise-app/
├── app/
│   ├── (auth)/
│   │   └── login/              # Authentication pages
│   ├── (main)/                 # Protected application routes
│   │   ├── chat/               # AI chat interface
│   │   ├── documents/          # Document management
│   │   ├── finance/            # Financial tracking
│   │   ├── goals/              # Goal planning
│   │   ├── journal/            # Personal journal
│   │   ├── professional/       # CRM for leads & deals
│   │   ├── relationships/      # Contact management
│   │   ├── reviews/            # GPS reviews
│   │   ├── tasks/              # Task & project management
│   │   ├── wellness/           # Habits & pomodoro
│   │   └── layout.tsx          # Shared layout with navigation
│   ├── api/
│   │   ├── chat/               # Gemini AI chat endpoint
│   │   └── ai-tip/             # Daily motivation endpoint
│   └── globals.css             # Tailwind theme & custom styles
├── components/
│   ├── layout/                 # AppLayout, Sidebar, FAB
│   ├── providers/              # AuthProvider, context
│   ├── tasks/                  # Task-related components
│   ├── ui/                     # Reusable primitives (Button, Modal, etc.)
│   └── ...                     # Feature-specific components
├── lib/
│   ├── firebase.ts             # Firebase initialization
│   ├── firestore.ts            # Firestore CRUD & real-time hooks
│   ├── types.ts                # TypeScript type definitions
│   └── utils.ts                # Utility functions (cn, date helpers)
├── public/                     # Static assets
├── firestore.rules             # Firestore security rules
├── storage.rules               # Storage security rules
├── CLAUDE.md                   # AI assistant guidance
└── package.json
```

---

## 🛠️ Tech Stack

| Category | Technology |
|----------|-----------|
| **Framework** | [Next.js 15](https://nextjs.org/) (App Router, Turbopack) |
| **Frontend** | [React 19](https://react.dev/), [TypeScript 5.7](https://www.typescriptlang.org/) |
| **Styling** | [Tailwind CSS 4](https://tailwindcss.com/) |
| **Backend** | [Firebase](https://firebase.google.com/) (Firestore, Auth, Storage) |
| **AI** | [Google Gemini](https://ai.google.dev/) 2.5 Flash |
| **State** | [Zustand 5](https://github.com/pmndrs/zustand) |
| **Forms** | [React Hook Form 7](https://react-hook-form.com/) |
| **Animation** | [Framer Motion 11](https://www.framer.com/motion/) |
| **Icons** | [Lucide React](https://lucide.dev/) |
| **Charts** | [Recharts 2](https://recharts.org/) |
| **Date** | [date-fns 4](https://date-fns.org/) |

---

## 📜 Available Scripts

```bash
npm run dev        # Start development server with Turbopack
npm run build      # Create production build
npm run start      # Start production server
npm run lint       # Run ESLint
```

**Note**: No test framework is currently configured.

---

## 🏗️ Architecture Highlights

### **Real-Time Data Layer**

All Firestore interactions go through `lib/firestore.ts`:
- **`useCollection<T>`**: Real-time subscription hook with client-side sorting
- **`addDocument`** / **`updateDocument`** / **`deleteDocument`**: CRUD helpers with automatic `userId` injection

**Important Design Decision**: Queries intentionally avoid `orderBy()` to eliminate composite index requirements. All sorting happens client-side for optimal Firebase performance.

### **Type-Safe Development**

`lib/types.ts` serves as the single source of truth for all data models:
- Tasks, Projects, Labels, Goals, Milestones
- Transactions, Budgets, Debts
- Habits, Pomodoro Sessions
- Leads, Deals, Connections
- Reviews, Journal Entries, Documents

### **Security First**

Firestore and Storage rules enforce strict per-user data isolation:
```javascript
// Users can only read/write their own documents
match /tasks/{taskId} {
  allow read, write: if request.auth.uid == resource.data.userId;
}
```

---

## 🎨 Design System

- **Primary Color**: `#FF9933` (RISE Orange)
- **Typography**: System fonts with max 18px size, max 600 weight
- **Grid Background**: Subtle graph-paper style with light blue lines
- **Responsive**: Mobile-first with safe-area padding for notched devices
- **Animations**: `slideUp` for bottom sheets, smooth transitions throughout

---

## 🔐 Authentication

Google OAuth via Firebase Authentication. Users sign in through `/login` and are redirected to the main dashboard upon success.

Access the current user anywhere with:
```typescript
import { useAuth } from '@/components/providers/AuthProvider';

const { user, signOut } = useAuth();
```

---

## 🌐 Deployment

### Firebase Setup

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable **Authentication** (Google provider)
3. Enable **Firestore Database**
4. Enable **Storage**
5. Deploy security rules:
   ```bash
   firebase deploy --only firestore:rules,storage:rules
   ```

### Vercel Deployment (Recommended)

1. Push your code to GitHub
2. Import project at [vercel.com](https://vercel.com)
3. Add environment variables from `.env.local`
4. Deploy

---

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is private and proprietary. All rights reserved.

---

## 🙏 Acknowledgments

Built with passion for productivity enthusiasts and professionals in the UAE.

Special thanks to:
- The Next.js team for an incredible framework
- Firebase for seamless backend infrastructure
- Google for Gemini AI capabilities
- The open-source community for amazing tools and libraries

---

## 📞 Support

For questions, issues, or feature requests, please open an issue in the GitHub repository.

---

<div align="center">

**Made with 🐝 and ☕**

*RISE — Organize your life, achieve your goals*

</div>
