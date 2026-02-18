import { Server, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import User from '../models/User';
import logger from '../utils/logger';

let io: Server;

export const initializeSocket = (httpServer: HttpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: "*", // Allow all origins for development/Capacitor
      methods: ["GET", "POST"],
      credentials: true
    }
  });

  io.on('connection', async (socket: Socket) => {
    handleConnection(socket);
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized!');
  }
  return io;
};

const handleConnection = async (socket: Socket) => {
  const userId = socket.handshake.query.userId as string;
  
  if (userId) {
    logger.info(`User connected: ${userId} (${socket.id})`);
    
    // Update user status to online
    try {
      await User.update({ status: 'online' }, { where: { id: userId } });
      
      // Broadcast user online status
      socket.broadcast.emit('user_status_change', {
        userId,
        status: 'online'
      });
    } catch (error) {
      logger.error(`Error updating user status for ${userId}:`, error);
    }

    socket.on('disconnect', async () => {
      logger.info(`User disconnected: ${userId} (${socket.id})`);
      
      // Update user status to offline
      try {
        await User.update({ status: 'offline' }, { where: { id: userId } });
        
        // Broadcast user offline status
        socket.broadcast.emit('user_status_change', {
          userId,
          status: 'offline'
        });
      } catch (error) {
        logger.error(`Error updating user status for ${userId}:`, error);
      }
    });
  } else {
    logger.info(`New client connected (no userId): ${socket.id}`);
    
    socket.on('disconnect', () => {
      logger.info(`Client disconnected: ${socket.id}`);
    });
  }

  // Send immediate feedback
  socket.emit('status', { status: 'online', message: 'Connected to Timeharbor API' });

  socket.on('ping', () => {
    socket.emit('pong', { timestamp: new Date().toISOString() });
  });
};
