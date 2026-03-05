import { Server, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import User from '../models/User';
import logger from '../utils/logger';
import { computeCurrentSessionState } from '../services/sessionStateService';

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
    // Join a personal room so we can emit directly to this user
    socket.join(userId);
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

    // Restore session state on this device immediately after connecting.
    // This handles Device B joining while Device A is already clocked in.
    try {
      const sessionState = await computeCurrentSessionState(userId);
      socket.emit('session_state_restore', sessionState);
      logger.info(`Session state emitted to ${userId} (${socket.id}): active=${sessionState.isSessionActive}`);
    } catch (error) {
      logger.error(`Error emitting session state for ${userId}:`, error);
    }

    socket.on('disconnect', async () => {
      logger.info(`User disconnected: ${userId} (${socket.id})`);
      
      // Only mark offline if no other sockets for this user are still connected.
      const room = io.sockets.adapter.rooms.get(userId);
      const remainingSockets = room ? room.size : 0;
      if (remainingSockets === 0) {
        try {
          await User.update({ status: 'offline' }, { where: { id: userId } });
          socket.broadcast.emit('user_status_change', { userId, status: 'offline' });
        } catch (error) {
          logger.error(`Error updating user status for ${userId}:`, error);
        }
      } else {
        logger.info(`User ${userId} still has ${remainingSockets} socket(s) connected — keeping online status.`);
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
