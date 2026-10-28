# StudyStream Live — 24/7 Virtual Focus & Co-working Platform

> **End-Term Software Engineering Project Submission**  
> **Course / Program:** Advanced Software Development & System Design  
> **Submission Deadline:** 27 October 2026, 11:59 PM IST  
> **Official Form Submission:** [Google Form](https://forms.gle/sBy4sfqyiRG2Zpom9)  
> **Project Walkthrough & Video Demonstration:** [Watch Video on Google Drive](https://drive.google.com/file/d/1hPIPdMF8TKHNjSq7-3352B8BXfBbK2tk/view?usp=drive_link)  
> **Live Application:** [https://study-sst.vercel.app/](https://study-sst.vercel.app/)  
> **License:** [MIT License](LICENSE)

---

> 🎥 **Website Walkthrough & Explanation Video:**  
> **[Watch the full video demonstration explaining StudySST](https://drive.google.com/file/d/1hPIPdMF8TKHNjSq7-3352B8BXfBbK2tk/view?usp=drive_link)**  
> *(Explains the live study rooms, WebRTC video architecture, hardware-level privacy, procedural ambient soundscapes, live hour leaderboard, 1-to-1 direct messaging, Spotify sharing, and knowledge blog platform)*

---

## 1. Project Overview & Problem Statement

### The Problem
Remote students, self-taught programmers, and independent researchers face severe isolation, chronic procrastination, and lack of social accountability. Traditional study tools (timer apps, isolated to-do lists) lack real-time human presence, while standard video meeting tools (Zoom, Google Meet) are clunky, require scheduled meetings, and lack dedicated focus-enhancing utilities like synchronized study intervals, ambient soundscapes, and public task accountability.

### The Solution: StudyStream Live
Inspired by global virtual coworking halls, **StudyStream Live** is an always-on, real-time virtual coworking platform where students, developers, and researchers jump into dedicated focus rooms ("Study Halls") alongside peers worldwide.

It combines:
1. **Low-Latency WebRTC & Video Grid**: Live peer presence with hardware-level camera/microphone privacy controls, screen sharing, and fallback avatars.
2. **Community Blogs Platform**: Full-stack blogging feed with image uploads, likes, threaded discussions, categories, and author presence tags.
3. **Unlimited Live Hours Leaderboard**: Real-time verified study rankings powered by an authoritative server heartbeat engine (All-Time, Monthly, Weekly).
4. **Algorithmic Web Audio Synthesizer**: Zero-asset in-browser audio generator for realistic rain & distant thunder, cafe hum, 10Hz binaural alpha brainwaves, and crackling campfire.
5. **Synchronized Room Pomodoro Engine**: Centrally synchronized work/break cycles with harmonic arpeggio chimes and automatic session logging.
6. **Global Light / Dark Mode**: Seamless theme toggle featuring a cohesive 5-color warm earthy palette and deep olive dark mode.
7. **Multi-Provider Authentication**: Email & password authentication with bcrypt hashing + 1-Click Google Sign-In via Firebase Auth.

---

## 2. Core Features & Capabilities

### 🎥 1. Focus Study Halls & Hardware-Level Privacy
- Join themed study rooms (Silent Library, STEM & LeetCode, Medical School, Deep Lofi).
- **Physical Sensor Shutoff**: Turning off camera or microphone physically stops media capture tracks (`MediaStreamTrack.stop()`), ensuring OS indicators (Mac green camera light & orange mic dot) completely turn off while staying in the room.
- Active room peer counts update dynamically with zero ghost connections.
- In-room live goal tags, real-time room chat, and floating reaction emojis (👏, 🔥, 💯, ☕, ⚡).

### ✍️ 2. Community Blogs Feed
- Publish rich-text blogs with categories (Study Tips, Productivity, Coding, Motivation, Science).
- Upload high-resolution cover images directly to disk via secure Multer pipeline.
- Interactive like toggle, live comment threads, and blog search/filtering.
- Live author presence badge indicates when a blog author is currently streaming in a study hall.

### 🏆 3. Unlimited Live Hours Leaderboard
- Authoritative live study hour accounting verified by Socket.IO heartbeats every 25 seconds.
- Incremental time accrual prevents lost progress on sudden disconnects or power outages.
- Podium highlights for top 3 scholars (#1 Gold, #2 Silver, #3 Bronze).
- Daily streak tracker with milestone recognition and personal ranking banner.

### 🎨 4. Cohesive Design System & Theme Engine
- **Light Theme**: Warm Ivory (`#FEFAE0`), Pale Sand (`#FAEDCD`), Soft Blush (`#E9EDC9`), Sage Green (`#CCD5AE`), and Earthy Terracotta (`#D4A373`).
- **Dark Theme**: Deep Forest (`#25291F`), Olive Sand (`#343B2B`), Card Olive (`#454D37`), Border Tone (`#555C48`), and Warm Terracotta (`#D4A373`).
- Anti-flash theme bootstrapper with `localStorage` persistence.

---

## 3. System Architecture

```
                          ┌───────────────────────────┐
                          │   Client Browser (SPA)    │
                          │   React 19 + Tailwind CSS │
                          │   Web Audio Synth Engine  │
                          │   Firebase Google Auth    │
                          └──────┬─────────────┬──────┘
                                 │             │
                    HTTP / REST  │             │ WebSockets (Socket.IO)
                    JWT Bearer   │             │ WebRTC Signaling
                                 ▼             ▼
                          ┌───────────────────────────┐
                          │    Node.js / Express 5    │
                          │    Socket.IO Server       │
                          │    Security Headers       │
                          │    Live Hours Accrual     │
                          └─────────────┬─────────────┘
                                        │
                                        │ Synchronous WAL Mode
                                        ▼
                          ┌───────────────────────────┐
                          │    SQLite Database        │
                          │    (node:sqlite Engine)   │
                          │    - users                │
                          │    - blogs & blog_likes   │
                          │    - blog_comments        │
                          │    - live_sessions        │
                          │    - rooms & tasks        │
                          └───────────────────────────┘
```

---

## 4. Technology Stack & Engineering Rationale

| Layer | Technology | Justification |
|---|---|---|
| **Frontend Framework** | **React 19 & Vite** | Blazing-fast compilation, modern hooks, and instant HMR. |
| **Styling & UI** | **Tailwind CSS & Lucide** | Custom 5-color earthy palette with responsive grid and dark mode support. |
| **Real-Time Communication** | **Socket.IO & WebRTC** | Low-latency bi-directional event bus for live presence, chat, and WebRTC peer signaling. |
| **Sound Synthesis** | **Web Audio API** | Real-time algorithmic sound synthesis (filtered noise, binaural alpha beats) without external MP3 files. |
| **Backend API** | **Node.js & Express 5** | High-throughput asynchronous event handling with parameterized queries and security middleware. |
| **Database & Persistence** | **node:sqlite (SQLite3)** | High performance WAL-mode SQLite database with zero external native compilation friction. |
| **Authentication** | **JWT, bcryptjs & Firebase** | Dual authentication supporting standard credentials and 1-Click Google Sign-In. |
| **File Storage** | **Multer** | Multipart form processing with MIME-type filtering and UUID-based disk storage. |

---

## 5. Local Setup & Quick Start

### Prerequisites
- **Node.js** v20+ (Node v20–v26 tested and fully compatible)
- **npm** v10+

### Step-by-Step Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/UjjwalPrakash12/StudySST.git
   cd StudySST
   ```

2. **Install all dependencies:**
   ```bash
   # Install root, server, and client dependencies
   npm run install:all
   ```

3. **Build the production client:**
   ```bash
   npm run build
   ```

4. **Start the application:**
   ```bash
   # Start the production server on port 5050
   npm start
   ```

5. **Open in your browser:**
   - **Live Production Application:** **[https://study-sst.vercel.app/](https://study-sst.vercel.app/)**
   - **Local Production Server:** `http://localhost:5050`
   - *(For development mode with hot reload, run `npm run dev` and open `http://localhost:3000`)*

---

## 6. Authentication & User Access

- **Create a New Account**: Click **"Sign In"** on the top navigation bar, toggle to **"Register"**, and enter your details.
- **1-Click Google Sign-In**: Click **"Continue with Google"** in the authentication modal to sign in via Firebase.
- **Guest Access**: Users can freely join any study hall without logging in as a guest with real-time video, chat, and ambient audio access.

---

## 7. Environment Variables

Create `server/.env` (optional, sane production defaults provided):

```env
PORT=5050
NODE_ENV=production
JWT_SECRET=your_custom_jwt_secret_key_here
CORS_ORIGIN=*
```

---

## 8. Security & Engineering Highlights

- **SQL Injection Prevention**: All queries in `server/server.js` use parameterized statements (`?` placeholders).
- **Physical Device Privacy**: Explicit `track.stop()` invocation upon camera/microphone toggle off and tab unload.
- **Security Headers**: `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, and disabled `X-Powered-By`.
- **Anti-Cheat Heartbeat**: Live session seconds accrue incrementally only during active Socket.IO connection heartbeats.
- **Clean Repository**: Binary databases (`*.db`), uploads, and build artifacts are strictly excluded via `.gitignore`.

---

## 9. Submission Metadata

```text
Project Name:
StudyStream Live — 24/7 Virtual Focus & Co-working Platform

Student Name:
Ujjwal Prakash

Repository:
https://github.com/UjjwalPrakash12/StudySST

Live Application:
https://study-sst.vercel.app/

Project Walkthrough & Video Demonstration:
https://drive.google.com/file/d/1hPIPdMF8TKHNjSq7-3352B8BXfBbK2tk/view?usp=drive_link

Primary Features:
1. Virtual Focus Study Halls with low-latency WebRTC peer video and hardware sensor release.
2. Community Blogs Feed with rich formatting, image uploads, likes, and comment threads.
3. Unlimited Live Hours Leaderboard with anti-cheat verified heartbeat time accrual.
4. Algorithmic Web Audio ambient synthesizer (12 procedural acoustic soundscapes).
5. 1-to-1 Private Direct Messaging and Spotify music playback sharing.
6. Global Light / Dark Mode with cohesive 5-color earthy palette and system auto-detect.
7. Dual Authentication with Email/Password and 1-Click Firebase Google Sign-In.
```

---
*Built with care for the End-Term Software Engineering Project 2026.*
