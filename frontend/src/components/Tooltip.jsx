import React, { useRef, useState, useEffect } from 'react';
import './Tooltip.css';

function Tooltip({ children, text, position = 'top' }) {
  const wrapperRef = useRef(null);
  const tooltipRef = useRef(null);
  const [tooltipStyle, setTooltipStyle] = useState({});

  useEffect(() => {
    const updateTooltipPosition = () => {
      if (!wrapperRef.current || !tooltipRef.current) return;

      const wrapperRect = wrapperRef.current.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      
      let top = 0;
      let left = 0;

      switch (position) {
        case 'top':
          top = wrapperRect.top - tooltipRect.height - 8;
          left = wrapperRect.left + wrapperRect.width / 2;
          break;
        case 'bottom':
          top = wrapperRect.bottom + 8;
          left = wrapperRect.left + wrapperRect.width / 2;
          break;
        case 'left':
          top = wrapperRect.top + wrapperRect.height / 2;
          left = wrapperRect.left - tooltipRect.width - 8;
          break;
        case 'right':
          top = wrapperRect.top + wrapperRect.height / 2;
          left = wrapperRect.right + 8;
          break;
        default:
          top = wrapperRect.top - tooltipRect.height - 8;
          left = wrapperRect.left + wrapperRect.width / 2;
      }

      setTooltipStyle({
        top: `${top}px`,
        left: `${left}px`,
        transform: position === 'top' || position === 'bottom' 
          ? 'translateX(-50%)' 
          : 'translateY(-50%)'
      });
    };

    const handleMouseEnter = () => {
      updateTooltipPosition();
    };

    const wrapper = wrapperRef.current;
    if (wrapper) {
      wrapper.addEventListener('mouseenter', handleMouseEnter);
      return () => {
        wrapper.removeEventListener('mouseenter', handleMouseEnter);
      };
    }
  }, [position]);

  return (
    <div className="tooltip-wrapper" ref={wrapperRef}>
      {children}
      <span 
        ref={tooltipRef}
        className={`tooltip tooltip-${position}`}
        style={tooltipStyle}
      >
        {text}
      </span>
    </div>
  );
}

export default Tooltip;
