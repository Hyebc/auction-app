import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const socket = io('http://63.246.112.245:3000');

const TEAM_NAMES = [
  '김선생', '김꾸루꾸루', '아무무를왜했을까', '초록머리만쏴', '하온부',
  '첼린저서포터', '카이사홀릭', '도선생', '아쉬운척 미안한척', '배응칠', '열쇠조각2개'
];
const INITIAL_POINTS = 1000;
function UserBar({ username, logout }) {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      background: '#333',
      color: 'white',
      padding: '10px 20px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      zIndex: 1000,
      height: 50
    }}>
      <div>
        👤 사용자: <strong>{username}</strong>
      </div>
      <button
        onClick={logout}
        style={{
          background: 'white',
          color: '#333',
          padding: '5px 10px',
          cursor: 'pointer'
        }}
      >
        로그아웃
      </button>
    </div>
  );
}

function App() {
  // 상태값 선언
  const [username, setUsername] = useState('');
  const [loginInput, setLoginInput] = useState('');
  const [isAdminVerified, setIsAdminVerified] = useState(false);
  const [message, setMessage] = useState('');
  const [bidInput, setBidInput] = useState('');
  const [currentBid, setCurrentBid] = useState(0);
  const [highestBidder, setHighestBidder] = useState(null);
  const [bidHistory, setBidHistory] = useState([]);
  const [visibleBidHistory, setVisibleBidHistory] = useState([]);
  const [currentItem, setCurrentItem] = useState(null);
  const [itemInput, setItemInput] = useState('');
  const [playerIntro, setPlayerIntro] = useState('');
  const [auctionResults, setAuctionResults] = useState([]);
  const [teamPoints, setTeamPoints] = useState(
    TEAM_NAMES.reduce((acc, name) => ({ ...acc, [name]: INITIAL_POINTS }), {})
  );
  const [chanceUsed, setChanceUsed] = useState(
    TEAM_NAMES.reduce((acc, name) => ({ ...acc, [name]: false }), {})
  );
  const [chanceActive, setChanceActive] = useState(false);
  const [playerOptions, setPlayerOptions] = useState([]);
  const [countdown, setCountdown] = useState(null);

  const countdownInterval = useRef(null);
  const logout = () => {
    setUsername('');
    setIsAdminVerified(false);
    setMessage('');
  };
  const UserBar = () => (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0,
      background: '#333', color: 'white', padding: '10px 20px',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      zIndex: 1000, height: 50
    }}>
      <div>
        👤 사용자: <strong>{username}</strong>
      </div>
      <button onClick={logout} style={{ background: 'white', color: '#333', padding: '5px 10px', cursor: 'pointer' }}>
        로그아웃
      </button>
    </div>
  );



  // 구글 시트에서 선수 목록 로드 및 선수 소개 업데이트
  useEffect(() => {
    fetch(
      'https://docs.google.com/spreadsheets/d/1ZF0tki5AtPbwA3FR2nUjKvQqsh3-Rzgi72jFP0UcsZA/gviz/tq?tqx=out:json'
    )
      .then((res) => res.text())
      .then((text) => {
        try {
          const json = JSON.parse(text.substring(47).slice(0, -2));
          const rows = json.table.rows.slice(2, 57); // 선수 데이터 영역

          // 선수 이름 목록 추출
          const names = rows
            .map((r) => r.c[5]?.v)
            .filter(Boolean);
          const soldOutPlayers = auctionResults.map((r) => r.item);
          const availablePlayers = names.filter(
            (name) => !soldOutPlayers.includes(name)
          );
          setPlayerOptions(availablePlayers);

          if (!currentItem) {
            setPlayerIntro('');
            return;
          }

          // 현재 선택된 선수 소개 찾기
          const row = rows.find((r) => r.c[5]?.v === currentItem);
          if (!row) {
            setPlayerIntro('선수를 찾을 수 없습니다.');
            return;
          }

          const mainPos = row.c[9]?.v || '-';
          const subPos = row.c[10]?.v || '-';
          const champs = [row.c[11]?.v, row.c[12]?.v, row.c[13]?.v]
            .filter(Boolean)
            .join(', ') || '-';
          const msg = row.c[14]?.v || '등록된 참가자 소개글이 없습니다.';

          const formattedIntro =
            `🧭 주 포지션: ${mainPos}\n` +
            `🎯 부 포지션: ${subPos}\n` +
            `🧩 주력 챔피언: ${champs}\n\n` +
            `💬 참가자의 말:\n${msg}`;

          setPlayerIntro(formattedIntro);
        } catch (error) {
          console.error('JSON 파싱 오류:', error);
          setPlayerIntro('소개글을 불러오는 데 실패했습니다.');
        }
      })
      .catch(() => setPlayerIntro('소개글을 불러오는 데 실패했습니다.'));
  }, [currentItem, auctionResults]);

  // 소켓 이벤트 리스너 등록 및 정리
  useEffect(() => {
    socket.on('bidInit', ({ currentBid, highestBidder, bidHistory, currentItem, teamPoints: serverTeamPoints, serverChanceUsed }) => {
      setCurrentBid(currentBid);
      setHighestBidder(highestBidder);
      setBidHistory(bidHistory);
      setCurrentItem(currentItem);
      setVisibleBidHistory([]);
      if (serverTeamPoints && typeof serverTeamPoints === 'object') {
        setTeamPoints(serverTeamPoints);
      }
      if (serverChanceUsed) setChanceUsed(serverChanceUsed);  // ✅
    });

    socket.on('bidUpdate', ({ currentBid, highestBidder, newBid, teamPoints: serverTeamPoints, serverChanceUsed }) => {
      if (newBid) {
      setBidHistory(prev => [...prev, newBid]);
      }

      setCurrentBid(currentBid);
      setHighestBidder(highestBidder);
      
      if (serverTeamPoints && typeof serverTeamPoints === 'object') {
        setTeamPoints(serverTeamPoints);
      }
      if (serverChanceUsed) setChanceUsed(serverChanceUsed);  // ✅
    });

    socket.on('bidRejected', ({ message }) => setMessage(message));

    socket.on('auctionEnded', ({ winner, price, itemName, teamPoints: serverTeamPoints, serverChanceUsed }) => {
      alert(`🎉 ${itemName}의 낙찰자: ${winner}, 금액: ${price ? toLocaleString() : 0} 포인트`);
      if (serverChanceUsed) setChanceUsed(serverChanceUsed);  // ✅

      setCurrentBid(0);
      setHighestBidder(null);
      setBidHistory([]);
      setVisibleBidHistory([]);
      setCurrentItem(null);
      setPlayerIntro('');
      if (serverTeamPoints && typeof serverTeamPoints === 'object') {
        setTeamPoints(serverTeamPoints);
      }
      setPlayerOptions((prev) => prev.filter((item) => item !== itemName));
      setChanceActive(false);
      setCountdown(null);
      clearInterval(countdownInterval.current);
    });

    socket.on('auctionStarted', ({ itemName }) => {
      setCurrentItem(itemName);
      setCurrentBid(0);
      setHighestBidder(null);
      setBidHistory([]);
      setVisibleBidHistory([]);
      setMessage('');
      setChanceActive(false);
      setCountdown(null);
      clearInterval(countdownInterval.current);
      socket.emit('requestBidInit');
    });

    socket.on('auctionResults', setAuctionResults);

    socket.on('countdownStart', ({ seconds }) => {
      setCountdown(seconds);
      clearInterval(countdownInterval.current);
      countdownInterval.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev === 1) {
            clearInterval(countdownInterval.current);
            return null;
          }
          return prev - 1;
        });
      }, 1000);
    });

    socket.on('revealBidLog', ({ bidHistory }) => {
      setVisibleBidHistory(bidHistory);
    });
    
    socket.on('resetAuction', () => {
      setCurrentBid(0);
      setHighestBidder(null);
      setBidHistory([]);
      setVisibleBidHistory([]);
      setCurrentItem(null);
      setPlayerIntro('');
      setCountdown(null);
      clearInterval(countdownInterval.current);
      setChanceUsed(
    TEAM_NAMES.reduce((acc, name) => ({ ...acc, [name]: false }), {}));  // ✅ 찬스권 상태 초기화
    });

    return () => {
      socket.off('bidInit');
      socket.off('bidUpdate');
      socket.off('bidRejected');
      socket.off('auctionEnded');
      socket.off('auctionStarted');
      socket.off('auctionResults');
      socket.off('countdownStart');
      socket.off('revealBidLog');
      socket.off('resetAuction');
      clearInterval(countdownInterval.current);
    };
    
  }, []);

  // 입찰 함수
  const placeBid = () => {
    const bidValue = Number(bidInput);
    if (!TEAM_NAMES.includes(username)) {
      setMessage('유효한 팀명을 입력하세요.');
      return;
    }
    if (isNaN(bidValue) || bidValue <= 0) {
    setMessage('유효한 입찰가를 입력하세요.');
    return;
    }
    if (!chanceActive && bidValue <= currentBid) {
    setMessage('입찰가는 현재가보다 높아야 합니다.');
    return;

    }
    if (teamPoints[username] < bidValue) {
      setMessage('잔여 포인트가 부족합니다.');
      return;
    }
    socket.emit('placeBid', {
    bid: bidValue,
    user: username,
    chance: chanceActive && !chanceUsed[username],
  });

  if (chanceActive && !chanceUsed[username]) {
    setChanceUsed((prev) => ({ ...prev, [username]: true }));
  }

  setChanceActive(false);
  setBidInput('');
  setMessage('');
};

  // 관리자 기능 함수
  const startAuction = () => {
    if (!itemInput.trim()) return;
    socket.emit('startAuction', itemInput.trim());
    socket.emit('requestBidInit');
    setItemInput('');
  };

  const declareWinner = () => socket.emit('declareWinner');

  const resetAuction = () => socket.emit('resetAuction');

  const resetAllAuctions = () => {
  if (window.confirm('전체 경매 기록을 초기화하시겠습니까?')) {
    socket.emit('resetAll');
  }
};

  const startCountdown = (seconds) => {
    socket.emit('countdownStart', { seconds });
  };

  // 로그인 처리
  const handleLogin = (id, pass) => {
    if (id === 'admin' && pass === 'zigops_25') {
      setUsername('admin');
      setIsAdminVerified(true);
      setMessage('');
    } else {
      setMessage('관리자 인증 실패');
    }
  };

  
  // 로그인 화면
  if (!username) {
    return (
      <div style={{ padding: 40, textAlign: 'center', fontFamily: 'Nanum Square' }}>
        <h2>멸망전 경매 로그인</h2>
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 30,
            marginTop: 30,
          }}
        >
          <div
            style={{
              flex: 1,
              maxWidth: 250,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <label>
              <b>팀장명</b>
            </label>
            <input
              type="text"
              placeholder="팀장명 입력 (예: 김선생)"
              value={loginInput}
              onChange={(e) => setLoginInput(e.target.value)}
              style={{ padding: 10, fontSize: 16 }}
            />
            <button
              onClick={() => setUsername(loginInput.trim())}
              disabled={!loginInput.trim()}
              style={{
                padding: 10,
                fontSize: 16,
                cursor: loginInput.trim() ? 'pointer' : 'not-allowed',
              }}
            >
              로그인
            </button>
          </div>
          <div
            style={{
              flex: 1,
              maxWidth: 250,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <label>
              <b>관리자 로그인</b>
            </label>
            <AdminLogin onAdminLogin={handleLogin} message={message} />
          </div>
        </div>
        <div style={{ fontSize: 14, color: '#777', marginTop: 30 }}>
          Created by Been.
        </div>
      </div>
    );
  }

  // 팀장 화면
  if (!isAdminVerified) {
    if (!TEAM_NAMES.includes(username)) {
      return (
        <div style={{ padding: 20, fontFamily: 'Nanum Square', color: 'red' }}>
          유효한 팀명을 입력하세요.
        </div>
      );
    }

    return (
      <>
       <UserBar />
      <div
        style={{ display: 'flex', fontFamily: 'Nanum Square', padding: 20, gap: 20, paddingTop: 80, }}
      >
        <div style={{ flex: 7 }}>
          <h3>🏆 팀별 낙찰 현황</h3>
          <div
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}
          >
            {TEAM_NAMES.map((name, idx) => {
  const points = teamPoints[name] ?? INITIAL_POINTS;
  const teamResults = auctionResults
    .filter((r) => r.user === name)
    .map(({ item, price, chance }) => ({ item, price, chance }));

  const hasWonWithChance = teamResults.some((r) => r.chance);
  const isUsingChanceButNotWon =
    visibleBidHistory.length > 0 &&
    chanceUsed[name] &&
    !hasWonWithChance;

  let chanceIcon = '';
  let chanceTitle = '';

  if (hasWonWithChance) {
    chanceIcon = '🔒';
    chanceTitle = '찬스권 사용함';
  } else if (isUsingChanceButNotWon) {
    chanceIcon = '🛡️';
    chanceTitle = '찬스권 사용 중';
  } else {
    chanceIcon = '🃏';
    chanceTitle = '찬스권 보유중';
  }

  return (
    <div
      key={idx}
      style={{
        background: '#fff',
        borderRadius: 8,
        padding: 8,
        fontSize: 13,
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      }}
    >
      <div
        style={{
          fontWeight: 'bold',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span>{name} | {points.toLocaleString()}P</span>
        <span title={chanceTitle}>{chanceIcon}</span>
      </div>

      {teamResults.length === 0 ? (
        <div style={{ color: '#999' }}>낙찰 없음</div>
      ) : (
        <ul
          style={{
            margin: 0,
            padding: 0,
            listStyle: 'none',
          }}
        >
          {teamResults.map((r, i) => (
            <li
              key={i}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <span>{r.item}</span>
              <span>{(r.price ?? 0).toLocaleString()}P</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
})}
          </div>
        </div>

        <div style={{ flex: 3 }}>
          <h3>⚡ 실시간 입찰</h3>
          <p>
             {visibleBidHistory.length > 0 ? (
            <>최고 입찰가: <strong>{currentBid.toLocaleString()} P</strong></>
             ) : (
              <>최고 입찰가: <i>비공개</i></>
             )}
          </p>
          <p style={{ fontWeight: 'bold' }}>
            카운트다운: {countdown !== null ? `${countdown}초` : '-'}
          </p>

          <div style={{ display: 'flex', gap: 5 }}>
            <input
              type="number"
              value={bidInput}
              onChange={(e) => setBidInput(e.target.value)}
              style={{ flex: 1 }}
            />
            <button onClick={placeBid}>
              입찰
            </button>
          </div>

          <div style={{ marginTop: 8 }}>
            <button
              onClick={() => setChanceActive((prev) => !prev)}
              disabled={chanceUsed[username] || countdown !== null}
            >
              {chanceActive ? '찬스권 취소' : '찬스권 사용'}
            </button>
            {chanceActive && (
              <span style={{ color: 'red', marginLeft: 8 }}>🃏 찬스권 활성화됨</span>
            )}
          </div>

          <div>
            <h4>
              🎯 선수 소개: <span style={{ fontWeight: 'bold' }}>{currentItem || '-'}</span>
            </h4>
            <p style={{ whiteSpace: 'pre-line', minHeight: 60 }}>{playerIntro}</p>
          </div>

          <div>
            <h4>📜 입찰 로그 (공개)</h4>
            <div style={{ maxHeight: 200, overflowY: 'auto' }}>
              {visibleBidHistory.length === 0
                ? '입찰 로그가 공개되지 않았습니다.'
                : visibleBidHistory.map((b, i) => {
                    let timeStr = b.time;
                    if (b.time) {
                    const date = new Date(b.time);
                    timeStr = isNaN(date.getTime()) ? b.time : date.toLocaleTimeString();
                    }
                    return (
                    <div key={i}>
                      {timeStr} - {b.user} {b.chance ? ' (🃏 찬스권)' : ''}: {b.bid.toLocaleString()}P
                    </div>
                    );
                  })}
            </div>
          </div>

          {message && <p style={{ color: 'red' }}>{message}</p>}
        </div>
      </div>
      </>
    );
  }

  // 관리자 화면
  return (
    <>
    <UserBar />
    <div
      style={{ display: 'flex', fontFamily: 'Nanum Square', padding: 20, gap: 20, paddingTop: 80, }}
    >
<div style={{ flex: 7 }}>
  <h3>🏆 팀별 낙찰 현황</h3>
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
    {TEAM_NAMES.map((name, idx) => {
  const points = teamPoints[name] ?? INITIAL_POINTS;
  const teamResults = auctionResults
    .filter((r) => r.user === name)
    .map(({ item, price, chance }) => ({ item, price, chance }));

  // 🔍 조건 판별
  const hasWonWithChance = teamResults.some((r) => r.chance);
  const isUsingChanceButNotWon =
    visibleBidHistory.length > 0 &&
    chanceUsed[name] &&
    !hasWonWithChance;

  // 🪄 아이콘/툴팁 결정
  let chanceIcon = '';
  let chanceTitle = '';

  if (hasWonWithChance) {
    chanceIcon = '🔒';
    chanceTitle = '찬스권 사용함';
  } else if (isUsingChanceButNotWon) {
    chanceIcon = '🛡️';
    chanceTitle = '찬스권 사용 중';
  } else {
    chanceIcon = '🃏';
    chanceTitle = '찬스권 보유중';
  }

  return (
    <div
      key={idx}
      style={{
        background: '#fff',
        borderRadius: 8,
        padding: 8,
        fontSize: 13,
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      }}
    >
      <div
        style={{
          fontWeight: 'bold',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span>{name} | {points.toLocaleString()}P</span>
        <span title={chanceTitle}>{chanceIcon}</span>
      </div>
    

      {teamResults.length === 0 ? (
        <div style={{ color: '#999' }}>낙찰 없음</div>
      ) : (
        <ul
          style={{
            margin: 0,
            padding: 0,
            listStyle: 'none',
          }}
        >
          {teamResults.map((r, i) => (
            <li
              key={i}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <span>{r.item}</span>
              <span>{(r.price ?? 0).toLocaleString()}P</span>
            </li>
          ))}
        </ul>
      )}
    </div>
      );
    })}
  </div>
</div>


      <div style={{ flex: 3 }}>
        <h3>⚡ 실시간 입찰</h3>
        <p>
          최고 입찰가: {''}
          <strong>
            {visibleBidHistory.length > 0
            ? `${currentBid.toLocaleString()} P`
            : <i>비공개</i>}
          </strong>
        </p>
        <p>
          최고 입찰자: {''}
          {visibleBidHistory.length > 0
            ? highestBidder || '없음'
            : <i>비공개</i>}
        </p>
        <p style={{ fontWeight: 'bold' }}>
          카운트다운: {countdown !== null ? `${countdown}초` : '-'}
        </p>

        <select
          value={itemInput}
          onChange={(e) => setItemInput(e.target.value)}
          style={{ padding: 8, width: '100%', marginBottom: 10 }}
        >
          <option value="">선수 선택</option>
          {playerOptions.map((opt, i) => (
            <option key={i} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        <button
          onClick={startAuction}
          disabled={!itemInput.trim()}
          style={{ marginBottom: 5, width: '100%' }}
        >
          입찰 시작
        </button>
        <button
          onClick={() => startCountdown(5)}
          style={{ marginBottom: 5, width: '100%' }}
        >
          카운트다운 5초 시작
        </button>
        <button
          onClick={() => startCountdown(3)}
          style={{ marginBottom: 10, width: '100%' }}
        >
          카운트다운 3초 시작
        </button>
        <button
          type="button"
          onClick={declareWinner}
          style={{ marginBottom: 10, width: '100%' }}
        >
          낙찰 처리
        </button>
        <button
          onClick={resetAllAuctions}
          style={{ backgroundColor: '#f33', color: 'white', width: '100%' }}
        >
          초기화
        </button>
        

        <div>
          <h4>
            🎯 선수 소개: <span style={{ fontWeight: 'bold' }}>{currentItem || '-'}</span>
          </h4>
          <p style={{ whiteSpace: 'pre-line', minHeight: 60 }}>{playerIntro}</p>
        </div>

        <div>
          <h4>📜 입찰 로그</h4>
          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            {visibleBidHistory.length === 0
              ? '입찰 기록 없음'
              : visibleBidHistory.map((b, i) => {
                 let timeStr = b.time;
                  if (b.time) {
                    const date = new Date(b.time);
                    timeStr = isNaN(date.getTime()) ? b.time : date.toLocaleTimeString();
                  }
                  return (
                    <div key={i}>
                      {timeStr} - {b.user} {b.chance ? ' (🃏 찬스권)' : ''}: {b.bid.toLocaleString()}P
                    </div>
                  );
})}
          </div>
        </div>

        {message && <p style={{ color: 'red' }}>{message}</p>}
      </div>
    </div>
    </>
  );
}

// 관리자 로그인 컴포넌트
function AdminLogin({ onAdminLogin, message }) {
  const [adminId, setAdminId] = useState('');
  const [adminPass, setAdminPass] = useState('');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <input
        type="text"
        placeholder="관리자 ID"
        value={adminId}
        onChange={(e) => setAdminId(e.target.value)}
        style={{ padding: 10, fontSize: 16 }}
      />
      <input
        type="password"
        placeholder="비밀번호"
        value={adminPass}
        onChange={(e) => setAdminPass(e.target.value)}
        style={{ padding: 10, fontSize: 16 }}
      />
      <button
        onClick={() => onAdminLogin(adminId, adminPass)}
        style={{
          padding: 12,
          backgroundColor: '#d9534f',
          color: 'white',
          fontSize: 16,
          cursor: 'pointer',
        }}
      >
        관리자 로그인
      </button>
      {message && <p style={{ color: 'red', marginTop: 5 }}>{message}</p>}
    </div>
  );
}

export default App;
