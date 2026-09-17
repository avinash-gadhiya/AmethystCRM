import { useContext, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, Search } from 'lucide-react';
import { ConfigContext } from 'contexts/ConfigContext';
import * as actionType from 'store/actions';

export default function NavLeft() {
  const configContext = useContext(ConfigContext);
  const { dispatch } = configContext;
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  const handleToggleMenu = (e) => {
    e.preventDefault();
    dispatch({ type: actionType.COLLAPSE_MENU });
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const query = searchQuery.trim().toLowerCase();
    if (!query) return;

    if (query.includes('ticket')) {
      navigate('/Tickets');
    } else if (query.includes('customer')) {
      navigate('/Customers');
    } else if (query.includes('profile')) {
      navigate('/MyProfile');
    } else if (query.includes('sale') || query.includes('report') || query.includes('perform')) {
      navigate('/Performance/Dashboard');
    } else {
      navigate(`/Performance/Dashboard?search=${encodeURIComponent(query)}`);
    }
  };

  return (
    <div className="d-flex align-items-center h-100 py-2">
      {/* Sidebar Collapse Toggle */}
      <button
        type="button"
        className="neu-icon-btn me-3"
        onClick={handleToggleMenu}
        title="Toggle Sidebar Navigation"
        aria-label="Toggle Sidebar Navigation"
      >
        <Menu size={18} />
      </button>

      {/* Global Header Search Bar */}
      <form onSubmit={handleSearchSubmit} className="neu-header-search d-none d-sm-flex align-items-center">
        <Search size={15} className="text-muted me-2 flex-shrink-0" />
        <input
          type="search"
          className="neu-header-search-input"
          placeholder="Search records, tickets..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <span className="neu-kbd-hint d-none d-lg-inline">Ctrl + K</span>
      </form>

      {/* Quick Navigation Links */}
      <nav className="d-none d-xl-flex align-items-center gap-1 ms-3">
        <Link to="/Performance/Dashboard" className="neu-nav-link">
          Reports
        </Link>
        <Link to="/Tickets" className="neu-nav-link">
          Tickets
        </Link>
        <Link to="/Customers" className="neu-nav-link">
          Customers
        </Link>
      </nav>
    </div>
  );
}
