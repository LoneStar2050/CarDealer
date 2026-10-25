import { useState, type FormEvent } from 'react';
import type { Vehicle, VehicleInput } from '../api';
import { Dialog, Spinner, ui } from './ui';

type FormErrors = Partial<Record<keyof VehicleInput, string>>;

/** Client-side checks that mirror the backend rules, for immediate feedback. */
function validateVehicle(form: Record<keyof VehicleInput, string>): FormErrors {
  const errors: FormErrors = {};
  if (!form.make.trim()) errors.make = 'Make is required';
  if (!form.model.trim()) errors.model = 'Model is required';
  if (!form.category.trim()) errors.category = 'Category is required';
  const price = Number(form.price);
  if (form.price.trim() === '' || !Number.isFinite(price) || price < 0) errors.price = 'Enter a price of 0 or more';
  const quantity = Number(form.quantity);
  if (form.quantity.trim() === '' || !Number.isInteger(quantity) || quantity < 0) {
    errors.quantity = 'Enter a whole number of 0 or more';
  }
  return errors;
}

interface VehicleFormDialogProps {
  vehicle: Vehicle | null; // null = add a new vehicle
  categories: string[];
  onSave: (input: VehicleInput) => Promise<boolean>;
  onClose: () => void;
}

/** Add or edit a vehicle. */
export function VehicleFormDialog({ vehicle, categories, onSave, onClose }: VehicleFormDialogProps) {
  const [form, setForm] = useState({
    make: vehicle?.make ?? '',
    model: vehicle?.model ?? '',
    category: vehicle?.category ?? '',
    price: vehicle ? String(vehicle.price) : '',
    quantity: vehicle ? String(vehicle.quantity) : '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const found = validateVehicle(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setSaving(true);
    const saved = await onSave({
      make: form.make.trim(),
      model: form.model.trim(),
      category: form.category.trim(),
      price: Number(form.price),
      quantity: Number(form.quantity),
    });
    if (!saved) setSaving(false);
  }

  const field = (name: keyof VehicleInput, label: string, props: Record<string, string> = {}) => (
    <div>
      <label htmlFor={`vehicle-${name}`} className={ui.label}>{label}</label>
      <input
        id={`vehicle-${name}`}
        className={ui.input}
        value={form[name]}
        aria-invalid={Boolean(errors[name])}
        aria-describedby={errors[name] ? `vehicle-${name}-error` : undefined}
        onChange={(e) => {
          setForm({ ...form, [name]: e.target.value });
          if (errors[name]) setErrors({ ...errors, [name]: undefined });
        }}
        {...props}
      />
      {errors[name] && <p id={`vehicle-${name}-error`} className={ui.fieldError}>{errors[name]}</p>}
    </div>
  );

  return (
    <Dialog title={vehicle ? 'Edit vehicle' : 'Add vehicle'} onClose={onClose}>
      <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
        {field('make', 'Make', { autoFocus: 'true' })}
        {field('model', 'Model')}
        {field('category', 'Category', { list: 'vehicle-categories', placeholder: 'e.g. SUV' })}
        <datalist id="vehicle-categories">
          {categories.map((c) => <option key={c} value={c} />)}
        </datalist>
        {field('price', 'Price (₹)', { type: 'number', min: '0', step: '1' })}
        {field('quantity', 'Quantity', { type: 'number', min: '0', step: '1' })}
        <div className="flex justify-end gap-3 sm:col-span-2">
          <button type="button" className={`${ui.button} ${ui.secondary}`} onClick={onClose}>Cancel</button>
          <button type="submit" className={`${ui.button} ${ui.primary}`} disabled={saving}>
            {saving && <Spinner />} Save vehicle
          </button>
        </div>
      </form>
    </Dialog>
  );
}

/** Add stock to a vehicle. */
export function RestockDialog({ vehicle, onRestock, onClose }: {
  vehicle: Vehicle;
  onRestock: (quantity: number) => Promise<boolean>;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const quantity = Number(amount);
    if (!Number.isInteger(quantity) || quantity < 1) {
      setError('Enter a whole number of 1 or more');
      return;
    }
    setSaving(true);
    if (!(await onRestock(quantity))) setSaving(false);
  }

  return (
    <Dialog title={`Restock ${vehicle.make} ${vehicle.model}`} onClose={onClose}>
      <form onSubmit={submit} noValidate className="space-y-4">
        <p className="text-sm text-slate-600">Currently in stock: <strong>{vehicle.quantity}</strong></p>
        <div>
          <label htmlFor="restock-amount" className={ui.label}>Quantity to add</label>
          <input id="restock-amount" type="number" min="1" step="1" autoFocus className={ui.input} value={amount}
            aria-invalid={Boolean(error)} onChange={(e) => { setAmount(e.target.value); setError(''); }} />
          {error && <p className={ui.fieldError}>{error}</p>}
        </div>
        <div className="flex justify-end gap-3">
          <button type="button" className={`${ui.button} ${ui.secondary}`} onClick={onClose}>Cancel</button>
          <button type="submit" className={`${ui.button} ${ui.primary}`} disabled={saving}>{saving && <Spinner />} Restock</button>
        </div>
      </form>
    </Dialog>
  );
}

/** Confirmation before deleting a vehicle. */
export function DeleteDialog({ vehicle, onConfirm, onClose }: {
  vehicle: Vehicle;
  onConfirm: () => Promise<boolean>;
  onClose: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  return (
    <Dialog title="Delete vehicle?" onClose={onClose}>
      <p className="text-slate-600">
        <strong>{vehicle.make} {vehicle.model}</strong> will be permanently removed from the inventory.
      </p>
      <div className="mt-6 flex justify-end gap-3">
        <button type="button" className={`${ui.button} ${ui.secondary}`} onClick={onClose}>Cancel</button>
        <button
          type="button"
          className={`${ui.button} ${ui.danger}`}
          disabled={deleting}
          onClick={async () => {
            setDeleting(true);
            if (!(await onConfirm())) setDeleting(false);
          }}
        >
          {deleting && <Spinner />} Delete
        </button>
      </div>
    </Dialog>
  );
}
