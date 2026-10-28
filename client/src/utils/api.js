const BACKEND_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const BASE_URL = `${BACKEND_URL}/api`;

export const getFullImageUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${BACKEND_URL}${url.startsWith('/') ? '' : '/'}${url}`;
};

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

  async googleAuth(payload) {
    const res = await fetch(`${BASE_URL}/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
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

  async getLiveKitToken(roomId, username, userId) {
    const params = new URLSearchParams();
    if (roomId) params.append('roomId', roomId);
    if (username) params.append('username', username);
    if (userId) params.append('userId', userId);
    const res = await fetch(`${BASE_URL}/livekit/token?${params.toString()}`, {
      headers: getAuthHeaders(),
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

  async getLeaderboard(period = 'all_time') {
    const res = await fetch(`${BASE_URL}/leaderboard?period=${encodeURIComponent(period)}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  // Blogs & Community
  async getBlogs({ search = '', category = '', sort = 'latest', page = 1, limit = 12 } = {}) {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (category) params.append('category', category);
    if (sort) params.append('sort', sort);
    if (page) params.append('page', page);
    if (limit) params.append('limit', limit);
    const res = await fetch(`${BASE_URL}/blogs?${params.toString()}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  async getBlog(id) {
    const res = await fetch(`${BASE_URL}/blogs/${id}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  async createBlog(formData) {
    const token = localStorage.getItem('studystream_token');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const res = await fetch(`${BASE_URL}/blogs`, {
      method: 'POST',
      headers,
      body: formData,
    });
    return handleResponse(res);
  },

  async updateBlog(id, formData) {
    const token = localStorage.getItem('studystream_token');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const res = await fetch(`${BASE_URL}/blogs/${id}`, {
      method: 'PUT',
      headers,
      body: formData,
    });
    return handleResponse(res);
  },

  async deleteBlog(id) {
    const res = await fetch(`${BASE_URL}/blogs/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  async toggleBlogLike(id) {
    const res = await fetch(`${BASE_URL}/blogs/${id}/like`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  async addBlogComment(blogId, content) {
    const res = await fetch(`${BASE_URL}/blogs/${blogId}/comments`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ content, comment: content }),
    });
    return handleResponse(res);
  },

  async deleteBlogComment(blogId, commentId) {
    const res = await fetch(`${BASE_URL}/blogs/${blogId}/comments/${commentId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
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
