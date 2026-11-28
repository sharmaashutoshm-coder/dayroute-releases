/*
 * DayRoute's push messages on the website (22 Nov 2026): "Priya shared “Buy school books” with you", even with
 * the site closed. The server function (functions/index.js) sends data-only messages; this worker shows them.
 * Clicking one opens (or focuses) DayRoute at that work (?open=<id>). Same Firebase web app as src/cloud.ts.
 */
importScripts("https://www.gstatic.com/firebasejs/11.10.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/11.10.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyDVJ0cQ9lD31QAagFpFWHWVxktmZFwHjWQ",
  authDomain: "dayroute-fbbe1.firebaseapp.com",
  projectId: "dayroute-fbbe1",
  storageBucket: "dayroute-fbbe1.firebasestorage.app",
  messagingSenderId: "151834864263",
  appId: "1:151834864263:web:53aff923bee9668199e622",
});

firebase.messaging().onBackgroundMessage((payload) => {
  const d = payload.data || {};
  // an expense shared with this person (26 Nov 2026): "Ashutosh shared an expense with you", at once, even with the
  // site closed. Tapping it opens Track money, where the review popup is waiting.
  if (d.kind === "moneyShare" && d.shareId) {
    return self.registration.showNotification(d.title || "Expense shared with you", {
      body: d.body || "", tag: `dr-money-share-${d.shareId}`, icon: "icon-192.png", badge: "icon-192.png",
      data: { moneyShare: d.shareId },
    });
  }
  // a reminder that fell due (26 Nov 2026): the server's every-minute function pushes it, so it also rings with the
  // site closed. With a DayRoute window open the page rings its own popup and notification the second it's due, so
  // there this does nothing — one ring per reminder, never two.
  if (d.kind === "reminder" && d.workId) {
    return clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      if (wins.some((c) => c.url.startsWith(self.registration.scope))) return undefined;
      return self.registration.showNotification(d.title || "1 work to acknowledge", {
        body: "Tap to answer it in DayRoute", tag: `dr-reminder-${d.workId}`, icon: "icon-192.png",
        badge: "icon-192.png", data: { reminder: d.workId },
      });
    });
  }
  if (d.kind !== "share" || !d.workId) return;
  // the same tag as the page's own notification for this work, so it never shows twice
  return self.registration.showNotification(d.title || "Shared with you", {
    body: d.body || "", tag: `dr-share-${d.workId}`, icon: "icon-192.png", badge: "icon-192.png", data: { workId: d.workId },
    // the two answers (23 Nov 2026), as in the app: Edit opens the work, Acknowledge puts it away
    actions: [{ action: "edit", title: "Edit" }, { action: "ack", title: "Acknowledge" }],
  });
});

/** A message to every open DayRoute window, without opening one */
async function tell(msg) {
  const wins = await clients.matchAll({ type: "window", includeUncontrolled: true });
  wins.forEach((c) => c.postMessage(msg));
}

self.addEventListener("notificationclick", (e) => {
  const data = e.notification.data || {};
  // an expense shared with you opens Track money, where it waits to be reviewed
  if (data.moneyShare) {
    e.notification.close();
    e.waitUntil((async () => {
      const wins = await clients.matchAll({ type: "window", includeUncontrolled: true });
      const here = wins.find((c) => c.url.startsWith(self.registration.scope));
      // the review popup is on every screen, so an open DayRoute only needs bringing forward
      if (here) return here.focus();
      return clients.openWindow(new URL("./#money", self.registration.scope).href);
    })());
    return;
  }
  // a reminder that came while the site was closed opens that work, where it waits in the popup; a site that's
  // already open is told to open it too (27 Nov 2026: it only came forward, showing whatever page it was on)
  if (data.reminder) {
    e.notification.close();
    const url = new URL(`./?open=${encodeURIComponent(data.reminder)}`, self.registration.scope).href;
    e.waitUntil((async () => {
      const wins = await clients.matchAll({ type: "window", includeUncontrolled: true });
      const here = wins.find((c) => c.url.startsWith(self.registration.scope));
      if (here) { here.postMessage({ open: data.reminder }); return here.focus(); }
      return clients.openWindow(url);
    })());
    return;
  }
  const id = data.workId;
  e.notification.close();
  if (!id) return;
  // Acknowledge: the notification goes and the work leaves the "Shared with you" popup; DayRoute stays as it is
  if (e.action === "ack") { e.waitUntil(tell({ ack: id })); return; }
  // Edit opens the work for changing; a plain tap just opens it
  const edit = e.action === "edit";
  const url = new URL(`./?${edit ? "edit" : "open"}=${encodeURIComponent(id)}`, self.registration.scope).href;
  e.waitUntil((async () => {
    const wins = await clients.matchAll({ type: "window", includeUncontrolled: true });
    const here = wins.find((c) => c.url.startsWith(self.registration.scope));
    if (here) { here.postMessage(edit ? { open: id, edit: true } : { open: id }); return here.focus(); }
    return clients.openWindow(url);
  })());
});
