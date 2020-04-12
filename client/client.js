document.getElementById("status").innerHTML = "Connecting...";
const canvas = document.getElementById("sketchpad");
canvas.height = canvas.clientHeight;
canvas.width = canvas.clientWidth;

const pad = SimpleDrawingBoard.create(canvas);
pad.setLineSize(5);
const bugout = new Bugout(new URLSearchParams(location.search).get("address"), {
    seed: localStorage.getItem("decent-pictionary-seed"),
    iceServers: new URLSearchParams(location.search).get("stun") === "true" ? [{urls: "stun:stun.l.google.com:19302"}] : []
});

const picker = Pickr.create({
    el: document.getElementById("picker"),
    theme: "nano", useAsButton: true, comparison: false,
    components: {hue: true, preview: true, opacity: true}
});

localStorage.setItem("decent-pictionary-seed", bugout.seed);

bugout.on("server", () => {
    document.getElementById("status").innerHTML = "Connected...";
    bugout.rpc("list-messages", {}, (messages) => {
        document.getElementById("messages").value = messages.map(m => `${m["address"]}: ${m["message"]}`).join("\n");
    });
    bugout.rpc("list-users", {}, (users) => {
        document.getElementById("users").value = users.map(u => u["address"]).join("\n");
    });
    bugout.rpc("get-drawing", {}, (drawing) => {
        pad.fillImageByDataURL(drawing).then();
    });
});

bugout.on("message", (_, message) => {
    if (message["code"] === "refresh-messages") {
        document.getElementById("messages").value = message["messages"].map(m => `${m["address"]}: ${m["message"]}`).join("\n");
    } else if (message["code"] === "refresh-users") {
        document.getElementById("users").value = message["users"].map(u => u["address"]).join("\n");
    } else if (message["code"] === "refresh-drawing") {
        pad.fillImageByDataURL(message["drawing"]).then();
    }
});

bugout.on("left", address => {
    if (address === new URLSearchParams(location.search).get("address")) {
        document.getElementById("status").innerHTML = "Connecting...";
    }
});

document.getElementById("message").addEventListener("keyup", (event) => {
    event.preventDefault();
    if (event.key === "Enter") {
        const message = document.getElementById("message").value.trim();
        document.getElementById("message").value = "";
        if (message) {
            bugout.rpc("post-message", message, () => {
            });
        }
    }
});

window.addEventListener("beforeunload", (_) => {
    bugout.close();
});

pad.observer.on("drawEnd", (_) => {
    bugout.rpc("post-drawing", pad.toDataURL(), () => {
    });
});

document.getElementById("clear").addEventListener("click", () => {
    pad.clear();
    bugout.rpc("post-drawing", pad.toDataURL(), () => {
    });
});

document.getElementById("undo").addEventListener("click", () => {
    pad.undo().then(() => {
        bugout.rpc("post-drawing", pad.toDataURL(), () => {
        });
    });
});

document.getElementById("redo").addEventListener("click", () => {
    pad.redo().then(() => {
        bugout.rpc("post-drawing", pad.toDataURL(), () => {
        });
    });
});

for (let i = 1; i <= 3; ++i) {
    document.getElementById(`brush${i.toString()}`).addEventListener("click", () => {
        pad.setLineSize(5 * i);
    });
}

picker.on("change", (color, _) => {
    pad.setLineColor(color.toRGBA().toString());
});