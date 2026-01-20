

// firebaseConfig.tsx

// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries
import { getStorage } from "firebase/storage";
// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCidMmKETDIkQsFj0xegLgrVLMy--NxLL4",
  authDomain: "mernapp-6e488.firebaseapp.com",
  projectId: "mernapp-6e488",
  storageBucket: "mernapp-6e488.appspot.com",
  messagingSenderId: "536088247858",
  appId: "1:536088247858:web:bd3fec84731d99e85e462b"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const storage = getStorage(app);

export { app, storage };

