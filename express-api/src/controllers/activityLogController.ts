import { Request, Response } from 'express';
import { ActivityLog } from '../models/ActivityLog';
import { Op } from 'sequelize';

export const getActivities = async (req: Request, res: Response) => {
  try {
    const { teamId } = req.params;
    const activities = await ActivityLog.findAll({
      where: { teamId },
      order: [['startTime', 'DESC']],
      limit: 50 // Limit to latest 50 for performance
    });

    // Map to frontend interface
    const formatted = activities.map(a => ({
      id: a.activityId, // Use the frontend-generated ID
      teamId: a.teamId, // Include teamId for frontend filtering
      type: a.type,
      title: a.title,
      subtitle: a.subtitle,
      description: a.description,
      status: a.status,
      startTime: a.startTime.toISOString(),
      endTime: a.endTime?.toISOString(),
      duration: a.duration
    }));

    res.json(formatted);
  } catch (error) {
    console.error('Error fetching activities:', error);
    res.status(500).json({ error: 'Failed to fetch activities' });
  }
};

export const syncActivities = async (req: Request, res: Response) => {
  try {
    const { teamId } = req.params;
    // Expecting an array of activities from frontend
    // Use 'any' to bypass strict checks for now, but should validate
    const activities: any[] = req.body;

    if (!Array.isArray(activities)) {
      return res.status(400).json({ error: 'Expected array of activities' });
    }

    const results = [];
    
    // Process upsert logic
    for (const act of activities) {
      if (!act.id) continue;

      const [record, created] = await ActivityLog.findOrCreate({
        where: { activityId: act.id },
        defaults: {
          teamId,
          activityId: act.id,
          type: act.type || 'LOG',
          title: act.title,
          subtitle: act.subtitle,
          description: act.description,
          status: act.status,
          startTime: act.startTime,
          endTime: act.endTime,
          duration: act.duration
        }
      });

      if (!created) {
        // Update if exists (e.g. status changed from Active -> Completed)
        await record.update({
          teamId, // ensure teamId is correct
          type: act.type || 'LOG',
          title: act.title,
          subtitle: act.subtitle,
          description: act.description,
          status: act.status,
          startTime: act.startTime,
          endTime: act.endTime,
          duration: act.duration
        });
      }
      results.push(record.activityId);
    }

    res.json({ success: true, syncedIds: results });
  } catch (error) {
    console.error('Error syncing activities:', error);
    res.status(500).json({ error: 'Failed to sync activities' });
  }
};
