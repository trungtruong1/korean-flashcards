// Optional accounts: sign in with Google or email and keep progress in
// Firestore (document users/{uid}), synced across devices.
// Turned on by filling in js/firebase-config.js; without it this file does nothing.
const cfg = window.GORAE_FIREBASE;
const V = "10.12.2";

if (cfg && cfg.apiKey) start().catch((e) => console.error("Sync failed to start", e));

async function start() {
  const [{ initializeApp }, A, F] = await Promise.all([
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`),
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-auth.js`),
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-firestore.js`),
  ]);
  const fb = initializeApp(cfg);
  const auth = A.getAuth(fb);
  const db = F.getFirestore(fb);
  const app = window.gorae;

  let user = null;
  let ready = false;       // first sync for this sign-in finished
  let unsubscribe = null;
  let timer = null;
  let state = "Connecting…";

  const ref = () => F.doc(db, "users", user.uid);

  // Combine two progress maps; `winner` wins when both have a word.
  function merge(loser, winner) {
    const out = {};
    for (const src of [loser || {}, winner || {}]) {
      for (const set in src) out[set] = Object.assign(out[set] || {}, src[set]);
    }
    return out;
  }

  async function upload() {
    if (!user) return;
    const local = app.getProgress();
    state = "Saving…";
    await F.setDoc(ref(), { progress: local.progress, updated: local.updated || Date.now(), email: user.email || null });
    state = "All progress saved to your account";
  }

  function push() {
    if (!user || !ready) return;
    clearTimeout(timer);
    state = "Saving…";
    timer = setTimeout(() => upload().catch(fail), 1200);
  }

  function fail(e) {
    console.error(e);
    state = "Couldn't reach the server; will retry when you study again";
  }

  async function firstSync() {
    const snap = await F.getDoc(ref());
    const local = app.getProgress();
    if (!snap.exists()) {
      app.setSyncUid(user.uid);
      await upload();
    } else {
      const remote = snap.data();
      const rU = remote.updated || 0, lU = local.updated || 0;
      if (local.syncUid !== user.uid) {
        // First sign-in on this device: keep both; the more recent side wins conflicts.
        const merged = rU > lU ? merge(local.progress, remote.progress) : merge(remote.progress, local.progress);
        app.applyRemote(merged, Date.now(), user.uid);
        await upload();
      } else if (rU > lU) {
        app.applyRemote(remote.progress, rU, user.uid);
      } else if (lU > rU) {
        await upload();
      }
    }
    state = "All progress saved to your account";
    ready = true;
    unsubscribe = F.onSnapshot(ref(), (s) => {
      if (s.metadata.hasPendingWrites || !s.exists()) return;
      const d = s.data();
      if ((d.updated || 0) > (app.getProgress().updated || 0)) app.applyRemote(d.progress, d.updated, user.uid);
    }, fail);
  }

  A.onAuthStateChanged(auth, (u) => {
    if (unsubscribe) { unsubscribe(); unsubscribe = null; }
    clearTimeout(timer);
    user = u;
    ready = false;
    app.authChanged();
    if (!u) { state = "Signed out"; return; }
    state = "Syncing…";
    firstSync().then(() => {
      app.authChanged();
    }, (e) => { fail(e); app.toast("Signed in, but syncing failed. Check your connection."); });
  });

  const MESSAGES = {
    "auth/invalid-credential": "Wrong email or password",
    "auth/wrong-password": "Wrong email or password",
    "auth/user-not-found": "No account with that email. Tap “Create account”.",
    "auth/email-already-in-use": "That email already has an account. Tap “Sign in”.",
    "auth/weak-password": "Passwords need at least 6 characters",
    "auth/invalid-email": "That email address doesn't look right",
    "auth/too-many-requests": "Too many tries. Wait a minute and try again.",
    "auth/network-request-failed": "No connection. Check your internet and try again.",
    "auth/unauthorized-domain": "Sign-in isn't allowed on this web address yet (add it in Firebase → Authentication → Settings).",
    "auth/operation-not-allowed": "This sign-in method isn't turned on in Firebase yet.",
  };

  window.goraeSync = {
    user: () => user,
    status: () => state,
    push,
    signInGoogle: () => {
      const provider = new A.GoogleAuthProvider();
      return A.signInWithPopup(auth, provider).catch((e) => {
        if (e.code === "auth/popup-blocked" || e.code === "auth/operation-not-supported-in-this-environment") {
          return A.signInWithRedirect(auth, provider);
        }
        throw e;
      });
    },
    signInEmail: (email, pass) => A.signInWithEmailAndPassword(auth, email, pass),
    signUpEmail: (email, pass) => A.createUserWithEmailAndPassword(auth, email, pass),
    resetPassword: (email) => A.sendPasswordResetEmail(auth, email),
    signOut: async () => {
      if (user && ready) await upload().catch(fail);
      app.setSyncUid(null);
      await A.signOut(auth);
    },
    // Friendly text for a Firebase error ("" when there is nothing to say).
    errorText: (e) => {
      if (!e || e.code === "auth/popup-closed-by-user" || e.code === "auth/cancelled-popup-request") return "";
      if (/^auth\/(api-key-not-valid|invalid-api-key)/.test(e.code || "")) return "Sign-in isn't set up correctly (check js/firebase-config.js)";
      return MESSAGES[e.code] || "Sign-in failed" + (e.code ? " (" + e.code.replace("auth/", "") + ")" : "");
    },
  };
  app.authChanged();
}
