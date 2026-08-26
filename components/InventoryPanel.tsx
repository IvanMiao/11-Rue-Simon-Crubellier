import React, { useState } from 'react';
import { InventoryItem } from '../types';
import StillLifeMark from './StillLifeMark';
import { stillLifeKind } from '../utils/roomArt';

interface InventoryPanelProps {
  items: InventoryItem[];
  onUseItem?: (item: InventoryItem) => void;
}

const InventoryPanel: React.FC<InventoryPanelProps> = ({ items, onUseItem }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="drawer transition-all duration-300">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-3.5 cursor-pointer flex items-center justify-between hover:bg-[#dfd2b6] select-none"
      >
        <div className="flex items-center gap-2">
          <h3 className="font-display text-lg tracking-wide text-[#2a2218]">口袋</h3>
          {items.length > 0 && (
            <span className="bg-[#2a2218] text-[#f4ead6] text-[10px] px-1.5 font-typewriter">
              {items.length}
            </span>
          )}
        </div>
        <span className="text-[#8a7c6a] text-[10px] font-typewriter uppercase tracking-widest">
          {isOpen ? '合上' : '拉开'}
        </span>
      </button>

      <div className={`overflow-hidden transition-all duration-500 ${isOpen ? 'max-h-96 opacity-100 pb-4' : 'max-h-0 opacity-0'}`}>
        <div className="px-4">
          {items.length === 0 ? (
            <p className="text-xs font-typewriter text-[#8a7c6a] italic text-center py-2">口袋是空的。</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {items.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className="pocket-card text-left"
                  onClick={() => onUseItem && onUseItem(item)}
                  title={item.description}
                >
                  <div className="flex items-start gap-2">
                    <StillLifeMark
                      kind={item.type === 'puzzle_piece' ? 'puzzle' : stillLifeKind(item.name)}
                      className="w-5 h-5 mt-0.5 text-[#4a3e30] shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="font-serif text-sm text-[#2a2218] truncate">{item.name}</div>
                      <div className="text-[10px] text-[#8a7c6a] truncate mt-0.5">{item.description}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InventoryPanel;
