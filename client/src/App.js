import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';

const socket = io('http://63.246.112.245:3000');

function App() {
  const [username, setUsername] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [bidInput, setBidInput] = useState('');
  const [currentBid, setCurrentBid] = useState(0);
  const [highestBidder, setHighestBidder] = useState(null);
  const [bidHistory, setBidHistory] = useState([]);
  const [message, setMessage] = useState('');
  const [currentItem, setCurrentItem] = useState(null);

  // 관리자 전용: 입찰 대상 입력
  const [itemInput, setItemInput] = useState('');

  useEffect(() => {
    socket.on('bidInit', ({ currentBid, highestBidder, bidHistory, currentItem }) => {
      setCurrentBid(currentBid);
      setHighestBidder(highestBidder);
      setBidHistory(bidHistory);
      setCurrentItem(currentItem);
    });

    socket.on('bidUpdate', ({ currentBid, highestBidder, newBid }) => {
      setCurrentBid(currentBid);
      setHighestBidder(highestBidder);
      setBidHistory((prev) => [...prev, newBid]);
      setMessage('');
    });

    socket.on('bidRejected', ({ message }) => {
      setMessage(message);
    });

    socket.on('auctionEnded', ({ winner, price }) => {
      alert(`🎉 낙찰자: ${winner}, 금액: ${price.toLocaleString()}원`);
      setCurrentBid(0);
      setHighestBidder(null);
      setBidHistory([]);
      setCurrentItem(null);
    });

    socket.on('auctionStarted', ({ itemName }) => {
      setCurrentItem(itemName);
      setCurrentBid(0);
      setHighestBidder(null);
      setBidHistory([]);
      setMessage('');
    });

    return () => {
      socket.off('bidInit');
      socket.off('bidUpdate');
      socket.off('bidRejected');
      socket.off('auctionEnded');
      socket.off('auctionStarted');
    };
  }, []);

  const placeBid = () => {
    const bidValue = Number(bidInput);
    if (!bidValue || bidValue <= currentBid) {
      setMessage('입찰가는 현재 입찰가보다 높아야 합니다.');
      return;
    }
    if (!username) {
      setMessage('닉네임을 먼저 입력하세요.');
      return;
    }

    socket.emit('placeBid', { bid: bidValue, user: username });
    setBidInput('');
  };

  const declareWinner = () => {
    socket.emit('declareWinner');
  };

  const startAuction = () => {
    if (itemInput.trim() === '') return;
    socket.emit('startAuction', itemInput.trim());
    setItemInput('');
  };

  return (
    <div style={{ maxWidth: 600, margin: '50px auto', textAlign: 'center', fontFamily: 'Arial' }}>
      {!username ? (
        <div>
          <h2>사용자 이름을 입력하세요</h2>
          <input
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder="닉네임 입력"
            style={{ padding: 8, width: '60%', fontSize: 16 }}
          />
          <button
            onClick={() => setUsername(nameInput)}
            style={{ padding: '8px 16px', marginLeft: 8, fontSize: 16 }}
          >
            확인
          </button>
        </div>
      ) : (
        <>
          <h1>실시간 경매</h1>
          <p>👤 <strong>{username}</strong>님</p>
          {currentItem && <h2>🎯 현재 입찰 대상: {currentItem}</h2>}
          <p>💰 현재 입찰가: <strong>{currentBid.toLocaleString()} 원</strong></p>
          <p>👑 최고 입찰자: {highestBidder || '없음'}</p>

          <input
            type="number"
            value={bidInput}
            onChange={(e) => setBidInput(e.target.value)}
            placeholder="입찰가 입력"
            style={{ padding: 8, width: '60%', fontSize: 16 }}
          />
          <button
            onClick={placeBid}
            style={{ padding: '8px 16px', marginLeft: 8, fontSize: 16 }}
          >
            입찰하기
          </button>

          <br /><br />
          {username === 'admin' && (
            <>
              <input
                type="text"
                value={itemInput}
                onChange={(e) => setItemInput(e.target.value)}
                placeholder="입찰 대상 입력"
                style={{ padding: 8, width: '60%', fontSize: 16 }}
              />
              <button
                onClick={startAuction}
                style={{ padding: '8px 16px', marginLeft: 8, fontSize: 16 }}
              >
                입찰 시작
              </button>
              <br /><br />
              <button
                onClick={declareWinner}
                style={{ padding: '8px 16px', background: '#222', color: 'white', fontSize: 16 }}
              >
                🏁 낙찰 처리
              </button>
            </>
          )}

          {message && <p style={{ color: 'red' }}>{message}</p>}

          <h3>입찰 내역</h3>
          <ul style={{ textAlign: 'left', padding: 0, listStyle: 'none' }}>
            {bidHistory.map((entry, idx) => (
              <li key={idx} style={{ borderBottom: '1px solid #ccc', padding: '4px 0' }}>
                {entry.time} - <strong>{entry.user}</strong>님이 {entry.bid.toLocaleString()}원 입찰
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export default App;
