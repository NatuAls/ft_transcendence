import { useState } from 'react';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';

function App() {
  // Ambas pantallas pertenecen al flujo de autenticación y se alternan sin
  // introducir una dependencia de routing para una navegación de dos vistas.
  const [page, setPage] = useState<'login' | 'register'>(() =>
    window.location.hash === '#register' ? 'register' : 'login',
  );

  function navigate(nextPage: 'login' | 'register') {
    window.history.replaceState(
      null,
      '',
      nextPage === 'register' ? '#register' : '#login',
    );
    setPage(nextPage);
  }

  return page === 'register' ? (
    <RegisterPage onSignIn={() => navigate('login')} />
  ) : (
    <LoginPage onCreateAccount={() => navigate('register')} />
  );
}
export default App;
