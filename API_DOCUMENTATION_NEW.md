# Habit Tracker API Documentation

**Base URL:** `http://localhost:8000` (development)

**Authentication:** JWT Token (Bearer Token)
- Header: `Authorization: Bearer <access_token>`
- Token almak için: `/users/api/login/` veya `/users/api/register/`

---

## 📋 İçindekiler

1. [Authentication](#1-authentication)
2. [Users](#2-users)
3. [Habits](#3-habits)
4. [Friends](#4-friends)
5. [Chat & Conversations](#5-chat--conversations)
6. [Proof Submission & Verification](#6-proof-submission--verification)
7. [WebSocket](#7-websocket)

---

## 1. Authentication

### 1.1 Register
**POST** `/users/api/register/`

**Authentication:** Not required

**Request Body:**
```json
{
  "username": "string",
  "email": "string",
  "password": "string",
  "password2": "string",
  "bio": "string (optional)"
}
```

**Response:** `201 Created`
```json
{
  "user": {
    "id": "uuid",
    "username": "string",
    "email": "string",
    "bio": "string"
  },
  "refresh": "string",
  "access": "string"
}
```

**Error Responses:**
- `400 Bad Request` - Validation errors
- `400 Bad Request` - Password fields didn't match

---

### 1.2 Login
**POST** `/users/api/login/`

**Authentication:** Not required

**Request Body:**
```json
{
  "username": "string",
  "password": "string"
}
```

**Response:** `200 OK`
```json
{
  "user": {
    "id": "uuid",
    "username": "string",
    "email": "string",
    "bio": "string"
  },
  "refresh": "string",
  "access": "string"
}
```

**Error Responses:**
- `404 Not Found` - User not found
- `401 Unauthorized` - Invalid credentials

---

### 1.3 Logout
**POST** `/users/api/logout/`

**Authentication:** Required

**Request Body:**
```json
{
  "refresh": "string"
}
```

**Response:** `205 Reset Content`

**Error Responses:**
- `400 Bad Request` - Missing refresh token
- `400 Bad Request` - Invalid token

---

### 1.4 Get Profile
**GET** `/users/api/profile/`

**Authentication:** Required

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "username": "string",
  "email": "string",
  "bio": "string",
  "xp": 0,
  "level": 1
}
```

---

### 1.5 Update Profile
**PUT** `/users/api/profile/`

**Authentication:** Required

**Request Body:** (all fields optional)
```json
{
  "email": "string",
  "bio": "string"
}
```

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "username": "string",
  "email": "string",
  "bio": "string",
  "xp": 0,
  "level": 1
}
```

---

### 1.6 Leaderboard
**GET** `/users/api/leaderboard/`

**Authentication:** Required

**Response:** `200 OK`
```json
[
  {
    "id": "uuid",
    "username": "string",
    "email": "string",
    "bio": "string",
    "xp": 150,
    "level": 2
  },
  {
    "id": "uuid",
    "username": "string",
    "email": "string",
    "bio": "string",
    "xp": 50,
    "level": 1
  }
]
```

**Note:** Returns list of friends (including self) sorted by XP descending.

---

## 2. Habits

### 2.1 List Habits
**GET** `/habits/`

**Authentication:** Required

**Response:** `200 OK`
```json
[
  {
    "id": "uuid",
    "name": "string",
    "habit_type": "count" | "time",
    "count": 0,
    "target_count": 10,
    "target_time": "HH:MM:SS" | null,
    "total_time": "HH:MM:SS" | null,
    "streak": 0,
    "completed_count": 0,
    "last_completed_date": "YYYY-MM-DD" | null,
    "frequency": "daily" | "weekly" | "monthly" | "custom"
  }
]
```

**Note:** Response is cached for 5 minutes

---

### 2.2 Create Habit
**POST** `/habits/`

**Authentication:** Required

**Request Body:**
```json
{
  "name": "string",
  "habit_type": "count" | "time",
  "target_count": 10,  // Required if habit_type is "count"
  "target_time": "HH:MM:SS",  // Required if habit_type is "time"
  "frequency": "daily" | "weekly" | "monthly" | "custom"
}
```

**Response:** `201 Created`
```json
{
  "id": "uuid",
  "name": "string",
  "habit_type": "count",
  "count": 0,
  "target_count": 10,
  "streak": 0,
  "completed_count": 0,
  "last_completed_date": null,
  "frequency": "daily"
}
```

**Error Responses:**
- `400 Bad Request` - Validation errors
- `400 Bad Request` - Target count/time required based on habit_type

---

### 2.3 Get Habit Detail
**GET** `/habits/{habit_id}/`

**Authentication:** Required

**Path Parameters:**
- `habit_id` (UUID) - Habit ID

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "name": "string",
  "habit_type": "count",
  "count": 5,
  "target_count": 10,
  "streak": 3,
  "completed_count": 15,
  "last_completed_date": "2024-01-15",
  "frequency": "daily"
}
```

**Error Responses:**
- `404 Not Found` - Habit not found or not owned by user

---

### 2.4 Update Habit
**PUT** `/habits/{habit_id}/`

**Authentication:** Required

**Path Parameters:**
- `habit_id` (UUID) - Habit ID

**Request Body:** (all fields optional, partial update)
```json
{
  "name": "string",
  "count": 5,
  "target_count": 10,
  "target_time": "HH:MM:SS",
  "frequency": "daily"
}
```

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "name": "string",
  "habit_type": "count",
  "count": 5,
  "target_count": 10,
  "streak": 3,  // Automatically recalculated
  "completed_count": 15,  // Automatically recalculated
  "last_completed_date": "2024-01-15",
  "frequency": "daily"
}
```

**Note:** After update, `update_and_recalculate()` is called automatically to update streak and completion stats.

**Error Responses:**
- `404 Not Found` - Habit not found or not owned by user
- `400 Bad Request` - Validation errors

---

### 2.5 Delete Habit
**DELETE** `/habits/{habit_id}/`

**Authentication:** Required

**Path Parameters:**
- `habit_id` (UUID) - Habit ID

**Response:** `204 No Content`

**Error Responses:**
- `404 Not Found` - Habit not found or not owned by user

---

## 3. Friends

### 3.1 Send Friend Request
**POST** `/friends/request/`

**Authentication:** Required

**Request Body:**
```json
{
  "username": "string"
}
```

**Response:** `201 Created`
```json
{
  "id": "uuid",
  "from_user": {
    "id": "uuid",
    "username": "string",
    "bio": "string"
  },
  "to_user": {
    "id": "uuid",
    "username": "string",
    "bio": "string"
  },
  "status": "PENDING",
  "created_at": "2024-01-15T10:30:00Z"
}
```

**Error Responses:**
- `400 Bad Request` - Username is required
- `404 Not Found` - User not found
- `400 Bad Request` - Cannot send request to yourself
- `400 Bad Request` - Friend request already exists

---

### 3.2 List Pending Friend Requests
**GET** `/friends/requests/pending/`

**Authentication:** Required

**Response:** `200 OK`
```json
[
  {
    "id": "uuid",
    "from_user": {
      "id": "uuid",
      "username": "string",
      "bio": "string"
    },
    "to_user": {
      "id": "uuid",
      "username": "string",
      "bio": "string"
    },
    "status": "PENDING",
    "created_at": "2024-01-15T10:30:00Z"
  }
]
```

**Note:** Returns only requests received by the current user with PENDING status

---

### 3.3 Respond to Friend Request
**POST** `/friends/requests/{request_id}/respond/`

**Authentication:** Required

**Path Parameters:**
- `request_id` (UUID) - Friend request ID

**Request Body:**
```json
{
  "action": "accept" | "decline"
}
```

**Response:** `200 OK`
```json
{
  "message": "Friend request accepted." | "Friend request declined."
}
```

**Error Responses:**
- `404 Not Found` - Friend request not found
- `400 Bad Request` - Request already responded to
- `400 Bad Request` - Invalid action

---

### 3.4 List Friends
**GET** `/friends/list/`

**Authentication:** Required

**Response:** `200 OK`
```json
[
  {
    "id": "uuid",
    "username": "string",
    "bio": "string"
  }
]
```

**Note:** Returns all users with ACCEPTED friendship status

---

## 4. Chat & Conversations

### 4.1 List Conversations
**GET** `/chat/conversations/`

**Authentication:** Required

**Response:** `200 OK`
```json
[
  {
    "id": "uuid",
    "participants": [
      {
        "id": "uuid",
        "username": "string",
        "email": "string",
        "bio": "string"
      }
    ],
    "last_message": {
      "id": "uuid",
      "sender": {...},
      "content": "string",
      "message_type": "TEXT" | "PROOF",
      "created_at": "2024-01-15T10:30:00Z"
    } | null,
    "created_at": "2024-01-15T10:30:00Z"
  }
]
```

---

### 4.2 Start Conversation
**POST** `/chat/conversations/start/`

**Authentication:** Required

**Request Body:**
```json
{
  "user_id": "uuid"
}
```

**Response:** `200 OK` (existing) or `201 Created` (new)
```json
{
  "id": "uuid",
  "participants": [
    {
      "id": "uuid",
      "username": "string",
      "email": "string",
      "bio": "string"
    }
  ],
  "last_message": null,
  "created_at": "2024-01-15T10:30:00Z"
}
```

**Error Responses:**
- `400 Bad Request` - user_id is required
- `400 Bad Request` - Cannot start conversation with yourself
- `403 Forbidden` - Can only start conversations with friends

---

### 4.3 List Messages
**GET** `/chat/conversations/{conversation_id}/messages/`

**Authentication:** Required

**Path Parameters:**
- `conversation_id` (UUID) - Conversation ID

**Response:** `200 OK`
```json
[
  {
    "id": "uuid",
    "sender": {
      "id": "uuid",
      "username": "string",
      "email": "string",
      "bio": "string"
    },
    "content": "string",
    "message_type": "TEXT" | "PROOF",
    "proof_image": "url" | null,
    "related_habit": "uuid" | null,
    "verification_status": "PENDING" | "VERIFIED" | "REJECTED" | null,
    "created_at": "2024-01-15T10:30:00Z"
  }
]
```

**Error Responses:**
- `404 Not Found` - Conversation not found
- Returns empty array if user is not a participant

---

### 4.4 Create Message
**POST** `/chat/conversations/{conversation_id}/messages/create/`

**Authentication:** Required

**Path Parameters:**
- `conversation_id` (UUID) - Conversation ID

**Request Body:**
```json
{
  "content": "string",
  "related_habit_id": "uuid" (optional)
}
```

**Response:** `201 Created`
```json
{
  "id": "uuid",
  "sender": {...},
  "content": "string",
  "message_type": "TEXT" | "PROOF",
  "proof_image": null,
  "related_habit": "uuid" | null,
  "verification_status": "PENDING" | null,
  "created_at": "2024-01-15T10:30:00Z"
}
```

**Error Responses:**
- `404 Not Found` - Conversation not found
- `403 Forbidden` - Not a participant of this conversation

---

## 5. Proof Submission & Verification

### 5.1 Submit Proof
**POST** `/chat/proof/submit/`

**Authentication:** Required

**Request Body:** (multipart/form-data)
```
habit_id: uuid (required)
conversation_id: uuid (optional, if friend_id not provided)
friend_id: uuid (optional, if conversation_id not provided)
proof_image: File (required)
content: string (optional)
```

**Response:** `201 Created`
```json
{
  "id": "uuid",
  "sender": {...},
  "content": "string",
  "message_type": "PROOF",
  "proof_image": "url",
  "related_habit": "uuid",
  "verification_status": "PENDING",
  "created_at": "2024-01-15T10:30:00Z"
}
```

**Error Responses:**
- `400 Bad Request` - habit_id is required
- `400 Bad Request` - proof_image is required
- `400 Bad Request` - Either conversation_id or friend_id is required
- `404 Not Found` - Habit not found or not owned by user
- `400 Bad Request` - Habit must be completed before submitting proof
- `403 Forbidden` - Can only send proofs to friends

**Note:** 
- Habit must be completed today (`is_completed_today()`)
- Automatically creates conversation if friend_id provided
- Updates habit's `last_proof_submission_date`
- Broadcasts via WebSocket

---

### 5.2 Verify/Reject Proof
**POST** `/chat/proof/{message_id}/verify/`

**Authentication:** Required

**Path Parameters:**
- `message_id` (UUID) - Chat message ID (must be PROOF type)

**Request Body:**
```json
{
  "action": "verify" | "reject"
}
```

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "sender": {...},
  "content": "string",
  "message_type": "PROOF",
  "proof_image": "url",
  "related_habit": "uuid",
  "verification_status": "VERIFIED" | "REJECTED",
  "created_at": "2024-01-15T10:30:00Z"
}
```

**Error Responses:**
- `400 Bad Request` - Action must be 'verify' or 'reject'
- `404 Not Found` - Proof message not found
- `403 Forbidden` - Cannot verify your own proof
- `403 Forbidden` - Not a participant of this conversation

**Note:**
- Only friends can verify (not the sender)
- On verify: Updates habit's `verified_count` and `verification_streak`
- Broadcasts verification update via WebSocket

---

## 6. WebSocket

### 6.1 WebSocket Connection
**WebSocket** `ws://localhost:8000/ws/chat/{conversation_id}/?token={jwt_token}`

**Authentication:** JWT Token (query parameter or Authorization header)

**Path Parameters:**
- `conversation_id` (UUID) - Conversation ID

**Connection:**
```javascript
const ws = new WebSocket(`ws://localhost:8000/ws/chat/${conversationId}/?token=${accessToken}`);
```

**Alternative:** Use Authorization header
```javascript
// Note: Some WebSocket clients may not support custom headers
// Query parameter is more reliable
```

---

### 6.2 Send Message (via WebSocket)
**Message Format:**
```json
{
  "type": "chat_message",
  "content": "string"
}
```

**Response:**
```json
{
  "type": "message",
  "message": {
    "id": "uuid",
    "sender": {...},
    "content": "string",
    "message_type": "TEXT",
    "created_at": "2024-01-15T10:30:00Z"
  }
}
```

---

### 6.3 Typing Indicator
**Send:**
```json
{
  "type": "typing",
  "is_typing": true | false
}
```

**Receive:**
```json
{
  "type": "typing",
  "user_id": "uuid",
  "username": "string",
  "is_typing": true | false
}
```

---

## 📝 Common Response Formats

### Error Response
```json
{
  "error": "Error message string"
}
```

### Validation Error Response
```json
{
  "field_name": ["Error message 1", "Error message 2"]
}
```

---

## 🔐 Authentication Flow

1. **Register** or **Login** to get `access` and `refresh` tokens
2. Include `access` token in Authorization header for all authenticated requests:
   ```
   Authorization: Bearer <access_token>
   ```
3. When `access` token expires, use `refresh` token to get new tokens (not implemented yet)
4. For WebSocket, pass token as query parameter: `?token=<access_token>`

---

## 📌 Notes

- All UUIDs are in standard UUID format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
- Date formats: `YYYY-MM-DD` for dates, `YYYY-MM-DDTHH:MM:SSZ` for datetimes
- Time formats: `HH:MM:SS` for duration fields
- Image URLs are relative paths that need to be prefixed with base URL and `/media/`
- All authenticated endpoints return `401 Unauthorized` if token is missing or invalid
- Habit streak and completion stats are automatically calculated on update

---

## 🚀 Quick Start Example

```javascript
// 1. Register
const registerResponse = await fetch('http://localhost:8000/users/api/register/', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: 'testuser',
    email: 'test@example.com',
    password: 'password123',
    password2: 'password123'
  })
});
const { access, refresh } = await registerResponse.json();

// 2. Create Habit
const habitResponse = await fetch('http://localhost:8000/habits/', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${access}`
  },
  body: JSON.stringify({
    name: 'Daily Exercise',
    habit_type: 'count',
    target_count: 10,
    frequency: 'daily'
  })
});
const habit = await habitResponse.json();

// 3. Update Habit Count
await fetch(`http://localhost:8000/habits/${habit.id}/`, {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${access}`
  },
  body: JSON.stringify({ count: 10 })
});

// 4. Connect WebSocket
const ws = new WebSocket(`ws://localhost:8000/ws/chat/${conversationId}/?token=${access}`);
```

