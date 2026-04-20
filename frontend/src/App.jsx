import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import contractAbi from './Contract.json';
import './App.css';

const API_URL = 'http://localhost:5197/api'; 
const CONTRACT_ADDRESS = '0xA40740B0a7B45789aE434cB7006E5c5Fded39732'; 

function App() {
  const [view, setView] = useState('home'); 
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user')));
  const [account, setAccount] = useState(null);
  const [contract, setContract] = useState(null);
  const [adminAddress, setAdminAddress] = useState(null);
  
  const [markets, setMarkets] = useState([]);
  const [myBets, setMyBets] = useState([]);
  const [authForm, setAuthForm] = useState({ email: '', password: '', username: '' });
  const [newMarket, setNewMarket] = useState({ question: '', duration: 86400 });

  // 1. Инициализация Web3
  const initWeb3 = useCallback(async (requestAccess = false) => {
    if (!window.ethereum) return;
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const accounts = await provider.listAccounts();

    if (accounts.length > 0 || requestAccess) {
      try {
        const _accounts = await provider.send("eth_requestAccounts", []);
        const _signer = provider.getSigner();
        const _contract = new ethers.Contract(CONTRACT_ADDRESS, contractAbi, _signer);
        setAccount(_accounts[0]);
        setContract(_contract);
        
        const admin = await _contract.admin();
        setAdminAddress(admin.toLowerCase());
      } catch (e) {
        console.error("Ошибка подключения кошелька", e);
      }
    } else {
      const _contract = new ethers.Contract(CONTRACT_ADDRESS, contractAbi, provider);
      setContract(_contract);
      try {
        const admin = await _contract.admin();
        setAdminAddress(admin.toLowerCase());
      } catch(e) {}
    }
  }, []);

  useEffect(() => {
    initWeb3();
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', (accs) => {
        setAccount(accs[0] || null);
        window.location.reload();
      });
      window.ethereum.on('chainChanged', () => window.location.reload());
    }
  }, [initWeb3]);

  useEffect(() => {
    const fetchMarkets = async () => {
      if (!contract) return;
      try {
        const count = await contract.marketCount();
        const list = [];
        for (let i = 1; i <= count.toNumber(); i++) {
          list.push(await contract.markets(i));
        }
        setMarkets(list.reverse()); 
      } catch (e) { console.error("Ошибка загрузки рынков", e); }
    };
    fetchMarkets();
  }, [contract, view]);

  // 3. Загрузка данных профиля
  useEffect(() => {
    if (user && view === 'profile') {
      fetch(`${API_URL}/user/bets/${user.email}`)
        .then(r => r.ok ? r.json() : [])
        .then(setMyBets)
        .catch(e => console.error(e));
    }
  }, [user, view]);

  const isAdmin = account && adminAddress && account.toLowerCase() === adminAddress;

  const handleBet = async (marketId, title, option, amount) => {
    if (!user) return alert("Пожалуйста, войдите в аккаунт!");
    if (!account) return await initWeb3(true);
    
    try {
      const tx = await contract.bet(marketId, option === 'YES' ? 1 : 2, {
        value: ethers.utils.parseEther(amount.toString())
      });
      alert("Транзакция отправлена...");
      await tx.wait();
      
      await fetch(`${API_URL}/user/bets`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ userEmail: user.email, marketId: marketId.toString(), marketTitle: title, option, amount: amount.toString() })
      });
      
      alert("Ставка принята!");
      setView('profile');
    } catch (e) { alert("Ошибка транзакции: " + e.message); }
  };

  const claimWinnings = async (marketId) => {
    try {
      const tx = await contract.claimWinnings(marketId);
      await tx.wait();
      alert("Выигрыш успешно переведен на ваш кошелек MetaMask!");
    } catch (e) { alert("Ошибка: Выигрыш уже забран или вы не победили."); }
  };

  const handleCreateMarket = async () => {
    if (!isAdmin) return alert("Только админ может создавать рынки!");
    try {
      const tx = await contract.createMarket(newMarket.question, newMarket.duration);
      await tx.wait();
      alert("Событие создано!");
      setView('home');
    } catch (e) { alert("Ошибка создания: " + e.message); }
  };

  const handleResolveMarket = async (marketId, winningOption) => {
    if (!isAdmin) return;
    try {
      const tx = await contract.resolveMarket(marketId, winningOption);
      await tx.wait();
      alert("Событие успешно завершено!");
      window.location.reload();
    } catch (e) { alert("Ошибка завершения: " + e.message); }
  };

  const handleAuth = async (isLogin) => {
    const path = isLogin ? 'login' : 'register';
    try {
      const res = await fetch(`${API_URL}/auth/${path}`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(authForm)
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('user', JSON.stringify(data));
        setUser(data);
        setView('home');
      } else { alert("Ошибка авторизации"); }
    } catch (e) { alert("Бэкенд не отвечает"); }
  };

  const logout = () => { localStorage.removeItem('user'); setUser(null); setView('home'); };

  return (
    <div className="poly-app">
      <nav className="header">
        <div className="logo" onClick={() => setView('home')}>POLY-MART</div>
        <div className="nav-links">
          <button onClick={() => setView('home')}>Рынки</button>
          {user ? (
            <>
              <button onClick={() => setView('profile')}>Профиль</button>
              <div className="wallet-chip" onClick={() => !account && initWeb3(true)} style={{cursor: 'pointer'}}>
                {account ? `${account.slice(0,6)}...${account.slice(-4)}` : 'Подключить MetaMask'}
              </div>
              <button className="btn-logout" onClick={logout}>Выйти</button>
            </>
          ) : (
            <button onClick={() => setView('login')}>Войти</button>
          )}
        </div>
      </nav>

      <main className="container">
        
        {view === 'home' && (
          <div className="market-list">
            <h1>Актуальные события</h1>
            <div className="grid">
              {markets.map(m => (
                <MarketCard key={m.id.toString()} market={m} onBet={handleBet} claimWinnings={claimWinnings} />
              ))}
              {markets.length === 0 && <p>Событий пока нет...</p>}
            </div>
          </div>
        )}

        {view === 'profile' && (
          <div className="profile-dashboard">
            <aside className="profile-sidebar">
              <div className="user-card">
                <div className="avatar">{user.username ? user.username[0].toUpperCase() : 'U'}</div>
                <h3>{user.username}</h3>
                <p>{user.email}</p>
                {!account && <button className="btn-primary" onClick={() => initWeb3(true)} style={{marginTop: '15px'}}>Подключить кошелек</button>}
                {isAdmin && <div className="admin-badge">ADMIN</div>}
              </div>
              
              <nav className="side-nav">
                <button onClick={() => setView('profile')} className="active">Мои ставки</button>
                {isAdmin && <button onClick={() => setView('admin')}>Админ-панель</button>}
                {isAdmin && <button onClick={() => setView('create')}>Создать событие</button>}
              </nav>
            </aside>

            <section className="profile-content">
               <div className="card">
                 <h2>Мои активные ставки</h2>
                 <p style={{color: '#9ca3af', marginBottom: '20px'}}>
                   Здесь отображается ваша история. Если событие завершено в вашу пользу, нажмите "Забрать".
                 </p>
                 <div className="bets-list">
                    {myBets.map((b, idx) => {
                      const market = markets.find(m => m.id.toString() === b.marketId.toString());
                      const isResolved = market?.resolved;
                      const isWinner = isResolved && ((market.winningOption === 1 && b.option === 'YES') || (market.winningOption === 2 && b.option === 'NO'));

                      return (
                        <div key={idx} className="bet-item">
                          <span className="bet-title">{b.marketTitle}</span>
                          <div className="bet-details">
                            <span className={`badge ${b.option}`}>{b.option}</span>
                            <strong className="bet-amount">{b.amount} ETH</strong>
                            
                            {!isResolved && <span className="status-pending">В игре</span>}
                            {isResolved && !isWinner && <span className="status-lost">Проигрыш</span>}
                            {isWinner && (
                              <button className="btn-claim" onClick={() => claimWinnings(b.marketId)}>Забрать</button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {myBets.length === 0 && <p>Вы еще не делали ставок.</p>}
                 </div>
               </div>
            </section>
          </div>
        )}

        {view === 'admin' && isAdmin && (
          <div className="admin-panel card">
            <h2>Управление событиями</h2>
            <p style={{color: '#9ca3af'}}>Завершайте события по истечении времени. Это определит победителей.</p>
            <div className="admin-markets">
              {markets.filter(m => !m.resolved).map(m => (
                <div key={m.id.toString()} className="admin-market-card">
                  <h3>{m.question}</h3>
                  <div className="pool-info">Пул: {ethers.utils.formatEther(m.totalPool)} ETH</div>
                  <div className="actions">
                    <button className="btn-yes" onClick={() => handleResolveMarket(m.id, 1)}>Победило ДА</button>
                    <button className="btn-no" onClick={() => handleResolveMarket(m.id, 2)}>Победило НЕТ</button>
                  </div>
                </div>
              ))}
              {markets.filter(m => !m.resolved).length === 0 && <p>Нет незавершенных событий.</p>}
            </div>
          </div>
        )}

        {view === 'create' && isAdmin && (
          <div className="create-page card">
            <h2>Создать событие (Блокчейн)</h2>
            <input placeholder="Вопрос (например: ETH > $4000 в мае?)" onChange={e => setNewMarket({...newMarket, question: e.target.value})} />
            <input type="number" placeholder="Длительность (в секундах, напр. 86400 = 1 день)" onChange={e => setNewMarket({...newMarket, duration: e.target.value})} />
            <button className="btn-primary" onClick={handleCreateMarket}>Опубликовать</button>
          </div>
        )}

        {(view === 'login' || view === 'register') && (
          <div className="auth-card card">
             <h2>{view === 'login' ? 'Вход в систему' : 'Регистрация'}</h2>
             {view === 'register' && <input placeholder="Никнейм" onChange={e => setAuthForm({...authForm, username: e.target.value})} />}
             <input type="email" placeholder="Email" onChange={e => setAuthForm({...authForm, email: e.target.value})} />
             <input type="password" placeholder="Пароль" onChange={e => setAuthForm({...authForm, password: e.target.value})} />
             <button className="btn-primary" onClick={() => handleAuth(view === 'login')}>
                {view === 'login' ? 'Войти' : 'Создать аккаунт'}
             </button>
             <p onClick={() => setView(view === 'login' ? 'register' : 'login')}>
               {view === 'login' ? 'Нет аккаунта? Зарегистрируйтесь' : 'Уже есть аккаунт? Войдите'}
             </p>
          </div>
        )}
      </main>
    </div>
  );
}

const MarketCard = ({ market, onBet }) => {
  const [timeLeft, setTimeLeft] = useState('');
  const [isClosed, setIsClosed] = useState(false);
  const [betAmount, setBetAmount] = useState('0.01');

  const calcOdds = () => {
    const total = parseFloat(ethers.utils.formatEther(market.totalPool));
    const yes = parseFloat(ethers.utils.formatEther(market.poolYes));
    const no = parseFloat(ethers.utils.formatEther(market.poolNo));
    if (total === 0) return { yes: 2.0, no: 2.0 }; 
    return { yes: (total / (yes || 0.001)).toFixed(2), no: (total / (no || 0.001)).toFixed(2) };
  };
  const odds = calcOdds();

  useEffect(() => {
    const endTimeMs = market.endTime.toNumber() * 1000;
    const updateTimer = () => {
      const diff = endTimeMs - Date.now();
      if (diff <= 0) { setTimeLeft('Событие завершено'); setIsClosed(true); }
      else {
        const d = Math.floor(diff / (1000 * 60 * 60 * 24));
        const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const m = Math.floor((diff / 1000 / 60) % 60);
        setTimeLeft(`${d}д ${h}ч ${m}м`);
      }
    };
    updateTimer();
    const timerId = setInterval(updateTimer, 1000);
    return () => clearInterval(timerId);
  }, [market.endTime]);

  return (
    <div className="market-card card">
      <div className="category">ПРЕДСКАЗАНИЕ</div>
      <h3>{market.question}</h3>
      <div className={isClosed ? "timer closed" : "timer"}>⏱ {timeLeft}</div>
      <div className="pool-info">Пул: {ethers.utils.formatEther(market.totalPool)} ETH</div>
      
      {!market.resolved ? (
        <>
          <div className="actions">
            <button className="btn-yes" disabled={isClosed} onClick={() => onBet(market.id, market.question, 'YES', betAmount)}>
              ДА ({odds.yes}x)
            </button>
            <button className="btn-no" disabled={isClosed} onClick={() => onBet(market.id, market.question, 'NO', betAmount)}>
              НЕТ ({odds.no}x)
            </button>
          </div>
          {!isClosed && <input type="number" step="0.01" value={betAmount} onChange={(e) => setBetAmount(e.target.value)} style={{marginTop: '15px'}}/>}
        </>
      ) : (
        <div className="resolved-panel">
          <h4>Победил вариант: {market.winningOption === 1 ? 'ДА' : 'НЕТ'}</h4>
        </div>
      )}
    </div>
  );
};

export default App;