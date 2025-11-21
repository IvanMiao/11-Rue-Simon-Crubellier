import React from 'react';
import { InventoryItem } from '../types';

interface InventoryPanelProps {
    items: InventoryItem[];
    onUseItem?: (item: InventoryItem) => void;
}

const InventoryPanel: React.FC<InventoryPanelProps> = ({ items, onUseItem }) => {
    if (items.length === 0) {
        return (
            <div className="p-4 border-t border-stone-300 bg-[#f4f1ea]">
                <h3 className="font-serif font-bold text-sm uppercase tracking-widest mb-2 text-stone-600">Inventory</h3>
                <p className="text-xs font-typewriter text-stone-400 italic">Your pockets are empty.</p>
            </div>
        );
    }

    return (
        <div className="p-4 border-t border-stone-300 bg-[#f4f1ea]">
            <h3 className="font-serif font-bold text-sm uppercase tracking-widest mb-3 text-stone-800">Inventory</h3>
            <div className="grid grid-cols-2 gap-2">
                {items.map((item) => (
                    <div
                        key={item.id}
                        className="p-2 border border-stone-300 bg-white hover:bg-stone-50 transition-colors cursor-pointer group"
                        onClick={() => onUseItem && onUseItem(item)}
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
        </div>
    );
};

export default InventoryPanel;
