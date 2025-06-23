import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';

const socket = io('http://63.246.112.245:3000');

function Login({ onUserLogin, onAdminLogin, message }) {
  const [userName, setUserName] = useState('');
  const [adminId, setAdminId] = useState('');
  const [adminPass, setAdminPass] = useState('');

  return (
    <div
      style={{
        display: 'flex',
        maxWidth: 600,
        margin: '50px auto',
        border: '1px solid #ddd',
        borderRadius: 8,
        overflow: 'hidden',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        fontFamily: 'Arial, sans-serif',
      }}
    >
      {/* 좌측 - 일반 사용자 로그인 */}
      <div
        style={{
          flex: 1,
          padding: 30,
          backgroundColor: '#f0f8ff',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <h2 style={{ marginBottom: 20 }}>멸망전 팀장명 입력</h2>
        <input
          type="text"
          placeholder="팀장명 입력"
          value={userName}
          onChange={(e) => setUserName(e.target.value)}
          style={{
            padding: 12,
            width: '80%',
            fontSize: 16,
            borderRadius: 4,
            border: '1px solid #ccc',
            marginBottom: 20,
          }}
        />
        <button
          onClick={() => onUserLogin(userName)}
          disabled={!userName.trim()}
          style={{
            padding: '10px 20px',
            fontSize: 16,
            borderRadius: 4,
            border: 'none',
            backgroundColor: '#007bff',
            color: 'white',
            cursor: userName.trim() ? 'pointer' : 'not-allowed',
          }}
        >
          로그인
        </button>
      </div>

      {/* 우측 - 관리자 로그인 */}
      <div
        style={{
          flex: 1,
          padding: 30,
          backgroundColor: '#fff0f0',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          borderLeft: '1px solid #ddd',
        }}
      >
        <h2 style={{ marginBottom: 20 }}>관리자 로그인</h2>
        <input
          type="text"
          placeholder="관리자 ID"
          value={adminId}
          onChange={(e) => setAdminId(e.target.value)}
          style={{
            padding: 12,
            width: '80%',
            fontSize: 16,
            borderRadius: 4,
            border: '1px solid #ccc',
            marginBottom: 12,
          }}
        />
        <input
          type="password"
          placeholder="비밀번호"
          value={adminPass}
          onChange={(e) => setAdminPass(e.target.value)}
          style={{
            padding: 12,
            width: '80%',
            fontSize: 16,
            borderRadius: 4,
            border: '1px solid #ccc',
            marginBottom: 20,
          }}
        />
        <button
          onClick={() => onAdminLogin(adminId, adminPass)}
          disabled={!adminId.trim() || !adminPass.trim()}
          style={{
            padding: '10px 20px',
            fontSize: 16,
            borderRadius: 4,
            border: 'none',
            backgroundColor: '#d9534f',
            color: 'white',
            cursor:
              adminId.trim() && adminPass.trim() ? 'pointer' : 'not-allowed',
          }}
        >
          관리자 로그인
        </button>
      </div>

      {/* 메시지 출력 */}
      {message && (
        <div
          style={{
            position: 'fixed',
            bottom: 30,
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: '#f44336',
            color: 'white',
            padding: '10px 20px',
            borderRadius: 6,
            fontWeight: 'bold',
            zIndex: 1000,
          }}
        >
          {message}
        </div>
      )}
    </div>
  );
}

function App() {
  const [username, setUsername] = useState('');
  const [isAdminVerified, setIsAdminVerified] = useState(false);
  const [message, setMessage] = useState('');

  const [bidInput, setBidInput] = useState('');
  const [currentBid, setCurrentBid] = useState(0);
  const [highestBidder, setHighestBidder] = useState(null);
  const [bidHistory, setBidHistory] = useState([]);
  const [currentItem, setCurrentItem] = useState(null);
  const [itemInput, setItemInput] = useState('');

  // **서버에서 내려주는 낙찰 결과 목록 상태**
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
      alert(`🎉 낙찰자: ${winner}, 금액: ${price.toLocaleString()}포인트`);
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

    // 서버에서 낙찰 결과를 받을 때 상태 갱신
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

  const resetAuction = () => {
    window.location.reload();
  };

  const handleUserLogin = (name) => {
    setUsername(name);
    setIsAdminVerified(false);
    setMessage('');
  };

  const handleAdminLogin = (id, pass) => {
    if (id === 'admin' && pass === 'zigops_25') {
      setUsername('admin');
      setIsAdminVerified(true);
      setMessage('');
    } else {
      setMessage('관리자 ID 또는 비밀번호가 올바르지 않습니다.');
    }
  };

  if (!username) {
    return (
      <Login
        onUserLogin={handleUserLogin}
        onAdminLogin={handleAdminLogin}
        message={message}
      />
    );
  }

  const sampleIconUrl = 'https://cdn-icons-png.flaticon.com/512/147/147144.png';

  return (
    <>
      <div style={{ maxWidth: 1200, margin: '20px auto', fontFamily: 'Arial', paddingBottom: 100 }}>
        {currentItem && (
          <h2 style={{ textAlign: 'center', fontSize: 28, marginBottom: 30 }}>
            🎯 현재 입찰 대상: <span style={{ color: '#007bff' }}>{currentItem}</span>
          </h2>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 40 }}>
          {/* 좌측 낙찰 목록 카드 UI */}
          <div
            style={{
              width: '40%',
              maxHeight: '80vh',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            <h3>🏆 낙찰 목록</h3>
            {auctionResults.length === 0 ? (
              <p>아직 낙찰된 내역이 없습니다.</p>
            ) : (
              auctionResults.map(({ user, price, item }, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: 12,
                    backgroundColor: '#f9f9f9',
                    borderRadius: 8,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  }}
                >
                  <img
                    src={sampleIconUrl}
                    alt="user icon"
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: '50%',
                      marginRight: 16,
                      objectFit: 'cover',
                    }}
                  />
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: 18 }}>{user}</div>
                    <div style={{ fontSize: 16, color: '#444' }}>
                      참가자: <strong>{item}</strong>
                    </div>
                    <div style={{ fontSize: 16, color: '#444' }}>
                      낙찰 금액: <strong>{price.toLocaleString()} 포인트</strong>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* 우측 기존 입찰 UI */}
          <div style={{ width: '60%' }}>
            <h1>실시간 경매</h1>
            <p>
              👤 <strong>{username}</strong>님
            </p>
            <p>
              💰 현재 입찰가: <strong>{currentBid.toLocaleString()} 포인트</strong>
            </p>
            <p>👑 최고 입찰자: {highestBidder || '없음'}</p>

            {/* 일반 사용자 UI */}
            {!isAdminVerified && (
              <>
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
              </>
            )}

            {/* 관리자 UI */}
            {isAdminVerified && (
              <>
                <br />
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

                <br />
                <br />
                <button
                  onClick={declareWinner}
                  style={{
                    padding: '8px 16px',
                    background: '#222',
                    color: 'white',
                    fontSize: 16,
                  }}
                >
                  🏁 낙찰 처리
                </button>

                <br />
                <br />
                <button
                  onClick={resetAuction}
                  style={{
                    padding: '8px 16px',
                    background: '#d33',
                    color: 'white',
                    fontSize: 16,
                    border: 'none',
                    borderRadius: 4,
                    cursor: 'pointer',
                  }}
                >
                  초기화 (경매 리셋)
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 하단 고정 낙찰 현황 */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: '#222',
          color: 'white',
          display: 'flex',
          overflowX: 'auto',
          padding: '10px 20px',
          boxShadow: '0 -2px 8px rgba(0,0,0,0.4)',
          zIndex: 9999,
          gap: 20,
          alignItems: 'center',
          fontFamily: 'Arial, sans-serif',
        }}
      >
        {auctionResults.length === 0 ? (
          <div>아직 낙찰된 내역이 없습니다.</div>
        ) : (
          auctionResults.map(({ user, price, item }, idx) => (
            <div
              key={idx}
              style={{
                whiteSpace: 'nowrap',
                padding: '6px 12px',
                backgroundColor: '#007bff',
                borderRadius: 6,
                fontWeight: 'bold',
                fontSize: 16,
                boxShadow: '0 0 8px rgba(0,123,255,0.7)',
                minWidth: 150,
                textAlign: 'center',
                userSelect: 'none',
              }}
              title={`${user}님의 낙찰 금액: ${price.toLocaleString()} 포인트, 참가자: ${item}`}
            >
              {user} <br />
              <span style={{ fontSize: 14 }}>{item}</span> <br />
              <span style={{ fontSize: 18 }}>{price.toLocaleString()} 포인트</span>
            </div>
          ))
        )}
      </div>
    </>
  );
}

export default App;
