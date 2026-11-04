import apiClient from './core/apiClient';
import authService from './authService';
import { buildLeadSchedulerPayload } from '@/lib/leadScheduler';

const leadSchedulerService = {
  createSchedule(form) {
    return apiClient.post('/LeadScheduler', buildLeadSchedulerPayload(form, { user: authService.getUser() }));
  },
  updateSchedule(form, existing) {
    return apiClient.put('/LeadScheduler', buildLeadSchedulerPayload(form, { existing, user: authService.getUser() }));
  },
  deleteSchedule(scheduleId) {
    const id = Number(scheduleId);
    if (!Number.isInteger(id) || id <= 0) throw new Error('A valid schedule ID is required.');
    return apiClient.delete(`/LeadScheduler/${id}`);
  }
};

export default leadSchedulerService;
