import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyCoycmmRkZjbWMefijj03vBJbtzTDbKSeo",
  authDomain: "signup-login-realtime-3de98.firebaseapp.com",
  projectId: "signup-login-realtime-3de98",
  storageBucket: "signup-login-realtime-3de98.appspot.com",
  messagingSenderId: "783662676729",
  appId: "1:783662676729:web:1f5acaa9271b072a19c028",
  measurementId: "G-M9ZW0F8E3P",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);
export { db, auth, storage };
