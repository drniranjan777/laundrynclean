import { useState, useMemo } from 'react';
import { HiOutlineSearch, HiX } from 'react-icons/hi';
import { CLOTH_ICONS, ICON_GROUPS, clothIcon } from './clothIcons';

/**
 * Picks an icon key from the cloth icon library. '' = no icon of its own; `autoIcon` / `autoLabel`
 * describe what is shown then (e.g. the icon guessed from the item's name).
 */
export default function ClothIconPicker({ value, onChange, autoIcon: AutoIcon, autoLabel = 'Automatic', emptyLabel = 'Auto', clearLabel = 'Use automatic', className = '' }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const selected = clothIcon(value);
  const Current = selected?.Icon || AutoIcon;

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matches = CLOTH_ICONS.filter(i => !q || `${i.label} ${i.key} ${i.group}`.toLowerCase().includes(q));
    return ICON_GROUPS.map(g => [g, matches.filter(i => i.group === g)]).filter(([, icons]) => icons.length);
  }, [search]);

  const pick = (key) => { onChange(key); setOpen(false); setSearch(''); };

  return (
    <div className={className}>
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-primary/15 text-secondary flex items-center justify-center flex-shrink-0">
          {Current && <Current className="w-7 h-7" />}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-700">{selected ? selected.label : autoLabel}</p>
          <p className="text-[11px] text-gray-400">{selected ? 'Chosen from the icon library' : 'No icon chosen; shown automatically'}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {selected && <button type="button" onClick={() => pick('')} className="text-xs text-gray-400 hover:text-red-500">{clearLabel}</button>}
          <button type="button" onClick={() => setOpen(!open)} className="px-3 py-1.5 border rounded-lg text-xs text-gray-600 hover:bg-gray-50" aria-expanded={open}>
            {open ? 'Close' : 'Choose icon'}
          </button>
        </div>
      </div>

      {open && (
        <div className="mt-3 border rounded-xl p-3 bg-gray-50" onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } }}>
          <div className="flex items-center gap-2 mb-3">
            <div className="relative flex-1">
              <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search icons, e.g. saree, curtain, shoes" className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm bg-white" aria-label="Search icons" />
            </div>
            <button type="button" onClick={() => setOpen(false)} className="p-2 text-gray-400 hover:text-gray-600" aria-label="Close icon library"><HiX className="w-4 h-4" /></button>
          </div>
          <div className="max-h-80 overflow-y-auto space-y-3 pr-1">
            {!search.trim() && (
              <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-8 gap-1.5">
                <IconButton label={emptyLabel} Icon={AutoIcon} active={!selected} onClick={() => pick('')} />
              </div>
            )}
            {groups.map(([group, icons]) => (
              <div key={group}>
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{group}</p>
                <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-8 gap-1.5">
                  {icons.map(i => <IconButton key={i.key} label={i.label} Icon={i.Icon} active={value === i.key} onClick={() => pick(i.key)} />)}
                </div>
              </div>
            ))}
            {groups.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No icons match “{search}”.</p>}
          </div>
        </div>
      )}
    </div>
  );
}

function IconButton({ label, Icon, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-pressed={active}
      className={`w-full flex flex-col items-center gap-1 rounded-lg border p-2 text-center bg-white hover:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary ${active ? 'border-secondary ring-1 ring-secondary' : 'border-gray-200'}`}
    >
      <span className="w-9 h-9 rounded-lg bg-primary/15 text-secondary flex items-center justify-center">{Icon && <Icon className="w-6 h-6" />}</span>
      <span className="text-[10px] leading-tight text-gray-600 line-clamp-2">{label}</span>
    </button>
  );
}
