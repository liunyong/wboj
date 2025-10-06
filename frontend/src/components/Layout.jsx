import { Outlet } from 'react-router-dom';

import Header from './Header.jsx';

function Layout() {
  return (
    <div className="app-shell">
      <Header />
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}

export default Layout;
