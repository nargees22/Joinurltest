import { initializeApp } from "firebase/app";
import { getFirestore, FieldValue, serverTimestamp, increment, arrayUnion } from "firebase/firestore";

// NOTE: You must ensure your Firebase project credentials are provided either 
// in this config or through environment variables for this to function.
const firebaseConfig = {
  // Replace with your project's Firebase configuration
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// Legacy support for older parts of the app that expect the firebase namespace
export const firebase = {
  firestore: {
    FieldValue: {
      serverTimestamp,
      increment,
      arrayUnion
    }
  }
};

export default app;