import { useState, useRef, useEffect } from 'react';

interface SearchableSelectProps {
    value: string;
    onChange: (value: string) => void;
    options: { value: string; label: string; icon?: string }[];
    placeholder?: string;
    className?: string;
}

export default function SearchableSelect({
    value,
    onChange,
    options,
    placeholder = 'เลือก...',
    className = ''
}: SearchableSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [highlightedIndex, setHighlightedIndex] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // ฟิลเตอร์ options ตาม search term
    const filteredOptions = options.filter(option =>
        option.label.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // ปิด dropdown เมื่อคลิกข้างนอก
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setSearchTerm('');
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Focus input เมื่อเปิด dropdown
    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    const handleSelect = (optionValue: string) => {
        onChange(optionValue);
        setIsOpen(false);
        setSearchTerm('');
        setHighlightedIndex(0);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!isOpen) {
            if (e.key === 'Enter' || e.key === ' ') {
                setIsOpen(true);
                e.preventDefault();
            }
            return;
        }

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setHighlightedIndex(prev =>
                    prev < filteredOptions.length - 1 ? prev + 1 : prev
                );
                break;
            case 'ArrowUp':
                e.preventDefault();
                setHighlightedIndex(prev => prev > 0 ? prev - 1 : 0);
                break;
            case 'Enter':
                e.preventDefault();
                if (filteredOptions[highlightedIndex]) {
                    handleSelect(filteredOptions[highlightedIndex].value);
                }
                break;
            case 'Escape':
                setIsOpen(false);
                setSearchTerm('');
                break;
        }
    };

    const selectedOption = options.find(opt => opt.value === value);
    const displayText = selectedOption?.label || placeholder;

    return (
        <div
            ref={containerRef}
            className={`searchable-select-container ${className}`}
            onKeyDown={handleKeyDown}
        >
            <div
                className={`searchable-select-trigger ${isOpen ? 'open' : ''}`}
                onClick={() => setIsOpen(!isOpen)}
                tabIndex={0}
            >
                <span className={value ? '' : 'placeholder'}>
                    {selectedOption?.icon && (
                        <img
                            src={selectedOption.icon}
                            alt=""
                            className="selected-icon"
                            onError={(e) => {
                                e.currentTarget.style.display = 'none';
                            }}
                        />
                    )}
                    {displayText}
                </span>
                <span className="arrow">▼</span>
            </div>

            {isOpen && (
                <div className="searchable-select-dropdown">
                    <div className="searchable-select-search">
                        <input
                            ref={inputRef}
                            type="text"
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value);
                                setHighlightedIndex(0);
                            }}
                            placeholder="พิมพ์เพื่อค้นหา..."
                            className="searchable-select-input"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>
                    <div className="searchable-select-options">
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map((option, index) => (
                                <div
                                    key={option.value}
                                    className={`searchable-select-option ${option.value === value ? 'selected' : ''
                                        } ${index === highlightedIndex ? 'highlighted' : ''}`}
                                    onClick={() => handleSelect(option.value)}
                                    onMouseEnter={() => setHighlightedIndex(index)}
                                >
                                    {option.icon && (
                                        <img
                                            src={option.icon}
                                            alt=""
                                            className="option-icon"
                                            onError={(e) => {
                                                e.currentTarget.style.display = 'none';
                                            }}
                                        />
                                    )}
                                    {option.label}
                                </div>
                            ))
                        ) : (
                            <div className="searchable-select-no-results">
                                ไม่พบข้อมูล
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
