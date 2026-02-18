# Payment Integration

## Table of Contents

- [Overview](#overview)
- [MTN Mobile Money](#mtn-mobile-money)
- [Airtel Money](#airtel-money)
- [Reward Redemption Flow](#reward-redemption-flow)
- [Subscription Payments](#subscription-payments)
- [Error Handling](#error-handling)

## Overview

DelipuCash integrates with MTN MoMo and Airtel Money for two payment directions:

| Direction | Use Case | Controller |
|-----------|----------|-----------|
| **Platform → User** (Disbursement) | Reward payouts, instant rewards | `paymentController.mjs` |
| **User → Platform** (Collection) | Subscription payments | `surveyPaymentController.mjs` |

**Currency:** Uganda Shillings (UGX)

**Points Conversion:** 1 point = 100 UGX (`POINTS_TO_UGX = 100`)

## MTN Mobile Money

### Disbursement Flow

**Function:** `processMtnPayment({ amount, phoneNumber, userId, reason })`

```mermaid
sequenceDiagram
    participant API as Backend
    participant MTN as MTN MoMo API

    API->>API: Format phone → 256XXXXXXXXX
    API->>API: Generate referenceId (UUID)
    API->>MTN: POST /collection/token/ (Basic Auth)
    MTN-->>API: { access_token }

    API->>MTN: POST /disbursement/v1_0/transfer
    Note right of MTN: Headers: Authorization, X-Reference-Id,<br/>X-Target-Environment, Ocp-Apim-Subscription-Key
    Note right of MTN: Body: { amount, currency, payee,<br/>payerMessage, payeeNote }
    MTN-->>API: 202 Accepted

    API->>API: Wait 3 seconds

    API->>MTN: GET /disbursement/v1_0/transfer/{referenceId}
    MTN-->>API: { status: "SUCCESSFUL", financialTransactionId }

    API-->>API: Return { success: true, reference }
```

### Configuration

| Env Variable | Purpose |
|-------------|---------|
| `MTN_PRIMARY_KEY` | API subscription key |
| `MTN_DISBURSEMENT_KEY` | Disbursement-specific key |

### API Endpoints

- **Token:** `https://sandbox.momodeveloper.mtn.com/collection/token/`
- **Transfer:** `https://sandbox.momodeveloper.mtn.com/disbursement/v1_0/transfer`
- **Status:** `https://sandbox.momodeveloper.mtn.com/disbursement/v1_0/transfer/{referenceId}`

> **Note:** Currently configured for MTN sandbox. Change base URL and remove EUR conversion for production.

## Airtel Money

### Disbursement Flow

**Function:** `processAirtelPayment({ amount, phoneNumber, userId, reason })`

Similar flow to MTN with Airtel-specific endpoints and authentication:

| Env Variable | Purpose |
|-------------|---------|
| `AIRTEL_CLIENT_ID` | OAuth client ID |
| `AIRTEL_CLIENT_SECRET` | OAuth client secret |

## Reward Redemption Flow

The `redeemRewards` controller uses a 3-phase transaction pattern for safe point-to-cash conversion:

```mermaid
sequenceDiagram
    participant App as Mobile App
    participant API as Backend
    participant DB as PostgreSQL
    participant Pay as MTN/Airtel

    App->>API: POST /api/rewards/redeem
    Note right of App: { cashValue, provider,<br/>phoneNumber, type }

    rect rgb(230, 245, 230)
        Note over API,DB: Phase 1: Validate & Deduct (Transaction)
        API->>DB: BEGIN TRANSACTION
        API->>DB: SELECT points FROM AppUser WHERE id = userId
        alt Insufficient Points
            API-->>App: 400 { error: "Insufficient points" }
        end
        API->>DB: UPDATE AppUser SET points -= required
        API->>DB: INSERT RewardRedemption (PENDING)
        API->>DB: COMMIT
    end

    rect rgb(230, 235, 250)
        Note over API,Pay: Phase 2: Payment (No Transaction)
        API->>Pay: processMtnPayment / processAirtelPayment
        Pay-->>API: { success, reference }
    end

    rect rgb(250, 235, 230)
        Note over API,DB: Phase 3: Finalize (Transaction)
        API->>DB: BEGIN TRANSACTION
        alt Payment Succeeded
            API->>DB: UPDATE RewardRedemption SET status=SUCCESSFUL
        else Payment Failed
            API->>DB: UPDATE RewardRedemption SET status=FAILED
            API->>DB: UPDATE AppUser SET points += required (refund)
        end
        API->>DB: COMMIT
    end

    API-->>App: { success, transactionRef, message }
```

### Request Validation

| Field | Validation |
|-------|-----------|
| `cashValue` | Required, positive number |
| `provider` | Required, must be "MTN" or "AIRTEL" |
| `phoneNumber` | Required |
| `type` | Required, must be "CASH" or "AIRTIME" |

### Instant Reward Disbursement

When a user correctly answers an instant reward question and the winner count reaches `maxWinners`:

1. `submitRewardQuestionAnswer` creates `InstantRewardWinner` record
2. Calls `processMtnPayment` or `processAirtelPayment` directly
3. Updates `InstantRewardWinner.paymentStatus` to SUCCESSFUL or FAILED
4. Publishes SSE event for real-time notification

## Subscription Payments

### Available Plans

Managed by `surveyPaymentController.mjs`:

| Endpoint | Description |
|----------|-------------|
| `GET /api/survey-subscriptions/plans` | List subscription tiers |
| `GET /api/survey-subscriptions/status` | Check current subscription |
| `POST /api/survey-payments/initiate` | Start payment |
| `GET /api/survey-payments/:paymentId/status` | Poll payment status |
| `POST /api/survey-subscriptions/:id/cancel` | Cancel auto-renewal |

### Subscription Types

ONCE, DAILY, WEEKLY, MONTHLY, QUARTERLY, HALF_YEARLY, YEARLY, LIFETIME

## Error Handling

### Payment Failures

- Phase 2 payment error → caught, `paymentResult.success = false`
- Phase 3 always runs → updates record status, refunds points on failure
- Client receives 502 with `"Payment processing failed. Your points have been refunded."`

### Idempotency

- Each `RewardRedemption` record has a unique ID
- Transaction phases prevent double-deduction
- Payment provider reference stored for reconciliation
