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
  const [itemInput, setItemInput] = useState('');

  // 추가: 낙찰 목록 상태
  const [auctionResults, setAuctionResults] = useState([]);

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

    // 추가: 낙찰 목록 수신
    socket.on('auctionResults', (results) => {
      setAuctionResults(results);
    });

    return () => {
      socket.off('bidInit');
      socket.off('bidUpdate');
      socket.off('bidRejected');
      socket.off('auctionEnded');
      socket.off('auctionStarted');
      socket.off('auctionResults');
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
    <div style={{ maxWidth: 1200, margin: '20px auto', fontFamily: 'Arial' }}>
      {!username ? (
        <div style={{ textAlign: 'center' }}>
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
          {currentItem && (
            <h2 style={{ textAlign: 'center', fontSize: 28, marginBottom: 30 }}>
              🎯 현재 입찰 대상: <span style={{ color: '#007bff' }}>{currentItem}</span>
            </h2>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 40 }}>
            {/* 왼쪽: 낙찰 목록 */}
            <div style={{ width: '40%', maxHeight: '80vh', overflowY: 'auto' }}>
              <h3>🏆 낙찰 목록</h3>
              {auctionResults.length === 0 ? (
                <p>아직 낙찰된 아이템이 없습니다.</p>
              ) : (
                [...new Set(auctionResults.map(r => r.user))].map((user, idx) => {
                  const userItems = auctionResults.filter(r => r.user === user);
                  return (
                    <div key={idx} style={{ marginBottom: 20 }}>
                      <h4>{user}</h4>
                      <ul style={{ paddingLeft: 20 }}>
                        {userItems.map((item, i) => (
                          <li key={i}>
                            {item.item} - {item.price.toLocaleString()}원
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })
              )}
            </div>

            {/* 오른쪽: 기존 입찰 내역 및 인터페이스 */}
            <div style={{ width: '60%' }}>
              <h3>📦 입찰 내역</h3>
              {bidHistory.length === 0 ? (
                <p>아직 입찰이 없습니다.</p>
              ) : (
                <div>
                  {[...new Set(bidHistory.map((e) => e.user))].map((user, idx) => {
                    const userBids = bidHistory.filter((e) => e.user === user);
                    return (
                      <div key={idx} style={{ marginBottom: 20 }}>
                        <h4>{user}</h4>
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                          {userBids.slice(0, 4).map((bid, i) => (
                            <div
                              key={i}
                              style={{
                                background: '#f5f5f5',
                                padding: '6px 10px',
                                borderRadius: 6,
                                fontSize: 14,
                              }}
                            >
                              {bid.bid.toLocaleString()}원
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <h1>실시간 경매</h1>
              <p>👤 <strong>{username}</strong>님</p>
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

              {username === 'admin' && (
                <>
                  <br /><br />
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

              {message && <p style={{ color: 'red', marginTop: 10 }}>{message}</p>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default App;
