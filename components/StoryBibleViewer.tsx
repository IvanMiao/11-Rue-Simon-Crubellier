import React from 'react';
import { StoryBible } from '../types';

interface StoryBibleViewerProps {
    isOpen: boolean;
    onClose: () => void;
    bible?: StoryBible;
}

const StoryBibleViewer: React.FC<StoryBibleViewerProps> = ({ isOpen, onClose, bible }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-[#f4f1ea] w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded shadow-2xl border-4 border-stone-800 relative flex flex-col">

                {/* Header */}
                <div className="bg-stone-800 text-[#f4f1ea] p-6 flex justify-between items-start shrink-0">
                    <div>
                        <h2 className="font-serif text-3xl font-bold uppercase tracking-widest mb-2">The Archives</h2>
                        <p className="font-typewriter text-sm opacity-70">CLASSIFIED: Building History & Secrets</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-[#f4f1ea] hover:text-red-400 font-typewriter text-xl"
                    >
                        [X]
                    </button>
                </div>

                {/* Content */}
                <div className="p-8 md:p-12 space-y-12 overflow-y-auto">
                    {!bible ? (
                        <div className="text-center py-20">
                            <p className="font-typewriter text-stone-500 animate-pulse">Accessing restricted files...</p>
                        </div>
                    ) : (
                        <>
                            {/* Title & Mystery */}
                            <section className="text-center border-b-2 border-stone-300 pb-10">
                                <h1 className="font-serif text-4xl md:text-5xl font-bold text-stone-900 mb-6">{bible.title}</h1>
                                <div className="max-w-2xl mx-auto bg-stone-200 p-6 rounded-sm shadow-inner">
                                    <h3 className="font-typewriter text-xs font-bold uppercase text-stone-500 mb-2 tracking-widest">Central Mystery</h3>
                                    <p className="font-serif text-xl italic text-stone-800 leading-relaxed">"{bible.mystery}"</p>
                                </div>
                            </section>

                            {/* Themes & Threads */}
                            <div className="grid md:grid-cols-2 gap-12">
                                <section>
                                    <h3 className="font-typewriter text-lg font-bold uppercase border-b-2 border-stone-800 mb-6 pb-2">Recurring Themes</h3>
                                    <ul className="space-y-4">
                                        {bible.themes.map((theme, idx) => (
                                            <li key={idx} className="flex items-center gap-3">
                                                <span className="w-2 h-2 bg-stone-800 rounded-full"></span>
                                                <span className="font-serif text-lg text-stone-800">{theme}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </section>

                                <section>
                                    <h3 className="font-typewriter text-lg font-bold uppercase border-b-2 border-stone-800 mb-6 pb-2">Plot Threads</h3>
                                    <ul className="space-y-4">
                                        {bible.plot_threads.map((thread, idx) => (
                                            <li key={idx} className="flex items-start gap-3">
                                                <span className="font-typewriter text-stone-400 mt-1">#{idx + 1}</span>
                                                <span className="font-serif text-lg text-stone-800">{thread}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </section>
                            </div>

                            {/* Characters */}
                            <section>
                                <h3 className="font-typewriter text-lg font-bold uppercase border-b-2 border-stone-800 mb-8 pb-2">Key Residents</h3>
                                <div className="grid md:grid-cols-2 gap-6">
                                    {bible.key_characters.map((char, idx) => (
                                        <div key={idx} className="bg-white border border-stone-200 p-6 shadow-sm hover:shadow-md transition-shadow">
                                            <div className="flex justify-between items-start mb-4">
                                                <h4 className="font-serif text-xl font-bold text-stone-900">{char.name}</h4>
                                                <span className="font-typewriter text-xs bg-stone-100 px-2 py-1 rounded text-stone-600 uppercase">{char.role}</span>
                                            </div>
                                            <div className="text-sm font-typewriter text-stone-500 mb-1">SECRET:</div>
                                            <p className="font-serif text-stone-700 italic border-l-2 border-red-800 pl-3">{char.secret}</p>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="bg-stone-200 p-4 text-center font-typewriter text-xs text-stone-500 border-t border-stone-300 shrink-0">
                    CONFIDENTIAL // DO NOT DISTRIBUTE // 11 RUE SIMON-CRUBELLIER
                </div>
            </div>
        </div>
    );
};

export default StoryBibleViewer;
