import authService from './authService';

const API_BASE_URL = (import.meta.env.VITE_APP_API_URL || 'https://demoapi.enstasol.com/api').replace(/\/$/, '');

const buildQuery = (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === '' || value === null || value === undefined) return;
    query.set(key, String(value));
  });
  return query.toString();
};

const readResponse = async (response, fallbackMessage) => {
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`${fallbackMessage} (${response.status}).`);
  }

  if (!response.ok || payload?.success === false) {
    const validationMessage = payload?.errors ? Object.values(payload.errors).flat().join(', ') : '';
    throw new Error(payload?.message || validationMessage || `${fallbackMessage} (${response.status}).`);
  }

  return payload;
};

const request = async (path, { method = 'GET', params, body, signal } = {}) => {
  const token = authService.getToken();
  if (!token) throw new Error('Your session has expired. Please sign in again.');

  const query = buildQuery(params);
  const response = await fetch(`${API_BASE_URL}${path}${query ? `?${query}` : ''}`, {
    method,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`
    },
    body,
    signal
  });

  return readResponse(response, 'Ticket request failed');
};

const append = (formData, key, value) => {
  if (value === undefined) return;
  if (value === null) {
    formData.append(key, '');
    return;
  }
  formData.append(key, typeof value === 'boolean' ? String(value) : String(value));
};

const buildTicketFormData = (ticket = {}) => {
  const formData = new FormData();
  append(formData, 'TicketId', ticket.ticketId || 0);
  append(formData, 'Subject', ticket.subject || '');
  append(formData, 'TicketStatus', ticket.ticketStatus || 0);
  append(formData, 'RemoteAccessCode', ticket.remoteAccessCode || '');
  append(formData, 'RemoteAccessMethod', ticket.remoteAccessMethod || 0);
  append(formData, 'OS', ticket.os || 0);
  append(formData, 'OSPassword', ticket.osPassword || '');
  append(formData, 'CaseNotes', ticket.caseNotes || '');
  append(formData, 'T_StartDate', ticket.t_StartDate || '');
  append(formData, 'T_EndDate', ticket.t_EndDate || '');
  append(formData, 'IsNewTicket', ticket.isNewTicket !== false);
  append(formData, 'AssignedTo', Number(ticket.assignedTo) > 0 ? ticket.assignedTo : null);
  append(formData, 'CustomerId', ticket.customerId || 0);
  append(formData, 'CreatedDate', ticket.createdDate);
  append(formData, 'CreatedBy', Number(ticket.createdBy) > 0 ? ticket.createdBy : undefined);
  append(formData, 'UpdatedDate', ticket.updatedDate);
  append(formData, 'UpdatedBy', ticket.updatedBy);
  append(formData, 'Qualitytech', ticket.qualitytech);
  append(formData, 'IsQualityCheckCompleted', Boolean(ticket.isQualityCheckCompleted));
  append(formData, 'QualityCheckDate', ticket.qualityCheckDate || '');
  append(formData, 'QualityComment', ticket.qualityComment || '');
  append(formData, 'IsDeleted', Boolean(ticket.isDeleted));
  append(formData, 'BrandId', ticket.brandId || 0);

  (Array.isArray(ticket.files) ? ticket.files : []).forEach((file) => {
    if (file) formData.append('files', file);
  });

  return formData;
};

export const ticketService = {
  async getTickets(params = {}, signal) {
    const payload = await request('/Ticket', {
      params: {
        Text: params.Text || '',
        SearchField: params.SearchField || '',
        FromDate: params.FromDate || '',
        ToDate: params.ToDate || '',
        PageNumber: params.PageNumber || 1,
        PageSize: params.PageSize || 10,
        SortProperty: params.SortProperty || 'TicketId',
        IsDescending: params.IsDescending !== false
      },
      signal
    });

    return {
      data: Array.isArray(payload?.data) ? payload.data : [],
      totalCount: Number(payload?.totalCount) || 0
    };
  },

  async getTicketById(ticketId, signal) {
    if (!ticketId) throw new Error('Ticket ID is required.');
    const payload = await request(`/Ticket/${ticketId}`, { signal });
    return payload?.data || null;
  },

  async getTicketActivity(ticketId, signal) {
    if (!ticketId) throw new Error('Ticket ID is required.');
    const payload = await request(`/Ticket/getTicketActivity/${ticketId}`, { signal });
    return Array.isArray(payload?.data) ? payload.data : [];
  },

  async getTicketFullUrl(ticketId, fileName, signal) {
    if (!ticketId || !fileName) throw new Error('Ticket ID and file name are required.');
    const payload = await request('/Ticket/GetFullUrl', { params: { TicketId: ticketId, fileName }, signal });
    const data = payload?.data;
    if (typeof data === 'string') return data;
    return data?.fullUrl || data?.url || data?.link || payload?.fullUrl || payload?.url || '';
  },

  async createTicket(ticket) {
    const payload = await request('/Ticket', { method: 'POST', body: buildTicketFormData(ticket) });
    return payload?.data || null;
  },

  async updateTicket(ticket) {
    const payload = await request('/Ticket', { method: 'PUT', body: buildTicketFormData(ticket) });
    return payload?.data || null;
  }
};

export default ticketService;
