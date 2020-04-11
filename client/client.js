document.getElementById("status").innerHTML = "Connecting...";
const canvas = document.getElementById("sketchpad");
canvas.height = canvas.clientHeight;
canvas.width = canvas.clientWidth;

const pad = new SimpleDrawingBoard(canvas);
const bugout = new Bugout(location.hash.substr(1), {seed: localStorage["decent-pictionary-seed"]});

const picker = Pickr.create({
    el: document.getElementById("picker"),
    theme: "nano", useAsButton: true, comparison: false,
    components: {hue: true, preview: true, opacity: true}
});

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
        pad.setImg(drawing, false, true);
    });
});

bugout.on("message", (_, message) => {
    if (message["code"] === "refresh-messages") {
        document.getElementById("messages").value = message["messages"].map(m => m["address"] + ": " + m["message"]).join("\n");
    } else if (message["code"] === "refresh-users") {
        document.getElementById("users").value = message["users"].map(u => u["address"]).join("\n");
    } else if (message["code"] === "refresh-drawing") {
        pad.setImg(message["drawing"], false, true);
    }
});

bugout.on("left", address => {
    if (address === location.hash.substr(1)) {
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

pad.isDrawing = 0;
Object.defineProperties(pad, {
    "_isDrawing": {
        get: () => pad.isDrawing,
        set: (x) => {
            pad.isDrawing = x;
            if (x === 0) {
                bugout.rpc("post-drawing", pad.getImg(), () => {
                });
            }
        }
    },
});

document.getElementById("clear").addEventListener("click", () => {
    pad.clear();
    bugout.rpc("post-drawing", pad.getImg(), () => {
    });
});

document.getElementById("undo").addEventListener("click", () => {
    const img = pad._history.prev.get(pad._history.prev._items.length - 1);
    if (img) {
        bugout.rpc("post-drawing", img, () => {
        });
    }
    pad.undo();
});

document.getElementById("redo").addEventListener("click", () => {
    const img = pad._history.next.get(pad._history.next._items.length - 1);
    if (img) {
        bugout.rpc("post-drawing", img, () => {
        });
    }
    pad.redo();
});

for (let i = 1; i <= 3; ++i) {
    document.getElementById("brush" + i.toString()).addEventListener("click", () => {
        pad.setLineSize(5 * i);
    });
}

picker.on("change", (color, _) => {
    pad.setLineColor(color.toRGBA().toString());
});