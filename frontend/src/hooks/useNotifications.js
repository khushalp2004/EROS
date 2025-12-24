import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import api from '../api';

const NotificationContext = createContext();

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children, userId = null }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [preferences, setPreferences] = useState(null);
  const [socket, setSocket] = useState(null);

  // Initialize WebSocket connection
  useEffect(() => {
    const newSocket = io('http://localhost:5001');
    
    newSocket.on('connect', () => {
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    newSocket.on('notification', (notification) => {
      setNotifications(prev => [notification, ...prev]);
      setUnreadCount(prev => prev + 1);
      
      // Show toast notification if enabled in preferences
      if (preferences?.in_app_notifications !== false) {
        showToastNotification(notification);
      }
    });

    newSocket.on('notification_updated', (update) => {
      setNotifications(prev => 
        prev.map(n => 
          n.id === update.notification_id 
            ? { ...n, ...update }
            : n
        )
      );
      
      // Update unread count if notification was marked as read
      if (update.is_read && !update.is_dismissed) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    });

    newSocket.on('all_notifications_read', ({ user_id }) => {
      if (user_id === userId || userId === null) {
        setUnreadCount(0);
        setNotifications(prev => 
          prev.map(n => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
        );
      }
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [userId, preferences]);

  // Load initial notifications and preferences
  useEffect(() => {
    if (userId) {
      loadNotifications();
      loadPreferences();
    }
  }, [userId]);

  const loadNotifications = async (status = 'all', limit = 50) => {
    try {
      const response = await api.get('/notifications', {
        params: { user_id: userId, status, limit }
      });
      
      if (response.data.success) {
        setNotifications(response.data.data);
        setUnreadCount(response.data.data.filter(n => !n.is_read).length);
      }
    } catch (error) {
      console.error('Failed to load notifications:', error);
    }
  };

  const loadPreferences = async () => {
    try {
      const response = await api.get('/notifications/preferences', {
        params: { user_id: userId }
      });
      
      if (response.data.success) {
        setPreferences(response.data.data);
      }
    } catch (error) {
      console.error('Failed to load notification preferences:', error);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      await api.post(`/notifications/${notificationId}/read`);
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const dismissNotification = async (notificationId) => {
    try {
      await api.post(`/notifications/${notificationId}/dismiss`);
    } catch (error) {
      console.error('Failed to dismiss notification:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.post('/notifications/mark-all-read', { user_id: userId });
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  };

  const updatePreferences = async (newPreferences) => {
    try {
      const response = await api.post('/notifications/preferences', {
        user_id: userId,
        ...newPreferences
      });
      
      if (response.data.success) {
        setPreferences(response.data.data);
      }
    } catch (error) {
      console.error('Failed to update notification preferences:', error);
    }
  };

  // Toast notification function
  const showToastNotification = (notification) => {
    const toast = {
      id: notification.id,
      title: notification.title,
      message: notification.message,
      type: notification.priority === 'urgent' ? 'error' : 
            notification.priority === 'high' ? 'warning' : 'info',
      duration: notification.priority === 'urgent' ? 0 : 5000, // Urgent notifications don't auto-dismiss
      actionUrl: notification.action_url
    };
    
    // You can integrate with your existing toast system here
    if (window.showToast) {
      window.showToast(toast);
    }
  };

  const getNotificationsByType = (type) => {
    return notifications.filter(n => n.type === type);
  };

  const getNotificationsByPriority = (priority) => {
    return notifications.filter(n => n.priority === priority);
  };

  const value = {
    notifications,
    unreadCount,
    isConnected,
    preferences,
    socket,
    markAsRead,
    dismissNotification,
    markAllAsRead,
    updatePreferences,
    loadNotifications,
    loadPreferences,
    getNotificationsByType,
    getNotificationsByPriority,
    showToastNotification
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};
