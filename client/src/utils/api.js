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
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('text/html')) {
    throw new Error('API server returned HTML instead of JSON. Ensure the backend server is running and VITE_API_URL is configured in your environment.');
  }
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

  async verifyRoomPassword(roomId, password) {
    const res = await fetch(`${BASE_URL}/rooms/${roomId}/verify-password`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ password }),
    });
    return handleResponse(res);
  },

  async getLiveKitToken(roomId, username, userId, roomToken = null) {
    const params = new URLSearchParams();
    if (roomId) params.append('roomId', roomId);
    if (username) params.append('username', username);
    if (userId) params.append('userId', userId);
    if (roomToken) params.append('roomToken', roomToken);
    const headers = getAuthHeaders();
    if (roomToken) {
      headers['x-room-token'] = roomToken;
    }
    const res = await fetch(`${BASE_URL}/livekit/token?${params.toString()}`, {
      headers,
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

  // 1-to-1 Private Direct Messaging
  async getDirectMessages(recipientId, roomId = null) {
    const url = roomId 
      ? `${BASE_URL}/direct-messages/${recipientId}?roomId=${encodeURIComponent(roomId)}` 
      : `${BASE_URL}/direct-messages/${recipientId}`;
    const res = await fetch(url, {
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  // Spotify Music Sharing
  async getSpotifyAuthUrl() {
    const res = await fetch(`${BASE_URL}/spotify/auth-url`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  async getSpotifyStatus() {
    const res = await fetch(`${BASE_URL}/spotify/status`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  async toggleSpotifySharing() {
    const res = await fetch(`${BASE_URL}/spotify/toggle-sharing`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  async disconnectSpotify() {
    const res = await fetch(`${BASE_URL}/spotify/disconnect`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  async getSpotifyCurrentTrack() {
    const res = await fetch(`${BASE_URL}/spotify/current-track`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  // ==========================================
  // SUPER ADMIN API METHODS
  // ==========================================
  async getAdminOverview() {
    const res = await fetch(`${BASE_URL}/admin/overview`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  async getAdminUsers() {
    const res = await fetch(`${BASE_URL}/admin/users`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  async suspendUser(userId) {
    const res = await fetch(`${BASE_URL}/admin/users/${userId}/suspend`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  async deleteUser(userId) {
    const res = await fetch(`${BASE_URL}/admin/users/${userId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  async getAdminRooms() {
    const res = await fetch(`${BASE_URL}/admin/rooms`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  async updateAdminRoom(roomId, updateData) {
    const res = await fetch(`${BASE_URL}/admin/rooms/${roomId}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify(updateData),
    });
    return handleResponse(res);
  },

  async deleteAdminRoom(roomId) {
    const res = await fetch(`${BASE_URL}/admin/rooms/${roomId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  async kickRoomParticipant(roomId, userId, reason) {
    const res = await fetch(`${BASE_URL}/admin/rooms/${roomId}/kick/${userId}`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ reason }),
    });
    return handleResponse(res);
  },

  async getAdminBlogs() {
    const res = await fetch(`${BASE_URL}/admin/blogs`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },
};
