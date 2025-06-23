import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';

const socket = io('http://63.246.112.245:3000'); // 서버 주소

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
  const [playerIntro, setPlayerIntro] = useState('');
  const [auctionResults, setAuctionResults] = useState([]);

  // 로그인 관련 상태 (관리자 아이디/비번 입력용)
  const [adminId, setAdminId] = useState('');
  const [adminPass, setAdminPass] = useState('');

  // 선수 소개 fetch
  useEffect(() => {
    if (!currentItem) {
      setPlayerIntro('');
      return;
    }

    fetch(
      'https://docs.google.com/spreadsheets/d/1drXfs4FJSbgh_OVzMnE2_2nuOkTJNnO8domunPmCgrA/gviz/tq?tqx=out:json'
    )
      .then(res => res.text())
      .then(text => {
        const json = JSON.parse(text.substring(47).slice(0, -2));
        const rows = json.table.rows;

        const row = rows.find(r => r.c[0]?.v === currentItem);
        if (row && row.c[1]?.v) {
          setPlayerIntro(row.c[1].v);
        } else {
          setPlayerIntro('등록된 소개글이 없습니다.');
        }
      })
      .catch(() => setPlayerIntro('소개글을 불러오는 데 실패했습니다.'));
  }, [currentItem]);

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
      setBidHistory(prev => [...prev, newBid]);
    });

    socket.on('bidRejected', ({ message }) => setMessage(message));

    socket.on('auctionEnded', ({ winner, price, itemName }) => {
      alert(`🎉 ${itemName}의 낙찰자: ${winner}, 금액: ${price.toLocaleString()} 포인트`);
      setCurrentBid(0);
      setHighestBidder(null);
      setBidHistory([]);
      setCurrentItem(null);
      setPlayerIntro('');
    });

    socket.on('auctionStarted', ({ itemName }) => {
      setCurrentItem(itemName);
      setCurrentBid(0);
      setHighestBidder(null);
      setBidHistory([]);
      setMessage('');
    });

    socket.on('auctionResults', setAuctionResults);

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
    if (!bidValue || bidValue <= currentBid) return setMessage('입찰가는 현재가보다 높아야 합니다.');
    if (!username) return setMessage('닉네임을 먼저 입력하세요.');
    socket.emit('placeBid', { bid: bidValue, user: username });
    setBidInput('');
  };

  const startAuction = () => {
    if (!itemInput.trim()) return;
    socket.emit('startAuction', itemInput.trim());
    setItemInput('');
  };

  const declareWinner = () => socket.emit('declareWinner');
  const resetAuction = () => window.location.reload();

  const handleAdminLogin = () => {
    if (adminId === 'admin' && adminPass === 'zigops_25') {
      setUsername('admin');
      setIsAdminVerified(true);
      setMessage('');
    } else {
      setMessage('관리자 인증 실패');
    }
  };

  const handleUserLogin = () => {
    if (!username.trim()) {
      setMessage('닉네임을 입력하세요.');
      return;
    }
    setIsAdminVerified(false);
    setMessage('');
  };

  // 각 입찰자의 총 낙찰 포인트 합산 (잔여포인트 계산용)
  const pointsUsedByUser = auctionResults.reduce((acc, cur) => {
    acc[cur.user] = (acc[cur.user] || 0) + cur.price;
    return acc;
  }, {});

  // 잔여포인트 계산 (기본 1000P - 낙찰사용포인트)
  const getRemainingPoints = user => {
    const used = pointsUsedByUser[user] || 0;
    return 1000 - used;
  };

  if (!username) {
    return (
      <div
        style={{
          padding: 40,
          fontFamily: "'Nanum Square', sans-serif",
          display: 'flex',
          justifyContent: 'center',
          gap: 50,
          maxWidth: 600,
          margin: '0 auto',
        }}
      >
        {/* 좌측: 일반 사용자 로그인 */}
        <div
          style={{
            flex: 1,
            border: '1px solid #ccc',
            padding: 20,
            borderRadius: 8,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <h2 style={{ textAlign: 'center', marginBottom: 30 }}>멸망전 팀장명 로그인</h2>
          <input
            type="text"
            placeholder="팀장명 입력"
            value={username}
            onChange={e => setUsername(e.target.value)}
            style={{ width: '100%', padding: 10, fontSize: 16, marginBottom: 20 }}
            onKeyDown={e => {
              if (e.key === 'Enter') handleUserLogin();
            }}
          />
          <button
            onClick={handleUserLogin}
            style={{
              width: '100%',
              padding: 12,
              fontSize: 16,
              backgroundColor: '#4caf50',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            로그인
          </button>
        </div>

        {/* 우측: 관리자 로그인 */}
        <div
          style={{
            flex: 1,
            border: '1px solid #ccc',
            padding: 20,
            borderRadius: 8,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <h2 style={{ textAlign: 'center', marginBottom: 30 }}>관리자 로그인</h2>
          <input
            type="text"
            placeholder="관리자 ID"
            value={adminId}
            onChange={e => setAdminId(e.target.value)}
            style={{ width: '100%', padding: 10, fontSize: 16, marginBottom: 12 }}
            onKeyDown={e => {
              if (e.key === 'Enter') handleAdminLogin();
            }}
          />
          <input
            type="password"
            placeholder="비밀번호"
            value={adminPass}
            onChange={e => setAdminPass(e.target.value)}
            style={{ width: '100%', padding: 10, fontSize: 16, marginBottom: 20 }}
            onKeyDown={e => {
              if (e.key === 'Enter') handleAdminLogin();
            }}
          />
          <button
            onClick={handleAdminLogin}
            style={{
              width: '100%',
              padding: 12,
              fontSize: 16,
              backgroundColor: '#2196f3',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            관리자 로그인
          </button>
        </div>

        {/* 메시지 */}
        <div
          style={{
            position: 'absolute',
            bottom: 20,
            width: '100%',
            textAlign: 'center',
            color: 'red',
            fontFamily: "'Nanum Square', sans-serif",
          }}
        >
          {message && <p>{message}</p>}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', fontFamily: "'Nanum Square', sans-serif", padding: 20, gap: 20 }}>
      {/* 좌측: 낙찰 목록 (가로 한 줄, 넓이 확대) */}
      <div
        style={{
          flex: '3',
          minWidth: 300,
          overflowX: 'auto',
          whiteSpace: 'nowrap',
          paddingBottom: 10,
        }}
      >
        <h3 style={{ fontSize: '18px' }}>🏆 낙찰 현황</h3>
        {auctionResults.length === 0 ? (
          <p>낙찰 내역 없음</p>
        ) : (
          auctionResults.map(({ user, item, price }, i) => (
            <div
              key={i}
              style={{
                display: 'inline-block',
                background: '#eee',
                padding: 10,
                marginRight: 10,
                borderRadius: 6,
                minWidth: 180,
                verticalAlign: 'top',
                boxSizing: 'border-box',
                fontSize: 14,
              }}
              title={`${user} 선수: ${item}, 금액: ${price.toLocaleString()}P`}
            >
              <strong>
                {user} (잔여: {getRemainingPoints(user).toLocaleString()}P)
              </strong>
              <br />
              선수: {item}
              <br />
              금액: {price.toLocaleString()}P
            </div>
          ))
        )}
      </div>

      {/* 가운데: 선수 소개 및 입찰 로그 (좁게) */}
      <div style={{ flex: '1', minWidth: 250 }}>
        <h3>🎯 입찰 선수 소개</h3>
        {currentItem ? (
          <div style={{ marginBottom: 20 }}>
            <strong>{currentItem}</strong>
            <p style={{ whiteSpace: 'pre-line', fontSize: 14 }}>{playerIntro}</p>
          </div>
        ) : (
          <p>입찰 대상이 없습니다.</p>
        )}

        <h4>🕘 입찰 로그</h4>
        <div style={{ maxHeight: 200, overflowY: 'auto', background: '#fafafa', padding: 10 }}>
          {bidHistory.length === 0 ? (
            <p>입찰 기록 없음</p>
          ) : (
            bidHistory.map((b, i) => (
              <div key={i}>
                {b.time} - {b.user}: {b.bid.toLocaleString()}P
              </div>
            ))
          )}
        </div>
      </div>

      {/* 우측: 입찰 UI (너비 축소) */}
      <div style={{ flex: '0.8', minWidth: 260 }}>
        <h3>⚡ 실시간 입찰</h3>
        <p>
          현재 입찰가: <strong>{currentBid.toLocaleString()} P</strong>
        </p>
        <p>최고 입찰자: {highestBidder || '없음'}</p>

        {!isAdminVerified ? (
          <>
            <input
              type="number"
              value={bidInput}
              onChange={e => setBidInput(e.target.value)}
              placeholder="입찰가"
              style={{ padding: 8, width: '80%' }}
            />
            <button onClick={placeBid} style={{ padding: 8, marginLeft: 10 }}>
              입찰
            </button>
            <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
              <button
                onClick={() =>
                  setBidInput(prev => String(Number(prev || currentBid) + 10))
                }
                style={{ padding: '6px 12px', fontSize: 14 }}
              >
                +10
              </button>
              <button
                onClick={() =>
                  setBidInput(prev => String(Number(prev || currentBid) + 50))
                }
                style={{ padding: '6px 12px', fontSize: 14 }}
              >
                +50
              </button>
              <button
                onClick={() =>
                  setBidInput(prev => String(Number(prev || currentBid) + 100))
                }
                style={{ padding: '6px 12px', fontSize: 14 }}
              >
                +100
              </button>
            </div>
          </>
        ) : (
          <>
            <input
              value={itemInput}
              onChange={e => setItemInput(e.target.value)}
              placeholder="입찰 선수 ID"
              style={{ padding: 8, width: '80%' }}
            />
            <button onClick={startAuction} style={{ marginTop: 10, padding: 8 }}>
              입찰 시작
            </button>
            <button onClick={declareWinner} style={{ marginTop: 10, padding: 8 }}>
              낙찰 처리
            </button>
            <button
              onClick={resetAuction}
              style={{ marginTop: 10, padding: 8, backgroundColor: '#f33', color: 'white' }}
            >
              경매 초기화
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default App;
