// Public browser configuration only. Never put credentials or allowlists here.
export default {
  appId: 'content-handler',
  title: 'Content Handler',
  subtitle: 'Write, manage, review, and publish.',
  firebase: {
    apiKey: 'AIzaSyB6qd1JVsltIV0tSi3BYN-qVHhRtajisTE',
    authDomain: 'kemptville-creative-writ-cf643.firebaseapp.com',
    projectId: 'kemptville-creative-writ-cf643',
    storageBucket: 'kemptville-creative-writ-cf643.firebasestorage.app',
    messagingSenderId: '892988687204',
    appId: '1:892988687204:web:d2524166fbb5d4d22bf071'
  },
  apiUrl: 'https://script.google.com/macros/s/AKfycbxDrDo2mhMCy6_uNx1ri90s-e1-NMm8XLCjQiIbyoAhcDg9O7HXKnRNmhVhJ3Le76j8/exec',
  serviceApiUrls: {
    calendar: 'https://script.google.com/macros/s/AKfycbyvxfJniOdH81RLvZT2_0_yicxGIcrlTUuTvzXw96u0qnVUQ5ZllW84JvsnsY4DD0jh/exec'
  },
  // Calendar records store relative paths such as images/event_123.png.
  // Set this to '/' when the current web server exposes those files at /images/.
  calendarAssetBaseUrl: 'https://raw.githubusercontent.com/impishlycreative/calendar_manager/main/kcw-calendar-site/',
  sessionMs: 60 * 60 * 1000,
  requestTimeoutMs: 20000
};
