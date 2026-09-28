// Email/password only. Initialize Auth without the popup/redirect resolver so
// the application does not load Google Sign-In/gapi dependencies it does not use.
export async function createFirebaseAdapter(config) {
  const [{ initializeApp }, sdk] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js')
  ]);

  const app = initializeApp(config.firebase, config.appId);
  const auth = sdk.initializeAuth(app, {
    persistence: sdk.browserSessionPersistence,
    popupRedirectResolver: undefined
  });

  await auth.authStateReady();

  return {
    get currentUser() { return auth.currentUser; },
    signIn: async (email, password) =>
      (await sdk.signInWithEmailAndPassword(auth, email, password)).user,
    signOut: () => sdk.signOut(auth),
    subscribe: callback => sdk.onAuthStateChanged(auth, callback)
  };
}
