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
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      let top = 0;
      let left = 0;
      let actualPosition = position;
      let transform = '';

      // Calculate initial position
      switch (position) {
        case 'top':
          top = wrapperRect.top - tooltipRect.height - 8;
          left = wrapperRect.left + wrapperRect.width / 2;
          transform = 'translateX(-50%)';
          // Check if tooltip goes above viewport, switch to bottom
          if (top < 0) {
            actualPosition = 'bottom';
            top = wrapperRect.bottom + 8;
          }
          break;
        case 'bottom':
          top = wrapperRect.bottom + 8;
          left = wrapperRect.left + wrapperRect.width / 2;
          transform = 'translateX(-50%)';
          // Check if tooltip goes below viewport, switch to top
          if (top + tooltipRect.height > viewportHeight) {
            actualPosition = 'top';
            top = wrapperRect.top - tooltipRect.height - 8;
          }
          break;
        case 'left':
          top = wrapperRect.top + wrapperRect.height / 2;
          left = wrapperRect.left - tooltipRect.width - 8;
          transform = 'translateY(-50%)';
          // Check if tooltip goes left of viewport, switch to right
          if (left < 0) {
            actualPosition = 'right';
            left = wrapperRect.right + 8;
          }
          break;
        case 'right':
          top = wrapperRect.top + wrapperRect.height / 2;
          left = wrapperRect.right + 8;
          transform = 'translateY(-50%)';
          // Check if tooltip goes right of viewport, switch to left
          if (left + tooltipRect.width > viewportWidth) {
            actualPosition = 'left';
            left = wrapperRect.left - tooltipRect.width - 8;
          }
          break;
        default:
          top = wrapperRect.top - tooltipRect.height - 8;
          left = wrapperRect.left + wrapperRect.width / 2;
          transform = 'translateX(-50%)';
          // Check if tooltip goes above viewport, switch to bottom
          if (top < 0) {
            actualPosition = 'bottom';
            top = wrapperRect.bottom + 8;
          }
      }

      // Ensure tooltip stays within viewport horizontally
      if (actualPosition === 'top' || actualPosition === 'bottom') {
        const halfTooltipWidth = tooltipRect.width / 2;
        if (left - halfTooltipWidth < 0) {
          left = halfTooltipWidth;
        } else if (left + halfTooltipWidth > viewportWidth) {
          left = viewportWidth - halfTooltipWidth;
        }
      }

      // Ensure tooltip stays within viewport vertically
      if (actualPosition === 'left' || actualPosition === 'right') {
        const halfTooltipHeight = tooltipRect.height / 2;
        if (top - halfTooltipHeight < 0) {
          top = halfTooltipHeight;
        } else if (top + halfTooltipHeight > viewportHeight) {
          top = viewportHeight - halfTooltipHeight;
        }
      }

      setTooltipStyle({
        top: `${top}px`,
        left: `${left}px`,
        transform: transform
      });
    };

    const handleMouseEnter = () => {
      // Temporarily make tooltip visible to measure it
      if (tooltipRef.current) {
        // Set visibility temporarily for measurement
        tooltipRef.current.style.visibility = 'visible';
        tooltipRef.current.style.opacity = '0';
        tooltipRef.current.style.pointerEvents = 'none';
        
        // Use requestAnimationFrame to ensure tooltip is rendered before measuring
        requestAnimationFrame(() => {
          updateTooltipPosition();
          // Remove inline styles to let CSS handle visibility via :hover
          if (tooltipRef.current) {
            tooltipRef.current.style.removeProperty('visibility');
            tooltipRef.current.style.removeProperty('opacity');
          }
        });
      } else {
        updateTooltipPosition();
      }
    };

    const handleMouseLeave = () => {
      // Remove any inline styles to let CSS handle visibility
      if (tooltipRef.current) {
        tooltipRef.current.style.removeProperty('visibility');
        tooltipRef.current.style.removeProperty('opacity');
      }
    };

    const wrapper = wrapperRef.current;
    if (wrapper) {
      wrapper.addEventListener('mouseenter', handleMouseEnter);
      wrapper.addEventListener('mouseleave', handleMouseLeave);
      return () => {
        wrapper.removeEventListener('mouseenter', handleMouseEnter);
        wrapper.removeEventListener('mouseleave', handleMouseLeave);
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
        {typeof text === 'string' ? text : text}
      </span>
    </div>
  );
}

export default Tooltip;
