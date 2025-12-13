import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBDmfkXC_16JHaHjxIKFW-CG1_Vm4Pj6iI",
  authDomain: "freshkeep-3c642.firebaseapp.com",
  projectId: "freshkeep-3c642",
  storageBucket: "freshkeep-3c642.firebasestorage.app",
  messagingSenderId: "823822657156",
  appId: "1:823822657156:web:0e51d85efd2291f66f84d1"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and Firestore
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);

export default app;
