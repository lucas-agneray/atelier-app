const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const session = require("express-session");
const fs = require("fs");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

/* ✅ FIX RENDER (IMPORTANT) */
const PORT = process.env.PORT || 3000;

let tasks = [];

/* USERS */
const users = JSON.parse(
  fs.readFileSync(path.join(__dirname, "users.json"), "utf8")
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: "atelier-secret",
  resave: false,
  saveUninitialized: false
}));

/* LOGIN PAGE */
app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

/* LOGIN */
app.post("/login", (req, res) => {
  const { username, password } = req.body;

  const user = users.find(u =>
    u.username === username && u.password === password
  );

  if (!user) return res.redirect("/login");

  req.session.user = {
    username: user.username,
    role: user.role
  };

  res.redirect("/");
});

/* LOGOUT */
app.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
});

/* USER INFO */
app.get("/me", (req, res) => {
  if (!req.session.user) return res.status(401).end();
  res.json(req.session.user);
});

/* PROTECTION HOME */
app.get("/", (req, res) => {
  if (!req.session.user) return res.redirect("/login");
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

/* STATIC FILES */
app.use(express.static(path.join(__dirname, "public")));

/* SOCKET.IO */
io.on("connection", (socket) => {

  socket.emit("update", tasks);

  /* ADD TASK */
  socket.on("addTask", ({ task, user }) => {
    if (!user) return;

    tasks.push({
      title: task.title,
      priority: task.priority,
      status: "active",
      createdBy: user.username
    });

    io.emit("update", tasks);
  });

  /* UPDATE STATUS */
  socket.on("updateStatus", ({ index, status }) => {
    if (!tasks[index]) return;

    tasks[index].status = status;

    if (status === "terminé") {

      io.emit("update", tasks);

      /* 10 sec delay avant suppression */
      setTimeout(() => {
        if (tasks[index] && tasks[index].status === "terminé") {
          tasks.splice(index, 1);
          io.emit("update", tasks);
        }
      }, 10000);

    } else {
      io.emit("update", tasks);
    }
  });

  /* DELETE TASK (ADMIN ONLY) */
  socket.on("deleteTask", ({ index, user }) => {
    if (!user || user.role !== "admin") return;

    if (tasks[index]) {
      tasks.splice(index, 1);
      io.emit("update", tasks);
    }
  });

});

/* LISTEN */
server.listen(PORT, "0.0.0.0", () => {
  console.log("Serveur OK -> port " + PORT);
});