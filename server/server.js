const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());

// React 빌드 폴더를 정적 파일로 서빙
app.use(express.static(path.join(__dirname, '../client/build')));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

let currentBid = 0;
let highestBidder = null;
let bidHistory = [];

io.on('connection', (socket) => {
  console.log(`✅ 사용자 접속: ${socket.id}`);

  socket.emit('bidInit', { currentBid, highestBidder, bidHistory });

  socket.on('placeBid', ({ bid, user }) => {
    const time = new Date().toLocaleTimeString();

    if (bid > currentBid) {
      currentBid = bid;
      highestBidder = user;

      const newBid = { bid, user, time };
      bidHistory.push(newBid);

      io.emit('bidUpdate', { currentBid, highestBidder, newBid });

      console.log(`💸 ${user}님이 ${bid}원 입찰 (${time})`);
    } else {
      socket.emit('bidRejected', { message: '입찰가가 현재가보다 낮습니다.' });
    }
  });

  socket.on('disconnect', () => {
    console.log(`❌ 사용자 퇴장: ${socket.id}`);
  });
});

// React 라우팅 지원을 위한 모든 GET 요청에 index.html 반환
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
});

const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 경매 서버 실행 중: http://0.0.0.0:${PORT}`);
});
