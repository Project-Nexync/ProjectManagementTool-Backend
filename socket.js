import { createServer } from "http";
import { Server } from "socket.io";
import dotenv from "dotenv";
import { getChatHistory, saveMessage } from "./services/chat.service.js";

dotenv.config();

const PORT = process.env.SOCKET_PORT || 7000;

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: "*", // change to frontend URL in production
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  // Join project room
  socket.on("joinProject", async (projectId) => {
    socket.join(projectId);
    try {
      const messages = await getChatHistory(projectId);
      socket.emit("chatHistory", Array.isArray(messages) ? messages : []);
    } catch (err) {
      console.error(err);
      socket.emit("chatHistory", []);
    }
  });

  // Send message
  socket.on("sendMessage", async ({ projectId, senderId, message }) => {
    try {
      const newMessage = await saveMessage(projectId, senderId, message);
      io.to(projectId).emit("receiveMessage", Array.isArray(newMessage) ? newMessage : [] );
    } catch (err) {
      console.error(err);
    }
  });

  socket.on("disconnect", () => {
    console.log("Socket disconnected:", socket.id);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Socket.IO server running on port ${PORT}`);
});
