importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

firebase.initializeApp({
    apiKey: "AIzaSyB7nueKFNhlXRNg5aOH-JknVcmF5Eihawc",
    authDomain: "controle-de-containers-150d0.firebaseapp.com",
    databaseURL: "https://controle-de-containers-150d0-default-rtdb.firebaseio.com",
    projectId: "controle-de-containers-150d0",
    storageBucket: "controle-de-containers-150d0.firebasestorage.app",
    messagingSenderId: "518139053",
    appId: "1:518139053:web:5807a54925ae7d014eea24"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {

    console.log(
        "[firebase-messaging-sw.js] Notificação recebida:",
        payload
    );

    const notification = payload.notification || {};
    const data = payload.data || {};

    const titulo =
        notification.title ||
        data.title ||
        "Controle de Containers";

    const opcoes = {
        body:
            notification.body ||
            data.body ||
            "Você recebeu uma nova notificação.",
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        tag: data.tipo || "controle-containers",
        renotify: true,
        data: {
            url: data.url || "/"
        }
    };

    self.registration.showNotification(
        titulo,
        opcoes
    );
});

self.addEventListener("notificationclick", function(event) {

    event.notification.close();

    const url =
        event.notification?.data?.url ||
        "/";

    event.waitUntil(
        clients.matchAll({
            type: "window",
            includeUncontrolled: true
        }).then(function(clientList) {

            for(const client of clientList) {

                if("focus" in client) {
                    client.focus();

                    if("navigate" in client) {
                        return client.navigate(url);
                    }

                    return client;
                }
            }

            if(clients.openWindow) {
                return clients.openWindow(url);
            }

        })
    );
});
