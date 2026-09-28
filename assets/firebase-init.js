/* ============================================================================
   Stock the Block — Firebase bootstrap
   ----------------------------------------------------------------------------
   Firebase's SDK is ESM-only, so this one file is a <script type="module">.
   Every other script stays a classic script and reaches Firebase through
   window.STB_FIREBASE.

   Auth is loaded only on pages that opt in with <html data-auth> (members.html
   and admin.html). The public pages never need a login, so they never load the
   auth SDK and it never stores sign-in state in a visitor's browser. That keeps
   the footer's privacy note true for the public site.

   No Analytics, on purpose: the footer promises no trackers.
   ============================================================================ */
   import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
   import {
     getFirestore, collection, addDoc, doc, getDoc, getDocs, setDoc, updateDoc,
     deleteDoc, query, where, orderBy, serverTimestamp, onSnapshot, writeBatch
   } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
   
   const firebaseConfig = {
     apiKey: "AIzaSyCPqXATeb7eYyphPoyAw6ujskAcYJHPgmY",
     authDomain: "stock-the-block.firebaseapp.com",
     projectId: "stock-the-block",
     storageBucket: "stock-the-block.firebasestorage.app",
     messagingSenderId: "861067109567",
     appId: "1:861067109567:web:d0919639fd44819fad920a"
   };
   
   const app = initializeApp(firebaseConfig);
   const db = getFirestore(app);
   
   /* Shorthand properties: { db } means { db: db }. */
   const fb = {
     app, db, collection, addDoc, doc, getDoc, getDocs, setDoc, updateDoc,
     deleteDoc, query, where, orderBy, serverTimestamp, onSnapshot, writeBatch
   };
   
   /* A dynamic import(): unlike the static imports above, this one only runs
      when the condition is true. Top-level await pauses this module until it
      finishes, so the ready event below never fires before auth is attached. */
   if (document.documentElement.hasAttribute("data-auth")) {
     const a = await import("https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js");
     fb.auth = a.getAuth(app);
     fb.onAuthStateChanged = a.onAuthStateChanged;
     fb.signInWithEmailAndPassword = a.signInWithEmailAndPassword;
     fb.sendPasswordResetEmail = a.sendPasswordResetEmail;
     fb.signOut = a.signOut;
     fb.GoogleAuthProvider = a.GoogleAuthProvider;
     fb.signInWithPopup = a.signInWithPopup;
   }
   
   window.STB_FIREBASE = fb;
   window.dispatchEvent(new Event("stb-firebase-ready"));