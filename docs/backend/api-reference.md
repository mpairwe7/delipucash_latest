# API Reference

Complete reference for all REST API endpoints. Base URL: `https://delipucash-latest.vercel.app` (production) or `http://localhost:3000` (development).

**Auth Legend:** `-` = public, `JWT` = requires Bearer token, `Admin` = requires ADMIN role, `Mod` = requires ADMIN or MODERATOR role

## Table of Contents

- [Authentication](#authentication)
- [Users](#users)
- [Questions](#questions)
- [Responses](#responses)
- [Surveys](#surveys)
- [Videos](#videos)
- [Reward Questions](#reward-questions)
- [Rewards](#rewards)
- [Payments](#payments)
- [Survey Payments & Subscriptions](#survey-payments--subscriptions)
- [Ads](#ads)
- [Notifications](#notifications)
- [File Upload (R2)](#file-upload-r2)
- [Real-Time (SSE)](#real-time-sse)
- [Quiz](#quiz)
- [Other](#other)

---

## Authentication

**Base:** `/api/auth`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/signup` | - | Register new user |
| POST | `/signin` | - | Login with email/password |
| POST | `/signout` | JWT | Logout (invalidate session) |
| POST | `/refresh-token` | - | Exchange refresh token for new token pair |
| POST | `/forgot-password` | - | Send password reset email |
| POST | `/reset-password` | - | Reset password with token |
| POST | `/validate-reset-token` | - | Check if reset token is valid |
| PUT | `/change-password` | JWT | Change password (authenticated) |
| PUT | `/two-factor` | JWT | Enable/disable 2FA |
| POST | `/two-factor/verify` | JWT | Verify OTP to enable 2FA |
| POST | `/two-factor/resend` | JWT | Resend OTP |
| POST | `/two-factor/send` | - | Send login OTP (2FA login flow) |
| POST | `/two-factor/verify-login` | - | Verify login OTP, get tokens |
| PUT | `/:userId/subscription-status` | - | Update subscription status |
| GET | `/:userId/subscription-status` | - | Check subscription status |
| PUT | `/:userId/surveysubscription-status` | - | Update survey subscription |
| GET | `/:userId/surveysubscription-status` | - | Check survey subscription |
| PUT | `/:userId/points` | - | Update user points |
| GET | `/:userId/points` | - | Get user points |

### POST `/signup`

```json
// Request
{ "email": "user@example.com", "password": "SecurePass123", "firstName": "John", "lastName": "Doe", "phone": "+256700000001" }

// Response 201
{ "accessToken": "eyJ...", "refreshToken": "a1b2c3...", "user": { "id": "uuid", "email": "...", "firstName": "...", "role": "USER", "points": 0 } }
```

### POST `/signin`

```json
// Request
{ "email": "user@example.com", "password": "SecurePass123" }

// Response 200 (without 2FA)
{ "accessToken": "eyJ...", "refreshToken": "a1b2c3...", "user": { ... } }

// Response 200 (with 2FA enabled)
{ "twoFactorRequired": true, "maskedEmail": "us***@example.com" }
```

### PUT `/two-factor`

```json
// Request — Enable
{ "enabled": true }
// Response 200
{ "success": true, "data": { "codeSent": true, "email": "us***@example.com", "expiresIn": 180 } }

// Request — Disable step 1 (send OTP)
{ "enabled": false, "password": "SecurePass123" }
// Response 200
{ "success": true, "data": { "codeSent": true, "email": "us***@example.com", "expiresIn": 180 } }

// Request — Disable step 2 (verify OTP)
{ "enabled": false, "password": "SecurePass123", "code": "123456" }
// Response 200
{ "success": true, "data": { "enabled": false } }
```

### POST `/two-factor/send`

Rate limited: 60-second cooldown between requests.

```json
// Request
{ "email": "user@example.com" }
// Response 200
{ "success": true, "data": { "codeSent": true, "email": "us***@example.com", "expiresIn": 600 } }
// Response 429 (rate limited)
{ "success": false, "error": "Please wait 45 seconds before requesting a new code" }
```

### POST `/two-factor/verify-login`

```json
// Request
{ "email": "user@example.com", "code": "123456" }
// Response 200
{ "success": true, "user": { ... }, "token": "eyJ...", "refreshToken": "a1b2c3..." }
```

### POST `/refresh-token`

```json
// Request
{ "refreshToken": "a1b2c3..." }

// Response 200
{ "accessToken": "eyJ...", "refreshToken": "d4e5f6..." }
```

---

## Users

**Base:** `/api/users`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/profile` | JWT | Get current user profile |
| PUT | `/profile` | JWT | Update profile fields |
| GET | `/stats` | JWT | Get user statistics |
| GET | `/privacy` | JWT | Get privacy settings |
| PUT | `/privacy` | JWT | Update privacy settings |
| GET | `/login-activity` | JWT | List login sessions |
| POST | `/signout-all-devices` | JWT | Revoke all sessions |
| POST | `/login-session` | JWT | Create new session record |
| POST | `/sessions/:sessionId/revoke` | JWT | Revoke specific session |

---

## Questions

**Base:** `/api/questions`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/all` | - | Paginated question feed |
| GET | `/leaderboard` | - | Top answerers leaderboard |
| GET | `/user-stats` | JWT | Current user's question stats |
| GET | `/uploaded` | - | Template/uploaded questions |
| GET | `/:questionId` | - | Single question with details |
| GET | `/:questionId/responses` | - | Paginated responses for question |
| POST | `/create` | JWT | Create new question |
| POST | `/loadquestions` | JWT | Bulk upload questions |
| POST | `/:questionId/vote` | JWT | Upvote or downvote |
| POST | `/:questionId/responses` | JWT | Submit a response/answer |

### GET `/all`

Query parameters:

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `tab` | string | "for-you" | Feed tab (for-you, trending, recent) |
| `page` | number | 1 | Page number |
| `limit` | number | 20 | Items per page (max 100) |

---

## Responses

**Base:** `/api/responses`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/:responseId/like` | - | Like a response |
| POST | `/:responseId/dislike` | - | Dislike a response |
| POST | `/:responseId/replies` | - | Reply to a response |
| GET | `/:responseId/replies` | - | Get replies for a response |
| GET | `/:responseId` | - | Get response with like/dislike counts |

---

## Surveys

**Base:** `/api/surveys`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/all` | Optional | All surveys (personalized if auth) |
| GET | `/status/:status` | Optional | Surveys by status |
| GET | `/:surveyId` | Optional | Single survey with questions |
| GET | `/:surveyId/attempt` | JWT | Check if user attempted survey |
| GET | `/:surveyId/responses` | JWT | Survey responses (creator only) |
| GET | `/:surveyId/analytics` | JWT | Survey analytics |
| POST | `/create` | JWT | Create survey with questions |
| POST | `/upload` | JWT | Upload survey questions |
| POST | `/:surveyId/responses` | JWT | Submit survey response |
| PUT | `/:surveyId` | JWT | Update survey (owner only) |
| DELETE | `/:surveyId` | JWT | Delete survey (owner only, cleans up R2 files) |

---

## Survey Webhooks

**Base:** `/api/surveys/:surveyId/webhooks` (via surveyRoutes)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/:surveyId/webhooks` | JWT | Create webhook |
| GET | `/:surveyId/webhooks` | JWT | List webhooks for survey |
| PUT | `/:surveyId/webhooks/:id` | JWT | Update webhook |
| DELETE | `/:surveyId/webhooks/:id` | JWT | Delete webhook |
| POST | `/:surveyId/webhooks/:id/test` | JWT | Test fire webhook |

### Webhook Events

Supported event types: `response.submitted`, `response.deleted`, `survey.updated`, `survey.deleted`, `survey.started`, `survey.ended`

### Security

- HMAC-SHA256 signature in `X-Webhook-Signature` header (if secret configured)
- Deterministic JSON body serialization (sorted keys) for reproducible signatures
- SSRF protection: blocked hosts (localhost, 127.0.0.1, 169.254.169.254, etc.) and private IP ranges (10.x, 172.16-31.x, 192.168.x)
- Auto-deactivation after 10 consecutive failures
- 5-second delivery timeout per webhook

---

## Survey File Uploads

**Base:** `/api/surveys`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/:surveyId/upload` | JWT | Upload file for file_upload question |
| GET | `/:surveyId/files/:fileId` | JWT | Get presigned download URL |
| DELETE | `/:surveyId/files/:fileId` | JWT | Delete uploaded file |

File validation: type check, max 25MB, question must be type `file_upload`.

---

## Survey Collaboration

**Base:** `/api/surveys/:surveyId/collab`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/:surveyId/collab/join` | JWT | Join editing session |
| POST | `/:surveyId/collab/leave` | JWT | Leave editing session |
| POST | `/:surveyId/collab/lock` | JWT | Lock a question for editing |
| POST | `/:surveyId/collab/unlock` | JWT | Unlock a question |
| GET | `/:surveyId/collab/editors` | JWT | Get active editors |

Sessions auto-expire after 30 minutes of inactivity (5-minute cleanup sweep).

---

## Survey Templates

**Base:** `/api/surveys/templates`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/templates` | JWT | Save survey as template |
| GET | `/templates` | JWT | List user's + public templates |
| GET | `/templates/:id` | JWT | Get template by ID |
| DELETE | `/templates/:id` | JWT | Delete template (owner only) |

---

## Videos

**Base:** `/api/videos`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/all` | Optional | All videos (shows user like/bookmark status if auth) |
| GET | `/live` | - | Active livestreams |
| GET | `/user/:userId` | - | Videos by user |
| GET | `/:id/comments` | - | Video comments |
| GET | `/limits/:userId` | - | Upload limits for user |
| GET | `/:id/status` | JWT | User's like/bookmark status for video |
| POST | `/create` | JWT | Upload/create video |
| POST | `/:id/like` | JWT | Like video |
| POST | `/:id/unlike` | JWT | Unlike video |
| POST | `/:id/comments` | JWT | Add comment |
| POST | `/:id/share` | - | Track share |
| POST | `/:id/bookmark` | JWT | Toggle bookmark |
| POST | `/:id/views` | - | Increment view count |
| POST | `/validate-upload` | JWT | Check upload limits |
| PUT | `/update/:id` | JWT | Update video metadata |
| DELETE | `/delete/:id` | JWT | Delete video + R2 files |
| POST | `/livestream/start` | JWT | Start livestream session |
| POST | `/livestream/end` | JWT | End livestream |
| POST | `/livestream/:sessionId/join` | JWT | Join livestream |
| POST | `/livestream/:sessionId/leave` | JWT | Leave livestream |
| POST | `/livestream/:sessionId/chat` | JWT | Send livestream chat |
| POST | `/validate-session` | JWT | Validate session duration |

---

## Reward Questions

**Base:** `/api/reward-questions`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/all` | JWT | All reward questions (answers stripped) |
| GET | `/regular` | JWT | Non-instant reward questions (paginated) |
| GET | `/instant` | JWT | Instant reward questions (paginated) |
| GET | `/user/:userId` | JWT | User's created reward questions |
| GET | `/:id` | JWT | Single reward question (answer stripped) |
| POST | `/create` | JWT | Create reward question |
| PUT | `/:id/update` | JWT | Update reward question (owner only) |
| DELETE | `/:id/delete` | JWT | Delete reward question (owner only) |
| POST | `/:id/answer` | JWT | Submit answer (triggers instant payout if correct) |
| POST | `/submit-answer` | JWT | Submit answer (alias endpoint) |

### GET `/regular` and `/instant`

Query parameters:

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `limit` | number | 10 | Items per page |

### POST `/create` Validation

| Field | Constraint |
| ----- | --------- |
| `text` | Required, max 2000 characters |
| `options` | Non-null object, 2-10 entries |
| `correctAnswer` | Must be a key in `options` |
| `rewardAmount` | 1 — 1,000,000 |
| `maxWinners` | 1 — 10 (instant rewards only) |
| `paymentProvider` | Must be "MTN" or "AIRTEL" (instant only) |

### POST `/:id/answer`

```json
// Request
{ "selectedAnswer": "Option B" }

// Response 200 (correct — answer revealed)
{ "isCorrect": true, "correctAnswer": "Option B", "rewardEarned": 500, "remainingSpots": 1 }

// Response 200 (incorrect — answer NOT revealed while question active)
{ "isCorrect": false, "rewardEarned": 0, "remainingSpots": 2 }

// Response 200 (incorrect — answer revealed after question completed/expired)
{ "isCorrect": false, "correctAnswer": "Option A", "rewardEarned": 0, "remainingSpots": 0 }

// Response 400 (already attempted)
{ "message": "You have already attempted this question" }
```

---

## Rewards

**Base:** `/api/rewards`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/user/:userId` | JWT | User's reward history |
| GET | `/:phoneNumber` | JWT | Rewards by phone number |
| POST | `/add` | JWT | Add reward points |
| POST | `/redeem` | JWT | Redeem points for cash/airtime |

### POST `/redeem`

```json
// Request
{ "cashValue": 5000, "provider": "MTN", "phoneNumber": "0771234567", "type": "CASH" }

// Response 200 (success)
{ "success": true, "transactionRef": "TXN-123", "message": "5,000 UGX has been sent to your MTN number!" }

// Response 502 (payment failed)
{ "success": false, "error": "Payment processing failed. Your points have been refunded." }

// Response 400 (insufficient points)
{ "success": false, "error": "Insufficient points. You have 300 points, need 500." }
```

---

## Payments

**Base:** `/api/payments`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/initiate` | - | Initiate subscription payment |
| POST | `/disburse` | - | Initiate disbursement to user |
| POST | `/callback` | - | Payment provider webhook |
| GET | `/users/:userId/payments` | - | User's payment history |
| PUT | `/payments/:paymentId/status` | - | Update payment status |

---

## Survey Payments & Subscriptions

### Survey Payments — `/api/survey-payments`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/initiate` | JWT | Start survey payment |
| GET | `/history` | JWT | Payment history |
| GET | `/:paymentId/status` | JWT | Check payment status |

### Survey Subscriptions — `/api/survey-subscriptions`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/plans` | - | Available subscription plans |
| GET | `/status` | JWT | Current subscription status |
| POST | `/:subscriptionId/cancel` | JWT | Cancel auto-renewal |

---

## Ads

**Base:** `/api/ads`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/all` | - | All active ads |
| GET | `/user/:userId` | - | User's ads |
| GET | `/:adId/analytics` | JWT | Ad performance metrics |
| POST | `/create` | JWT | Create ad campaign |
| PUT | `/:adId/update` | JWT | Update ad |
| DELETE | `/:adId/delete` | JWT | Delete ad |
| PUT | `/:adId/pause` | JWT | Pause campaign |
| PUT | `/:adId/resume` | JWT | Resume campaign |
| GET | `/admin/pending` | Mod | Ads awaiting moderation |
| PUT | `/:adId/approve` | Mod | Approve ad |
| PUT | `/:adId/reject` | Mod | Reject ad (with reason) |
| POST | `/:adId/view` | - | Track ad view |
| POST | `/:adId/impression` | - | Track ad impression |
| POST | `/:adId/click` | - | Track ad click |
| POST | `/:adId/conversion` | - | Track ad conversion |

---

## Notifications

**Base:** `/api/notifications`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | JWT | User's notifications (paginated) |
| GET | `/unread-count` | JWT | Unread notification count |
| GET | `/stats` | JWT | Notification statistics |
| GET | `/users/:userId` | JWT | Filtered notifications |
| GET | `/users/:userId/stats` | JWT | User notification stats |
| POST | `/` | JWT | Create notification |
| POST | `/template` | JWT | Create from template |
| PUT | `/:notificationId/read` | JWT | Mark as read |
| POST | `/:notificationId/read` | JWT | Mark as read (alias) |
| PUT | `/users/:userId/read` | JWT | Mark multiple as read |
| POST | `/read-all` | JWT | Mark all as read |
| PUT | `/:notificationId/archive` | JWT | Archive notification |
| DELETE | `/:notificationId` | JWT | Delete notification |
| DELETE | `/cleanup` | Admin | Clean up expired notifications |

---

## File Upload (R2)

**Base:** `/api/r2`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/upload/video` | JWT | Upload video to R2 |
| POST | `/upload/thumbnail` | JWT | Upload thumbnail |
| POST | `/upload/media` | JWT | Upload video + thumbnail |
| POST | `/upload/validate` | JWT | Validate upload request |
| POST | `/upload/ad-media` | JWT | Upload ad media |
| POST | `/presign/upload` | - | Get presigned upload URL |
| POST | `/presign/download` | - | Get presigned download URL |
| POST | `/livestream/chunk` | - | Upload livestream chunk |
| POST | `/livestream/finalize` | - | Finalize livestream recording |
| DELETE | `/delete/:key(*)` | - | Delete file by R2 key |

---

## Real-Time (SSE)

**Base:** `/api/sse`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/stream` | JWT | SSE event stream (persistent connection) |
| GET | `/poll` | JWT | JSON poll endpoint (alternative to SSE) |

See [Real-Time Events](realtime.md) for details.

---

## Quiz

**Base:** `/api/quiz`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/questions` | JWT | Get quiz questions |
| GET | `/points/:userId` | JWT | Get user points |
| PUT | `/points` | JWT | Update user points |
| POST | `/sessions` | JWT | Save quiz session |
| POST | `/redeem` | JWT | Redeem quiz points |
| POST | `/disburse` | JWT | Initiate disbursement |

---

## Other

### Question Attempts — `/api/attempts`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/record` | - | Record question attempt |
| GET | `/:phoneNumber` | - | Get attempts by phone |

### Explore — `/api/explore`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/items` | - | Explore feed content |

### Health — `/api/health`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Quick health check |
| GET | `/api/health/health` | Comprehensive health (includes DB) |
| GET | `/api/health/ping` | Ping/pong |

### Deep Links (Top-Level)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/.well-known/apple-app-site-association` | iOS Universal Links |
| GET | `/.well-known/assetlinks.json` | Android App Links |
| GET | `/reset-password` | Password reset redirect |

---

## Error Responses

All errors follow this format:

```json
{
  "success": false,
  "statusCode": 400,
  "message": "Human-readable error message",
  "stack": "..." // Only in development
}
```

### Common Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad request (validation error) |
| 401 | Unauthorized (missing/expired token) |
| 403 | Forbidden (insufficient role) |
| 404 | Resource not found |
| 409 | Conflict (duplicate attempt) |
| 500 | Internal server error |
| 502 | Bad gateway (payment provider failure) |
