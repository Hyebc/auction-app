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

const TEAM_COUNT = 11;
const INITIAL_POINTS = 1000;

let currentBid = 0;
let highestBidder = null;
let bidHistory = [];
let currentItem = null;

let auctionResults = [];
let teamPoints = Array(TEAM_COUNT).fill(INITIAL_POINTS);
let bidRecords = []; // { bid, user, teamNumber, chance, time }
let chanceUsed = Array(TEAM_COUNT).fill(false);

io.on('connection', (socket) => {
  console.log(`✅ 사용자 접속: ${socket.id}`);

  socket.emit('bidInit', { currentBid, highestBidder, bidHistory, currentItem, teamPoints });
  socket.emit('auctionResults', auctionResults);

  socket.on('startAuction', (itemName) => {
    currentItem = itemName;
    currentBid = 0;
    highestBidder = null;
    bidHistory = [];
    bidRecords = [];
    io.emit('auctionStarted', { itemName });
    console.log(`📦 입찰 시작: ${itemName}`);
  });

  socket.on('placeBid', ({ bid, user, teamNumber, chance }) => {
    const time = new Date().toLocaleTimeString();

    if (typeof teamNumber !== 'number' || teamNumber < 1 || teamNumber > TEAM_COUNT) {
      socket.emit('bidRejected', { message: '유효하지 않은 팀 번호입니다.' });
      return;
    }

    if (teamPoints[teamNumber - 1] < bid) {
      socket.emit('bidRejected', { message: '잔여 포인트가 부족합니다.' });
      return;
    }

    if (bid <= currentBid) {
      socket.emit('bidRejected', { message: '입찰가가 현재가보다 낮습니다.' });
      return;
    }

    currentBid = bid;
    highestBidder = user;

    const newBid = { bid, user, time };
    bidHistory.push(newBid);
    bidRecords.push({ bid, user, teamNumber, chance, time });

    if (chance && !chanceUsed[teamNumber - 1]) {
      chanceUsed[teamNumber - 1] = true;
    }

    io.emit('bidUpdate', { currentBid, highestBidder, newBid, teamPoints });
    console.log(`💸 ${user}님이 ${bid}원 입찰 (${time}) | 찬스: ${chance}`);
  });

  socket.on('declareWinner', () => {
    if (bidRecords.length === 0) return;

    bidRecords.sort((a, b) => {
      if (a.chance && !b.chance) return -1;
      if (!a.chance && b.chance) return 1;
      return b.bid - a.bid;
    });

    const winnerBid = bidRecords[0];
    const { user, bid, teamNumber } = winnerBid;

    if (!isNaN(teamNumber) && teamNumber >= 1 && teamNumber <= TEAM_COUNT) {
      teamPoints[teamNumber - 1] -= bid;
      if (teamPoints[teamNumber - 1] < 0) teamPoints[teamNumber - 1] = 0;
    }

    auctionResults.push({ user, item: currentItem, price: bid });

    io.emit('auctionEnded', {
      winner: user,
      price: bid,
      itemName: currentItem,
      teamPoints,
    });

    io.emit('auctionResults', auctionResults);

    console.log(`🎉 낙찰자: ${user}, 금액: ${bid}, 대상: ${currentItem}`);

    currentBid = 0;
    highestBidder = null;
    bidHistory = [];
    bidRecords = [];
    currentItem = null;
  });

  socket.on('disconnect', () => {
    console.log(`❌ 사용자 퇴장: ${socket.id}`);
  });
});

const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 경매 서버 실행 중: http://0.0.0.0:${PORT}`);
});
