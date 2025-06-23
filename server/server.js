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

const TEAM_COUNT = 11;
const INITIAL_POINTS = 1000;

let currentBid = 0;
let highestBidder = null;
let bidHistory = [];
let currentItem = null;

let auctionResults = []; // 낙찰 목록 저장용

let teamPoints = Array(TEAM_COUNT).fill(INITIAL_POINTS);

io.on('connection', (socket) => {
  console.log(`✅ 사용자 접속: ${socket.id}`);

  // 초기 데이터 전달 (포인트 포함)
  socket.emit('bidInit', { currentBid, highestBidder, bidHistory, currentItem, teamPoints });
  socket.emit('auctionResults', auctionResults);

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
  socket.on('placeBid', ({ bid, user, teamNumber }) => {
    const time = new Date().toLocaleTimeString();

    // teamNumber 유효성 검사
    if (typeof teamNumber !== 'number' || teamNumber < 1 || teamNumber > TEAM_COUNT) {
      socket.emit('bidRejected', { message: '유효하지 않은 팀 번호입니다.' });
      return;
    }

    // 잔여 포인트 체크
    if (teamPoints[teamNumber - 1] < bid) {
      socket.emit('bidRejected', { message: '잔여 포인트가 부족합니다.' });
      return;
    }

    // 입찰가가 현재가보다 높아야 함
    if (bid > currentBid) {
      currentBid = bid;
      highestBidder = user;

      const newBid = { bid, user, time };
      bidHistory.push(newBid);

      io.emit('bidUpdate', { currentBid, highestBidder, newBid, teamPoints });

      console.log(`💸 ${user}님이 ${bid}원 입찰 (${time})`);
    } else {
      socket.emit('bidRejected', { message: '입찰가가 현재가보다 낮습니다.' });
    }
  });

  // 낙찰 처리
  socket.on('declareWinner', () => {
    if (highestBidder) {
      const teamNumber = parseInt(highestBidder.replace(/[^0-9]/g, ''), 10);

      if (!isNaN(teamNumber) && teamNumber >= 1 && teamNumber <= TEAM_COUNT) {
        teamPoints[teamNumber - 1] -= currentBid;

        if (teamPoints[teamNumber - 1] < 0) {
          teamPoints[teamNumber - 1] = 0; // 음수 방지
        }
      }

      auctionResults.push({
        user: highestBidder,
        item: currentItem,
        price: currentBid,
      });

      io.emit('auctionEnded', {
        winner: highestBidder,
        price: currentBid,
        itemName: currentItem,
        teamPoints,
      });

      io.emit('auctionResults', auctionResults);

      console.log(`🎉 낙찰자: ${highestBidder}, 금액: ${currentBid}, 대상: ${currentItem}`);

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
