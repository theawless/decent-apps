document.getElementById("status").innerHTML = "Creating server...";
const canvas = document.getElementById("sketchpad");
canvas.height = canvas.clientHeight;
canvas.width = canvas.clientWidth;

document.getElementById("stun").checked = localStorage.getItem("decent-pictionary-server-stun") === "true";
document.getElementById("stun").addEventListener("click", event => {
    event.preventDefault();
    localStorage.setItem("decent-pictionary-server-stun", document.getElementById("stun").checked);
    window.location.reload();
});

const pad = new SimpleDrawingBoard(canvas);
const bugout = new Bugout({
    seed: localStorage.getItem("decent-pictionary-server-seed"),
    iceServers: document.getElementById("stun").checked ? [{urls: "stun:stun.l.google.com:19302"}] : []
});
const users = [];
const messages = [];

localStorage.setItem("decent-pictionary-server-seed", bugout.seed);
pad.dispose();

bugout.register("post-message", (address, message, callback) => {
    messages.push({"address": address, "message": message});
    if (messages.length > 10) {
        messages.shift();
    }
    bugout.send({"code": "refresh-messages", "messages": messages});
    callback({});
    document.getElementById("messages").value = messages.map(m => m["address"] + ": " + m["message"]).join("\n");
}, "Post a message to the party");

bugout.register("post-drawing", (_, drawing, callback) => {
    bugout.send({"code": "refresh-drawing", "drawing": drawing});
    callback({});
    pad.setImg(drawing, false, true);
}, "Post a drawing to the party");

bugout.register("list-messages", (_, __, callback) => {
    callback(messages);
}, "List all messages in the party");

bugout.register("list-users", (_, __, callback) => {
    callback(users);
}, "List all users in the party");

bugout.register("get-drawing", (_, __, callback) => {
    callback(pad.getImg());
}, "Get drawing in the party");

bugout.once("connections", (_) => {
    document.getElementById("status").innerHTML = "Listening...";
    const url = location.href.replace("server", "client");
    const query = "?address=" + bugout.address() + "&stun=" + document.getElementById("stun").checked;
    document.getElementById("partyLink").href = url + query;
    document.getElementById("partyLink").innerText = "Share this link with your friends!";
});

bugout.on("seen", (address) => {
    users.push({"address": address});
    bugout.send({"code": "refresh-users", "users": users});
    document.getElementById("users").value = users.map(u => u["address"]).join("\n");
});

window.addEventListener("beforeunload", (_) => {
    bugout.close();
});

bugout.on("left", address => {
    for (let i = 0; i < users.length; ++i) {
        if (users[i]["address"] === address) {
            users.splice(i, 1);
        }
    }
    bugout.send({"code": "refresh-users", "users": users});
    document.getElementById("users").value = users.map(u => u["address"]).join("\n");
});