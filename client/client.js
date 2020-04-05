document.getElementById("status").innerHTML = "Connecting...";

const bugout = new Bugout(location.hash.substr(1), {seed: localStorage["decent-pictionary-seed"]});
const pad = new Sketchpad(document.getElementById("sketchpad"));

localStorage["decent-pictionary-seed"] = bugout.seed;

bugout.on("server", () => {
    document.getElementById("status").innerHTML = "Connected...";
    bugout.rpc("list-messages", {}, (messages) => {
        document.getElementById("messages").value = messages.map(m => m["address"] + ": " + m["message"]).join("\n");
    });
    bugout.rpc("list-users", {}, (users) => {
        document.getElementById("users").value = users.map(u => u["address"]).join("\n");
    });
    bugout.rpc("get-drawing", {}, (drawing) => {
        pad.loadJSON(drawing);
    });
});

bugout.on("message", (_, message) => {
    if (message["code"] === "refresh-messages") {
        document.getElementById("messages").value = message["messages"].map(m => m["address"] + ": " + m["message"]).join("\n");
    } else if (message["code"] === "refresh-users") {
        document.getElementById("users").value = message["users"].map(u => u["address"]).join("\n");
    } else if (message["code"] === "refresh-drawing") {
        pad.loadJSON(message["drawing"]);
    }
});

document.getElementById("message").addEventListener("keyup", (event) => {
    if (event.key === "Enter") {
        const message = document.getElementById("message").value.trim();
        if (message) {
            bugout.rpc("post-message", message, () => {
            });
        }
        document.getElementById("message").value = "";
    }
});

window.addEventListener("beforeunload", (_) => {
    bugout.close();
});

pad.onDrawEnd = () => {
    bugout.rpc("post-drawing", pad.toJSON(), () => {
    });
};