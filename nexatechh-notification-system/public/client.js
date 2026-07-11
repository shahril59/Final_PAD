const SERVERS = [
    `ws://${location.hostname}:3000`,
    `ws://${location.hostname}:3001`
];

let socket = null;
let serverIndex = 0;

let username = "";
let role = "";

function joinChat() {

    username = document.getElementById("username").value.trim();
    role = document.getElementById("role").value;

    if (username === "") {
        alert("Please enter your username.");
        return;
    }

    document.getElementById("loginPage").style.display = "none";
    document.getElementById("chatPage").style.display = "block";

    if (role === "Lecturer") {
        document.getElementById("lecturerPanel").style.display = "block";
    } else {
        document.getElementById("lecturerPanel").style.display = "none";
    }

    connect();

}

function connect() {

    socket = new WebSocket(SERVERS[serverIndex]);

    socket.onopen = () => {

        socket.send(JSON.stringify({
            type: "join",
            username,
            role
        }));

    };

    socket.onmessage = (event) => {

        const data = JSON.parse(event.data);

        switch (data.type) {

            case "server":
                document.getElementById("serverName").textContent = data.server;
                break;

            case "users":
                displayUsers(data.users);
                break;

            case "chat":
                displayMessage(data);
                break;
            case "error":
                alert(data.message);
                logout();
                break;
        }

    };

    socket.onclose = () => {

    if (username === "") {
        return;
    }

    document.getElementById("serverName").textContent =
        "Reconnecting...";

    serverIndex = (serverIndex + 1) % SERVERS.length;

    setTimeout(connect, 1000);
};

    socket.onerror = () => {

        socket.close();

    };

}

function sendMessage(category) {

    if (!socket || socket.readyState !== WebSocket.OPEN) {

        alert("Server disconnected.");

        return;

    }

    let message = "";

    if (category === "announcement") {

        message = document
            .getElementById("announcementInput")
            .value
            .trim();

        if (message === "") return;

        document.getElementById("announcementInput").value = "";

    } else {

        message = document
            .getElementById("responseInput")
            .value
            .trim();

        if (message === "") return;

        document.getElementById("responseInput").value = "";

    }

    socket.send(JSON.stringify({

        type: "chat",
        category,
        message

    }));

}
function displayUsers(users) {

    const list = document.getElementById("userList");

    list.innerHTML = "";

    document.getElementById("onlineCount").textContent = users.length;

    users.forEach(user => {

        const li = document.createElement("li");

        const me = user.username === username
            ? " (You)"
            : "";

        li.innerHTML = `
            <span>${user.username}${me}</span>
            <span class="role">${user.role}</span>
        `;

        list.appendChild(li);

    });

}

function displayMessage(data) {

    const box = document.getElementById("messages");

    const div = document.createElement("div");

    div.className = `message ${data.category}`;

    const title =
        data.category === "announcement"
            ? "📢 Announcement"
            : "💬 Response";

    div.innerHTML = `
        <div class="message-title">${title}</div>

        <div>
            <strong>${data.sender}</strong>
            (${data.role})
        </div>

        <p>${data.message}</p>

        <small>
            ${data.time} | ${data.server}
        </small>
    `;

    box.appendChild(div);

    box.scrollTop = box.scrollHeight;

}

function logout() {

    if (socket) {

        socket.onclose = null;

        socket.close();

    }

    document.getElementById("messages").innerHTML = "";
    document.getElementById("userList").innerHTML = "";

    document.getElementById("loginPage").style.display = "flex";
    document.getElementById("chatPage").style.display = "none";

    document.getElementById("username").value = "";
    document.getElementById("responseInput").value = "";
    document.getElementById("announcementInput").value = "";

    username = "";
    role = "";
    serverIndex = 0;

}

function updateDateTime() {

    const now = new Date();

    const options = {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
    };

    const time = now.toLocaleString("en-MY", options);

    const element = document.getElementById("currentTime");

    if (element) {
        element.textContent = time;
    }

}

setInterval(updateDateTime, 1000);

updateDateTime();