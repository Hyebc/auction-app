const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());

app.use(express.static(path.join(__dirname, '../client/build')));

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

let teamPoints = {};
let chanceUsed = {};
let chanceBids = [];
TEAM_NAMES.forEach(name => {
  teamPoints[name] = INITIAL_POINTS;
  chanceUsed[name] = false;
});

let currentBid = 0;
let highestBidder = null;
let bidHistory = [];
let currentItem = null;
let auctionResults = [];
let countdownTimer = null;

io.on('connection', (socket) => {
  console.log(`✅ 사용자 접속: ${socket.id}`);

  socket.emit('bidInit', { currentBid, highestBidder, bidHistory, currentItem, teamPoints });
  socket.emit('auctionResults', auctionResults);

  socket.on('startAuction', (itemName) => {
    currentItem = itemName;
    currentBid = 0;
    highestBidder = null;
    bidHistory = [];
    chanceBids = [];

    io.emit('auctionStarted', { itemName });
    console.log(`📦 입찰 시작: ${itemName}`);
  });

  socket.on('placeBid', ({ bid, user, chance }) => {
    const time = new Date().toISOString();

    if (!TEAM_NAMES.includes(user)) {
      socket.emit('bidRejected', { message: '유효하지 않은 팀명입니다.' });
      return;
    }

    if (teamPoints[user] < bid) {
      socket.emit('bidRejected', { message: '잔여 포인트가 부족합니다.' });
      return;
    }

    if (chance) {
      if (chanceUsed[user]) {
        socket.emit('bidRejected', { message: '이미 찬스권을 사용했습니다.' });
        return;
      }

  // 입찰가 높이기 조건 검사 삭제 (이 부분을 없앰)

      chanceUsed[user] = true;

  // 기존 찬스권 입찰 제거 후 새 입찰 등록
      chanceBids = chanceBids.filter(b => b.user !== user);
      const newBid = { bid, user, time, chance: true };
      chanceBids.push({ user, bid, time });
      bidHistory.push(newBid);

  // 현재 찬스권 입찰 중 최고가 반영
      const bestChance = chanceBids.reduce((max, cur) => cur.bid > max.bid ? cur : max, chanceBids[0]);
      currentBid = bestChance.bid;
      highestBidder = bestChance.user;

      io.emit('bidUpdate', { currentBid, highestBidder, newBid, teamPoints, currentItem,serverChanceUsed: chanceUsed });
      console.log(`🃏 찬스권 입찰: ${user} ${bid}P`);
      return;
}



    if (bid > currentBid) {
      currentBid = bid;
      highestBidder = user;

      const newBid = { bid, user, time, chance: false };
      bidHistory.push(newBid);

      io.emit('bidUpdate', { currentBid, highestBidder, newBid, teamPoints });
      console.log(`💸 일반 입찰: ${user} ${bid}P`);
    } else {
      socket.emit('bidRejected', { message: '입찰가가 현재가보다 낮습니다.' });
    }
  });

  socket.on('declareWinner', () => {
    let winner = null;
    let finalPrice = 0;
    let isChance = false; // ✅ 추가


    if (chanceBids.length > 0) {
      const bestChance = chanceBids.reduce((max, cur) => cur.bid > max.bid ? cur : max, chanceBids[0]);
      winner = bestChance.user;
      finalPrice = bestChance.bid;
      isChance = true;

      chanceBids.forEach(bid => {
        if (bid.user !== winner) {
          chanceUsed[bid.user] = false; // 찬스권 환급
        }
    });
      chanceUsed[winner] = true;

    } else if (highestBidder) {
      winner = highestBidder;
      finalPrice = currentBid;
      isChance = false;
    }

    if (winner && TEAM_NAMES.includes(winner)) {
      teamPoints[winner] -= finalPrice;
      if (teamPoints[winner] < 0) teamPoints[winner] = 0;

      auctionResults.push({ user: winner, item: currentItem, price: finalPrice, chance: isChance });

      io.emit('bidUpdate', {
        currentBid: 0,
        highestBidder: null,
        newBid: null,
        teamPoints,
        currentItem: null,
        serverChanceUsed: chanceUsed
      });

      io.emit('auctionEnded', {
        winner,
        price: finalPrice,
        itemName: currentItem,
        teamPoints,
        serverChanceUsed: chanceUsed,
      });
      io.emit('auctionResults', auctionResults);
      console.log(`🎉 낙찰자: ${winner} - ${finalPrice}P (찬스: ${isChance})`);
    } else {
      chanceBids.forEach(bid => {
        chanceUsed[bid.user] = false;
      });

      io.emit('auctionEnded', {
        winner: null,
        price: 0,
        itemName: currentItem,
        teamPoints,
        serverChanceUsed: chanceUsed,
     });

      socket.emit('bidRejected', { message: '낙찰처리 불가 - 유효한 낙찰자가 없습니다.' });
    }

    // 초기화
    currentBid = 0;
    highestBidder = null;
    bidHistory = [];
    currentItem = null;
    chanceBids = [];
  });

  socket.on('countdownStart', ({ seconds }) => {
    io.emit('countdownStart', { seconds });
    console.log(`⏳ 카운트다운 시작: ${seconds}초`);

    if (countdownTimer) clearTimeout(countdownTimer);

    countdownTimer = setTimeout(() => {
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
    chanceBids = [];

    teamPoints = {};
    chanceUsed = {};
    TEAM_NAMES.forEach(name => {
      teamPoints[name] = INITIAL_POINTS;
      chanceUsed[name] = false;
    });

    io.emit('auctionResults', auctionResults);
    io.emit('resetAuction');
    io.emit('bidInit', { currentBid, highestBidder, bidHistory, currentItem, teamPoints, serverChanceUsed: chanceUsed });
    console.log('🔄 전체 초기화 완료');
  });

  socket.on('disconnect', () => {
    console.log(`❌ 사용자 퇴장: ${socket.id}`);
  });
});

const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 경매 서버 실행 중: http://0.0.0.0:${PORT}`);
});
