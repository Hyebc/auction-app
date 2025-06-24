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

const TEAM_NAMES = [
  '김선생', '김꾸루꾸루', '아무무를왜했을까', '초록머리만쏴', '하온부',
  '첼린저서포터', '카이사홀릭', '도선생', '아쉬운척 미안한척', '배응칠', '열쇠조각2개'
];
const INITIAL_POINTS = 1000;

// 팀별 포인트 객체 { 팀명: 포인트 }
let teamPoints = {};
TEAM_NAMES.forEach(name => {
  teamPoints[name] = INITIAL_POINTS;
});

let currentBid = 0;
let highestBidder = null;
let bidHistory = [];
let currentItem = null;
let auctionResults = []; // 낙찰 목록 저장용
let countdownTimer = null;

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
  socket.on('placeBid', ({ bid, user, chance }) => {
    const time = new Date().toLocaleTimeString();

    if (!TEAM_NAMES.includes(user)) {
      socket.emit('bidRejected', { message: '유효하지 않은 팀명입니다.' });
      return;
    }

    if (teamPoints[user] < bid) {
      socket.emit('bidRejected', { message: '잔여 포인트가 부족합니다.' });
      return;
    }

    if (bid > currentBid) {
      currentBid = bid;
      highestBidder = user;

      const newBid = { bid, user, time, chance: !!chance };
      bidHistory.push(newBid);

      io.emit('bidUpdate', { currentBid, highestBidder, newBid, teamPoints });

      console.log(`💸 ${user}님이 ${bid}원 입찰 (${time})${chance ? ' [찬스권]' : ''}`);
    } else {
      socket.emit('bidRejected', { message: '입찰가가 현재가보다 낮습니다.' });
    }
  });

  // 낙찰 처리
  socket.on('declareWinner', () => {
    if (highestBidder && TEAM_NAMES.includes(highestBidder)) {
      teamPoints[highestBidder] -= currentBid;
      if (teamPoints[highestBidder] < 0) {
        teamPoints[highestBidder] = 0;
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
    } else {
      socket.emit('bidRejected', { message: '낙찰처리 불가 - 유효한 낙찰자가 없습니다.' });
    }
  });

  // 관리자 카운트다운 시작 이벤트 (예: 5초, 3초)
  socket.on('countdownStart', ({ seconds }) => {
    io.emit('countdownStart', { seconds });
    console.log(`⏳ 카운트다운 시작: ${seconds}초`);

    if (countdownTimer) clearTimeout(countdownTimer);

    countdownTimer = setTimeout(() => {
      // 카운트다운 종료 시점에 입찰로그 공개 이벤트 전송
      io.emit('revealBidLog', { bidHistory });
      console.log('🔔 카운트다운 종료 - 입찰 로그 공개');
    }, seconds * 1000);
  });

  socket.on('resetAll', () => {
    auctionResults = [];
    currentItem = null;
    currentBid = 0;
    highestBidder = null;
    bidHistory = [];

    teamPoints = {};
    TEAM_NAMES.forEach(name => {
    teamPoints[name] = INITIAL_POINTS;
  });


    io.emit('auctionResults', auctionResults);
    io.emit('resetAuction'); // 기존 초기화도 유지
    io.emit('bidInit', { currentBid, highestBidder, bidHistory, currentItem, teamPoints }); // 포인트 포함 초기 데이터 전송

    console.log('🔄 전체 초기화: 낙찰 기록 및 포인트 리셋됨');
  });


  socket.on('disconnect', () => {
    console.log(`❌ 사용자 퇴장: ${socket.id}`);
  });
});

const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 경매 서버 실행 중: http://0.0.0.0:${PORT}`);
});
