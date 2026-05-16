# Aura-Agent: Frontend API Contract & Integration Guide

This document outlines the API contract and the step-by-step workflow for the Frontend team (PWA) to integrate with the Aura-Agent Backend. 

Because the frontend is a Progressive Web App (PWA), the integration relies on standard HTTP requests (via `fetch` or Axios) and optionally the Firebase JS SDK for real-time updates.

---

## 🔐 Authentication Guide (IMPORTANT)

All endpoints in this API are protected using **Role-Based Access Control (RBAC)** via Firebase Authentication. You must include an `Authorization: Bearer <token>` header in all requests.

### Scenario A: Local Testing (`MOCK_MODE=True` on backend)
While the backend is running locally in mock mode, you **do not** need to connect to real Firebase servers. You can bypass authentication by sending dummy strings:
*   **Act as a Normal User**: Send `Authorization: Bearer user_123` (The backend will treat `user_123` as your Firebase UID).
*   **Act as an Admin**: Send `Authorization: Bearer mock-admin-token` (The backend will grant you full admin privileges, allowing you to fetch all claims and manually review them).

### Scenario B: Production (`MOCK_MODE=False` on backend)
When the backend is live, the dummy tokens will be rejected with a `401 Unauthorized` error. You must implement the real Firebase Auth flow:
1. Initialize the Firebase JS SDK (`npm install firebase`) on the frontend.
2. Build a Login/Signup UI (Email/Password or Google Auth).
3. After signup/login, save app profile fields such as `username` through `POST /api/v1/users/register`.
4. Once the user logs in, fetch their JWT token:
   ```javascript
   import { getAuth } from "firebase/auth";
   const auth = getAuth();
   const user = auth.currentUser;
   const token = await user.getIdToken(); // This returns the massive JWT string
   ```
5. Attach this token to your API calls:
   ```javascript
   headers: {
       "Content-Type": "application/json",
       "Authorization": `Bearer ${token}`
   }
   ```

---

## 🗺️ Step-by-Step Integration Workflow

### Step 1: Upload Evidence
*   **Action**: The user selects images/videos/audio on the frontend. The PWA sends each file to the backend via `POST /api/v1/upload`.
*   **Result**: The backend returns a `file_id` and a `signed_url`. In `MOCK_MODE=true`, this is stored in memory and no Google Cloud Storage call is made. In real mode, the backend stores the file in Google Cloud Storage. The PWA collects an array of these `file_id`s to attach to the claim.

### Step 2: Create the Claim
*   **Action**: The user submits the claim form. The PWA sends the user info, claim type, description fields, refund amount, and the array of `file_id`s to `POST /api/v1/claims`.
*   **Result**: The backend saves this claim and returns the full claim document. The claim `id` is the claim identifier. The claim status is now `pending`.

### Step 3: Trigger the AI Analysis
*   **Action**: The PWA immediately triggers the analysis pipeline by calling `POST /api/v1/claims/{claim_id}/analyze`.
*   **Result**: The backend returns `202 Accepted` immediately. It runs the multimodal AI and fraud checks asynchronously in the background so the HTTP request doesn't time out. In `MOCK_MODE=true`, the analysis result is deterministic and no Vertex AI call is made.

### Step 4: Track Progress (Two Options)
*   **Option A (Recommended for PWA)**: Use the `firebase` npm package on the frontend. Listen to the Firestore document `claims/{claim_id}` in real-time. The UI will instantly update as the backend changes the `current_step` field.
*   **Option B (Fallback Polling)**: If you don't want to use the Firebase SDK on the frontend, poll the `GET /api/v1/claims/{claim_id}/status` endpoint every 2-3 seconds to check the `current_step` and `status`.

### Step 5: Show Final Result
*   **Action**: Once the status changes from `processing` to `approved`, `review`, `rejected`, or `failed`, stop polling/listening. Fetch the full claim details from `GET /api/v1/claims/{claim_id}` and display the refund amount and AI explanation to the user.

---

## 📜 Backend API Contract

All endpoints follow this standard JSON response wrapper:
```json
{
  "status": "ok" | "error",
  "data": { ... payload ... },
  "message": "Human readable description",
  "timestamp": "2024-05-15T10:00:00Z"
}
```

### 1. Upload File
`POST /api/v1/upload`

`POST /api/v1/upload/` is also accepted for compatibility.

*   **Headers**: `Content-Type: multipart/form-data`
*   **Body**: Form-data with key `file` (binary, allowed: `image/*`, `video/*`, `audio/*`)
*   **Response (data payload)**:
    ```json
    {
      "file_id": "uuid-string.jpg",
      "signed_url": "https://storage.googleapis.com/..."
    }
    ```

### 2. Register / Save User Profile
`POST /api/v1/users/register`

*   **Headers**: `Content-Type: application/json`, `Authorization: Bearer <JWT>`
*   **Body**:
    ```json
    {
      "username": "rafif_store",
      "email": "rafif@example.com"
    }
    ```
*   **Response (data payload)**:
    ```json
    {
      "id": "firebase-uid",
      "username": "rafif_store",
      "email": "rafif@example.com",
      "created_at": "2024-05-15T10:00:00Z",
      "updated_at": "2024-05-15T10:00:00Z"
    }
    ```

Firebase Auth still owns password/login. This endpoint only stores app profile metadata such as `username`.

### 3. Create Claim
`POST /api/v1/claims`

`POST /api/v1/claims/` is also accepted for compatibility.

*   **Headers**: `Content-Type: application/json`
*   **Body**:
    ```json
    {
      "user_id": "user_123",
      "order_id": "ORD-4455",
      "claim_type": "product_defect",
      "file_ids": ["uuid-string.jpg", "uuid-string.mp4"],
      "text_description": "Layar retak saat diterima.",
      "voice_description": null,
      "product_price": 2500000.0,
      "refund_amount": 2500000.0
    }
    ```
*   **Response (data payload)**: 
    Returns the newly created claim document, including `id`.
    ```json
    {
      "id": "claim-uuid",
      "user_id": "user123",
      "order_id": "ORD-999",
      "claim_type": "product_defect",
      "file_ids": ["uuid-string.jpg"],
      "text_description": "The screen arrived cracked.",
      "voice_description": null,
      "product_price": 2500000.0,
      "item_value": 2500000.0,
      "refund_amount": 150.0,
      "status": "pending",
      "current_step": null,
      "confidence_score": null,
      "ai_decision": null,
      "ai_explanation": null,
      "damage_type": null,
      "refund_value": null,
      "created_at": "2024-05-15T10:00:00Z",
      "updated_at": "2024-05-15T10:00:00Z"
    }
    ```

`product_price` is the user-entered product price. `item_value` remains as a legacy alias in responses for older clients. `refund_amount` is optional when the refund request equals the product price; the backend can fall back to `product_price` for approval/refund calculations.

### 4. Trigger Analysis (Background Job)
`POST /api/v1/claims/{claim_id}/analyze`

*   **Response (202 Accepted)**:
    ```json
    {
      "claim_id": "claim-uuid",
      "status": "processing",
      "message": "Analysis pipeline started. Poll /status or listen via Firestore realtime."
    }
    ```

### 5. Poll Status
`GET /api/v1/claims/{claim_id}/status`

*   **Response (data payload)**:
    ```json
    {
      "claim_id": "claim-uuid",
      "status": "processing", 
      "current_step": "analyzing_evidence", 
      "updated_at": "2024-05-15T10:05:00Z"
    }
    ```
*   **Note on `status`**: Transitions from `pending` -> `processing` -> `approved` | `review` | `rejected` | `failed`.
*   **Note on `current_step`**: Transitions through `uploading_evidence` -> `analyzing_evidence` -> `detecting_damage_patterns` -> `calculating_confidence_score` -> `generating_report` -> `complete`. If the pipeline crashes, it becomes `failed`.

### 6. Get Full Claim Details
`GET /api/v1/claims/{claim_id}`

*   **Response (data payload)**:
    Returns the full claim document, which includes the final decision metrics after analysis:
    ```json
    {
      "id": "claim-uuid",
      "user_id": "user123",
      "order_id": "ORD-999",
      "claim_type": "product_defect",
      "file_ids": ["uuid-string.jpg"],
      "text_description": "The screen arrived cracked.",
      "voice_description": null,
      "product_price": 2500000.0,
      "item_value": 2500000.0,
      "refund_amount": 150.0,
      "status": "approved",
      "current_step": "complete",
      "confidence_score": 0.91,
      "ai_decision": "AUTO_APPROVE",
      "visual_score": 0.95,
      "exif_score": 1.0,
      "trust_score": 0.70,
      "ai_explanation": "Clear manufacturing defect is visible...",
      "damage_type": "product_defect",
      "refund_value": 150.0,
      "created_at": "2024-05-15T10:00:00Z",
      "updated_at": "2024-05-15T10:05:00Z"
    }
    ```

### 7. List Claims
`GET /api/v1/claims`

*   **Query Parameters**: 
    *   `user_id` (Optional for Admins, Required for Users).
*   **Response (data payload)**:
    Returns an array of full claim documents. If an Admin calls this without a `user_id`, it returns the history of ALL claims in the system across all users.

### 8. Fresh File URL
`GET /api/v1/upload/{file_id}/url`

*   **Response (data payload)**:
    ```json
    {
      "file_id": "uuid-string.jpg",
      "signed_url": "https://storage.googleapis.com/..."
    }
    ```

### 9. Admin Manual Review
`PATCH /api/v1/claims/{claim_id}/review`

*   **Headers**: `Authorization: Bearer <Admin_JWT>`
*   **Body**:
    ```json
    {
      "status": "approved",
      "ai_decision": "OVERRIDDEN_APPROVE",
      "refund_value": 150.0
    }
    ```
*   **Response (data payload)**:
    Returns the updated full claim document.
    ```json
    {
      "id": "claim-uuid",
      "status": "approved",
      "ai_decision": "OVERRIDDEN_APPROVE",
      "refund_value": 150.0
      // ...other fields
    }
    ```
