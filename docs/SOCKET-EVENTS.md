# Socket.io Event Map

This document describes all Socket.io events used in NADC Helpdesk for real-time communication.

## Connection Setup

Connect to the Socket.io server at your API URL (default: `http://localhost:3001`).

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3001', {
  transports: ['websocket', 'polling'],
});
```

## Rooms

### User Room
For receiving personal notifications.

```javascript
// Join
socket.emit('join:user', { userId: 'user-uuid' });

// Leave
socket.emit('leave:user', { userId: 'user-uuid' });
```

### Ticket Room
For receiving real-time updates on a specific ticket.

```javascript
// Join
socket.emit('join:ticket', { ticketId: 'ticket-uuid' });

// Leave
socket.emit('leave:ticket', { ticketId: 'ticket-uuid' });
```

### Agents Room
For receiving broadcast notifications for all agents.

```javascript
// Join
socket.emit('join:agents');
```

## Events from Server to Client

### Notifications

#### `notification:new`
Emitted when a new notification is created for the user.

**Room:** `user:{userId}`

**Payload:**
```typescript
{
  id: string;
  userId: string;
  type: 'ticket_assigned' | 'ticket_reply' | 'ticket_status_changed' | 'sla_warning' | 'sla_breached';
  title: string;
  message: string;
  link: string;
  readAt: string | null;
  createdAt: string;
}
```

### Ticket Events

#### `ticket:new`
Emitted when a new unassigned ticket is created.

**Room:** `agents`

**Payload:**
```typescript
{
  ticketId: string;
  subject: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
}
```

#### `ticket:reply`
Emitted when a reply is added to a ticket.

**Room:** `ticket:{ticketId}`

**Payload:**
```typescript
{
  ticketId: string;
  reply: {
    id: string;
    body: string;
    isInternal: boolean;
    authorId: string;
    createdAt: string;
    author: {
      id: string;
      name: string;
      avatar: string | null;
      role: string;
    };
    attachments: Array<{
      id: string;
      filename: string;
      url: string;
    }>;
  };
}
```

#### `ticket:updated`
Emitted when ticket properties change (status, priority, assignee, etc.).

**Room:** `ticket:{ticketId}`

**Payload:**
```typescript
{
  ticketId: string;
  changes: {
    status?: string;
    priority?: string;
    assigneeId?: string;
    // ... other changed fields
  };
}
```

#### `ticket:typing`
Emitted when a user is typing a reply on a ticket.

**Room:** `ticket:{ticketId}`

**Payload:**
```typescript
{
  ticketId: string;
  user: {
    id: string;
    name: string;
  };
  isTyping: boolean;
}
```

### Workload Events

#### `workload:moved`
Emitted when a ticket is moved on the workload board (date change).

**Room:** `agents`

**Payload:**
```typescript
{
  ticketId: string;
  assigneeId: string;
  oldDate: string;
  newDate: string;
}
```

## Events from Client to Server

### Room Management

```javascript
// Join user room for notifications
socket.emit('join:user', { userId: 'user-uuid' });

// Leave user room
socket.emit('leave:user', { userId: 'user-uuid' });

// Join ticket room for real-time updates
socket.emit('join:ticket', { ticketId: 'ticket-uuid' });

// Leave ticket room
socket.emit('leave:ticket', { ticketId: 'ticket-uuid' });

// Join agents room for broadcast notifications
socket.emit('join:agents');
```

### Typing Indicators

```javascript
// Emit typing status
socket.emit('ticket:typing', {
  ticketId: 'ticket-uuid',
  isTyping: true
});
```

## Usage Example

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3001');

// Join user room on login
socket.emit('join:user', { userId: currentUser.id });
socket.emit('join:agents');

// Listen for notifications
socket.on('notification:new', (notification) => {
  showToast(notification.title);
  updateUnreadCount();
});

// When viewing a ticket
socket.emit('join:ticket', { ticketId });

socket.on('ticket:reply', ({ ticketId, reply }) => {
  addReplyToUI(reply);
});

socket.on('ticket:updated', ({ ticketId, changes }) => {
  updateTicketUI(changes);
});

socket.on('ticket:typing', ({ user, isTyping }) => {
  if (isTyping) {
    showTypingIndicator(user.name);
  } else {
    hideTypingIndicator();
  }
});

// When leaving ticket view
socket.emit('leave:ticket', { ticketId });

// On logout
socket.emit('leave:user', { userId: currentUser.id });
socket.disconnect();
```
