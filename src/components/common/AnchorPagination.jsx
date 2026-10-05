import React, { useRef, useState, useEffect, useLayoutEffect, useCallback, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import '@/styles/anchor-pagination.css';

/**
 * Helper to generate page item list with smart ellipsis.
 * Uses a loop-driven approach to construct clean, stable pagination segments.
 */
function generatePaginationRange(currentPage, totalPages, siblingCount = 1) {
  if (totalPages <= 0) return [];
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const leftSiblingIndex = Math.max(currentPage - siblingCount, 1);
  const rightSiblingIndex = Math.min(currentPage + siblingCount, totalPages);

  const shouldShowLeftDots = leftSiblingIndex > 2;
  const shouldShowRightDots = rightSiblingIndex < totalPages - 2;

  // Case 1: No left dots, but right dots needed
  if (!shouldShowLeftDots && shouldShowRightDots) {
    const leftItemCount = 3 + 2 * siblingCount;
    const leftRange = Array.from({ length: leftItemCount }, (_, i) => i + 1);
    return [...leftRange, 'dots-end', totalPages];
  }

  // Case 2: No right dots, but left dots needed
  if (shouldShowLeftDots && !shouldShowRightDots) {
    const rightItemCount = 3 + 2 * siblingCount;
    const start = totalPages - rightItemCount + 1;
    const rightRange = Array.from({ length: rightItemCount }, (_, i) => start + i);
    return [1, 'dots-start', ...rightRange];
  }

  // Case 3: Both left and right dots needed
  if (shouldShowLeftDots && shouldShowRightDots) {
    const middleRange = [];
    for (let i = leftSiblingIndex; i <= rightSiblingIndex; i += 1) {
      middleRange.push(i);
    }
    return [1, 'dots-start', ...middleRange, 'dots-end', totalPages];
  }

  return Array.from({ length: totalPages }, (_, i) => i + 1);
}

/**
 * AnchorPagination Component
 * Inspired by @jh3y's Progressive Anchor Pagination (https://codepen.io/jh3y/pen/qEbVOMm)
 *
 * Provides a dynamic sliding pill/circle indicator for the active page and hover state,
 * with pixel-perfect centering and smooth sliding transitions.
 */
const AnchorPagination = ({
  currentPage = 1,
  pageNumber,
  totalPages = 1,
  onPageChange,
  disabled = false,
  siblingCount = 1,
  className = ''
}) => {
  const activePage = pageNumber ?? currentPage;
  const safeTotalPages = Math.max(1, Number(totalPages) || 1);
  const safeCurrentPage = Math.min(Math.max(1, Number(activePage) || 1), safeTotalPages);

  const trackRef = useRef(null);
  const buttonRefs = useRef({});

  // Indicator transforms and sizes
  const [activeRect, setActiveRect] = useState({ left: 0, top: 0, width: 0, height: 0, opacity: 0 });
  const [hoverRect, setHoverRect] = useState({ left: 0, top: 0, width: 0, height: 0, opacity: 0 });

  // Compute items array using a loop
  const pages = useMemo(
    () => generatePaginationRange(safeCurrentPage, safeTotalPages, siblingCount),
    [safeCurrentPage, safeTotalPages, siblingCount]
  );

  // Measure and align the active indicator to current page button
  const updateActivePosition = useCallback(() => {
    const track = trackRef.current;
    const btn = buttonRefs.current[safeCurrentPage];
    if (!track || !btn) {
      setActiveRect((prev) => (prev.opacity === 0 ? prev : { ...prev, opacity: 0 }));
      return;
    }

    const trackBounds = track.getBoundingClientRect();
    const btnBounds = btn.getBoundingClientRect();
    const borderLeft = track.clientLeft || 0;
    const borderTop = track.clientTop || 0;

    setActiveRect({
      left: Math.round(btnBounds.left - trackBounds.left - borderLeft),
      top: Math.round(btnBounds.top - trackBounds.top - borderTop),
      width: btnBounds.width,
      height: btnBounds.height,
      opacity: 1
    });
  }, [safeCurrentPage]);

  useLayoutEffect(() => {
    updateActivePosition();
  }, [updateActivePosition, pages]);

  // Recalculate on window resize
  useEffect(() => {
    const handleResize = () => {
      updateActivePosition();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [updateActivePosition]);

  // Hover handlers for smooth gliding indicator
  const handleButtonMouseEnter = (el) => {
    if (!el || !trackRef.current) return;
    const track = trackRef.current;
    const trackBounds = track.getBoundingClientRect();
    const btnBounds = el.getBoundingClientRect();
    const borderLeft = track.clientLeft || 0;
    const borderTop = track.clientTop || 0;

    setHoverRect({
      left: Math.round(btnBounds.left - trackBounds.left - borderLeft),
      top: Math.round(btnBounds.top - trackBounds.top - borderTop),
      width: btnBounds.width,
      height: btnBounds.height,
      opacity: 1
    });
  };

  const handleTrackMouseLeave = () => {
    setHoverRect((prev) => ({ ...prev, opacity: 0 }));
  };

  const handlePageClick = (page) => {
    if (disabled || page === safeCurrentPage || page < 1 || page > safeTotalPages) return;
    if (typeof onPageChange === 'function') {
      onPageChange(page);
    }
  };

  if (safeTotalPages <= 1) {
    return null;
  }

  return (
    <nav
      className={`anchor-pagination ${className}`}
      aria-label="Pagination"
      role="navigation"
      onMouseLeave={handleTrackMouseLeave}
    >
      <div className="anchor-pagination__track" ref={trackRef}>
        {/* Sliding Hover Indicator */}
        <div
          className="anchor-pagination__indicator anchor-pagination__indicator--hover"
          aria-hidden="true"
          style={{
            transform: `translate3d(${hoverRect.left}px, ${hoverRect.top}px, 0)`,
            width: `${hoverRect.width}px`,
            height: `${hoverRect.height}px`,
            opacity: hoverRect.opacity
          }}
        />

        {/* Sliding Active Indicator */}
        <div
          className="anchor-pagination__indicator anchor-pagination__indicator--active"
          aria-hidden="true"
          style={{
            transform: `translate3d(${activeRect.left}px, ${activeRect.top}px, 0)`,
            width: `${activeRect.width}px`,
            height: `${activeRect.height}px`,
            opacity: activeRect.opacity
          }}
        />

        <ul className="anchor-pagination__list">
          {/* Previous Page Button */}
          <li className="anchor-pagination__item">
            <button
              type="button"
              className="anchor-pagination__button anchor-pagination__button--nav"
              aria-label="Previous page"
              disabled={disabled || safeCurrentPage <= 1}
              onClick={() => handlePageClick(safeCurrentPage - 1)}
              onMouseEnter={(e) => handleButtonMouseEnter(e.currentTarget)}
            >
              <ChevronLeft size={15} />
            </button>
          </li>

          {/* Looping through page items */}
          {pages.map((item, idx) => {
            if (typeof item === 'string' && item.startsWith('dots')) {
              return (
                <li key={`ellipsis-${idx}`} className="anchor-pagination__gap" aria-hidden="true">
                  &hellip;
                </li>
              );
            }

            const isCurrent = item === safeCurrentPage;
            return (
              <li key={`page-${item}`} className="anchor-pagination__item">
                <button
                  type="button"
                  ref={(el) => {
                    if (el) {
                      buttonRefs.current[item] = el;
                    } else {
                      delete buttonRefs.current[item];
                    }
                  }}
                  className="anchor-pagination__button"
                  aria-label={`Page ${item}`}
                  aria-current={isCurrent ? 'page' : undefined}
                  disabled={disabled}
                  onClick={() => handlePageClick(item)}
                  onMouseEnter={(e) => handleButtonMouseEnter(e.currentTarget)}
                >
                  {item}
                </button>
              </li>
            );
          })}

          {/* Next Page Button */}
          <li className="anchor-pagination__item">
            <button
              type="button"
              className="anchor-pagination__button anchor-pagination__button--nav"
              aria-label="Next page"
              disabled={disabled || safeCurrentPage >= safeTotalPages}
              onClick={() => handlePageClick(safeCurrentPage + 1)}
              onMouseEnter={(e) => handleButtonMouseEnter(e.currentTarget)}
            >
              <ChevronRight size={15} />
            </button>
          </li>
        </ul>
      </div>
    </nav>
  );
};

export default AnchorPagination;
