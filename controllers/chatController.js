const db = require('../config/db');

// Send a chat message
exports.sendMessage = async (req, res) => {
  const { receiver_id, receiver_role, message } = req.body;
  const { id: sender_id, role: sender_role } = req.user;

  if (!receiver_id || !receiver_role || !message) {
    return res.status(400).json({ error: 'Receiver ID, Role and message are required' });
  }

  // Enforcement: Cleaner can only message their Owner
  if (sender_role === 'Cleaner') {
    const [cleaner] = await db.query('SELECT owner_id FROM `cleaners` WHERE id = ?', [sender_id]);
    if (!cleaner.length || receiver_role !== 'Owner' || cleaner[0].owner_id !== receiver_id) {
      return res.status(403).json({ error: 'Cleaners can only message their assigned Owner.' });
    }
  }

  // Enforcement: Admin can only message their assigned Owners
  if (sender_role === 'Admin') {
    if (receiver_role === 'Owner') {
      const [owner] = await db.query('SELECT admin_id FROM `owners` WHERE id = ?', [receiver_id]);
      if (!owner.length || owner[0].admin_id !== sender_id) {
        return res.status(403).json({ error: 'Admins can only message their assigned Owners.' });
      }
    } else if (receiver_role === 'Cleaner') {
      return res.status(403).json({ error: 'Admins cannot message Cleaners directly.' });
    }
  }

  // Enforcement: Owner can only message their Cleaners or their Admin
  if (sender_role === 'Owner') {
    if (receiver_role === 'Cleaner') {
      const [cleaner] = await db.query('SELECT owner_id FROM `cleaners` WHERE id = ?', [receiver_id]);
      if (!cleaner.length || cleaner[0].owner_id !== sender_id) {
        return res.status(403).json({ error: 'Owners can only message their own Cleaners.' });
      }
    } else if (receiver_role === 'Admin') {
      const [owner] = await db.query('SELECT admin_id FROM `owners` WHERE id = ?', [sender_id]);
      if (!owner.length || owner[0].admin_id !== receiver_id) {
        return res.status(403).json({ error: 'Owners can only message their assigned Admin.' });
      }
    }
  }

  try {
    const [result] = await db.query(
      'INSERT INTO `chats` (sender_id, sender_role, receiver_id, receiver_role, message) VALUES (?, ?, ?, ?, ?)',
      [sender_id, sender_role, receiver_id, receiver_role, message]
    );

    res.status(201).json({
      id: result.insertId,
      sender_id,
      sender_role,
      receiver_id,
      receiver_role,
      message,
      timestamp: new Date()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get chat history
exports.getChatHistory = async (req, res) => {
  const { id: myId, role: myRole } = req.user;
  const { userId: otherId } = req.params;
  const { otherRole } = req.query;

  if (!otherRole) return res.status(400).json({ error: 'otherRole query parameter is required' });

  try {
    const [chats] = await db.query(
      `SELECT * FROM \`chats\` 
       WHERE (
         (sender_id = ? AND sender_role = ? AND receiver_id = ? AND receiver_role = ? AND deleted_by_sender = FALSE) 
         OR 
         (sender_id = ? AND sender_role = ? AND receiver_id = ? AND receiver_role = ? AND deleted_by_receiver = FALSE)
       ) 
       ORDER BY timestamp ASC`,
      [myId, myRole, otherId, otherRole, otherId, otherRole, myId, myRole]
    );

    // Mark these messages as read
    await db.query(
      'UPDATE `chats` SET is_read = TRUE WHERE receiver_id = ? AND receiver_role = ? AND sender_id = ? AND sender_role = ?',
      [myId, myRole, otherId, otherRole]
    );

    res.json(chats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.editMessage = async (req, res) => {
  const { id } = req.params;
  const { message } = req.body;
  const { id: userId, role } = req.user;

  try {
    const [rows] = await db.query('SELECT timestamp FROM `chats` WHERE id = ? AND sender_id = ? AND sender_role = ?', [id, userId, role]);
    if (rows.length === 0) return res.status(404).json({ error: 'Message not found or unauthorized' });

    const sentTime = new Date(rows[0].timestamp);
    const now = new Date();
    const diffMinutes = (now - sentTime) / (1000 * 60);

    if (diffMinutes > 5) {
      return res.status(403).json({ error: 'Cannot edit message after 5 minutes' });
    }

    await db.query(
      'UPDATE `chats` SET message = ?, is_edited = TRUE WHERE id = ?',
      [message, id]
    );

    res.json({ success: true, message: 'Message updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteMessage = async (req, res) => {
  const { id } = req.params;
  const { id: userId, role: userRole } = req.user;

  try {
    const [rows] = await db.query('SELECT * FROM `chats` WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Message not found' });

    const msg = rows[0];
    const isSender = (msg.sender_id === userId && msg.sender_role === userRole);
    const isReceiver = (msg.receiver_id === userId && msg.receiver_role === userRole);

    if (!isSender && !isReceiver) return res.status(403).json({ error: 'Unauthorized to delete this message' });

    const sentTime = new Date(msg.timestamp);
    const now = new Date();
    const diffMinutes = (now - sentTime) / (1000 * 60);

    if (isSender) {
      if (diffMinutes <= 5) {
        // Delete for everyone (by hiding it from both)
        await db.query('UPDATE `chats` SET deleted_by_sender = TRUE, deleted_by_receiver = TRUE WHERE id = ?', [id]);
        return res.json({ success: true, message: 'Message deleted for everyone' });
      } else {
        // Delete for self only
        await db.query('UPDATE `chats` SET deleted_by_sender = TRUE WHERE id = ?', [id]);
        return res.json({ success: true, message: 'Message deleted from your view' });
      }
    } else {
      // Receiver can only delete for themselves
      await db.query('UPDATE `chats` SET deleted_by_receiver = TRUE WHERE id = ?', [id]);
      return res.json({ success: true, message: 'Message deleted from your view' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
