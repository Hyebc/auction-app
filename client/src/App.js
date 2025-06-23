import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';

const socket = io('http://63.246.112.245:3000');

const TEAM_COUNT = 11;
const INITIAL_POINTS = 1000;

function App() {
  const [username, setUsername] = useState('');
  const [loginInput, setLoginInput] = useState('');
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
  const [teamPoints, setTeamPoints] = useState(Array(TEAM_COUNT).fill(INITIAL_POINTS));

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
    socket.on('bidInit', ({ currentBid, highestBidder, bidHistory, currentItem, teamPoints: serverTeamPoints }) => {
      setCurrentBid(currentBid);
      setHighestBidder(highestBidder);
      setBidHistory(bidHistory);
      setCurrentItem(currentItem);
      if (Array.isArray(serverTeamPoints)) setTeamPoints(serverTeamPoints);
    });

    socket.on('bidUpdate', ({ currentBid, highestBidder, newBid, teamPoints: serverTeamPoints }) => {
      setCurrentBid(currentBid);
      setHighestBidder(highestBidder);
      setBidHistory(prev => [...prev, newBid]);
      if (Array.isArray(serverTeamPoints)) setTeamPoints(serverTeamPoints);
    });

    socket.on('bidRejected', ({ message }) => setMessage(message));

    socket.on('auctionEnded', ({ winner, price, itemName, teamPoints: serverTeamPoints }) => {
      alert(`🎉 ${itemName}의 낙찰자: ${winner}, 금액: ${price.toLocaleString()} 포인트`);
      setCurrentBid(0);
      setHighestBidder(null);
      setBidHistory([]);
      setCurrentItem(null);
      setPlayerIntro('');
      if (Array.isArray(serverTeamPoints)) setTeamPoints(serverTeamPoints);
    });

    socket.on('auctionStarted', ({ itemName }) => {
      setCurrentItem(itemName);
      setCurrentBid(0);
      setHighestBidder(null);
      setBidHistory([]);
      setMessage('');
      socket.emit('requestBidInit');
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
    const teamNumber = parseInt(username.replace(/[^0-9]/g, ''), 10);
    if (isNaN(teamNumber) || teamNumber < 1 || teamNumber > TEAM_COUNT) {
      return setMessage('유효한 팀명을 입력하세요 (예: 팀1)');
    }
    if (teamPoints[teamNumber - 1] < bidValue) return setMessage('잔여 포인트가 부족합니다.');
    socket.emit('placeBid', { bid: bidValue, user: username, teamNumber });
    setBidInput('');
    setMessage('');
  };

  const increaseBid = amount => {
    let currentVal = Number(bidInput) || currentBid;
    setBidInput(String(currentVal + amount));
  };

  const startAuction = () => {
    if (!itemInput.trim()) return;
    socket.emit('startAuction', itemInput.trim());
    socket.emit('requestBidInit');
    setItemInput('');
  };

  const declareWinner = () => socket.emit('declareWinner');
  const resetAuction = () => window.location.reload();

  const handleLogin = (id, pass) => {
    if (id === 'admin' && pass === 'zigops_25') {
      setUsername('admin');
      setIsAdminVerified(true);
      setMessage('');
    } else {
      setMessage('관리자 인증 실패');
    }
  };

  // 로그인 전 화면
  if (!username) {
    return (
      <div style={{ padding: 40, textAlign: 'center', fontFamily: "'Nanum Square', sans-serif" }}>
        <h2>멸망전 경매 로그인</h2>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 30, marginTop: 30 }}>
          {/* 팀장 로그인 영역 */}
          <div style={{ flex: 1, maxWidth: 250 }}>
            <h3>팀장명</h3>
            <input
              type="text"
              placeholder="팀장명 입력 (예: 팀1)"
              value={loginInput}
              onChange={e => setLoginInput(e.target.value)}
              style={{ width: '100%', padding: 10, boxSizing: 'border-box' }}
            />
            <button
              onClick={() => setUsername(loginInput.trim())}
              disabled={!loginInput.trim()}
              style={{ marginTop: 10, width: '100%', padding: 10 }}
            >
              로그인
            </button>
          </div>

          {/* 관리자 로그인 영역 */}
          <div style={{ flex: 1, maxWidth: 250 }}>
            <h3>관리자 로그인</h3>
            <AdminLogin onAdminLogin={handleLogin} message={message} />
          </div>
        </div>
      
          {/* 하단 문구 */}
          <div style={{ fontSize: 14, color: '#777', marginTop: 30 }}>
          Created by Been.</div>
      </div>
    );
   }

  // 로그인 후 메인 화면
  return (
    <div style={{ display: 'flex', fontFamily: "'Nanum Square', sans-serif", padding: 20, gap: 20, height: '100vh' }}>
      <div style={{ flex: 1.5, minWidth: 300, overflowY: 'auto' }}>
        <h3>🏆 팀별 낙찰 현황</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {teamPoints.map((points, idx) => {
            const teamUserPrefix = `팀${idx + 1}`;
            const teamResults = auctionResults.filter(r => r.user.startsWith(teamUserPrefix));
            return (
              <div
                key={idx}
                style={{
                  borderRadius: 12,
                  backgroundColor: '#ffffffcc',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                  padding: '16px',
                  backdropFilter: 'blur(6px)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  transition: 'transform 0.2s ease',
                }}
              >
                <div
                  style={{
                    fontSize: '18px',
                    fontWeight: '700',
                    color: '#333',
                    backgroundColor: '#e8f0fe',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    textAlign: 'center',
                  }}
                >
                  팀 {idx + 1} | 💰 {points.toLocaleString()} P
                </div>

                <div style={{ padding: '6px 12px' }}>
                  {teamResults.length === 0 ? (
                    <div style={{ color: '#999', fontStyle: 'italic' }}>낙찰 선수 없음</div>
                  ) : (
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                      {teamResults.map((r, i) => (
                        <li
                          key={i}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            padding: '4px 0',
                            borderBottom: '1px dashed #ddd',
                            fontWeight: '500',
                          }}
                        >
                          <span>{r.item}</span>
                          <span style={{ fontWeight: '600' }}>{r.price.toLocaleString()}P</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div
        style={{
          flex: 1,
          minWidth: 320,
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
          height: '100%',
          overflow: 'hidden',
        }}
      >
        <div style={{ flexShrink: 0 }}>
          <h3>⚡ 실시간 입찰</h3>
          <p>
            현재 입찰가: <strong>{currentBid.toLocaleString()} P</strong>
          </p>
          <p>최고 입찰자: {highestBidder || '없음'}</p>
          {!isAdminVerified ? (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <button onClick={() => increaseBid(10)}>+10</button>
              <button onClick={() => increaseBid(50)}>+50</button>
              <button onClick={() => increaseBid(100)}>+100</button>
              <input
                type="number"
                value={bidInput}
                onChange={e => setBidInput(e.target.value)}
                placeholder="입찰가"
                style={{ padding: 8, width: '60%' }}
              />
              <button onClick={placeBid}>입찰</button>
            </div>
          ) : (
            <>
              <input
                value={itemInput}
                onChange={e => setItemInput(e.target.value)}
                placeholder="입찰 선수 ID"
                style={{ padding: 8, width: '80%', marginTop: 10 }}
              />
              <button onClick={startAuction}>입찰 시작</button>
              <button onClick={declareWinner}>낙찰 처리</button>
              <button
                onClick={resetAuction}
                style={{ backgroundColor: '#f33', color: 'white' }}
              >
                경매 초기화
              </button>
            </>
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          <h3>🎯 입찰 선수 소개</h3>
          {currentItem ? (
            <div>
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
      </div>
    </div>
  );
}

function AdminLogin({ onAdminLogin, message }) {
  const [adminId, setAdminId] = useState('');
  const [adminPass, setAdminPass] = useState('');

  return (
    <div style={{ textAlign: 'center' }}>
      <input
        type="text"
        placeholder="관리자 ID"
        value={adminId}
        onChange={e => setAdminId(e.target.value)}
        style={{ width: '100%', padding: 10, marginBottom: 12, boxSizing: 'border-box' }}
      />
      <input
        type="password"
        placeholder="비밀번호"
        value={adminPass}
        onChange={e => setAdminPass(e.target.value)}
        style={{ width: '100%', padding: 10, marginBottom: 20, boxSizing: 'border-box' }}
      />
      <button
        onClick={() => onAdminLogin(adminId, adminPass)}
        disabled={!adminId.trim() || !adminPass.trim()}
        style={{
          width: '100%',
          padding: 12,
          backgroundColor: adminId.trim() && adminPass.trim() ? '#d9534f' : '#ccc',
          color: 'white',
          border: 'none',
        }}
      >
        관리자 로그인
      </button>
      {message && <p style={{ color: 'red', marginTop: 12 }}>{message}</p>}
    </div>
  );
}

export default App;
