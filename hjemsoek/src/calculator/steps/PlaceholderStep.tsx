import React from 'react';

interface Props { title: string; description?: string; onNext(): void; onBack(): void; children?: React.ReactNode; }

export const PlaceholderStep: React.FC<Props> = ({ title, description, onNext, onBack, children }) => (
  <div>
    <h2 className="text-lg font-semibold mb-3">{title}</h2>
    {description && <p className="text-xs opacity-70 mb-3">{description}</p>}
    <div className="p-3 border rounded bg-neutral-50 text-xs mb-4">Plassholder for "{title}"</div>
    {children}
    <div className="flex gap-2 mt-4">
      <button onClick={onBack} className="px-3 py-1 border rounded">Tilbake</button>
      <button onClick={onNext} className="px-3 py-1 bg-blue-600 text-white rounded">Neste</button>
    </div>
  </div>
);
