const express = require('express');
const http = require('http');               // Add http module
const cors = require('cors');
const { Server } = require('socket.io');   // Import Server from socket.io

require('dotenv').config();
require('./db');    

const app = express();
app.use(cors());
app.use(express.json());

const datasetRoutes = require('./routes/datasets');
const relationshipRoutes = require("./routes/relationships");
const authRoutes = require('./routes/authRoutes');
app.use('/api/datasets', datasetRoutes);
app.use("/api/relationships", relationshipRoutes);
app.use('/api/auth', authRoutes);

const PORT = process.env.PORT || 5000;

// Create HTTP server and bind to Express app
const server = http.createServer(app);

// Create socket.io server attached to HTTP server
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all origins, adjust for production
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});

// Make io accessible in routes
app.set("io", io);

io.on("connection", (socket) => {
  console.log("New client connected: ", socket.id);

  socket.on("disconnect", () => {
    console.log("Client disconnected: ", socket.id);
  });
});

// Start server with http server (not app.listen)
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
