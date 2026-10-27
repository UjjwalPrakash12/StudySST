const BASE_URL = '/api';

function getAuthHeaders() {
  const token = localStorage.getItem('studystream_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function handleResponse(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed with status ${res.status}`);
  }
  return data;
}

export const api = {
  // Auth
  async login(login, password) {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login, password }),
    });
    return handleResponse(res);
  },

  async register(username, email, password, displayName) {
    const res = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password, displayName }),
    });
    return handleResponse(res);
  },

  async getMe() {
    const res = await fetch(`${BASE_URL}/auth/me`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  async updateProfile(profileData) {
    const res = await fetch(`${BASE_URL}/auth/profile`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(profileData),
    });
    return handleResponse(res);
  },

  // Rooms
  async getRooms() {
    const res = await fetch(`${BASE_URL}/rooms`);
    return handleResponse(res);
  },

  async getRoom(id) {
    const res = await fetch(`${BASE_URL}/rooms/${id}`);
    return handleResponse(res);
  },

  async createRoom(roomData) {
    const res = await fetch(`${BASE_URL}/rooms`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(roomData),
    });
    return handleResponse(res);
  },

  // Sessions & Analytics
  async recordSession(sessionData) {
    const res = await fetch(`${BASE_URL}/sessions/record`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(sessionData),
    });
    return handleResponse(res);
  },

  async getSessionHistory() {
    const res = await fetch(`${BASE_URL}/sessions/history`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  async getAnalyticsOverview() {
    const res = await fetch(`${BASE_URL}/analytics/overview`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  async getLeaderboard() {
    const res = await fetch(`${BASE_URL}/leaderboard`);
    return handleResponse(res);
  },

  // Tasks
  async getTasks(roomId) {
    const url = roomId ? `${BASE_URL}/tasks?roomId=${roomId}` : `${BASE_URL}/tasks`;
    const res = await fetch(url, {
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  async createTask(title, roomId) {
    const res = await fetch(`${BASE_URL}/tasks`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ title, roomId }),
    });
    return handleResponse(res);
  },

  async toggleTask(id) {
    const res = await fetch(`${BASE_URL}/tasks/${id}/toggle`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  async deleteTask(id) {
    const res = await fetch(`${BASE_URL}/tasks/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },
};
