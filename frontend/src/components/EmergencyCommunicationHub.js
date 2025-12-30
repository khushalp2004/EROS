import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import api from '../api';

const EmergencyCommunicationHub = () => {
  const { user } = useAuth();
  const [activeChannel, setActiveChannel] = useState('GENERAL');
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [showNewMessageModal, setShowNewMessageModal] = useState(false);
  const [messageForm, setMessageForm] = useState({
    message_type: 'CHAT',
    content: '',
    communication_channel: 'GENERAL',
    is_urgent: false,
    requires_acknowledgment: false
  });
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const communicationChannels = [
    { 
      id: 'GENERAL', 
      name: 'General Operations', 
      icon: '📡', 
      color: '#3b82f6',
      description: 'General emergency communications'
    },
    { 
      id: 'FIRE', 
      name: 'Fire Operations', 
      icon: '🔥', 
      color: '#dc2626',
      description: 'Fire department operations'
    },
    { 
      id: 'MEDICAL', 
      name: 'Medical Operations', 
      icon: '🚑', 
      color: '#059669',
      description: 'EMS and medical emergencies'
    },
    { 
      id: 'POLICE', 
      name: 'Law Enforcement', 
      icon: '🚔', 
      color: '#7c3aed',
      description: 'Police operations and security'
    },
    { 
      id: 'COMMAND', 
      name: 'Command Center', 
      icon: '🎯', 
      color: '#f59e0b',
      description: 'Incident command communications'
    },
    { 
      id: 'LOGISTICS', 
      name: 'Logistics', 
      icon: '🚚', 
      color: '#6b7280',
      description: 'Resources and logistics'
    }
  ];

  const messageTypes = [
    { type: 'CHAT', label: 'General Chat', icon: '💬' },
    { type: 'STATUS_UPDATE', label: 'Status Update', icon: '📊' },
    { type: 'RESOURCE_REQUEST', label: 'Resource Request', icon: '🔧' },
    { type: 'SITUATION_REPORT', label: 'Situation Report', icon: '📋' },
    { type: 'DECISION', label: 'Decision/Order', icon: '⚖️' }
  ];

  useEffect(() => {
    loadMessages();
    // Simulate real-time updates
    const interval = setInterval(loadMessages, 5000);
    return () => clearInterval(interval);
  }, [activeChannel]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadMessages = async () => {
    try {
      // For demo purposes, use mock data
      setMessages(getMockMessages(activeChannel));
    } catch (error) {
      console.error('Error loading messages:', error);
      setMessages(getMockMessages(activeChannel));
    }
  };

  const getMockMessages = (channel) => {
    const mockMessages = {
      GENERAL: [
        {
          id: 1,
          message_type: 'STATUS_UPDATE',
          content: 'All units are responding normally. Weather conditions are clear.',
          sender_name: 'Command Center',
          sender_role: 'dispatcher',
          sent_at: new Date(Date.now() - 300000).toISOString(),
          is_urgent: false,
          requires_acknowledgment: false
        },
        {
          id: 2,
          message_type: 'CHAT',
          content: 'Training exercise will begin at 1400 hours. All units report to Station 1.',
          sender_name: 'Training Officer',
          sender_role: 'admin',
          sent_at: new Date(Date.now() - 600000).toISOString(),
          is_urgent: false,
          requires_acknowledgment: false
        }
      ],
      FIRE: [
        {
          id: 3,
          message_type: 'SITUATION_REPORT',
          content: 'Structure fire at 456 Oak Street. Two alarms, requesting additional units.',
          sender_name: 'Fire Chief Johnson',
          sender_role: 'authority',
          sent_at: new Date(Date.now() - 120000).toISOString(),
          is_urgent: true,
          requires_acknowledgment: true
        },
        {
          id: 4,
          message_type: 'RESOURCE_REQUEST',
          content: 'Need additional hose lines and ground monitors for extended operation.',
          sender_name: 'Engine 3',
          sender_role: 'authority',
          sent_at: new Date(Date.now() - 300000).toISOString(),
          is_urgent: false,
          requires_acknowledgment: false
        }
      ],
      MEDICAL: [
        {
          id: 5,
          message_type: 'STATUS_UPDATE',
          content: 'Multiple casualties from MVC on Highway 101. Requesting trauma units.',
          sender_name: 'EMS Supervisor',
          sender_role: 'authority',
          sent_at: new Date(Date.now() - 60000).toISOString(),
          is_urgent: true,
          requires_acknowledgment: true
        }
      ]
    };
    
    return mockMessages[channel] || mockMessages.GENERAL;
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    setLoading(true);

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const message = {
        id: Date.now(),
        message_type: 'CHAT',
        content: newMessage,
        sender_name: user?.name || 'Unknown User',
        sender_role: user?.role || 'user',
        sent_at: new Date().toISOString(),
        is_urgent: false,
        requires_acknowledgment: false
      };

      setMessages(prev => [...prev, message]);
      setNewMessage('');
      
      showNotification('Message sent successfully', 'success');
    } catch (error) {
      console.error('Error sending message:', error);
      showNotification('Failed to send message', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUrgentMessage = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await api.post('/communication/communication', messageForm);
      
      if (response.data.communication_id) {
        setShowNewMessageModal(false);
        setMessageForm({
          message_type: 'CHAT',
          content: '',
          communication_channel: 'GENERAL',
          is_urgent: false,
          requires_acknowledgment: false
        });
        loadMessages();
        
        showNotification('Urgent message sent successfully!', 'success');
      }
    } catch (error) {
      console.error('Error sending urgent message:', error);
      showNotification('Failed to send urgent message', 'error');
    } finally {
      setLoading(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const showNotification = (message, type) => {
    console.log(`${type.toUpperCase()}: ${message}`);
  };

  const getMessageTypeIcon = (type) => {
    const messageType = messageTypes.find(mt => mt.type === type);
    return messageType ? messageType.icon : '💬';
  };

  const getMessageTypeColor = (type) => {
    switch (type) {
      case 'STATUS_UPDATE': return '#3b82f6';
      case 'RESOURCE_REQUEST': return '#f59e0b';
      case 'SITUATION_REPORT': return '#dc2626';
      case 'DECISION': return '#7c3aed';
      default: return '#6b7280';
    }
  };

  const getChannelInfo = (channelId) => {
    return communicationChannels.find(ch => ch.id === channelId) || communicationChannels[0];
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString();
    }
  };

  const groupMessagesByDate = (messages) => {
    const grouped = {};
    messages.forEach(message => {
      const date = formatDate(message.sent_at);
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(message);
    });
    return grouped;
  };

  const groupedMessages = groupMessagesByDate(messages);

  return (
    <div className="emergency-communication-hub">
      <div className="communication-header">
        <div className="header-content">
          <h2>💬 Emergency Communication Hub</h2>
          <p>Real-time emergency communications and coordination</p>
        </div>
        
        <div className="header-actions">
          <button 
            className="btn btn-warning"
            onClick={() => setShowNewMessageModal(true)}
          >
            🚨 Send Urgent Message
          </button>
        </div>
      </div>

      <div className="communication-layout">
        {/* Channel Sidebar */}
        <div className="channels-sidebar">
          <h3>Communication Channels</h3>
          
          <div className="channels-list">
            {communicationChannels.map((channel) => (
              <button
                key={channel.id}
                className={`channel-item ${activeChannel === channel.id ? 'active' : ''}`}
                onClick={() => setActiveChannel(channel.id)}
                style={{ 
                  borderLeftColor: activeChannel === channel.id ? channel.color : 'transparent' 
                }}
              >
                <div className="channel-icon" style={{ color: channel.color }}>
                  {channel.icon}
                </div>
                <div className="channel-info">
                  <div className="channel-name">{channel.name}</div>
                  <div className="channel-description">{channel.description}</div>
                </div>
                
                {/* Message count indicator */}
                <div className="channel-badge">
                  {messages.filter(m => m.communication_channel === channel.id).length}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Messages Area */}
        <div className="messages-area">
          <div className="messages-header">
            <div className="active-channel-info">
              <span className="channel-icon" style={{ color: getChannelInfo(activeChannel).color }}>
                {getChannelInfo(activeChannel).icon}
              </span>
              <div>
                <h3>{getChannelInfo(activeChannel).name}</h3>
                <p>{getChannelInfo(activeChannel).description}</p>
              </div>
            </div>
            
            <div className="channel-stats">
              <span className="message-count">{messages.length} messages</span>
            </div>
          </div>

          <div className="messages-container">
            {Object.keys(groupedMessages).length === 0 ? (
              <div className="empty-messages">
                <div className="empty-icon">💬</div>
                <p>No messages in this channel yet</p>
                <p>Start the conversation!</p>
              </div>
            ) : (
              Object.entries(groupedMessages).map(([date, dateMessages]) => (
                <div key={date} className="message-group">
                  <div className="message-date-divider">
                    <span>{date}</span>
                  </div>
                  
                  {dateMessages.map((message) => (
                    <div key={message.id} className={`message-item ${message.is_urgent ? 'urgent' : ''}`}>
                      <div className="message-header">
                        <div className="message-meta">
                          <span className="message-type-icon" style={{ color: getMessageTypeColor(message.message_type) }}>
                            {getMessageTypeIcon(message.message_type)}
                          </span>
                          
                          <span className="sender-name">{message.sender_name}</span>
                          <span className="sender-role">({message.sender_role})</span>
                          
                          {message.is_urgent && (
                            <span className="urgent-badge">URGENT</span>
                          )}
                          
                          {message.requires_acknowledgment && (
                            <span className="ack-badge">ACK REQUIRED</span>
                          )}
                        </div>
                        
                        <span className="message-time">
                          {formatTime(message.sent_at)}
                        </span>
                      </div>
                      
                      <div className="message-content">
                        <p>{message.content}</p>
                      </div>
                      
                      {message.requires_acknowledgment && (
                        <div className="message-actions">
                          <button className="btn btn-success btn-sm">
                            ✅ Acknowledge
                          </button>
                          <button className="btn btn-warning btn-sm">
                            ❓ Need Info
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input */}
          <div className="message-input-area">
            <form onSubmit={handleSendMessage} className="message-form">
              <div className="input-group">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder={`Message ${getChannelInfo(activeChannel).name}...`}
                  className="message-input"
                  disabled={loading}
                />
                
                <div className="input-actions">
                  <button
                    type="button"
                    className={`urgent-btn ${newMessage.includes('urgent') || newMessage.includes('emergency') ? 'active' : ''}`}
                    title="Mark as urgent"
                  >
                    🚨
                  </button>
                  
                  <button
                    type="submit"
                    className="send-btn"
                    disabled={loading || !newMessage.trim()}
                  >
                    {loading ? '⏳' : '📤'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Urgent Message Modal */}
      {showNewMessageModal && (
        <div className="modal-overlay" onClick={() => setShowNewMessageModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>🚨 Send Urgent Message</h2>
              <button 
                className="close-btn"
                onClick={() => setShowNewMessageModal(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUrgentMessage} className="urgent-message-form">
              <div className="form-row">
                <div className="form-group">
                  <label>Message Type</label>
                  <select
                    value={messageForm.message_type}
                    onChange={(e) => setMessageForm({...messageForm, message_type: e.target.value})}
                    required
                  >
                    {messageTypes.map((type) => (
                      <option key={type.type} value={type.type}>
                        {type.icon} {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Channel</label>
                  <select
                    value={messageForm.communication_channel}
                    onChange={(e) => setMessageForm({...messageForm, communication_channel: e.target.value})}
                    required
                  >
                    {communicationChannels.map((channel) => (
                      <option key={channel.id} value={channel.id}>
                        {channel.icon} {channel.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Message Content</label>
                <textarea
                  value={messageForm.content}
                  onChange={(e) => setMessageForm({...messageForm, content: e.target.value})}
                  placeholder="Enter your urgent message..."
                  rows="4"
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={messageForm.is_urgent}
                      onChange={(e) => setMessageForm({...messageForm, is_urgent: e.target.checked})}
                    />
                    Mark as Urgent
                  </label>
                </div>

                <div className="form-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={messageForm.requires_acknowledgment}
                      onChange={(e) => setMessageForm({...messageForm, requires_acknowledgment: e.target.checked})}
                    />
                    Require Acknowledgment
                  </label>
                </div>
              </div>

              <div className="modal-actions">
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => setShowNewMessageModal(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-warning"
                  disabled={loading || !messageForm.content}
                >
                  {loading ? 'Sending...' : '🚨 Send Urgent Message'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmergencyCommunicationHub;
