import React, { useState } from 'react';
import { InventoryItem } from '../types';

interface InventoryPanelProps {
    items: InventoryItem[];
    onUseItem?: (item: InventoryItem) => void;
}

const InventoryPanel: React.FC<InventoryPanelProps> = ({ items, onUseItem }) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="border-t border-stone-300 bg-[#f4f1ea] transition-all duration-300 ease-in-out shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
             {/* Header - always visible, acts as toggle */}
            <div
                onClick={() => setIsOpen(!isOpen)}
                className="p-4 cursor-pointer flex items-center justify-between hover:bg-[#ece8df] select-none group"
            >
                <div className="flex items-center gap-2">
                    <h3 className="font-serif font-bold text-sm uppercase tracking-widest text-stone-800 group-hover:text-stone-600 transition-colors">
                        Inventory
                    </h3>
                    {items.length > 0 && (
                        <span className="bg-stone-800 text-white text-[10px] px-1.5 rounded-sm font-typewriter">
                            {items.length}
                        </span>
                    )}
                </div>
                <span className="text-stone-400 text-[10px] font-typewriter uppercase tracking-widest group-hover:text-stone-600">
                    {isOpen ? 'Close [▼]' : 'Open [▲]'}
                </span>
            </div>

            {/* Content - Collapsible */}
            <div className={`overflow-hidden transition-all duration-500 ease-in-out ${isOpen ? 'max-h-96 opacity-100 pb-4' : 'max-h-0 opacity-0'}`}>
                <div className="px-4">
                    {items.length === 0 ? (
                        <p className="text-xs font-typewriter text-stone-400 italic text-center py-2">Your pockets are empty.</p>
                    ) : (
                        <div className="grid grid-cols-2 gap-2">
                            {items.map((item) => (
                                <div
                                    key={item.id}
                                    className="p-2 border border-stone-300 bg-white hover:bg-stone-50 transition-colors cursor-pointer group"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onUseItem && onUseItem(item);
                                    }}
                                    title={item.description}
                                >
                                    <div className="font-typewriter text-xs font-bold text-stone-800 group-hover:text-stone-600">
                                        {item.name}
                                    </div>
                                    <div className="text-[10px] text-stone-500 truncate mt-1">
                                        {item.description}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default InventoryPanel;
