// Exaxmples of usage:
//* 1. In a background image: <div style={{backgroundImage: `url('${toAbsoluteUrl('/media/misc/pattern-1.jpg')}')`}}>...
//* 2. In img tag: <img src={toAbsoluteUrl('/media/avatars/300-2.jpg')} />
const toAbsoluteUrl = (pathname) => {
  const rawPath = String(pathname || '');
  const baseUrl = import.meta.env.BASE_URL;
  if (baseUrl && baseUrl !== '/') {
    return `${baseUrl.replace(/\/+$/, '')}/${rawPath.replace(/^\/+/, '')}`;
  }
  return rawPath;
};
export { toAbsoluteUrl };

