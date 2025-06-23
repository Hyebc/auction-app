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
  const [chanceUsed, setChanceUsed] = useState(Array(TEAM_COUNT).fill(false));
  const [chanceActive, setChanceActive] = useState(false);
  const [playerOptions, setPlayerOptions] = useState([]);

  useEffect(() => {
    fetch('https://docs.google.com/spreadsheets/d/1drXfs4FJSbgh_OVzMnE2_2nuOkTJNnO8domunPmCgrA/gviz/tq?tqx=out:json')
      .then(res => res.text())
      .then(text => {
        const json = JSON.parse(text.substring(47).slice(0, -2));
        const rows = json.table.rows;
        const options = rows.map(r => r.c[0]?.v).filter(Boolean);
        setPlayerOptions(options);
      });
  }, []);

  useEffect(() => {
    if (!currentItem) {
      setPlayerIntro('');
      return;
    }
    fetch('https://docs.google.com/spreadsheets/d/1drXfs4FJSbgh_OVzMnE2_2nuOkTJNnO8domunPmCgrA/gviz/tq?tqx=out:json')
      .then(res => res.text())
      .then(text => {
        const json = JSON.parse(text.substring(47).slice(0, -2));
        const rows = json.table.rows;
        const row = rows.find(r => r.c[0]?.v === currentItem);
        setPlayerIntro(row?.c[1]?.v || '등록된 소개글이 없습니다.');
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
      setPlayerOptions(prev => prev.filter(item => item !== itemName));
    });

    socket.on('auctionStarted', ({ itemName }) => {
      setCurrentItem(itemName);
      setCurrentBid(0);
      setHighestBidder(null);
      setBidHistory([]);
      setMessage('');
      setChanceActive(false);
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
    const teamNumber = parseInt(username.replace(/[^0-9]/g, ''), 10);
    if (!bidValue || bidValue <= currentBid) return setMessage('입찰가는 현재가보다 높아야 합니다.');
    if (isNaN(teamNumber) || teamNumber < 1 || teamNumber > TEAM_COUNT) return setMessage('유효한 팀명을 입력하세요.');
    if (teamPoints[teamNumber - 1] < bidValue) return setMessage('잔여 포인트가 부족합니다.');
    socket.emit('placeBid', {
      bid: bidValue,
      user: username,
      teamNumber,
      chance: chanceActive && !chanceUsed[teamNumber - 1],
    });
    if (chanceActive && !chanceUsed[teamNumber - 1]) {
      const updated = [...chanceUsed];
      updated[teamNumber - 1] = true;
      setChanceUsed(updated);
    }
    setChanceActive(false);
    setBidInput('');
    setMessage('');
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

  if (!username) {
    return (
      <div style={{ padding: 40, textAlign: 'center', fontFamily: 'Nanum Square' }}>
        <h2>멸망전 경매 로그인</h2>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 30, marginTop: 30 }}>
          <div style={{ flex: 1, maxWidth: 250 }}>
            <h3>팀장명</h3>
            <input type="text" placeholder="팀장명 입력 (예: 팀1)" value={loginInput} onChange={e => setLoginInput(e.target.value)} style={{ width: '100%', padding: 10 }} />
            <button onClick={() => setUsername(loginInput.trim())} disabled={!loginInput.trim()} style={{ marginTop: 10, width: '100%', padding: 10 }}>로그인</button>
          </div>
          <div style={{ flex: 1, maxWidth: 250 }}>
            <h3>관리자 로그인</h3>
            <AdminLogin onAdminLogin={handleLogin} message={message} />
          </div>
        </div>
        <div style={{ fontSize: 14, color: '#777', marginTop: 30 }}>Created by Been.</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', fontFamily: 'Nanum Square', padding: 20, gap: 10 }}>
      <div style={{ flex: '1 1 350px', maxWidth: 400 }}>
        <h3>🏆 팀별 낙찰 현황</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {teamPoints.map((points, idx) => {
            const teamUserPrefix = `팀${idx + 1}`;
            const teamResults = auctionResults.filter(r => r.user.startsWith(teamUserPrefix));
            return (
              <div key={idx} style={{ background: '#fff', borderRadius: 8, padding: 8, fontSize: 13, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <div style={{ fontWeight: 'bold' }}>팀{idx + 1} | {points.toLocaleString()}P</div>
                {teamResults.length === 0 ? (
                  <div style={{ color: '#999' }}>낙찰 없음</div>
                ) : (
                  <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                    {teamResults.map((r, i) => (
                      <li key={i} style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>{r.item}</span>
                        <span>{r.price.toLocaleString()}P</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ flex: '2 1 500px', minWidth: 300 }}>
        <h3>⚡ 실시간 입찰</h3>
        <p>현재 입찰가: <strong>{currentBid.toLocaleString()} P</strong></p>
        <p>최고 입찰자: {highestBidder || '없음'}</p>
        {!isAdminVerified ? (
          <>
            <div style={{ display: 'flex', gap: 5 }}>
              <input type="number" value={bidInput} onChange={e => setBidInput(e.target.value)} style={{ flex: 1 }} />
              <button onClick={placeBid}>입찰</button>
            </div>
            <div>
              <button onClick={() => setChanceActive(true)} disabled={chanceUsed[parseInt(username.replace(/[^0-9]/g, ''), 10) - 1]}>
                찬스권 사용
              </button>
              {chanceActive && <span style={{ color: 'red', marginLeft: 8 }}>🃏 찬스권 활성화됨</span>}
            </div>
          </>
        ) : (
          <>
            <select value={itemInput} onChange={e => setItemInput(e.target.value)} style={{ padding: 8 }}>
              <option value="">선수 선택</option>
              {playerOptions.map((opt, i) => (
                <option key={i} value={opt}>{opt}</option>
              ))}
            </select>
            <button onClick={startAuction}>입찰 시작</button>
            <button onClick={declareWinner}>낙찰 처리</button>
            <button onClick={resetAuction} style={{ backgroundColor: '#f33', color: 'white' }}>초기화</button>
          </>
        )}

        <div>
          <h4>🎯 선수 소개</h4>
          <p><strong>{currentItem}</strong></p>
          <p style={{ whiteSpace: 'pre-line' }}>{playerIntro}</p>
        </div>

        <div>
          <h4>📜 입찰 로그</h4>
          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            {bidHistory.length === 0 ? '입찰 기록 없음' : bidHistory.map((b, i) => (
              <div key={i}>{b.time} - {b.user}: {b.bid.toLocaleString()}P</div>
            ))}
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
      <input type="text" placeholder="관리자 ID" value={adminId} onChange={e => setAdminId(e.target.value)} style={{ width: '100%', padding: 10 }} />
      <input type="password" placeholder="비밀번호" value={adminPass} onChange={e => setAdminPass(e.target.value)} style={{ width: '100%', padding: 10, marginTop: 10 }} />
      <button onClick={() => onAdminLogin(adminId, adminPass)} style={{ width: '100%', padding: 12, backgroundColor: '#d9534f', color: 'white', marginTop: 10 }}>
        관리자 로그인
      </button>
      {message && <p style={{ color: 'red' }}>{message}</p>}
    </div>
  );
}

export default App;
