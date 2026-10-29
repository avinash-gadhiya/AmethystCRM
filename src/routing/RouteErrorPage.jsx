import { isRouteErrorResponse, Link, useRouteError } from 'react-router-dom';

export default function RouteErrorPage() {
  const error = useRouteError();
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  return (
    <div className="app-loading" role="alert">
      <div className="app-loading__card">
        <h1 className="app-loading__title">{notFound ? 'Page not found' : 'This page could not load'}</h1>
        <p className="app-loading__description">
          {notFound ? 'Open your home page to continue.' : 'Check your connection and reload to try again.'}
        </p>
        <div className="app-loading__actions">
          <button type="button" className="app-loading__button" onClick={() => window.location.reload()}>
            Reload page
          </button>
          <Link to="/" className="app-loading__button app-loading__button--secondary">
            Go to home
          </Link>
        </div>
      </div>
    </div>
  );
}
