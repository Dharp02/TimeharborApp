'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addIndex('work_logs', ['userId', 'timestamp'], {
      name: 'work_logs_user_timestamp_idx'
    });
    
    // Also beneficial if teamId is often used
    await queryInterface.addIndex('work_logs', ['userId', 'teamId', 'timestamp'], {
      name: 'work_logs_user_team_timestamp_idx'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex('work_logs', 'work_logs_user_timestamp_idx');
    await queryInterface.removeIndex('work_logs', 'work_logs_user_team_timestamp_idx');
  }
};
