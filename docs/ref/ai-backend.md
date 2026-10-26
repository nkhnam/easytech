# Firebase AI backend setup

The mobile app now calls generateAI in us-central1 through @react-native-firebase/functions, using the existing native Firebase app and native Auth login. No Gemini key is stored in mobile source, build variables or Firebase public config.

Prerequisites: use the existing EasyTech Firebase project, Node.js 22 for the functions runtime, Firebase CLI, permission to deploy functions and secrets, and the billing plan required by Cloud Functions. No billing or cloud setting was changed during implementation.

Before rollout:

1. From functions/, run npm ci and npm test.
2. Create a Firestore Native database named easytech-ai in the existing project, in an appropriate supported location. This database is separate from the app's default Firestore database and stores only per-user quota windows. Use the Firebase/Google Cloud database administration UI or CLI.
3. Deploy only its deny-client rules using the firestore:easytech-ai target in firebase.json. Do not deploy rules to the app's default database. The function's Admin SDK service account needs access to the named database.
4. Set a rotated GEMINI_API_KEY through Firebase Secret Manager (firebase functions:secrets:set GEMINI_API_KEY --project YOUR_EXISTING_PROJECT). Do not put it in a .env file committed to Git.
5. Deploy the function using firebase deploy --only functions:easytech-ai --project YOUR_EXISTING_PROJECT. The export is generateAI. Apply database rules before enabling the function.
6. Reinstall iOS pods with the normal project CocoaPods workflow after adding the native Functions dependency, then build the mobile app normally. Verify signed-in chatbot and task-image calls. Verify signed-out calls fail. A new mobile release is required; existing installed builds still contain the old key until updated, so revoke the old provider key.

The backend has a per-user transaction quota of 20 attempts per one-hour window, including provider failures, and maxInstances=3. The quota is in database easytech-ai, collection _aiRateLimits; only the Admin SDK can read or write it. No existing user database rules are changed. Requests accept at most 32000 prompt characters and an optional JPEG/PNG/WebP image up to 4 MB. The server selects gemini-2.5-flash, disables thinking and caps output at 4096 tokens.

The backend tests replace Gemini HTTP calls and use an in-memory transaction adapter for quota logic. They do not prove Firestore deployment, IAM, Firebase authentication transport, provider availability or native mobile builds. No Firebase deploy, real Gemini call, credential rotation or mobile release was performed.

