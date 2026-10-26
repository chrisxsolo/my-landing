import {
  ALL, SORTS, activeFilterCount, type FacetOption, type LocationFilters as Filters, type SortValue,
} from "@/lib/locationLibrary/publicFilters";

interface Facets {
  regions: FacetOption[];
  environments: FacetOption[];
  kinds: FacetOption[];
}

function FacetSelect({
  id, label, allLabel, value, options, onChange,
}: {
  id: string;
  label: string;
  allLabel: string;
  value: string;
  options: FacetOption[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="loc-select-wrap">
      <label className="loc-label" htmlFor={id}>{label}</label>
      <select id={id} className="loc-select" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value={ALL}>{allLabel}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label} ({o.count})</option>
        ))}
      </select>
    </div>
  );
}

export default function LocationFilters({
  filters, sort, facets, shown, onChange, onSort, onReset,
}: {
  filters: Filters;
  sort: SortValue;
  facets: Facets;
  shown: number;
  onChange: (next: Filters) => void;
  onSort: (sort: SortValue) => void;
  onReset: () => void;
}) {
  const active = activeFilterCount(filters);
  return (
    <div className="loc-toolbar" data-reveal>
      <div className="loc-toolbar-grid">
        <div>
          <label className="loc-label" htmlFor="loc-search">Search locations</label>
          <div className="loc-search">
            <span aria-hidden="true">🔎</span>
            <input
              id="loc-search"
              type="search"
              value={filters.query}
              onChange={(e) => onChange({ ...filters, query: e.target.value })}
              placeholder="Search Baker, beach, redwoods, SF, San Jose..."
            />
          </div>
        </div>
        <div className="loc-count" aria-live="polite">
          <p className="loc-count-label">Showing</p>
          <p className="loc-count-num">{shown}</p>
          <p className="loc-count-note">{active ? "matches" : "spots"}</p>
        </div>
      </div>

      <div className="loc-filters">
        <FacetSelect id="loc-region" label="Region" allLabel="All locations" value={filters.region}
          options={facets.regions} onChange={(region) => onChange({ ...filters, region })} />
        <FacetSelect id="loc-env" label="Environment" allLabel="All environments" value={filters.environment}
          options={facets.environments} onChange={(environment) => onChange({ ...filters, environment })} />
        <FacetSelect id="loc-kind" label="Photography type" allLabel="All types" value={filters.kind}
          options={facets.kinds} onChange={(kind) => onChange({ ...filters, kind })} />
        <div className="loc-select-wrap">
          <label className="loc-label" htmlFor="loc-sort">Sort</label>
          <select id="loc-sort" className="loc-select" value={sort} onChange={(e) => onSort(e.target.value as SortValue)}>
            {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>

      {active > 0 ? (
        <div className="loc-filter-foot">
          <p className="loc-active-note">{active} filter{active === 1 ? "" : "s"} on</p>
          <button type="button" className="loc-reset" onClick={onReset}>Clear filters</button>
        </div>
      ) : null}
    </div>
  );
}
