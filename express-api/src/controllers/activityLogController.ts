import { Request, Response } from 'express';
import { ActivityLog } from '../models/ActivityLog';
import { Op } from 'sequelize';
import { AuthRequest } from '../middleware/authMiddleware';

export const getActivities = async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  try {
    const { teamId } = req.params;
    const userId = authReq.user?.id;
    
    // Filter activities by userId if available, or return all if needed (but user requested filtering)
    // The user wants "only log your own activity", so we should filter by userId.
    
    const whereClause: any = { teamId };
    if (userId) {
      whereClause.userId = userId;
    } else {
       // If for some reason userId is missing (shouldn't happen with auth), maybe return empty or handle gracefully
       // For now, let's allow it to return nothing or all?
       // If no userId, we can't filter by user, so maybe return empty array to be safe?
       // But authenticateToken ensures req.user is set.
    }

    const activities = await ActivityLog.findAll({
      where: whereClause,
      order: [['startTime', 'DESC']],
      limit: 50 // Limit to latest 50 for performance
    });

    // Map to frontend interface
    const formatted = activities.map(a => ({
      id: a.activityId, // Use the frontend-generated ID
      teamId: a.teamId, // Include teamId for frontend filtering
      userId: a.userId, // Include userId so frontend knows who created it
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
  const authReq = req as AuthRequest;
  try {
    const { teamId } = req.params;
    const userId = authReq.user?.id;
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
          userId, // Save userId
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
        const updateData: any = {
          teamId, // ensure teamId is correct
          type: act.type || 'LOG',
          title: act.title,
          subtitle: act.subtitle,
          description: act.description,
          status: act.status,
          startTime: act.startTime,
          endTime: act.endTime,
          duration: act.duration
        };
        // Update userId if linking previously unlinked log
        if (!record.userId && userId) {
            updateData.userId = userId;
        }
        await record.update(updateData);
      }
      results.push(record.activityId);
    }

    res.json({ success: true, syncedIds: results });
  } catch (error) {
    console.error('Error syncing activities:', error);
    res.status(500).json({ error: 'Failed to sync activities' });
  }
};
