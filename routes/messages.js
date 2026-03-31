const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Message = require('../schemas/messages');

// Sử dụng CheckLogin (JWT Middleware) đã có sẵn của dự án
const { CheckLogin } = require('../utils/authHandler');

/* 
  1. GET / 
  Lấy lịch sử - tin nhắn cuối cùng của mỗi bạn chat của user hiện tại
*/
router.get('/', CheckLogin, async (req, res) => {
  try {
    const currentUserId = req.user._id.toString();

    // Lấy tất cả tin nhắn liên quan đến user hiện tại, sắp xếp mới nhất trước
    const allMessages = await Message.find({
      $or: [{ from: req.user._id }, { to: req.user._id }]
    })
      .sort({ createdAt: -1 })
      .populate("from to", "fullName avatarUrl _id email");

    // Gom nhóm: Mỗi người bạn chat chỉ giữ lại tin nhắn mới nhất
    const partnerMap = {};
    for (const msg of allMessages) {
      // Xác định "người kia" là ai
      const partnerId = msg.from._id.toString() === currentUserId
        ? msg.to._id.toString()
        : msg.from._id.toString();

      // Chỉ giữ tin nhắn đầu tiên gặp (mới nhất) cho mỗi partner
      if (!partnerMap[partnerId]) {
        partnerMap[partnerId] = msg;
      }
    }

    // Chuyển Map thành Array để trả về cho Frontend
    const result = Object.values(partnerMap);

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ code: "500", message: error.message, timestamp: Date.now() });
  }
});

/* 
  2. GET /:userID 
  Lấy toàn bộ tin nhắn 2 chiều giữa User hiện hành và 1 UserID cụ thể
*/
router.get('/:userID', CheckLogin, async (req, res) => {
  try {
    const { userID } = req.params;
    const currentUserId = req.user._id;

    // Xử lý chuẩn hóa ObjectId để Mongoose so sánh không bị sai lệch Type
    const targetId = new mongoose.Types.ObjectId(userID);
    const myId = new mongoose.Types.ObjectId(currentUserId);

    // Tìm tất cả tin nhắn thỏa mãn: (from = me AND to = targetId) OR (from = targetId AND to = me)
    const messages = await Message.find({
      $or: [
        { from: myId, to: targetId },
        { from: targetId, to: myId }
      ]
    })
      .sort({ createdAt: 1 }) // Tin cũ hiện trên, tin mới ở dưới (để render giao diện box Chat)
      .populate("from to", "fullName avatarUrl _id");

    res.status(200).json(messages);
  } catch (error) {
    res.status(500).json({ code: "500", message: error.message, timestamp: Date.now() });
  }
});

/* 
  3. POST / 
  Tạo và gửi tin nhắn mới
*/
router.post('/', CheckLogin, async (req, res) => {
  try {
    const { to, text, file } = req.body;
    const currentUserId = req.user._id;

    if (!to) {
      return res.status(400).json({ code: "400", message: "Missing userID receiver (to)", timestamp: Date.now() });
    }
    if (!text && !file) {
      return res.status(400).json({ code: "400", message: "Must provide either text or file content", timestamp: Date.now() });
    }

    // Logic quyết định type và content giống yêu cầu
    let messageType = "text";
    let contentValue = text;

    if (file) {
      messageType = "file";
      contentValue = file; 
    }

    const newMessage = new Message({
      from: currentUserId,
      to: to,
      messageContent: {
        type: messageType,
        text: contentValue
      }
    });

    await newMessage.save();

    res.status(201).json(newMessage);
  } catch (error) {
    res.status(500).json({ code: "500", message: error.message, timestamp: Date.now() });
  }
});

module.exports = router;
