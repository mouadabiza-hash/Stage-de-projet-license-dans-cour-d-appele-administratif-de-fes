/**
 * SearchableSelect.jsx
 * 
 * Improved combobox component with:
 * - Arrow appears only when dropdown is open.
 * - Options displayed as blocks (cards) for better readability.
 * - Full keyboard support (ArrowUp/Down, Enter, Escape).
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';

export default function SearchableSelect({
  name,
  value = '',
  onChange,
  options = [],
  placeholder = '-- اختر --',
  required = false,
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlighted, setHighlighted] = useState(-1);
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const selectedLabel = options.find(o => String(o.value) === String(value))?.label || '';
  const displayValue = open ? query : selectedLabel;

  const filtered = query.trim()
    ? options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()))
    : options;

  const select = useCallback((opt) => {
    onChange({ target: { name, value: opt.value } });
    setQuery('');
    setOpen(false);
    setHighlighted(-1);
  }, [name, onChange]);

  const clear = (e) => {
    e.stopPropagation();
    onChange({ target: { name, value: '' } });
    setQuery('');
    setHighlighted(-1);
  };

  const handleInputClick = () => {
    if (disabled) return;
    setOpen(prev => {
      if (!prev) setQuery('');
      return !prev;
    });
    setHighlighted(-1);
  };

  const handleKeyDown = (e) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setOpen(true);
        setQuery('');
      }
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlighted(h => Math.min(h + 1, filtered.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlighted(h => Math.max(h - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlighted >= 0 && filtered[highlighted]) {
          select(filtered[highlighted]);
        }
        break;
      case 'Escape':
        setOpen(false);
        setQuery('');
        setHighlighted(-1);
        break;
      default:
        break;
    }
  };

  // Scroll highlighted item into view
  useEffect(() => {
    if (!listRef.current || highlighted < 0) return;
    const items = listRef.current.querySelectorAll('[data-idx]');
    if (items[highlighted]) {
      items[highlighted].scrollIntoView({ block: 'nearest' });
    }
  }, [highlighted]);

  // Close on outside click
  useEffect(() => {
    const handle = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setQuery('');
        setHighlighted(-1);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  // Inline styles (or you can move to a CSS file)
  const styles = {
    wrapper: {
      position: 'relative',
      width: '100%',
    },
    control: {
      display: 'flex',
      alignItems: 'center',
      border: '1px solid var(--line, #d8e3ee)',
      borderRadius: '8px',
      backgroundColor: 'var(--field, #fbfdff)',
      minHeight: '44px',
      transition: 'border-color 0.2s, box-shadow 0.2s',
      cursor: disabled ? 'not-allowed' : 'pointer',
    },
    input: {
      flex: 1,
      border: 'none',
      outline: 'none',
      backgroundColor: 'transparent',
      padding: '0.65rem 0.85rem',
      fontSize: '0.95rem',
      color: 'var(--ink, #12314f)',
      cursor: disabled ? 'not-allowed' : 'text',
    },
    indicators: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.25rem',
      paddingRight: '0.5rem',
    },
    clearButton: {
      background: 'none',
      border: 'none',
      fontSize: '1.2rem',
      cursor: 'pointer',
      color: 'var(--muted, #6b7d90)',
      padding: '0 0.25rem',
      fontWeight: 'bold',
    },
    arrow: {
      display: open ? 'inline-block' : 'none',  // Hide arrow when closed
      fontSize: '0.9rem',
      color: 'var(--muted, #6b7d90)',
      transition: 'transform 0.2s',
      transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
      marginRight: '0.25rem',
    },
    list: {
      position: 'absolute',
      top: 'calc(100% + 4px)',
      left: 0,
      right: 0,
      maxHeight: '280px',
      overflowY: 'auto',
      backgroundColor: '#fff',
      border: '1px solid var(--line, #d8e3ee)',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
      zIndex: 1000,
      padding: 0,
      margin: 0,
      listStyle: 'none',
    },
    option: {
      padding: '0.75rem 1rem',
      cursor: 'pointer',
      borderBottom: '1px solid var(--soft-line, #edf2f7)',
      transition: 'background-color 0.1s',
      fontSize: '0.95rem',
      color: 'var(--ink, #12314f)',
    },
    selectedOption: {
      backgroundColor: 'var(--navy-700, #164d7d)',
      color: '#fff',
    },
    highlightedOption: {
      backgroundColor: 'var(--soft-line, #edf2f7)',
    },
    noResults: {
      padding: '0.75rem 1rem',
      textAlign: 'center',
      color: 'var(--muted, #6b7d90)',
    },
  };

  return (
    <div ref={containerRef} style={styles.wrapper}>
      <input type="hidden" name={name} value={value} required={required} />

      <div style={styles.control} onClick={handleInputClick}>
        <input
          ref={inputRef}
          type="text"
          style={styles.input}
          value={displayValue}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(e) => {
            setQuery(e.target.value);
            setHighlighted(-1);
            if (!open) setOpen(true);
          }}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          readOnly={disabled}
        />
        <div style={styles.indicators}>
          {value && !disabled && (
            <button
              type="button"
              style={styles.clearButton}
              onClick={clear}
              tabIndex={-1}
              title="مسح"
            >
              ×
            </button>
          )}
          <span style={styles.arrow}>▼</span>
        </div>
      </div>

      {open && (
        <ul ref={listRef} style={styles.list} role="listbox">
          {filtered.length === 0 ? (
            <li style={styles.noResults}>لا توجد نتائج</li>
          ) : (
            filtered.map((opt, idx) => (
              <li
                key={opt.value}
                data-idx={idx}
                role="option"
                aria-selected={String(opt.value) === String(value)}
                style={{
                  ...styles.option,
                  ...(String(opt.value) === String(value) ? styles.selectedOption : {}),
                  ...(highlighted === idx ? styles.highlightedOption : {}),
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  select(opt);
                }}
                onMouseEnter={() => setHighlighted(idx)}
              >
                {opt.label}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}