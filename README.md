# VibeZ 💬
### Private 1-on-1 Chat App

> Modern dark-mode messaging app. No backend needed — runs entirely in the browser.

---

## 🚀 Live Demo (GitHub Pages)

Upload these 3 files to GitHub → Enable GitHub Pages → Done.

`https://yourusername.github.io/vibez`

---

## 📁 Files (Only 3 needed)

| File | Description |
|------|-------------|
| `index.html` | App entry point — loads React from CDN |
| `styles.css` | Complete dark-mode design system |
| `App.js` | All app logic — auth, chat, friends, profile |

---

## ✅ Complete Feature List

### 🔐 Authentication
- [x] Email + password **Sign Up**
- [x] Email + password **Sign In**
- [x] No Google / social login
- [x] Password minimum 6 characters
- [x] Show / hide password toggle (👁️)
- [x] Real-time password strength bar (Weak → Strong)
- [x] Clear error messages on wrong credentials
- [x] Enter key submits the form

### 👤 User Profile
- [x] Name, Email, Profile Photo
- [x] Auto-generated unique Row ID per user (`uid`)
- [x] Bio / status text
- [x] Upload profile photo from device
- [x] Edit name, bio, photo anytime (tap your avatar)
- [x] Gradient initials avatar if no photo

### 📋 Screens
- [x] **Auth Screen** — Sign In / Sign Up with tab switcher
- [x] **Users List Screen** — People / Friends / Requests tabs
- [x] **Chat Screen** — Full private 1-on-1 messaging
- [x] **Profile Edit Modal** — with privacy toggles

### 💬 Chat Features
- [x] Send & receive text messages
- [x] Real-time polling every **3 seconds**
- [x] Sender name + avatar on each received message
- [x] **Last 50 messages** only (auto-hides older ones)
- [x] Date separators: Today / Yesterday / Date
- [x] Auto-scroll to newest message
- [x] Mobile keyboard hides after tapping Send
- [x] Enter key sends message (Shift+Enter = new line)
- [x] Auto-expanding textarea (up to 4 lines)

### 😊 Emoji
- [x] Emoji picker button in chat input
- [x] 40 emojis in picker
- [x] Toggle picker open/close
- [x] Emoji inserts at cursor

### 👻 Vanish Mode
- [x] Ghost button (👻) in chat header
- [x] Confirmation dialog before vanishing
- [x] Permanently deletes all messages in that chat
- [x] Works for both users (shared chatId)

### 🤝 Friend System
- [x] **People tab** — browse all users, send friend request
- [x] **Friends tab** — accepted friends, tap to chat
- [x] **Requests tab** — incoming & sent requests
- [x] Accept / Decline incoming requests
- [x] Red notification badge for new requests
- [x] "Sent ✓" shown for pending sent requests
- [x] Only friends can open chat with each other

### 🔒 Privacy & Security
- [x] Every chat has a **unique Chat ID** (`sort([userA, userB]).join('::')`)
- [x] Users can **only** see messages where they are sender or receiver
- [x] **4 privacy toggles** per user (in profile edit):
  - Show / hide online status
  - Show / hide last seen
  - Show / hide profile photo
  - Show / hide bio
- [x] Privacy settings respected across all views

### 🟢 Online Status
- [x] Green dot = Online, Grey dot = Offline
- [x] Online status in users list
- [x] Online status in chat header
- [x] "Last seen X ago" when offline
- [x] Auto-ping every 4 seconds to stay online

### 🔍 Search
- [x] Search bar on users list
- [x] Search by name
- [x] Search by email

### 🎨 Design & Theme
- [x] Full dark mode — `#000000` background
- [x] Primary color `#7C3AED` purple
- [x] White `#FFFFFF` text
- [x] Sent bubbles → Purple gradient
- [x] Received bubbles → Dark grey `#1F1F1F`
- [x] Sora font (Google Fonts)
- [x] No ads, no watermarks
- [x] Mobile-first responsive design
- [x] Smooth animations & transitions

### 🗄️ Data Schema

**Users table**
```
id, name, email, password, photo, bio, createdAt
```

**Messages table**
```
id, text, from (senderId), to (receiverId), cid (chatId), at (timestamp), gone (vanished)
```

**FriendRequests table**
```
id, from, to, status (pending/accepted/rejected), at
```

---

## 🛠 How to Run Locally

Just open `index.html` in any browser. No npm, no build, no server needed.

```bash
# Option 1 — just open the file
open index.html

# Option 2 — local server (avoids CORS on some browsers)
npx serve .
# or
python3 -m http.server 3000
```

---

## 📤 Deploy to GitHub Pages

1. Create a new GitHub repo (e.g. `vibez`)
2. Upload all 3 files: `index.html`, `styles.css`, `App.js`
3. Go to **Settings → Pages**
4. Source: **Deploy from branch** → `main` → `/ (root)`
5. Click **Save**
6. Visit: `https://yourusername.github.io/vibez`

---

## 📝 Notes

- All data stored in `window.__vz` (browser memory) — resets on page refresh
- To make data persistent, replace the in-memory DB with **Firebase** or **Supabase**
- Passwords stored in plain text — use **bcrypt** in production
- React 18 + Babel loaded from CDN — no build step needed
