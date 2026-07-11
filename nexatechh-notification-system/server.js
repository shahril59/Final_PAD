const express = require("express");
const http = require("http");
const path = require("path");
const WebSocket = require("ws");
const Redis = require("ioredis");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;
const SERVER_ID = process.env.SERVER_ID || "server1";
const REDIS_HOST = process.env.REDIS_HOST || "localhost";
const REDIS_PORT = process.env.REDIS_PORT || 6379;

app.use(express.static(path.join(__dirname, "public")));

const publisher = new Redis({
    host: REDIS_HOST,
    port: REDIS_PORT
});

const subscriber = new Redis({
    host: REDIS_HOST,
    port: REDIS_PORT
});

const CHANNEL = "notification-channel";

const clients = new Map();
const onlineUsers = new Map();
const messageHistory = [];

const MAX_HISTORY = 20;

subscriber.subscribe(CHANNEL);

subscriber.on("message", (channel, message) => {

    if (channel !== CHANNEL) return;

    const data = JSON.parse(message);

    switch (data.type) {

        case "join":

            onlineUsers.set(
                `${data.server}-${data.username}`,
                {
                    username: data.username,
                    role: data.role,
                    server: data.server
                }
            );

            sendUserList();

            break;

        case "leave":

            onlineUsers.delete(
                `${data.server}-${data.username}`
            );

            sendUserList();

            break;

        case "chat":

            const chat = {
                type: "chat",
                sender: data.sender,
                role: data.role,
                category: data.category,
                message: data.message,
                server: data.server,
                time: data.time
            };

            messageHistory.push(chat);

            if (messageHistory.length > MAX_HISTORY) {
                messageHistory.shift();
            }

            broadcast(chat);

            break;

    }

});

wss.on("connection", (ws) => {

    ws.send(JSON.stringify({
        type: "server",
        server: SERVER_ID
    }));

    ws.on("message", (raw) => {

        let data;

        try {

            data = JSON.parse(raw);

        } catch (err) {

            return;

        }

        if (data.type === "join") {

            if (clients.has(ws)) {
                return;
            }

            const usernameExists = Array.from(onlineUsers.values()).find(user =>
                user.username.toLowerCase() === data.username.toLowerCase()
            );

            if (usernameExists) {

                ws.send(JSON.stringify({
                    type: "error",
                    message: "Username already exists."
                }));

                return;

            }

            clients.set(ws, {
                username: data.username,
                role: data.role
            });

            messageHistory.forEach(message => {
                ws.send(JSON.stringify(message));
            });

            publisher.publish(CHANNEL, JSON.stringify({

                type: "join",
                username: data.username,
                role: data.role,
                server: SERVER_ID

            }));

            return;

        }

        if (data.type === "chat") {

            const user = clients.get(ws);

            if (!user) return;

            publisher.publish(CHANNEL, JSON.stringify({

                type: "chat",
                sender: user.username,
                role: user.role,
                category: data.category,
                message: data.message,
                server: SERVER_ID,
                time: new Date().toLocaleString()

            }));

        }

    });

    ws.on("close", () => {

        const user = clients.get(ws);

        if (!user) return;

        clients.delete(ws);

        onlineUsers.delete(`${SERVER_ID}-${user.username}`);

        publisher.publish(CHANNEL, JSON.stringify({

            type: "leave",
            username: user.username,
            server: SERVER_ID

        }));

    });

});

function broadcast(data) {

    const message = JSON.stringify(data);

    wss.clients.forEach((client) => {

        if (client.readyState === WebSocket.OPEN) {

            client.send(message);

        }

    });

}

function sendUserList() {

    const users = Array.from(onlineUsers.values());

    broadcast({
        type: "users",
        users: users
    });

}

publisher.on("connect", () => {
    console.log("Redis Publisher Connected");
});

subscriber.on("connect", () => {
    console.log("Redis Subscriber Connected");
});

publisher.on("error", (err) => {
    console.log("Publisher Error:", err.message);
});

subscriber.on("error", (err) => {
    console.log("Subscriber Error:", err.message);
});

server.listen(PORT, () => {

    console.log("=================================");
    console.log(" NexaTech Notification System");
    console.log("=================================");
    console.log(` Server : ${SERVER_ID}`);
    console.log(` Port   : ${PORT}`);
    console.log("=================================");

});