import React, { useState, useEffect } from 'react';
import axios from 'axios';
import io from 'socket.io-client';

// Notification Bell Component
function NotificationBell({ token, onNotificationClick }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (token) {
      fetchUnreadCount();
      fetchNotifications();
      setupSocket();
    }

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [token]);

  const setupSocket = () => {
    const newSocket = io('http://localhost:3001', {
      auth: { token }
    });

    newSocket.on('newNotification', (data) => {
      const { notification } = data;
      console.log('New notification received:', notification);
      
      // Add new notification to the top of the list
      setNotifications(prev => [notification, ...prev]);
      
      // Update unread count
      setUnreadCount(prev => prev + 1);
      
      // Show toast notification
      showToast(notification);
    });

    setSocket(newSocket);
  };

  const fetchUnreadCount = async () => {
    try {
      const response = await axios.get('/api/notifications/unread-count', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUnreadCount(response.data.unreadCount);
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  };

  const fetchNotifications = async () => {
    try {
      const response = await axios.get('/api/notifications?limit=10', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(response.data.notifications);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      await axios.patch(`/api/notifications/${notificationId}/read`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Update local state
      setNotifications(prev => 
        prev.map(n => 
          n.id === notificationId ? { ...n, isRead: true } : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleNotificationClick = (notification) => {
    // Mark as read
    if (!notification.isRead) {
      markAsRead(notification.id);
    }

    // Handle navigation based on notification type
    const { type, metadata } = notification;
    
    switch (type) {
      case 'LEAD_ASSIGNED':
        if (metadata.action === 'view_lead') {
          onNotificationClick('lead', metadata.leadId);
        }
        break;
        
      case 'NEW_MESSAGE':
        if (metadata.action === 'open_chat') {
          onNotificationClick('chat', metadata.sessionId);
        }
        break;
        
      default:
        console.log('Unknown notification type:', type);
    }

    setShowDropdown(false);
  };

  const showToast = (notification) => {
    // Create a toast notification
    const toast = document.createElement('div');
    toast.className = 'notification-toast';
    toast.innerHTML = `
      <div class="toast-header">
        <strong>${notification.title}</strong>
        <button onclick="this.parentElement.parentElement.remove()">&times;</button>
      </div>
      <div class="toast-body">${notification.message}</div>
    `;
    
    document.body.appendChild(toast);
    
    // Remove toast after 5 seconds
    setTimeout(() => {
      if (toast.parentElement) {
        toast.remove();
      }
    }, 5000);
  };

  return (
    <div className="notification-container">
      {/* Notification Bell */}
      <div 
        className="notification-bell"
        onClick={() => setShowDropdown(!showDropdown)}
      >
        <i className="fas fa-bell"></i>
        {unreadCount > 0 && (
          <span className="notification-badge">{unreadCount}</span>
        )}
      </div>

      {/* Notification Dropdown */}
      {showDropdown && (
        <div className="notification-dropdown">
          <div className="notification-header">
            <h3>Notifications</h3>
            {unreadCount > 0 && (
              <button 
                className="mark-all-read"
                onClick={async () => {
                  try {
                    await axios.patch('/api/notifications/mark-all-read', {}, {
                      headers: { Authorization: `Bearer ${token}` }
                    });
                    setNotifications(prev => 
                      prev.map(n => ({ ...n, isRead: true }))
                    );
                    setUnreadCount(0);
                  } catch (error) {
                    console.error('Error marking all as read:', error);
                  }
                }}
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="notification-list">
            {notifications.length === 0 ? (
              <div className="no-notifications">
                No notifications
              </div>
            ) : (
              notifications.map(notification => (
                <div 
                  key={notification.id}
                  className={`notification-item ${!notification.isRead ? 'unread' : ''}`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="notification-icon">
                    {notification.type === 'LEAD_ASSIGNED' && <i className="fas fa-user-plus"></i>}
                    {notification.type === 'NEW_MESSAGE' && <i className="fas fa-comment"></i>}
                    {notification.type === 'SYSTEM_ALERT' && <i className="fas fa-exclamation-triangle"></i>}
                  </div>
                  
                  <div className="notification-content">
                    <div className="notification-title">{notification.title}</div>
                    <div className="notification-message">{notification.message}</div>
                    <div className="notification-time">
                      {new Date(notification.createdAt).toLocaleString()}
                    </div>
                  </div>
                  
                  {!notification.isRead && (
                    <div className="unread-indicator"></div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// CSS Styles (add to your stylesheet)
const styles = `
.notification-container {
  position: relative;
  display: inline-block;
}

.notification-bell {
  position: relative;
  cursor: pointer;
  padding: 8px;
  border-radius: 50%;
  transition: background-color 0.2s;
}

.notification-bell:hover {
  background-color: rgba(0, 0, 0, 0.1);
}

.notification-badge {
  position: absolute;
  top: 0;
  right: 0;
  background-color: #ff4444;
  color: white;
  border-radius: 50%;
  padding: 2px 6px;
  font-size: 12px;
  min-width: 18px;
  text-align: center;
}

.notification-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  width: 350px;
  max-height: 400px;
  background: white;
  border: 1px solid #ddd;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  overflow: hidden;
}

.notification-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #eee;
  background-color: #f8f9fa;
}

.notification-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.mark-all-read {
  background: none;
  border: none;
  color: #007bff;
  cursor: pointer;
  font-size: 12px;
  text-decoration: underline;
}

.notification-list {
  max-height: 300px;
  overflow-y: auto;
}

.notification-item {
  display: flex;
  align-items: flex-start;
  padding: 12px 16px;
  border-bottom: 1px solid #f0f0f0;
  cursor: pointer;
  transition: background-color 0.2s;
  position: relative;
}

.notification-item:hover {
  background-color: #f8f9fa;
}

.notification-item.unread {
  background-color: #f0f8ff;
}

.notification-item.unread:hover {
  background-color: #e6f3ff;
}

.notification-icon {
  margin-right: 12px;
  margin-top: 2px;
  color: #666;
  width: 20px;
  text-align: center;
}

.notification-content {
  flex: 1;
  min-width: 0;
}

.notification-title {
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 4px;
  color: #333;
}

.notification-message {
  font-size: 13px;
  color: #666;
  margin-bottom: 4px;
  line-height: 1.4;
}

.notification-time {
  font-size: 11px;
  color: #999;
}

.unread-indicator {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 8px;
  height: 8px;
  background-color: #007bff;
  border-radius: 50%;
}

.no-notifications {
  padding: 20px;
  text-align: center;
  color: #666;
  font-style: italic;
}

.notification-toast {
  position: fixed;
  top: 20px;
  right: 20px;
  width: 300px;
  background: white;
  border: 1px solid #ddd;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 10000;
  animation: slideIn 0.3s ease-out;
}

.toast-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid #eee;
  background-color: #f8f9fa;
}

.toast-header button {
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  color: #666;
}

.toast-body {
  padding: 12px;
  font-size: 14px;
  line-height: 1.4;
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}
`;

// Usage Example
function App() {
  const [token, setToken] = useState(localStorage.getItem('accessToken'));

  const handleNotificationClick = (type, id) => {
    switch (type) {
      case 'lead':
        // Navigate to lead details
        window.location.href = `/leads/${id}`;
        break;
      case 'chat':
        // Open chat session
        window.location.href = `/chat/${id}`;
        break;
      default:
        console.log('Unknown notification type:', type);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>CRM System</h1>
        <NotificationBell 
          token={token} 
          onNotificationClick={handleNotificationClick}
        />
      </header>
      
      <style>{styles}</style>
    </div>
  );
}

export default NotificationBell; 