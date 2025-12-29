import { User, Team, Member, Ticket, WorkLog, RefreshToken } from '../src/models';
import sequelize from '../src/config/sequelize';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from the root .env file
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const clearData = async () => {
  try {
    await sequelize.authenticate();
    console.log('Connected to database.');

    // Clear data in reverse order of dependencies
    
    console.log('Clearing WorkLogs...');
    await WorkLog.destroy({ where: {}, truncate: true, cascade: true });
    
    console.log('Clearing Tickets...');
    await Ticket.destroy({ where: {}, truncate: true, cascade: true });
    
    console.log('Clearing Members...');
    await Member.destroy({ where: {}, truncate: true, cascade: true });
    
    console.log('Clearing Teams...');
    await Team.destroy({ where: {}, truncate: true, cascade: true });
    
    console.log('Clearing RefreshTokens...');
    await RefreshToken.destroy({ where: {}, truncate: true, cascade: true });

    // console.log('Clearing Users...');
    // await User.destroy({ where: {}, truncate: true, cascade: true });

    console.log('✅ All data cleared successfully.');
  } catch (error) {
    console.error('❌ Error clearing data:', error);
  } finally {
    await sequelize.close();
  }
};

clearData();
