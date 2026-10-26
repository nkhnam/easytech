# AI backend implementation plan

Goal: remove the Gemini key from the mobile bundle while preserving task verification and chatbot calls.

Decision: use a Firebase v2 callable in the existing Firebase project. The native Functions SDK forwards the current native Firebase authentication token; the callable rejects unsigned requests and calls Gemini using a Secret Manager binding. Rejected: a mobile environment variable because it would ship the key in the app. Assumptions: existing Firebase sign-in remains required and the project can deploy Cloud Functions. No new public AI endpoint without authentication is introduced.

- [x] Add callable handler, server secret binding, fixed provider/model and input/output bounds.
- [x] Use a transaction-backed quota in an isolated named Firestore database with no client access.
- [x] Switch TaskTutorial and ChatBot to a shared callable client.
- [x] Test unsigned calls, bad inputs, image payloads, provider errors and quota boundaries without provider calls.
- [x] Check changed client JavaScript syntax and Firebase module loading.
- [ ] Provision the named database and deny-client rules, secret and function in the existing project.
- [ ] Verify signed-in mobile text/image calls after deployment; build and release the mobile app through the normal workflow.
- [ ] Revoke the leaked key and review GitGuardian after rollout.

Risk sizing: authenticated users can replay requests, gaining billed model capacity. The server enforces 20 requests per UID per one-hour window and at most 4096 output tokens. Quota persists in a transaction and is isolated from mobile data rules. Limits are estimates for this deployment, not measured traffic requirements; reassess before changing signup policy, traffic or billing limits. Account creation abuse is not solved by per-user quotas; normal provider/project budget monitoring remains necessary.

