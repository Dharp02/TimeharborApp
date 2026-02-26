'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('user_daily_stats', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      teamId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'teams', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      totalMs: {
        type: Sequelize.BIGINT,
        allowNull: false,
        defaultValue: 0,
      },
      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE },
    });

    // Lookup index (not unique — teamId can be NULL; app enforces uniqueness via findOrCreate)
    await queryInterface.addIndex('user_daily_stats', ['userId', 'teamId', 'date'], {
      name: 'user_daily_stats_lookup_idx',
    });

    await queryInterface.addIndex('user_daily_stats', ['userId', 'date'], {
      name: 'user_daily_stats_user_date_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('user_daily_stats');
  },
};
