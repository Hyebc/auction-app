import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';

const socket = io('http://63.246.112.245:3000');

function App() {
  const [username, setUsername] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [currentBid, setCurrentBid] = useState(0);
  const [highestBidder, setHighestBidder] = useState(null);
  const [bidInput, setBidInput] = useState('');
  const [message, setMessage] = useState('');
  const [bidHistory, setBidHistory] = useState([]);
  const [auctionEnded, setAuctionEnded] = useState(false);
  const [winnerInfo, setWinnerInfo] = useState(null);

  useEffect(() => {
    socket.on('bidInit', ({ currentBid, highestBidder, bidHistory }) => {
      setCurrentBid(currentBid);
      setHighestBidder(highestBidder);
      setBidHistory(bidHistory);
      setAuctionEnded(false);
      setWinnerInfo(null);
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
      setAuctionEnded(true);
      setWinnerInfo({ winner, price });
      setMessage(`경매 종료! 낙찰자: ${winner}, 낙찰가: ${price.toLocaleString()} 원`);
      // 초기화 화면 보여주거나 추가 동작 가능
    });

    return () => {
      socket.off('bidInit');
      socket.off('bidUpdate');
      socket.off('bidRejected');
      socket.off('auctionEnded');
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
    if (auctionEnded) {
      setMessage('경매가 종료되었습니다.');
      return;
    }

    socket.emit('placeBid', { bid: bidValue, user: username });
    setBidInput('');
  };

  const declareWinner = () => {
    socket.emit('declareWinner');
  };

  return (
    <div style={{ maxWidth: 500, margin: '50px auto', textAlign: 'center', fontFamily: 'Arial' }}>
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
            onClick={() => setUsername(nameInput.trim())}
            style={{ padding: '8px 16px', marginLeft: 8, fontSize: 16 }}
          >
            확인
          </button>
        </div>
      ) : (
        <>
          <h1>실시간 경매</h1>
          <p>안녕하세요, <strong>{username}</strong>님!</p>
          <p>현재 입찰가: <strong>{currentBid.toLocaleString()} 원</strong></p>
          <p>최고 입찰자: {highestBidder || '없음'}</p>

          <input
            type="number"
            value={bidInput}
            onChange={(e) => setBidInput(e.target.value)}
            placeholder="입찰가 입력"
            style={{ padding: 8, width: '60%', fontSize: 16 }}
            disabled={auctionEnded}
          />
          <button
            onClick={placeBid}
            style={{ padding: '8px 16px', marginLeft: 8, fontSize: 16 }}
            disabled={auctionEnded}
          >
            입찰하기
          </button>

          {/* 관리자만 낙찰 버튼 노출 */}
          {username.toLowerCase() === 'admin' && !auctionEnded && (
            <div style={{ marginTop: 20 }}>
              <button
                onClick={declareWinner}
                style={{ padding: '10px 20px', backgroundColor: '#4CAF50', color: 'white', border: 'none', cursor: 'pointer' }}
              >
                낙찰 처리하기
              </button>
            </div>
          )}

          {message && <p style={{ color: auctionEnded ? 'green' : 'red' }}>{message}</p>}

          {auctionEnded && winnerInfo && (
            <p style={{ color: 'blue', fontWeight: 'bold' }}>
              🎉 경매가 종료되었습니다! 낙찰자: {winnerInfo.winner}, 낙찰가: {winnerInfo.price.toLocaleString()} 원
            </p>
          )}

          <h3>입찰 내역</h3>
          <ul style={{ textAlign: 'left', padding: 0, listStyle: 'none', maxHeight: 200, overflowY: 'auto' }}>
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
