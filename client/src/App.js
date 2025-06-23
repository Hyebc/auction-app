import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';

const socket = io('http://63.246.112.245:3000');

const TEAM_COUNT = 11;
const INITIAL_POINTS = 1000;

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

  // 팀별 잔여 포인트 상태 (team1 ~ team11)
  // 초기값 1000 포인트로 세팅
  const [teamPoints, setTeamPoints] = useState(
    Array(TEAM_COUNT).fill(INITIAL_POINTS)
  );

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
    socket.on('bidInit', ({ currentBid, highestBidder, bidHistory, currentItem, teamPoints: serverTeamPoints }) => {
      setCurrentBid(currentBid);
      setHighestBidder(highestBidder);
      setBidHistory(bidHistory);
      setCurrentItem(currentItem);

      if (serverTeamPoints && Array.isArray(serverTeamPoints)) {
        setTeamPoints(serverTeamPoints);
      }
    });

    socket.on('bidUpdate', ({ currentBid, highestBidder, newBid, teamPoints: serverTeamPoints }) => {
      setCurrentBid(currentBid);
      setHighestBidder(highestBidder);
      setBidHistory(prev => [...prev, newBid]);

      if (serverTeamPoints && Array.isArray(serverTeamPoints)) {
        setTeamPoints(serverTeamPoints);
      }
    });

    socket.on('bidRejected', ({ message }) => setMessage(message));

    socket.on('auctionEnded', ({ winner, price, itemName, teamPoints: serverTeamPoints }) => {
      alert(`🎉 ${itemName}의 낙찰자: ${winner}, 금액: ${price.toLocaleString()} 포인트`);
      setCurrentBid(0);
      setHighestBidder(null);
      setBidHistory([]);
      setCurrentItem(null);
      setPlayerIntro('');

      if (serverTeamPoints && Array.isArray(serverTeamPoints)) {
        setTeamPoints(serverTeamPoints);
      }
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

    // 팀명에서 팀번호 추출 (예: 팀3 -> 3)
    const teamNumber = parseInt(username.replace(/[^0-9]/g, ''), 10);
    if (isNaN(teamNumber) || teamNumber < 1 || teamNumber > TEAM_COUNT) {
      setMessage('유효한 팀명을 입력하세요 (예: 팀1)');
      return;
    }

    // 잔여 포인트 체크
    if (teamPoints[teamNumber - 1] < bidValue) {
      setMessage('잔여 포인트가 부족합니다.');
      return;
    }

    // 서버에 입찰 정보와 팀번호 함께 보냄
    socket.emit('placeBid', { bid: bidValue, user: username, teamNumber });

    setBidInput('');
    setMessage('');
  };

  const increaseBid = (amount) => {
    let currentVal = Number(bidInput) || currentBid;
    setBidInput(String(currentVal + amount));
  };

  const startAuction = () => {
    if (!itemInput.trim()) return;
    socket.emit('startAuction', itemInput.trim());
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
      <div style={{ padding: 40, textAlign: 'center', fontFamily: "'Nanum Square', sans-serif" }}>
        <h2>멸망전 경매 로그인</h2>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 30, marginTop: 30 }}>
          <div style={{ flex: 1, maxWidth: 250 }}>
            <h3>팀장명 (팀1 ~ 팀11)</h3>
            <input
              type="text"
              placeholder="팀장명 입력 (예: 팀1)"
              onChange={e => setUsername(e.target.value)}
              style={{ width: '100%', padding: 10, fontSize: 16, borderRadius: 4, border: '1px solid #ccc' }}
            />
            <button
              onClick={() => setUsername(username.trim())}
              disabled={!username.trim()}
              style={{
                marginTop: 15,
                width: '100%',
                padding: 10,
                fontSize: 16,
                borderRadius: 4,
                backgroundColor: username.trim() ? '#007bff' : '#ccc',
                color: 'white',
                border: 'none',
                cursor: username.trim() ? 'pointer' : 'not-allowed',
              }}
            >
              로그인
            </button>
          </div>

          <div style={{ flex: 1, maxWidth: 250 }}>
            <h3>관리자 로그인</h3>
            <AdminLogin onAdminLogin={handleLogin} message={message} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', fontFamily: "'Nanum Square', sans-serif", padding: 20, gap: 20 }}>
      {/* 좌측: 팀별 잔여 포인트 및 낙찰 선수 */}
      <div style={{ flex: 1.5, minWidth: 300 }}>
        <h3>🏆 팀별 낙찰 현황</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {teamPoints.map((points, idx) => {
            // 해당 팀 낙찰 선수 및 가격 찾기
            const teamUserPrefix = `팀${idx + 1}`;
            const teamResult = auctionResults.find(r => r.user.startsWith(teamUserPrefix)) || null;
            return (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  border: '1px solid #ccc',
                  borderRadius: 6,
                  padding: 10,
                  width: '48%',
                  alignItems: 'center',
                  gap: 10,
                  backgroundColor: '#fafafa',
                }}
              >
                {/* 팀 잔여 포인트 박스 */}
                <div
                  style={{
                    minWidth: 100,
                    backgroundColor: '#007bff',
                    color: 'white',
                    padding: '10px 12px',
                    borderRadius: 6,
                    textAlign: 'center',
                    fontWeight: 'bold',
                  }}
                  title={`팀${idx + 1} 잔여 포인트`}
                >
                  팀{idx + 1}<br />
                  {points.toLocaleString()}P
                </div>

                {/* 낙찰 선수 및 금액 */}
                <div style={{ flex: 1 }}>
                  <div><strong>낙찰 선수:</strong> {teamResult ? teamResult.item : '없음'}</div>
                  <div><strong>금액:</strong> {teamResult ? teamResult.price.toLocaleString() + 'P' : '-'}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 가운데: 선수 소개 및 입찰 로그 */}
      <div style={{ flex: 2, minWidth: 400 }}>
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

      {/* 우측: 실시간 입찰 UI */}
      <div style={{ flex: 1, minWidth: 280 }}>
        <h3>⚡ 실시간 입찰</h3>
        <p>현재 입찰가: <strong>{currentBid.toLocaleString()} P</strong></p>
        <p>최고 입찰자: {highestBidder || '없음'}</p>

        {!isAdminVerified ? (
          <>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button
                onClick={() => increaseBid(10)}
                style={{ padding: '6px 12px', fontSize: 14, minWidth: 50 }}
                type="button"
              >
                +10
              </button>
              <button
                onClick={() => increaseBid(50)}
                style={{ padding: '6px 12px', fontSize: 14, minWidth: 50 }}
                type="button"
              >
                +50
              </button>
              <button
                onClick={() => increaseBid(100)}
                style={{ padding: '6px 12px', fontSize: 14, minWidth: 60 }}
                type="button"
              >
                +100
              </button>

              <input
                type="number"
                value={bidInput}
                onChange={e => setBidInput(e.target.value)}
                placeholder="입찰가"
                style={{ padding: 8, width: '60%', marginLeft: 10 }}
              />
              <button
                onClick={placeBid}
                style={{ padding: '8px 16px', marginLeft: 10, fontSize: 16 }}
              >
                입찰
              </button>
            </div>
          </>
        ) : (
          <>
            <input
              value={itemInput}
              onChange={e => setItemInput(e.target.value)}
              placeholder="입찰 선수 ID"
              style={{ padding: 8, width: '80%', marginTop: 10 }}
            />
            <button onClick={startAuction} style={{ marginTop: 10, padding: 8 }}>입찰 시작</button>
            <button onClick={declareWinner} style={{ marginTop: 10, padding: 8 }}>낙찰 처리</button>
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

// 관리자 로그인 컴포넌트 분리
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
        style={{ width: '100%', padding: 10, marginBottom: 12, fontSize: 16, borderRadius: 4, border: '1px solid #ccc' }}
      />
      <input
        type="password"
        placeholder="비밀번호"
        value={adminPass}
        onChange={e => setAdminPass(e.target.value)}
        style={{ width: '100%', padding: 10, marginBottom: 20, fontSize: 16, borderRadius: 4, border: '1px solid #ccc' }}
      />
      <button
        onClick={() => onAdminLogin(adminId, adminPass)}
        disabled={!adminId.trim() || !adminPass.trim()}
        style={{
          width: '100%',
          padding: 12,
          fontSize: 16,
          borderRadius: 4,
          border: 'none',
          backgroundColor: adminId.trim() && adminPass.trim() ? '#d9534f' : '#ccc',
          color: 'white',
          cursor: adminId.trim() && adminPass.trim() ? 'pointer' : 'not-allowed',
        }}
      >
        관리자 로그인
      </button>
      {message && (
        <p style={{ color: 'red', marginTop: 12, fontWeight: 'bold' }}>{message}</p>
      )}
    </div>
  );
}

export default App;
