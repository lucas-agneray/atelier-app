const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const session = require("express-session");
const fs = require("fs");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

/* FILE STORAGE */
const TASK_FILE = path.join(__dirname, "tasks.json");

let tasks = [];
if (fs.existsSync(TASK_FILE)) {
  try {
    tasks = JSON.parse(fs.readFileSync(TASK_FILE, "utf8"));
  } catch {
    tasks = [];
  }
}

function saveTasks() {
  fs.writeFileSync(TASK_FILE, JSON.stringify(tasks, null, 2));
}

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

/* LOGIN */
app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

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

/* USER */
app.get("/me", (req, res) => {
  if (!req.session.user) return res.status(401).end();
  res.json(req.session.user);
});

/* HOME */
app.get("/", (req, res) => {
  if (!req.session.user) return res.redirect("/login");
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.use(express.static(path.join(__dirname, "public")));

/* SOCKET */
io.on("connection", (socket) => {

  socket.emit("update", tasks);

  /* ADD */
  socket.on("addTask", ({ task, user }) => {
    if (!user) return;

    tasks.push({
      title: task.title,
      priority: task.priority,
      status: "active",
      createdBy: user.username
    });

    saveTasks();
    io.emit("update", tasks);
  });

  /* UPDATE */
  socket.on("updateStatus", ({ index, status }) => {
    if (!tasks[index]) return;

    tasks[index].status = status;
    saveTasks();

    if (status === "terminé") {
      io.emit("update", tasks);

      setTimeout(() => {
        if (tasks[index] && tasks[index].status === "terminé") {
          tasks.splice(index, 1);
          saveTasks();
          io.emit("update", tasks);
        }
      }, 10000);
    } else {
      io.emit("update", tasks);
    }
  });

  /* DELETE */
  socket.on("deleteTask", ({ index, user }) => {
    if (!user || user.role !== "admin") return;

    if (tasks[index]) {
      tasks.splice(index, 1);
      saveTasks();
      io.emit("update", tasks);
    }
  });

});

server.listen(PORT, "0.0.0.0", () => {
  console.log("Server running on port " + PORT);
});