import type { FormEvent } from 'react';
import type { SortOrder } from '../discovery';
import { ui } from './ui';

export type { SortOrder };

export interface FilterValues {
  make: string;
  model: string;
  category: string;
  minPrice: string;
  maxPrice: string;
  /** '' (any), 'in_stock' or 'out_of_stock'. */
  availability: string;
}

export const EMPTY_FILTERS: FilterValues = { make: '', model: '', category: '', minPrice: '', maxPrice: '', availability: '' };

interface FiltersProps {
  values: FilterValues;
  categories: string[];
  sort: SortOrder;
  onChange: (values: FilterValues) => void;
  onSortChange: (sort: SortOrder) => void;
  onApply: () => void;
  onClear: () => void;
  /** Shown under the price fields, e.g. for an inverted range. */
  priceError?: string | null;
}

/** Search and filter controls; the search itself runs on the backend. */
export function Filters({ values, categories, sort, onChange, onSortChange, onApply, onClear, priceError }: FiltersProps) {
  const set = (field: keyof FilterValues) => (event: { target: { value: string } }) =>
    onChange({ ...values, [field]: event.target.value });

  function submit(event: FormEvent) {
    event.preventDefault();
    onApply();
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
      <div>
        <label htmlFor="filter-make" className={ui.label}>Make</label>
        <input id="filter-make" className={ui.input} placeholder="e.g. Hyundai" value={values.make} onChange={set('make')} />
      </div>
      <div>
        <label htmlFor="filter-model" className={ui.label}>Model</label>
        <input id="filter-model" className={ui.input} placeholder="e.g. Creta" value={values.model} onChange={set('model')} />
      </div>
      <div>
        <label htmlFor="filter-category" className={ui.label}>Category</label>
        <select id="filter-category" className={ui.input} value={values.category} onChange={set('category')}>
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category} value={category}>{category}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="filter-availability" className={ui.label}>Availability</label>
        <select id="filter-availability" className={ui.input} value={values.availability} onChange={set('availability')}>
          <option value="">Any availability</option>
          <option value="in_stock">In stock</option>
          <option value="out_of_stock">Out of stock</option>
        </select>
      </div>
      <div>
        <label htmlFor="filter-min" className={ui.label}>Min price</label>
        <input id="filter-min" type="number" min="0" className={ui.input} placeholder="₹ min" value={values.minPrice} onChange={set('minPrice')} />
      </div>
      <div>
        <label htmlFor="filter-max" className={ui.label}>Max price</label>
        <input
          id="filter-max"
          type="number"
          min="0"
          className={ui.input}
          placeholder="₹ max"
          value={values.maxPrice}
          aria-invalid={priceError ? true : undefined}
          aria-describedby={priceError ? 'filter-price-error' : undefined}
          onChange={set('maxPrice')}
        />
      </div>
      <div>
        <label htmlFor="filter-sort" className={ui.label}>Sort by</label>
        <select id="filter-sort" className={ui.input} value={sort} onChange={(e) => onSortChange(e.target.value as SortOrder)}>
          <option value="featured">Featured</option>
          <option value="newest">Newest first</option>
          <option value="rating">Top rated</option>
          <option value="price-asc">Price: low to high</option>
          <option value="price-desc">Price: high to low</option>
          <option value="name">Name: A to Z</option>
        </select>
      </div>
      {priceError && (
        <p id="filter-price-error" className={`${ui.fieldError} sm:col-span-2 lg:col-span-4 xl:col-span-7`}>{priceError}</p>
      )}
      <div className="flex gap-3 sm:col-span-2 lg:col-span-4 lg:justify-end xl:col-span-7">
        <button type="button" className={`${ui.button} ${ui.secondary}`} onClick={onClear}>Clear filters</button>
        <button type="submit" className={`${ui.button} ${ui.primary}`}>Apply filters</button>
      </div>
    </form>
  );
}
