'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Check if table exists
    const [results] = await queryInterface.sequelize.query(
      "SELECT to_regclass('public.activity_logs');"
    );
    const tableExists = !!results[0].to_regclass;

    if (!tableExists) {
      await queryInterface.createTable('activity_logs', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
        },
        activityId: {
          type: Sequelize.STRING,
          allowNull: false,
          unique: true
        },
        teamId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'teams',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        },
        userId: {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: 'users',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL'
        },
        type: {
          type: Sequelize.STRING,
          allowNull: false
        },
        title: {
          type: Sequelize.STRING,
          allowNull: false
        },
        subtitle: {
          type: Sequelize.STRING,
          allowNull: true
        },
        description: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        status: {
          type: Sequelize.STRING,
          allowNull: true,
          defaultValue: 'Completed'
        },
        startTime: {
          type: Sequelize.DATE,
          allowNull: false
        },
        endTime: {
          type: Sequelize.DATE,
          allowNull: true
        },
        duration: {
          type: Sequelize.STRING,
          allowNull: true
        },
        createdAt: {
          allowNull: false,
          type: Sequelize.DATE
        },
        updatedAt: {
          allowNull: false,
          type: Sequelize.DATE
        }
      });
    }

    // Add indexes for performance safely
    const addIndexSafe = async (tableName, fields, options = {}) => {
      try {
        await queryInterface.addIndex(tableName, fields, options);
      } catch (e) {
        // Ignore if index already exists
      }
    };

    await addIndexSafe('activity_logs', ['teamId']);
    await addIndexSafe('activity_logs', ['userId']);
    await addIndexSafe('activity_logs', ['startTime']);
    await addIndexSafe('activity_logs', ['activityId']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('activity_logs');
  }
};
