// firebase-config.js

import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.1.3/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/9.1.3/firebase-firestore.js';

const firebaseConfig = {
    apiKey: "AIzaSyCsoGz6eJHTp39--aq9BVGH3f4NrLslOmo",
    authDomain: "hellotabeeb-4b6eb.firebaseapp.com",
    projectId: "hellotabeeb-4b6eb",
    storageBucket: "hellotabeeb-4b6eb.firebasestorage.app",
    messagingSenderId: "430006296642",
    appId: "1:430006296642:web:4bf1cc090e532b85358ddb",
    measurementId: "G-949YWDRZCM"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { app, db };