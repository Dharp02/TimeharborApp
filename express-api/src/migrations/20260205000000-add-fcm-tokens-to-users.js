'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Check and add fcm_token column
      const tableDescription = await queryInterface.describeTable('users');
      
      if (!tableDescription.fcm_token) {
        await queryInterface.addColumn('users', 'fcm_token', {
          type: Sequelize.TEXT,
          allowNull: true
        }, { transaction });
      }

      if (!tableDescription.fcm_platform) {
        await queryInterface.addColumn('users', 'fcm_platform', {
          type: Sequelize.ENUM('ios', 'android'),
          allowNull: true
        }, { transaction });
      }

      if (!tableDescription.fcm_updated_at) {
        await queryInterface.addColumn('users', 'fcm_updated_at', {
          type: Sequelize.DATE,
          allowNull: true
        }, { transaction });
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('users', 'fcm_token');
    await queryInterface.removeColumn('users', 'fcm_platform');
    await queryInterface.removeColumn('users', 'fcm_updated_at');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_users_fcm_platform";');
  }
};
