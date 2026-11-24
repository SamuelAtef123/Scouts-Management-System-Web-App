import { Phone } from 'lucide-react';
import { t as tr } from '../i18n.jsx';

/** Egyptian mobile field (+20): digits only, 11 digits starting with 010, 011, 012 or 015. */
export default function PhoneInput({ value, onChange, required, autoFocus }) {
  return (
    <div className="input-icon phone-input" dir="ltr">
      <Phone size={18} />
      <span className="phone-code" aria-hidden="true">
        +20
      </span>
      <input
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        placeholder="01001234567"
        maxLength={11}
        pattern="01[0125][0-9]{8}"
        title={tr('Egyptian mobile number of 11 digits, e.g. 01001234567')}
        dir="ltr"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 11))}
        required={required}
        autoFocus={autoFocus}
      />
    </div>
  );
}
