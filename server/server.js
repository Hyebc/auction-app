const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());

// React 빌드 폴더를 정적 파일로 서빙
app.use(express.static(path.join(__dirname, '../client/build')));

// React 라우팅 지원 - 모든 GET 요청에 index.html 반환
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

let currentBid = 0;
let highestBidder = null;
let bidHistory = [];
let currentItem = null;

let auctionResults = []; // 낙찰 목록 저장용 추가

io.on('connection', (socket) => {
  console.log(`✅ 사용자 접속: ${socket.id}`);

  // 초기 데이터 전달
  socket.emit('bidInit', { currentBid, highestBidder, bidHistory, currentItem });
  socket.emit('auctionResults', auctionResults); // 낙찰 목록도 함께 전송

  // 관리자 전용 입찰 시작 이벤트
  socket.on('startAuction', (itemName) => {
    currentItem = itemName;
    currentBid = 0;
    highestBidder = null;
    bidHistory = [];

    io.emit('auctionStarted', { itemName });

    console.log(`📦 입찰 시작: ${itemName}`);
  });

  // 입찰 처리
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

  // 낙찰 처리
  socket.on('declareWinner', () => {
    if (highestBidder) {
      // 낙찰 결과 저장
      auctionResults.push({
        user: highestBidder,
        item: currentItem,
        price: currentBid,
      });

      io.emit('auctionEnded', {
        winner: highestBidder,
        price: currentBid,
        itemName: currentItem,
      });

      io.emit('auctionResults', auctionResults); // 낙찰 목록 갱신 전송

      console.log(`🎉 낙찰자: ${highestBidder}, 금액: ${currentBid}, 대상: ${currentItem}`);

      // 초기화
      currentBid = 0;
      highestBidder = null;
      bidHistory = [];
      currentItem = null;
    }
  });

  socket.on('disconnect', () => {
    console.log(`❌ 사용자 퇴장: ${socket.id}`);
  });
});

const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 경매 서버 실행 중: http://0.0.0.0:${PORT}`);
});
