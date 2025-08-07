import React, { useState, useEffect, useRef } from 'react';
import { Input } from './input';
import { Button } from './button';
import { MapPin, ChevronDown } from 'lucide-react';

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  ref?: React.Ref<HTMLInputElement>;
}

interface AddressSuggestion {
  description: string;
  place_id: string;
}

export const AddressAutocomplete = React.forwardRef<HTMLInputElement, AddressAutocompleteProps>(({
  value,
  onChange,
  placeholder = "Enter address",
  className = "",
  disabled = false
}, ref) => {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Mock address suggestions for demo (replace with Google Places API)
  const mockAddresses = [
    "123 Main Street, New York, NY 10001",
    "456 Oak Avenue, Los Angeles, CA 90210",
    "789 Pine Road, Chicago, IL 60601",
    "321 Elm Street, Houston, TX 77001",
    "654 Maple Drive, Phoenix, AZ 85001",
    "987 Cedar Lane, Philadelphia, PA 19101",
    "147 Birch Court, San Antonio, TX 78201",
    "258 Spruce Way, San Diego, CA 92101",
    "369 Willow Path, Dallas, TX 75201",
    "741 Aspen Circle, San Jose, CA 95101",
    // Special test address - put it first for easier testing
    "13022 Barhms Terrace, Austin, TX 78750",
    "13023 Barhms Terrace, Austin, TX 78750",
    "13024 Barhms Terrace, Austin, TX 78750",
    "13025 Barhms Terrace, Austin, TX 78750",
    "13026 Barhms Terrace, Austin, TX 78750",
    "13027 Barhms Terrace, Austin, TX 78750",
    "13028 Barhms Terrace, Austin, TX 78750",
    "13029 Barhms Terrace, Austin, TX 78750",
    "13030 Barhms Terrace, Austin, TX 78750",
    "13031 Barhms Terrace, Austin, TX 78750",
    "13032 Barhms Terrace, Austin, TX 78750",
    "13033 Barhms Terrace, Austin, TX 78750",
    "13034 Barhms Terrace, Austin, TX 78750",
    "13035 Barhms Terrace, Austin, TX 78750",
    "13036 Barhms Terrace, Austin, TX 78750",
    "13037 Barhms Terrace, Austin, TX 78750",
    "13038 Barhms Terrace, Austin, TX 78750",
    "13039 Barhms Terrace, Austin, TX 78750",
    "13040 Barhms Terrace, Austin, TX 78750",
    "13041 Barhms Terrace, Austin, TX 78750",
    "13042 Barhms Terrace, Austin, TX 78750",
    "13043 Barhms Terrace, Austin, TX 78750",
    "13044 Barhms Terrace, Austin, TX 78750",
    "13045 Barhms Terrace, Austin, TX 78750",
    "13046 Barhms Terrace, Austin, TX 78750",
    "13047 Barhms Terrace, Austin, TX 78750",
    "13048 Barhms Terrace, Austin, TX 78750",
    "13049 Barhms Terrace, Austin, TX 78750",
    "13050 Barhms Terrace, Austin, TX 78750",
    "13051 Barhms Terrace, Austin, TX 78750",
    "13052 Barhms Terrace, Austin, TX 78750",
    "13053 Barhms Terrace, Austin, TX 78750",
    "13054 Barhms Terrace, Austin, TX 78750",
    "13055 Barhms Terrace, Austin, TX 78750",
    "13056 Barhms Terrace, Austin, TX 78750",
    "13057 Barhms Terrace, Austin, TX 78750",
    "13058 Barhms Terrace, Austin, TX 78750",
    "13059 Barhms Terrace, Austin, TX 78750",
    "13060 Barhms Terrace, Austin, TX 78750",
    "13061 Barhms Terrace, Austin, TX 78750",
    "13062 Barhms Terrace, Austin, TX 78750",
    "13063 Barhms Terrace, Austin, TX 78750",
    "13064 Barhms Terrace, Austin, TX 78750",
    "13065 Barhms Terrace, Austin, TX 78750",
    "13066 Barhms Terrace, Austin, TX 78750",
    "13067 Barhms Terrace, Austin, TX 78750",
    "13068 Barhms Terrace, Austin, TX 78750",
    "13069 Barhms Terrace, Austin, TX 78750",
    "13070 Barhms Terrace, Austin, TX 78750",
    "13071 Barhms Terrace, Austin, TX 78750",
    "13072 Barhms Terrace, Austin, TX 78750",
    "13073 Barhms Terrace, Austin, TX 78750",
    "13074 Barhms Terrace, Austin, TX 78750",
    "13075 Barhms Terrace, Austin, TX 78750",
    "13076 Barhms Terrace, Austin, TX 78750",
    "13077 Barhms Terrace, Austin, TX 78750",
    "13078 Barhms Terrace, Austin, TX 78750",
    "13079 Barhms Terrace, Austin, TX 78750",
    "13080 Barhms Terrace, Austin, TX 78750",
    "13081 Barhms Terrace, Austin, TX 78750",
    "13082 Barhms Terrace, Austin, TX 78750",
    "13083 Barhms Terrace, Austin, TX 78750",
    "13084 Barhms Terrace, Austin, TX 78750",
    "13085 Barhms Terrace, Austin, TX 78750",
    "13086 Barhms Terrace, Austin, TX 78750",
    "13087 Barhms Terrace, Austin, TX 78750",
    "13088 Barhms Terrace, Austin, TX 78750",
    "13089 Barhms Terrace, Austin, TX 78750",
    "13090 Barhms Terrace, Austin, TX 78750",
    "13091 Barhms Terrace, Austin, TX 78750",
    "13092 Barhms Terrace, Austin, TX 78750",
    "13093 Barhms Terrace, Austin, TX 78750",
    "13094 Barhms Terrace, Austin, TX 78750",
    "13095 Barhms Terrace, Austin, TX 78750",
    "13096 Barhms Terrace, Austin, TX 78750",
    "13097 Barhms Terrace, Austin, TX 78750",
    "13098 Barhms Terrace, Austin, TX 78750",
    "13099 Barhms Terrace, Austin, TX 78750",
    "13100 Barhms Terrace, Austin, TX 78750",
    "13101 Barhms Terrace, Austin, TX 78750",
    "13102 Barhms Terrace, Austin, TX 78750",
    "13103 Barhms Terrace, Austin, TX 78750",
    "13104 Barhms Terrace, Austin, TX 78750",
    "13105 Barhms Terrace, Austin, TX 78750",
    "13106 Barhms Terrace, Austin, TX 78750",
    "13107 Barhms Terrace, Austin, TX 78750",
    "13108 Barhms Terrace, Austin, TX 78750",
    "13109 Barhms Terrace, Austin, TX 78750",
    "13110 Barhms Terrace, Austin, TX 78750",
    "13111 Barhms Terrace, Austin, TX 78750",
    "13112 Barhms Terrace, Austin, TX 78750",
    "13113 Barhms Terrace, Austin, TX 78750",
    "13114 Barhms Terrace, Austin, TX 78750",
    "13115 Barhms Terrace, Austin, TX 78750",
    "13116 Barhms Terrace, Austin, TX 78750",
    "13117 Barhms Terrace, Austin, TX 78750",
    "13118 Barhms Terrace, Austin, TX 78750",
    "13119 Barhms Terrace, Austin, TX 78750",
    "13120 Barhms Terrace, Austin, TX 78750",
    "13121 Barhms Terrace, Austin, TX 78750",
    "13122 Barhms Terrace, Austin, TX 78750",
    "13123 Barhms Terrace, Austin, TX 78750",
    "13124 Barhms Terrace, Austin, TX 78750",
    "13125 Barhms Terrace, Austin, TX 78750",
    "13126 Barhms Terrace, Austin, TX 78750",
    "13127 Barhms Terrace, Austin, TX 78750",
    "13128 Barhms Terrace, Austin, TX 78750",
    "13129 Barhms Terrace, Austin, TX 78750",
    "13130 Barhms Terrace, Austin, TX 78750",
    "13131 Barhms Terrace, Austin, TX 78750",
    "13132 Barhms Terrace, Austin, TX 78750",
    "13133 Barhms Terrace, Austin, TX 78750",
    "13134 Barhms Terrace, Austin, TX 78750",
    "13135 Barhms Terrace, Austin, TX 78750",
    "13136 Barhms Terrace, Austin, TX 78750",
    "13137 Barhms Terrace, Austin, TX 78750",
    "13138 Barhms Terrace, Austin, TX 78750",
    "13139 Barhms Terrace, Austin, TX 78750",
    "13140 Barhms Terrace, Austin, TX 78750",
    "13141 Barhms Terrace, Austin, TX 78750",
    "13142 Barhms Terrace, Austin, TX 78750",
    "13143 Barhms Terrace, Austin, TX 78750",
    "13144 Barhms Terrace, Austin, TX 78750",
    "13145 Barhms Terrace, Austin, TX 78750",
    "13146 Barhms Terrace, Austin, TX 78750",
    "13147 Barhms Terrace, Austin, TX 78750",
    "13148 Barhms Terrace, Austin, TX 78750",
    "13149 Barhms Terrace, Austin, TX 78750",
    "13150 Barhms Terrace, Austin, TX 78750",
    "13151 Barhms Terrace, Austin, TX 78750",
    "13152 Barhms Terrace, Austin, TX 78750",
    "13153 Barhms Terrace, Austin, TX 78750",
    "13154 Barhms Terrace, Austin, TX 78750",
    "13155 Barhms Terrace, Austin, TX 78750",
    "13156 Barhms Terrace, Austin, TX 78750",
    "13157 Barhms Terrace, Austin, TX 78750",
    "13158 Barhms Terrace, Austin, TX 78750",
    "13159 Barhms Terrace, Austin, TX 78750",
    "13160 Barhms Terrace, Austin, TX 78750",
    "13161 Barhms Terrace, Austin, TX 78750",
    "13162 Barhms Terrace, Austin, TX 78750",
    "13163 Barhms Terrace, Austin, TX 78750",
    "13164 Barhms Terrace, Austin, TX 78750",
    "13165 Barhms Terrace, Austin, TX 78750",
    "13166 Barhms Terrace, Austin, TX 78750",
    "13167 Barhms Terrace, Austin, TX 78750",
    "13168 Barhms Terrace, Austin, TX 78750",
    "13169 Barhms Terrace, Austin, TX 78750",
    "13170 Barhms Terrace, Austin, TX 78750",
    "13171 Barhms Terrace, Austin, TX 78750",
    "13172 Barhms Terrace, Austin, TX 78750",
    "13173 Barhms Terrace, Austin, TX 78750",
    "13174 Barhms Terrace, Austin, TX 78750",
    "13175 Barhms Terrace, Austin, TX 78750",
    "13176 Barhms Terrace, Austin, TX 78750",
    "13177 Barhms Terrace, Austin, TX 78750",
    "13178 Barhms Terrace, Austin, TX 78750",
    "13179 Barhms Terrace, Austin, TX 78750",
    "13180 Barhms Terrace, Austin, TX 78750",
    "13181 Barhms Terrace, Austin, TX 78750",
    "13182 Barhms Terrace, Austin, TX 78750",
    "13183 Barhms Terrace, Austin, TX 78750",
    "13184 Barhms Terrace, Austin, TX 78750",
    "13185 Barhms Terrace, Austin, TX 78750",
    "13186 Barhms Terrace, Austin, TX 78750",
    "13187 Barhms Terrace, Austin, TX 78750",
    "13188 Barhms Terrace, Austin, TX 78750",
    "13189 Barhms Terrace, Austin, TX 78750",
    "13190 Barhms Terrace, Austin, TX 78750",
    "13191 Barhms Terrace, Austin, TX 78750",
    "13192 Barhms Terrace, Austin, TX 78750",
    "13193 Barhms Terrace, Austin, TX 78750",
    "13194 Barhms Terrace, Austin, TX 78750",
    "13195 Barhms Terrace, Austin, TX 78750",
    "13196 Barhms Terrace, Austin, TX 78750",
    "13197 Barhms Terrace, Austin, TX 78750",
    "13198 Barhms Terrace, Austin, TX 78750",
    "13199 Barhms Terrace, Austin, TX 78750",
    "13200 Barhms Terrace, Austin, TX 78750"
  ];

  // Simulate API call with debouncing
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      // Only search if user has interacted with the input
      if (inputValue.length > 2 && hasUserInteracted) {
        setIsLoading(true);
        
        // Simulate API delay
        setTimeout(() => {
          const searchTerms = inputValue.toLowerCase().split(' ').filter(term => term.length > 0);
          
          // More flexible search - check if ANY search term matches (not ALL)
          const filtered = mockAddresses.filter(addr => {
            const addrLower = addr.toLowerCase();
            
            // If user types multiple words, check if ANY word matches
            if (searchTerms.length > 1) {
              return searchTerms.some(term => addrLower.includes(term));
            }
            
            // For single word searches, check if it's included
            return addrLower.includes(searchTerms[0]);
          });
          
          // Sort by relevance (exact matches first, then partial matches)
          const sorted = filtered.sort((a, b) => {
            const aLower = a.toLowerCase();
            const bLower = b.toLowerCase();
            const inputLower = inputValue.toLowerCase();
            
            // Exact match gets highest priority
            if (aLower.startsWith(inputLower)) return -1;
            if (bLower.startsWith(inputLower)) return 1;
            
            // Then sort by how early the match occurs
            const aIndex = aLower.indexOf(inputLower);
            const bIndex = bLower.indexOf(inputLower);
            
            if (aIndex !== bIndex) {
              return aIndex - bIndex;
            }
            
            // Finally, sort alphabetically
            return aLower.localeCompare(bLower);
          });
          
          // Debug logging
          console.log('Search input:', inputValue);
          console.log('Search terms:', searchTerms);
          console.log('Filtered results:', filtered.length);
          console.log('Top results:', sorted.slice(0, 3));
          
          setSuggestions(
            sorted.slice(0, 10).map(addr => ({
              description: addr,
              place_id: addr.replace(/\s+/g, '_').toLowerCase()
            }))
          );
          setIsLoading(false);
          setIsOpen(true);
        }, 300);
      } else {
        setSuggestions([]);
        setIsOpen(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [inputValue, hasUserInteracted]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    setHasUserInteracted(true);
    onChange(newValue);
  };

  const handleSuggestionClick = (suggestion: AddressSuggestion) => {
    setInputValue(suggestion.description);
    setHasUserInteracted(true);
    onChange(suggestion.description);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const handleFocus = () => {
    setHasUserInteracted(true);
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <div className="relative">
        <Input
          ref={ref || inputRef}
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          placeholder={placeholder}
          disabled={disabled}
          className="pr-10"
        />
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
          {isLoading ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
          ) : (
            <MapPin className="h-4 w-4 text-gray-400" />
          )}
        </div>
      </div>

      {/* Suggestions Dropdown */}
      {isOpen && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
          {suggestions.map((suggestion, index) => (
            <button
              key={suggestion.place_id}
              type="button"
              className="w-full px-4 py-2 text-left hover:bg-gray-100 focus:bg-gray-100 focus:outline-none flex items-center gap-2"
              onClick={() => handleSuggestionClick(suggestion)}
            >
              <MapPin className="h-4 w-4 text-gray-400 flex-shrink-0" />
              <span className="text-sm">{suggestion.description}</span>
            </button>
          ))}
        </div>
      )}

      {/* No suggestions message */}
      {isOpen && suggestions.length === 0 && inputValue.length > 2 && !isLoading && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg">
          <div className="px-4 py-2 text-sm text-gray-500">
            No addresses found. Please type a different address.
          </div>
        </div>
      )}
    </div>
  );
}); 