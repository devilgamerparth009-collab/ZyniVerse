# ZyniVerse v1.3.0 Roadmap

## Overview
This roadmap outlines the planned features to bridge the gap between the current ZyniVerse app (v1.2.0) and the full website feature set at zyverse.in. All features will be implemented as native mobile screens with real data fetching.

---

## 🎯 Phase 1: Core Social Features (v1.3.0)

### 1. Live Chat on Forum
**Priority**: High  
**Estimated Effort**: 2-3 weeks  

**Requirements**:
- WebSocket connection for real-time messaging
- Forum thread integration with chat sidebar
- Message formatting (markdown support)
- User presence indicators (online/offline)
- Notification for new messages

**Implementation Plan**:
1. Add `socket.io-client` dependency
2. Create `ForumChatScreen` component
3. Integrate with `ThreadDetailScreen`
4. Add real-time message API endpoints
5. Implement message persistence (AsyncStorage + backend)

**API Changes Needed**:
- `POST /api/forum/{threadId}/messages`
- `GET /api/forum/{threadId}/messages`
- `WS /api/forum/{threadId}/chat`

---

### 2. User-to-User Messaging
**Priority**: High  
**Estimated Effort**: 3-4 weeks  

**Requirements**:
- Private message inbox
- Contact list with search
- Message threads with read receipts
- Push notifications for new messages
- Block/unblock functionality

**Implementation Plan**:
1. Create `InboxScreen` with message list
2. Create `ConversationScreen` for thread view
3. Add ` contacts` API endpoint
4. Implement message CRUD operations
5. Add notification integration

**API Changes Needed**:
- `GET /api/user/messages/inbox`
- `GET /api/user/messages/conversation/{userId}`
- `POST /api/user/messages`
- `PUT /api/user/messages/{messageId}/read`

---

### 3. Advanced Tournament Brackets
**Priority**: Medium  
**Estimated Effort**: 2-3 weeks  

**Requirements**:
- Single-elimination bracket view
- Team creation/management
- Real-time bracket updates
- Winner progression tracking
- Multiple tournament types (round-robin, double-elimination)

**Implementation Plan**:
1. Create `TournamentsScreen` with bracket selector
2. Create `BracketScreen` component
3. Add tournament creation API
4. Implement team registration system
5. Add progression tracking logic

**API Changes Needed**:
- `POST /api/tournaments/create`
- `GET /api/tournaments/active`
- `POST /api/tournaments/{id}/join`
- `PUT /api/tournaments/{id}/results`

---

## 🎯 Phase 2: Premium & Monetization (v1.3.1)

### 4. Premium/Subscription System
**Priority**: Medium  
**Estimated Effort**: 2-3 weeks  

**Requirements**:
- Premium tier features
- Buy me a coffee integration
- Ad-free experience
- Exclusive content access
- Subscription management

**Implementation Plan**:
1. Create `PremiumScreen` with feature comparison
2. Integrate payment provider (Stripe/Razorpay)
3. Add subscription status API
4. Implement feature gates throughout app
5. Add restore purchases functionality

**API Changes Needed**:
- `GET /api/user/premium/status`
- `POST /api/payment/create-intent`
- `POST /api/subscription/plans`

---

### 5. Dark/Light Mode Manual Toggle
**Priority**: Low  
**Estimated Effort**: 1 week  

**Note**: Already have Diwali auto-apply during November 2026. This adds manual control for other months.

**Implementation Plan**:
1. Add theme mode persistence in AsyncStorage
2. Create theme selector in Settings
3. Add system theme detection
4. Persist user preference across app restarts

**Already Completed**:
- ✅ Diwali theme auto-applies November 2026
- ✅ Manual toggle in Settings → Appearance
- ✅ Force Apply Diwali button if auto-apply fails

---

## 🎯 Phase 3: Enhanced Features (v1.3.2)

### 6. Chrome Extension
**Priority**: Low  
**Estimated Effort**: 3-4 weeks  

**Requirements**:
- Browser extension for anime tracking
- Sync with mobile app state
- Quick access from browser
- Web panel for forum browsing

**Implementation Plan**:
1. Create React extension with manifest V3
2. Implement state sync with mobile app
3. Add quick action buttons
4. Forum integration panel

---

### 7. Manga Reader
**Priority**: Low  
**Estimated Effort**: 4-5 weeks  

**Requirements**:
- Page viewer with zoom/panning
- Bookmarking and history
- Chapter navigation
- Offline caching

**Implementation Plan**:
1. Create `MangaReaderScreen` component
2. Implement chapter fetching API
3. Add image loading with placeholder
4. Bookmark and history storage

---

### 8. Podcast Player
**Priority**: Low  
**Estimated Effort**: 3-4 weeks  

**Requirements**:
- Episode list with playback
- Progress tracking
- Subscription management
- Streaming from podcast APIs

**Implementation Plan**:
1. Create `PodcastsScreen` with list
2. Integrate with podcast RSS feeds
3. Add audio player component
4. Progress tracking storage

---

## 📊 Current Status Overview

Statuses below reflect what is actually shipped. The v1.5.0 column is the
feature branch (`social-v1.5.0`), which is not released yet.

| Feature | Shipped (v1.4.0) | v1.5.0 branch |
|---|---|---|
| **Live Chat** | ✅ Real inbox + conversations (native polling, website realtime) | ✅ Typing, reactions, delete |
| **User Messaging** | ✅ Inbox + conversations | ✅ Say hi + discovery entry points |
| **Followers / Following** | ⚠️ Counts only, no list screens | ✅ Tappable list screens on both platforms |
| **Find people** | ❌ Not available | ✅ Discovery with shared-interest reasons |
| **Broadcast channels** | ❌ Not available | ✅ One-to-many channels |
| **Stories** | ❌ Not available | ✅ 24-hour stories |
| **Advanced Tournaments** | ✅ Available | ✅ Maintained |
| **Premium System** | ❌ Deferred | ❌ Deferred |
| **Dark/Light Mode** | ✅ Diwali auto + manual | ✅ Maintained |
| **Splash Animation** | ✅ 2-second fade-in | ✅ Maintained |
| **Login System** | ✅ Fixed + Google button | ✅ Maintained |
| **Forum Markdown** | ✅ `stripMarkdown()` | ✅ Maintained |

---

## 🚀 Development Guidelines

### Code Style
- Follow existing TypeScript patterns
- Use `fetchWithTimeout()` for all API calls (25s AbortController)
- Apply `stripMarkdown()` to all forum content
- Keep UI consistent with current design system
- Maintain release-signed APK build process

### API Pattern
```typescript
// All authenticated calls use fetchWithTimeout with AbortController
import { fetchWithTimeout } from '../services/api';

// Example:
const response = await fetchWithTimeout('/api/endpoint', {
  method: 'POST',
  headers: { 'X-Auth-Return-Redirect': '/' },
  body: JSON.stringify(data),
});
```

### Theme System
- Diwali theme auto-applies November 1-30
- Manual toggle always available in Settings
- Store user preference in AsyncStorage key: `zt_theme_config_diwali`
- Force apply via Settings → Appearance → "Force Apply Diwali"

### Testing
- Test on device: `AI+ Nova 2 Ultra`, Android 16
- Verify all 6 tab bar icons work
- Confirm login with QA accounts
- Test Diwali theme activation
- Validate forum `stripMarkdown()` output

---

## 📦 Release Process

### v1.3.0 Checklist
- [ ] Live Chat on Forum (WebSocket integration)
- [ ] User Messaging System (inbox + conversations)
- [ ] Advanced Tournament Brackets (single + double elimination)
- [ ] Premium/Subscription System (payment integration)
- [ ] Dark/Light Mode Manual Toggle (enhanced Diwali)
- [ ] All existing v1.2.0 features preserved
- [ ] TypeScript compiles cleanly
- [ ] Release APK built and signed
- [ ] On-device verification completed
- [ ] OneDrive APK cleanup completed

### Build Commands
```bash
# Build release APK
cd "C:\\zv\\android"
$env:NODE_ENV='production'
.\gradlew.bat assembleRelease

# Install on device
adb -s 192.168.1.46:37091 install -r app-release.apk

# Verify TypeScript
cd mobile
npx tsc --noEmit
```

---

## 📞 QA Accounts for Testing

Two test accounts are already created for v1.2.0 verification:
1. `qa.zyniverse.1794198134@mailinator.com` / `TestPass123!`
2. `qa1794198297@mailinator.com` / `testpass123`

These can be used for testing new v1.3.0 features after implementation.

---

## 🎨 Design References

### aniTally Play Store App
- Smooth page transitions
- Animated tournament brackets
- Clean forum message formatting
- Theme-aware UI elements

### Pinterest Inspiration
- Neumorphic buttons with soft shadows
- Parallax header images
- Micro-interactions on tab selection
- Smooth color transitions on theme change

### ZyniVerse Brand Guidelines
- Orange primary: `#FF8C00`
- Gold accent: `#FFD700`
- Deep dark backgrounds: `#1a0f00`, `#0a0a0f`
- Gold text: `#FFD700`
- Muted bronze: `#B8860B`

---

## 📅 Timeline Estimate

| Milestone | Target Date |
|---|---|
| v1.3.0 Beta Release | Q2 2027 |
| v1.3.0 Full Release | Q3 2027 |
| v1.3.1 Premium Features | Q4 2027 |
| v1.4.0 Chrome Extension | Q1 2028 |
| v1.5.0 Manga + Podcast | Q2 2028 |

---

*Roadmap last updated: November 9, 2026*  
*Current version: 1.2.0 (release-signed APK installed on device)*  
*Next version: 1.3.0 (planned feature set above)*