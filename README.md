# StudyStream Live — 24/7 Virtual Focus & Co-working Platform

> **End-Term Software Engineering Project Submission**  
> **Course / Program:** Advanced Software Development & System Design  
> **Submission Deadline:** 27 October 2026, 11:59 PM IST  
> **Official Form Submission:** [Google Form](https://forms.gle/sBy4sfqyiRG2Zpom9)

---

## 1. Project Overview & Problem Statement

### The Problem
Remote students, self-taught programmers, and independent researchers face severe isolation, chronic procrastination, and lack of social accountability. Traditional study tools (timer apps, isolated to-do lists) lack real-time human presence, while standard video meeting tools (Zoom, Google Meet) are clunky, require scheduled meetings, and lack dedicated focus-enhancing utilities like synchronized study intervals, ambient soundscapes, and public task accountability.

### The Solution: StudyStream Live
Inspired by global virtual coworking halls such as StudyStream, **StudyStream Live** is an always-on, real-time virtual coworking platform where students and professionals jump into dedicated focus rooms ("Study Halls") alongside peers worldwide. 

It fuses:
1. **Low-latency WebRTC Video & Audio Grid**: Peer presence with active speaker detection, camera/mic controls, screen sharing, and avatar fallbacks.
2. **Synchronized Room Pomodoro Engine**: Centrally synchronized work/break intervals with harmonic bell chimes and automatic database session logging.
3. **Web Audio API Ambient Synthesizer**: In-browser algorithmic synthesizer for rain & thunder, cafe murmurs, 10Hz binaural alpha brainwaves, and fireplace crackle—with zero external audio assets.
4. **Accountability Task Tracker & Goal Sharing**: Live to-do checklist and in-room goal tags visible to peers.
5. **Persistent Focus Analytics & Streak Tracking**: SQLite-backed consecutive streak calculations, daily focus goals, 7-day focus heatmaps, and global leaderboards.

---

## 2. Target Users

- **Computer Science & STEM Students**: Grinding data structures, competitive programming, and thesis code.
- **Medical & Exam Candidates**: Prepping for USMLE, MCAT, GRE, and board examinations with long 50/10 focus sprints.
- **Remote Professionals & Writers**: Seeking background coworking presence without conversational distraction.

---

## 3. Core Workflows (Application Logic)

StudyStream Live implements 5 complete, interconnected workflows:

```
Workflow 1: Authentication & Identity
  Sign In / Register / 1-Click Demo Login 
    → JWT Token Generated 
    → SQLite Profile & Active Streak Calculated 
    → Session Hydrated

Workflow 2: Study Hall Discovery & Real-Time Presence
  Browse Lobby with Live Online Counters
    → Filter by Category (Silent Study, STEM, Lofi, Med)
    → Join Study Hall
    → Socket.IO Registers Peer & Broadcasts Presence
    → WebRTC Media Grid Initialized

Workflow 3: Synchronized Pomodoro Interval Lifecycle
  Host / Room starts Pomodoro
    → Server clock synchronizes 1s ticks across all peers
    → Countdown reaches 00:00
    → WebAudio Harmonic Bell Chime + Confetti Triggered
    → Automatic Focus Session Record inserted into SQLite
    → Streak & Total Focus Hours incremented in real-time

Workflow 4: Deep Work Sound Synthesis & Live Collaboration
  Toggle In-Browser Ambient Audio Mixer
    → WebAudio generates customized Rain, Cafe, or 10Hz Alpha Waves
    → Add & check off session tasks in live goal tracker
    → Send floating live reaction emojis (👏, 🔥, 💯, ☕, ⚡)

Workflow 5: Focus Analytics & Global Leaderboard
  Navigate to Stats Dashboard
    → Inspect 7-Day focus distribution bar chart
    → View goal completion progress (% toward daily target)
    → View Global Podium & Student Leaderboard
```

---

## 4. System Architecture

```
                          ┌───────────────────────────┐
                          │   Client Browser (SPA)    │
                          │   React 19 + Tailwind CSS │
                          │   Web Audio Synth Engine  │
                          └──────┬─────────────┬──────┘
                                 │             │
                    HTTP / REST  │             │ WebSockets (Socket.IO)
                    JWT Bearer   │             │ WebRTC Signaling
                                 ▼             ▼
                          ┌───────────────────────────┐
                          │    Node.js / Express 5    │
                          │    Socket.IO Server       │
                          │    Pomodoro Ticker        │
                          └─────────────┬─────────────┘
                                        │
                                        │ WAL Mode (Sync Queries)
                                        ▼
                          ┌───────────────────────────┐
                          │    SQLite Database        │
                          │    (node:sqlite Engine)   │
                          │    - users                │
                          │    - study_sessions       │
                          │    - tasks                │
                          │    - rooms                │
                          └───────────────────────────┘
```

---

## 5. Technology Stack & Engineering Rationale

| Layer | Technology | Justification |
|---|---|---|
| **Frontend Framework** | **React 19 & Vite** | Blazing-fast HMR, component tree reconciliation, and responsive rendering of dynamic video tiles. |
| **Styling & UI** | **Tailwind CSS & Lucide Icons** | Glassmorphic dark theme, custom responsive grid, and zero-runtime CSS footprint. |
| **Real-Time Communication** | **Socket.IO & WebRTC** | Low-latency bi-directional event bus for timer synchronization, live chat, floating reaction broadcasts, and peer signaling. |
| **Sound Synthesis** | **Web Audio API** | Real-time algorithmic audio generation (filtered white/pink noise, dual oscillator binaural beats). Zero external MP3 downloads or copyright licensing risks. |
| **Backend API** | **Node.js & Express 5** | High-throughput asynchronous event handling with modern routing and clean middleware pipelines. |
| **Database & Persistence** | **node:sqlite (SQLite3)** | High performance WAL-mode SQLite database with zero external native compilation friction. Reliable atomic transactions and persistent streak calculation. |
| **Security & Auth** | **JWT & bcryptjs** | Salted password hashing (cost factor 10) and stateless token validation with user-scoped resource guards. |

---

## 6. Key Engineering Highlights

### A. Algorithmic Web Audio Ambient Sound Generator
Rather than streaming large external MP3 files that fail on mobile or cause bandwidth lag, `soundSynthesizer.js` uses native browser oscillators and noise buffers:
- **Rain**: Pink noise approximation routed through a 800Hz low-pass Biquad filter.
- **Cafe**: Twin sine/triangle oscillators (140Hz and 220Hz) modulated with ambient noise through a 350Hz band-pass filter.
- **Binaural Alpha Waves**: Precise stereo channel merger running 216Hz in the left ear and 226Hz in the right ear, creating a **10Hz alpha differential beat** that stimulates deep mental focus.
- **Pomodoro Chime**: 4-note ascending harmonic arpeggio (C5, E5, G5, C6) with linear attack and exponential decay.

### B. Synchronized Pomodoro State Machine
Instead of relying on unsynchronized client timers, the room timer runs on the server. The server broadcasts interval synchronization (`timer-sync`) and second ticks (`timer-tick`). When the countdown reaches zero, the server issues a `timer-completed` event, triggering the client-side audio chime, confetti explosion, and database session logging.

### C. Streak & Activity Engine
The backend calculates consecutive focus streaks:
- Same-day focus sessions preserve and increment current streaks.
- Consecutive day sessions increment the streak counter.
- Gaps exceeding 24–48 hours gracefully reset the current streak while preserving the user's `longest_streak` milestone in their profile.

---

## 7. Local Setup & Quick Start

### Prerequisites
- Node.js v20+ (Node v26 tested and fully compatible)
- npm v10+

### Step-by-Step Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/ujjwalprakash/studystream-live.git
   cd studystream-live
   ```

2. **Install all dependencies:**
   ```bash
   # Install root orchestrator dependencies
   npm install

   # Install backend server dependencies
   cd server && npm install && cd ..

   # Install frontend client dependencies
   cd client && npm install && cd ..
   ```

3. **Build the production client:**
   ```bash
   npm run build
   ```

4. **Start the application:**
   ```bash
   # Run in unified production mode (Port 5050)
   npm start
   ```
   *Or for live developer hot-reloading:*
   ```bash
   npm run dev
   ```

5. **Open in your browser:**
   ```
   http://localhost:5050
   ```
   *(If running `npm run dev`, open `http://localhost:3000`)*

---

## 8. Evaluator / Demo Credentials

For quick evaluation without having to register a new account:

- **1-Click Demo Login:** Click the **"Sign In / Demo"** button on the top right, then click **"⚡ 1-Click Quick Demo Login"**.
- **Manual Credentials:**
  - **Username / Email:** `student_demo` or `demo@studystream.live`
  - **Password:** `demo1234`
  - *Preloaded with:* 4-Day Focus Streak, 6.4 Hours logged, 3 Study tasks, and past session history.

---

## 9. Environment Variables

Create `server/.env` (optional, defaults provided out-of-the-box):

```env
PORT=5050
NODE_ENV=production
JWT_SECRET=studystream_dev_secret_key_2026_super_secure
```

---

## 10. Submission Metadata for Evaluation Form

```text
Project Name:
StudyStream Live — 24/7 Virtual Focus & Co-working Platform

Student Name:
Ujjwal Prakash

Problem Statement:
Combating loneliness, distraction, and procrastination for remote students and developers through a real-time virtual coworking hall featuring WebRTC peer presence, synchronized Pomodoro intervals, algorithmic ambient audio synthesis, goal tracking, and persistent focus streak analytics.

GitHub Repository:
https://github.com/ujjwalprakash/studystream-live

Deployed Application / Build:
http://localhost:5050 (Self-contained full-stack build)

Tech Stack:
React 19, Vite, Tailwind CSS, Web Audio API, WebRTC, Socket.IO, Node.js, Express 5, node:sqlite (SQLite WAL Mode), JWT, bcryptjs.

Major Features:
1. Real-time WebRTC focus rooms with active speaker detection, mic/video toggles, and screen share.
2. Synchronized room Pomodoro timer with harmonic bell chimes and automatic session logging.
3. In-browser Web Audio API ambient sound mixer (Rain, Cafe, 10Hz Alpha Binaural Beats, Fireplace).
4. Interactive session task accountability checklists.
5. Persistent study streak engine, weekly focus breakdown bar charts, and global scholar leaderboard.
```

---
*Built with passion for the End-Term Software Engineering Project 2026.*
